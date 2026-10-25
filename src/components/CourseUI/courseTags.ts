import { Course } from "./CourseTypes";

const titleCase = (text: string) =>
  text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Quest, Gen Ed and writing designations, collected across a course's sections
export const getCourseTags = (course: Course): string[] => {
  const quest = new Set<string>();
  const genEd = new Set<string>();
  let writing = 0;
  for (const section of course.sections ?? []) {
    section.quest?.forEach((q) => quest.add(titleCase(q.trim())));
    section.genEd?.forEach((g) => genEd.add(g.trim()));
    const words = Number(section.grWriting);
    if (words > writing) writing = words;
  }
  return [
    ...Array.from(quest).sort(),
    ...Array.from(genEd).sort(),
    ...(writing ? [`Writing ${writing}k`] : []),
  ].filter(Boolean);
};
