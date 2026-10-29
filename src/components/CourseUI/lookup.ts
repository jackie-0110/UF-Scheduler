import { sectionsOverlap } from "../Calendar/calendarConflictUtils";
import { CourseGroups, formatCode } from "../Cytoscape/prereqs";
import { Section } from "./CourseTypes";

export type SectionFit =
  | { kind: "fits" }
  | { kind: "clash"; with: string }
  | { kind: "online" }
  | { kind: "none" }; // no schedule picked yet, or this course is already in it

// The schedule the student pinned with "Select" for this term
export const readPinnedSchedule = (term: string, year: string): Section[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(`selectedCalendar_${term}_${year}`) || "null");
    return Array.isArray(stored?.combination) ? stored.combination : [];
  } catch {
    return [];
  }
};

const label = (section: Section) =>
  section.courseCode ? formatCode(section.courseCode) : section.courseName || "an event";

export const sectionFit = (section: Section, courseCode: string, schedule: Section[]): SectionFit => {
  // compare against everything except this same course, so swapping sections works
  const others = schedule.filter((s) => s.courseCode !== courseCode);
  if (!others.length) return { kind: "none" };
  if (!section.meetTimes?.length) return { kind: "online" };
  const clash = others.find((other) => sectionsOverlap(section, other));
  return clash ? { kind: "clash", with: label(clash) } : { kind: "fits" };
};

// "CHM 1025 or CHM 2045" per unmet group
export const describeMissing = (missing: CourseGroups) =>
  missing.map((group) => group.map(formatCode).join(" or "));
