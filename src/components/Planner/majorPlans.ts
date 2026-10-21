import fullTables from "../../data/fullTables.json";
import { PrereqMap } from "../Cytoscape/prereqs";
import { newItemId, PlanItem, PlanSemester } from "./plannerLogic";

type Row = { [column: string]: string | null };
const tables = fullTables as unknown as Record<string, Row[]>;

const CODE_RE = /^[A-Z]{3}\d{4}[A-Z]?$/;
const SEMESTER_NAMES = ["two", "three", "four", "five", "six", "seven", "eight"];

export const majorNames = Object.keys(tables)
  .map((name) => name.trim())
  .sort((a, b) => a.localeCompare(b));

const tableFor = (major: string) =>
  tables[major] ?? tables[Object.keys(tables).find((key) => key.trim() === major) ?? ""] ?? [];

/** "3", "0-3" -> 3. Takes the larger number of a range. */
const parseCredits = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const numbers = String(raw).match(/\d+/g);
  return numbers ? Math.max(...numbers.map(Number)) : null;
};

/** The catalog sometimes lists COP3502C where the model plan says COP 3502. */
const resolveCode = (code: string, info: PrereqMap) =>
  info[code] ? code : info[`${code}C`] ? `${code}C` : code;

let placeholderCount = 0;

/**
 * Turns a major's model semester plan into plan items for each of the eight semesters.
 * Rows with a course code become real courses; everything else ("Quest 1", "Elective",
 * "State Core Gen Ed ...") becomes a requirement card with its credits. Summer terms are
 * folded into the following semester because the planner only has fall and spring.
 */
export function buildMajorPlan(major: string, info: PrereqMap, planSemesters: PlanSemester[]): PlanItem[][] {
  // Model-plan semesters 1..8 are the fall/spring columns; "Summer After Semester N" goes to
  // the summer column that follows semester N when the planner has one.
  const regular = planSemesters
    .map((semester, position) => ({ semester, position }))
    .filter(({ semester }) => !semester.summer)
    .map(({ position }) => position);
  const semesterCount = regular.length;
  const slots: PlanItem[][] = Array.from({ length: planSemesters.length }, () => []);
  const summerAfter = (n: number): number | null => {
    const next = planSemesters[regular[n - 1] + 1];
    return next?.summer ? regular[n - 1] + 1 : null;
  };
  let index = 0;
  let summerSlot: number | null = null;

  tableFor(major).forEach((row) => {
    const first = (row["Semester One"] ?? row["First Year"] ?? "").toString().replace(/ /g, " ").trim();
    const second = (row["Semester One.1"] ?? row["First Year.1"] ?? "").toString().replace(/ /g, " ").trim();
    const creditText = row["Credits"];

    const semesterMatch = first.match(/^Semester (\w+)$/i);
    if (semesterMatch) {
      const position = SEMESTER_NAMES.indexOf(semesterMatch[1].toLowerCase());
      if (position >= 0) index = position + 1;
      summerSlot = null;
      return;
    }
    const summerMatch = first.match(/^Summer After Semester (\w+)$/i);
    if (summerMatch) {
      const names = ["one", ...SEMESTER_NAMES];
      const after = names.indexOf(summerMatch[1].toLowerCase());
      summerSlot = after >= 0 ? summerAfter(after + 1) : null;
      // no summer column there: fold these courses into the next semester
      if (summerSlot === null && after >= 0) index = after + 1;
      return;
    }
    const yearMatch = first.match(/^(Second|Third|Fourth) Year$/i);
    if (yearMatch) {
      index = ["second", "third", "fourth"].indexOf(yearMatch[1].toLowerCase()) * 2 + 2;
      return;
    }
    if (/^(total )?credits$/i.test(second) || /^(total )?credits$/i.test(first)) return;

    const credits = parseCredits(creditText);
    if (credits === null || (!first && !second)) return; // options listed under a "select one" row

    const target =
      summerSlot !== null ? slots[summerSlot] : slots[regular[Math.min(index, semesterCount - 1)]];
    const code = first.replace(/\s+/g, "");
    if (CODE_RE.test(code)) {
      const resolved = resolveCode(code, info);
      target.push({
        id: newItemId(),
        code: resolved,
        label: info[resolved] ? undefined : second || first,
        credits: info[resolved] ? undefined : credits,
      });
    } else {
      placeholderCount += 1;
      target.push({
        id: newItemId(),
        code: `REQ:${placeholderCount}`,
        label: first || second,
        credits,
      });
    }
  });

  return slots;
}
