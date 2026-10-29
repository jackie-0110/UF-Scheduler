import rawCoords from "../../data/buildingCoords.json";
import { Section } from "../CourseUI/CourseTypes";

type Building = { name: string; lat: number; lng: number };

const coords = (rawCoords as {
  features: Record<string, { properties: { PropName: string; Latitude: number; Longitude: number } }>;
}).features;

// Section meetings use zero-padded building numbers, e.g. "0042"
export const findBuilding = (code: string): Building | null => {
  const feature = coords[String(code ?? "").replace(/^0+/, "")];
  if (!feature) return null;
  const { PropName, Latitude, Longitude } = feature.properties;
  return { name: PropName.replace(/\s+/g, " ").trim(), lat: Latitude, lng: Longitude };
};

const metersBetween = (a: Building, b: Building) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};

// Paths aren't straight lines, so pad the distance; ~80 m/min is a normal walk
const DETOUR = 1.3;
const METERS_PER_MINUTE = 80;
export const walkMinutes = (a: Building, b: Building) =>
  Math.max(1, Math.round((metersBetween(a, b) * DETOUR) / METERS_PER_MINUTE));

// Breaks longer than this aren't a rush, so they aren't listed
const MAX_BREAK = 30;
const SPARE = 3;

export type Walk = {
  days: string[];
  from: { course: string; building: string; end: string; place: Building };
  to: { course: string; building: string; begin: string; place: Building };
  minutes: number;
  gap: number;
  tight: boolean;
};

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

type Meeting = { course: string; building: string; code: string; begin: string; end: string };

export const findWalks = (combination: Section[]): Walk[] => {
  const byDay: Record<string, Meeting[]> = {};
  for (const section of combination) {
    if (!section.courseCode) continue;
    for (const meet of section.meetTimes ?? []) {
      for (const day of meet.meetDays) {
        (byDay[day] = byDay[day] || []).push({
          course: section.courseCode,
          building: meet.meetBuilding,
          code: meet.meetBldgCode,
          begin: meet.meetTimeBegin,
          end: meet.meetTimeEnd,
        });
      }
    }
  }

  // The same walk usually repeats on MWF or TR, so group it by day
  const walks = new Map<string, Walk>();
  for (const day of ["M", "T", "W", "R", "F", "S"]) {
    const meetings = (byDay[day] || []).sort((a, b) => toMinutes(a.begin) - toMinutes(b.begin));
    for (let i = 1; i < meetings.length; i++) {
      const prev = meetings[i - 1];
      const next = meetings[i];
      const gap = toMinutes(next.begin) - toMinutes(prev.end);
      if (gap < 0 || gap > MAX_BREAK || prev.code === next.code) continue;
      const a = findBuilding(prev.code);
      const b = findBuilding(next.code);
      if (!a || !b) continue;

      const key = [prev.course, prev.end, next.course, next.begin].join("|");
      const existing = walks.get(key);
      if (existing) {
        existing.days.push(day);
        continue;
      }
      const minutes = walkMinutes(a, b);
      walks.set(key, {
        days: [day],
        from: { course: prev.course, building: prev.building, end: prev.end, place: a },
        to: { course: next.course, building: next.building, begin: next.begin, place: b },
        minutes,
        gap,
        tight: minutes + SPARE > gap,
      });
    }
  }
  return Array.from(walks.values());
};

export const directionsUrl = (a: Building, b: Building) =>
  `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}` +
  `&destination=${b.lat},${b.lng}&travelmode=walking`;
