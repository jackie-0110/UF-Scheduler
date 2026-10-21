import { PrereqInfo, PrereqMap } from "../Cytoscape/prereqs";

/** A course placed in a semester. `id` is unique per placement. */
export interface PlanItem {
  id: string;
  code: string;
}

export interface PlanSemester {
  id: string;
  term: string;
  yearIndex: number;
  items: PlanItem[];
}

export interface PlanViolation {
  /** Requirement groups not met yet, e.g. [["COP3502"], ["MAC2311", "MAC2281"]] */
  missing: string[][];
}

export const DEFAULT_CREDIT_LIMIT = 18;
export const DEGREE_CREDITS = 120;

export const creditsOf = (course: PrereqInfo | undefined) => course?.credits ?? 0;

export function createDefaultSemesters(startYear: number): PlanSemester[] {
  const semesters: PlanSemester[] = [];
  for (let year = 0; year < 4; year++) {
    semesters.push({
      id: `sem-${year * 2}`,
      term: `Fall ${startYear + year}`,
      yearIndex: year,
      items: [],
    });
    semesters.push({
      id: `sem-${year * 2 + 1}`,
      term: `Spring ${startYear + year + 1}`,
      yearIndex: year,
      items: [],
    });
  }
  return semesters;
}

export const newItemId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const anyIn = (group: string[], codes: Set<string>) => group.some((code) => codes.has(code));

/**
 * Catalog codes can carry a trailing "C" (COP3502C, lecture plus lab) while prerequisite text
 * says "COP 3502". Both spellings count as the same course; a separate lab (CHM2045L) does not.
 */
export const aliasesOf = (code: string): string[] =>
  /\dC$/.test(code) ? [code, code.slice(0, -1)] : [code, `${code}C`];

const withAliases = (codes: Iterable<string>) => {
  const set = new Set<string>();
  Array.from(codes).forEach((code) => aliasesOf(code).forEach((alias) => set.add(alias)));
  return set;
};

/**
 * Checks every placed course against its prerequisites:
 * - prerequisites must be completed or placed in an EARLIER semester
 * - corequisites may be in the same or an earlier semester
 * - "prereq or coreq" courses may be in the same semester too
 */
export function validatePlan(
  semesters: PlanSemester[],
  info: PrereqMap,
  completed: Set<string>
): Map<string, PlanViolation> {
  const violations = new Map<string, PlanViolation>();
  const prior = withAliases(completed);

  semesters.forEach((semester) => {
    const same = withAliases(semester.items.map((item) => item.code));
    const priorOrSame = new Set([...Array.from(prior), ...Array.from(same)]);

    semester.items.forEach((item) => {
      const course = info[item.code];
      if (!course) return;
      const missing = [
        ...course.prereq.filter((group) => !anyIn(group, prior)),
        ...course.concurrent.filter((group) => !anyIn(group, priorOrSame)),
        ...course.coreq.filter((group) => !anyIn(group, priorOrSame)),
      ];
      if (missing.length > 0) violations.set(item.id, { missing });
    });

    same.forEach((code) => prior.add(code));
  });

  return violations;
}

export function totalCredits(semesters: PlanSemester[], info: PrereqMap) {
  return semesters.reduce(
    (sum, semester) =>
      sum + semester.items.reduce((s, item) => s + creditsOf(info[item.code]), 0),
    0
  );
}

export type ArrangeStrategy = "early" | "balanced";

export interface ArrangedPlan {
  strategy: ArrangeStrategy;
  /** One list of course codes per semester, in the same order as the plan's semesters */
  semesters: string[][];
  warnings: number;
}

/**
 * Rearranges the placed courses into valid semesters: every prerequisite lands in an
 * earlier semester, no semester goes over the credit limit, and courses that don't fit
 * anywhere spill into the last semester (and are counted as warnings).
 */
export function arrangeCourses(
  codes: string[],
  semesterCount: number,
  info: PrereqMap,
  completed: Set<string>,
  maxCredits: number,
  strategy: ArrangeStrategy
): ArrangedPlan {
  const planCodeFor = new Map<string, string>();
  codes.forEach((code) => aliasesOf(code).forEach((alias) => planCodeFor.set(alias, code)));
  const done = withAliases(completed);
  const semesterOf = new Map<string, number>();
  const loads = new Array<number>(semesterCount).fill(0);
  const buckets: string[][] = Array.from({ length: semesterCount }, () => []);

  // depth-first order so that prerequisites are placed before the courses that need them
  const ordered: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (code: string) => {
    if (state.has(code)) return;
    state.set(code, "visiting");
    const course = info[code];
    course?.prereq.forEach((group) =>
      group.forEach((prereq) => {
        const planned = planCodeFor.get(prereq);
        if (planned && planned !== code) visit(planned);
      })
    );
    state.set(code, "done");
    ordered.push(code);
  };
  [...codes]
    .sort((a, b) => a.localeCompare(b))
    .forEach(visit);

  ordered.forEach((code) => {
    const course = info[code];
    const credits = creditsOf(course);

    // earliest semester allowed by prerequisites that are also in the plan
    let earliest = 0;
    course?.prereq.forEach((group) => {
      if (anyIn(group, done)) return;
      const placed = group.filter((c) => semesterOf.has(c)).map((c) => semesterOf.get(c)!);
      if (placed.length > 0) earliest = Math.max(earliest, Math.min(...placed) + 1);
    });
    [...(course?.coreq ?? []), ...(course?.concurrent ?? [])].forEach((group) => {
      if (anyIn(group, done)) return;
      const placed = group.filter((c) => semesterOf.has(c)).map((c) => semesterOf.get(c)!);
      if (placed.length > 0) earliest = Math.max(earliest, Math.min(...placed));
    });

    const candidates: number[] = [];
    for (let i = earliest; i < semesterCount; i++) {
      if (loads[i] + credits <= maxCredits) candidates.push(i);
    }

    let target: number;
    if (candidates.length === 0) {
      target = semesterCount - 1;
    } else if (strategy === "early") {
      target = candidates[0];
    } else {
      target = candidates.reduce((best, i) => (loads[i] < loads[best] ? i : best), candidates[0]);
    }

    aliasesOf(code).forEach((alias) => semesterOf.set(alias, target));
    loads[target] += credits;
    buckets[target].push(code);
  });

  const semesters: PlanSemester[] = buckets.map((bucket, i) => ({
    id: `arranged-${i}`,
    term: "",
    yearIndex: Math.floor(i / 2),
    items: bucket.map((code) => ({ id: `${code}-${i}`, code })),
  }));
  return {
    strategy,
    semesters: buckets,
    warnings: validatePlan(semesters, info, completed).size,
  };
}
