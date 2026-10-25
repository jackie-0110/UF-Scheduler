import type { MeetingTime, Section } from "../CourseUI/CourseTypes";

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const meetingsOverlap = (a: MeetingTime, b: MeetingTime) =>
  a.meetDays.some(
    (day) =>
      b.meetDays.includes(day) &&
      toMinutes(a.meetTimeBegin) < toMinutes(b.meetTimeEnd) &&
      toMinutes(b.meetTimeBegin) < toMinutes(a.meetTimeEnd)
  );

export const sectionsOverlap = (a: Section, b: Section) =>
  !!a.meetTimes?.length &&
  !!b.meetTimes?.length &&
  a.meetTimes.some((x) => b.meetTimes.some((y) => meetingsOverlap(x, y)));

// Every section of one course clashes with every section of the other
const alwaysClash = (a: Section[], b: Section[]) => {
  const timedA = a.filter((s) => s.meetTimes?.length);
  const timedB = b.filter((s) => s.meetTimes?.length);
  if (!timedA.length || !timedB.length) return false;
  return timedA.every((x) => timedB.every((y) => sectionsOverlap(x, y)));
};

export const groupLabel = (sections: Section[]) => {
  const s = sections[0];
  if (!s) return "Course";
  return s.courseCode
    ? s.courseCode.replace(/([A-Z]+)/g, "$1 ").trim()
    : s.courseName || "Event";
};

export type ClashPair = { a: string; b: string };

// Pairs of courses (or events) that can never be taken together
export const findClashPairs = (groups: Section[][]): ClashPair[] => {
  const pairs: ClashPair[] = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      if (alwaysClash(groups[i], groups[j])) {
        pairs.push({ a: groupLabel(groups[i]), b: groupLabel(groups[j]) });
      }
    }
  }
  return pairs;
};
