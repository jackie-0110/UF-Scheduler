import { Section } from "../CourseUI/CourseTypes";

export const DAYS = ["M", "T", "W", "R", "F"] as const;
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// One meeting as [days, start, end, place], e.g. ["MWF", "10:40", "11:30", "CAR 0100"]
type SharedMeeting = [string, string, string, string];

export type SharedClass = {
  code: string; // empty for personal events, which share as plain "Busy"
  name: string;
  classNumber: string;
  meets: SharedMeeting[];
};

export type SharedSchedule = {
  v: 1;
  name: string;
  term: string;
  year: string;
  classes: SharedClass[];
};

export const toShared = (
  name: string,
  term: string,
  year: string,
  combination: Section[]
): SharedSchedule => ({
  v: 1,
  name: name.trim(),
  term,
  year,
  classes: combination.map((section) => ({
    code: section.courseCode || "",
    name: section.courseCode ? section.courseName : "Busy",
    // the API sends class numbers as numbers despite the type
    classNumber: section.courseCode ? String(section.classNumber) : "",
    meets: (section.meetTimes ?? []).map((m) => [
      m.meetDays.join(""),
      m.meetTimeBegin,
      m.meetTimeEnd,
      m.meetBuilding ? `${m.meetBuilding} ${m.meetRoom}` : "",
    ]),
  })),
});

// base64url so the whole schedule fits in a link with no server
export const encodeSchedule = (schedule: SharedSchedule) => {
  // percent-encode first so names with accents survive btoa
  const binary = encodeURIComponent(JSON.stringify(schedule)).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const decodeSchedule = (text: string): SharedSchedule | null => {
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const json = decodeURIComponent(
      Array.from(binary, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    );
    const data = JSON.parse(json);
    if (data?.v !== 1 || !Array.isArray(data.classes) || typeof data.name !== "string") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const shareLink = (schedule: SharedSchedule) =>
  `${window.location.origin}${window.location.pathname}#friend=${encodeSchedule(schedule)}`;

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export type Block = { start: number; end: number };

// Busy blocks per weekday, merged and sorted
export const busyByDay = (classes: SharedClass[]): Block[][] =>
  DAYS.map((day) => {
    const blocks = classes
      .flatMap((c) => c.meets)
      .filter(([days]) => days.includes(day))
      .map(([, start, end]) => ({ start: toMinutes(start), end: toMinutes(end) }))
      .sort((a, b) => a.start - b.start);
    const merged: Block[] = [];
    for (const block of blocks) {
      const last = merged[merged.length - 1];
      if (last && block.start <= last.end) last.end = Math.max(last.end, block.end);
      else merged.push({ ...block });
    }
    return merged;
  });

export const DAY_START = 8 * 60;
export const DAY_END = 18 * 60;
const MIN_FREE = 30;

// Windows of at least 30 min in the school day when neither of you has class
export const freeTogether = (mine: Block[], theirs: Block[]): Block[] => {
  const busy = [...mine, ...theirs].sort((a, b) => a.start - b.start);
  const free: Block[] = [];
  let cursor = DAY_START;
  for (const block of busy) {
    if (block.start - cursor >= MIN_FREE) free.push({ start: cursor, end: Math.min(block.start, DAY_END) });
    cursor = Math.max(cursor, block.end);
    if (cursor >= DAY_END) break;
  }
  if (DAY_END - cursor >= MIN_FREE) free.push({ start: cursor, end: DAY_END });
  return free.filter((b) => b.end - b.start >= MIN_FREE);
};

export type SharedCourse = {
  code: string;
  name: string;
  sameSection: boolean;
  classNumber: string; // theirs
};

export const sharedCourses = (mine: SharedClass[], theirs: SharedClass[]): SharedCourse[] =>
  theirs
    .filter((t) => t.code)
    .flatMap((t) => {
      const match = mine.find((m) => m.code === t.code);
      if (!match) return [];
      return [
        {
          code: t.code,
          name: t.name,
          sameSection: String(match.classNumber) === String(t.classNumber),
          classNumber: t.classNumber,
        },
      ];
    });

export const formatMinutes = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  const h12 = hour % 12 || 12;
  return min ? `${h12}:${String(min).padStart(2, "0")}` : `${h12}`;
};

export const formatBlock = (block: Block) => {
  const suffix = (m: number) => (m >= 12 * 60 ? "pm" : "am");
  const sameHalf = suffix(block.start) === suffix(block.end);
  return `${formatMinutes(block.start)}${sameHalf ? "" : suffix(block.start)}–${formatMinutes(
    block.end
  )}${suffix(block.end)}`;
};

// Saved friends live on this device only
const FRIENDS_KEY = "friendSchedules";

export const loadFriends = (): SharedSchedule[] => {
  try {
    const list = JSON.parse(localStorage.getItem(FRIENDS_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const saveFriends = (list: SharedSchedule[]) =>
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(list));

// Same name + term replaces the older copy
export const upsertFriend = (list: SharedSchedule[], friend: SharedSchedule) => [
  friend,
  ...list.filter(
    (f) => !(f.name === friend.name && f.term === friend.term && f.year === friend.year)
  ),
];
