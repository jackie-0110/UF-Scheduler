import { API_BASE_URL } from "../../config/api";
import { authHeaders } from "../../account/account";

// Each account has one calendar feed the student subscribes to once; every
// change to their pinned schedule is pushed to it.

export type FeedEvent = {
  uid: string;
  title: string;
  location: string;
  start: string; // 20260824T093500
  end: string;
  until: string; // 20261204
  days: string; // MO,WE,FR
};

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const hms = (time: string) => {
  const [h = "0", m = "0"] = time.split(":");
  return `${pad(Number(h))}${pad(Number(m))}00`;
};
// MM/DD/YYYY from the course data
const parseDay = (value?: string) => {
  const parts = value?.split("/") ?? [];
  if (parts.length !== 3) return null;
  const date = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
  return Number.isNaN(date.valueOf()) ? null : date;
};

/**
 * One repeating event per meeting time, e.g. MWF 9:35 instead of three
 * separate weekly events. Appointments are the ones drawn on the week grid.
 */
export const toFeedEvents = (appointments: any[], termId: string): FeedEvent[] => {
  const groups = new Map<string, { a: any; days: Set<number> }>();
  for (const a of appointments) {
    if (!a?.startDate || !a?.endDate) continue;
    const [date, startTime] = String(a.startDate).split("T");
    const endTime = String(a.endDate).split("T")[1];
    if (!date || !startTime || !endTime) continue;
    const [y, m, d] = date.split("-").map(Number);
    const weekday = new Date(y, m - 1, d).getDay();
    const key = [a.title, a.location, startTime, endTime, a.firstDay, a.lastDay].join("|");
    const group = groups.get(key) ?? { a, days: new Set<number>() };
    group.days.add(weekday);
    groups.set(key, group);
  }

  const events: FeedEvent[] = [];
  for (const { a, days } of Array.from(groups.values())) {
    const first = parseDay(a.firstDay);
    const last = parseDay(a.lastDay);
    if (!first || !last || last < first) continue;
    // DTSTART has to be the first real class day
    const begin = new Date(first);
    while (!days.has(begin.getDay())) begin.setDate(begin.getDate() + 1);
    const startTime = String(a.startDate).split("T")[1];
    const endTime = String(a.endDate).split("T")[1];
    const dayList = Array.from(days).sort().map((n) => BYDAY[n]).join(",");
    const title = a.courseName ? `${a.title} ${a.courseName}` : String(a.title);
    events.push({
      uid: `${termId}-${a.title}-${dayList}-${hms(startTime)}`.replace(/[^A-Za-z0-9-]/g, ""),
      title,
      location: String(a.location ?? "").trim(),
      start: `${ymd(begin)}T${hms(startTime)}`,
      end: `${ymd(begin)}T${hms(endTime)}`,
      until: ymd(last),
      days: dayList,
    });
  }
  return events;
};

export const syncFeed = async (session: string, year: string, term: string, appointments: any[]) => {
  const response = await fetch(`${API_BASE_URL}/api/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(session) },
    body: JSON.stringify({ year, term, events: toFeedEvents(appointments, `${year}${term}`) }),
  });
  if (!response.ok) throw new Error(`calendar sync ${response.status}`);
  return (await response.json()).feed as string;
};

export const resetFeed = async (session: string) => {
  const response = await fetch(`${API_BASE_URL}/api/calendar/reset`, { method: "POST", headers: authHeaders(session) });
  if (!response.ok) throw new Error(`calendar reset ${response.status}`);
  return (await response.json()).feed as string;
};

export const feedLinks = (feed: string) => {
  const https = `${API_BASE_URL}/cal/${feed}.ics`;
  const webcal = https.replace(/^https?:/, "webcal:");
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent("UF Classes")}`,
  };
};
