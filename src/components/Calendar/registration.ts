import { Course, MeetingTime, Section } from "../CourseUI/CourseTypes";
import { sectionsOverlap } from "./calendarConflictUtils";
import { sectionRating } from "./scheduleSort";

export type CartRow = {
  section: Section;
  backups: Section[];
  // sections that would fit, before trimming to the shortlist
  fits: number;
};

const MAX_BACKUPS = 3;

const startOf = (section: Section) =>
  Math.min(
    ...(section.meetTimes ?? []).map((m) => {
      const [h, min] = m.meetTimeBegin.split(":").map(Number);
      return h * 60 + min;
    }),
    Infinity
  );

// For each course in the schedule, the other sections that still fit around
// everything else. Courses with the fewest fallbacks come first, since those
// are the seats to grab first.
export const buildCart = (combination: Section[], courses: Course[]): CartRow[] => {
  const rows = combination
    .filter((section) => section.courseCode)
    .map((section) => {
      const others = combination.filter((other) => other !== section);
      const course = courses.find((c) => c.code === section.courseCode);
      const candidates = (course?.sections ?? []).filter(
        (s) =>
          s.classNumber !== section.classNumber &&
          !s.excluded &&
          others.every((other) => !sectionsOverlap(s, other))
      );
      const start = startOf(section);
      candidates.sort(
        (a, b) =>
          sectionRating(b) - sectionRating(a) ||
          Math.abs(startOf(a) - start) - Math.abs(startOf(b) - start)
      );
      return { section, backups: candidates.slice(0, MAX_BACKUPS), fits: candidates.length };
    });
  return rows.sort((a, b) => a.fits - b.fits);
};

const to12h = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}`;
};

const meetingText = (m: MeetingTime) =>
  `${m.meetDays.join("")} ${to12h(m.meetTimeBegin)}–${to12h(m.meetTimeEnd)}` +
  (m.meetBuilding ? ` · ${m.meetBuilding} ${m.meetRoom}` : "");

// With `compareTo`, meetings both sections share (usually the big lecture)
// are folded into "Same lecture" so the difference stands out
export const meetingSummary = (section: Section, compareTo?: Section) => {
  if (!section.meetTimes?.length) return "Online · no set time";
  const shared = new Set((compareTo?.meetTimes ?? []).map(meetingText));
  const own = section.meetTimes.map(meetingText);
  const differing = own.filter((text) => !shared.has(text));
  if (!compareTo || differing.length === own.length) return own.join(", ");
  if (!differing.length) return "Same times";
  return `Same lecture, ${differing.join(", ")}`;
};
