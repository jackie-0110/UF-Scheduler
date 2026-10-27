import { PrereqInfo, PrereqMap } from "../Cytoscape/prereqs";

/** A course placed in a semester. `id` is unique per placement. */
export interface PlanItem {
  id: string;
  /** Course code, or `REQ:<n>` for a requirement card ("Gen Ed Humanities", "Elective") */
  code: string;
  /** Shown when the course isn't in the catalog data, and for requirement cards */
  label?: string;
  credits?: number;
  /** Requirement cards only: the student has already satisfied it */
  done?: boolean;
  /** Placed from a transcript: finished, or being taken this term */
  taken?: "done" | "in-progress";
  grade?: string;
  /** Requirement cards this taken course filled, e.g. "Quest 1 (Gen Ed Humanities)" */
  counts?: string[];
}

export const GRADE_ORDER = ["E", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A"];
/** Grades that count as passing for a course taken at UF */
export const PASSING_GRADES = new Set(GRADE_ORDER.slice(1).concat(["S", "P", "TR", "AP", "CR"]));

/** True when `grade` meets `minimum` (non-letter grades like S, P, TR always do). */
export function meetsMinimumGrade(grade: string | undefined, minimum: string | null) {
  if (!grade || !minimum) return true;
  const have = GRADE_ORDER.indexOf(grade);
  const need = GRADE_ORDER.indexOf(minimum);
  return have === -1 || need === -1 || have >= need;
}

export const MIN_CREDITS = 12;
export const isRequirement = (item: PlanItem) => item.code.startsWith("REQ:");

export const itemCredits = (item: PlanItem, info: PrereqMap) =>
  info[item.code]?.credits ?? item.credits ?? 0;

export interface PlanSemester {
  id: string;
  term: string;
  yearIndex: number;
  items: PlanItem[];
  /** Optional summer term between spring and the next fall */
  summer?: boolean;
}

export interface PlanViolation {
  /** Requirement groups not met yet, e.g. [["COP3502"], ["MAC2311", "MAC2281"]] */
  missing: string[][];
}

export const DEFAULT_CREDIT_LIMIT = 18;
export const SUMMER_CREDIT_LIMIT = 12;
export const DEGREE_CREDITS = 120;

export const creditsOf = (course: PrereqInfo | undefined) => course?.credits ?? 0;

export const creditLimitOf = (semester: PlanSemester) =>
  semester.summer ? SUMMER_CREDIT_LIMIT : DEFAULT_CREDIT_LIMIT;

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
    if (year < 3) {
      semesters.push({
        id: `sum-${year}`,
        term: `Summer ${startYear + year + 1}`,
        yearIndex: year,
        items: [],
        summer: true,
      });
    }
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

/** "ENC 1101 or ENC 1102" -> [ENC1101, ENC1102]; "PHY 2048 & 2048L" -> [PHY2048, PHY2048L] */
export function codesInLabel(label: string): string[] {
  const codes: string[] = [];
  let prefix = "";
  const pattern = /\b([A-Z]{3})?\s?(\d{4}[A-Z]?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(label)) !== null) {
    if (match[1]) prefix = match[1];
    if (prefix) codes.push(`${prefix}${match[2]}`);
  }
  return codes;
}

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
  completed: Set<string>,
  grades: Record<string, string> = {}
): Map<string, PlanViolation> {
  const violations = new Map<string, PlanViolation>();
  const prior = withAliases(completed);

  semesters.forEach((semester) => {
    // a requirement card such as "ENC 1101 or ENC 1102" is assumed to cover the courses it names
    const same = withAliases(
      semester.items.flatMap((item) =>
        isRequirement(item) ? codesInLabel(item.label ?? "") : [item.code]
      )
    );
    const priorOrSame = new Set([...Array.from(prior), ...Array.from(same)]);

    semester.items.forEach((item) => {
      const course = info[item.code];
      if (!course) return;
      // a completed course with too low a grade (say a D where a C is needed) doesn't count
      const gradeOf = (code: string) =>
        [code, ...aliasesOf(code)].map((alias) => grades[alias]).find(Boolean);
      const usable = (group: string[]) =>
        group.some(
          (code) =>
            prior.has(code) &&
            (!aliasesOf(code).some((alias) => completed.has(alias)) ||
              meetsMinimumGrade(gradeOf(code), course.minGrade))
        );
      const missing = [
        ...course.prereq.filter((group) => !usable(group)),
        ...course.concurrent.filter((group) => !anyIn(group, priorOrSame)),
        ...course.coreq.filter((group) => !anyIn(group, priorOrSame)),
      ];
      if (missing.length > 0) violations.set(item.id, { missing });
    });

    same.forEach((code) => prior.add(code));
  });

  return violations;
}

export const semesterCredits = (semester: PlanSemester, info: PrereqMap) =>
  semester.items.reduce((sum, item) => sum + itemCredits(item, info), 0);

export function totalCredits(semesters: PlanSemester[], info: PrereqMap) {
  return semesters.reduce((sum, semester) => sum + semesterCredits(semester, info), 0);
}

/** Credits the student has already finished: completed courses plus requirement cards marked done. */
export function completedCredits(
  semesters: PlanSemester[],
  info: PrereqMap,
  completed: Set<string>
) {
  return semesters.reduce(
    (sum, semester) =>
      sum +
      semester.items.reduce((s, item) => {
        const done = isRequirement(item)
          ? !!item.done
          : aliasesOf(item.code).some((alias) => completed.has(alias));
        return done ? s + itemCredits(item, info) : s;
      }, 0),
    0
  );
}

/**
 * Semesters that have courses but fall short of full-time (12 credits). The last
 * one is left out: a graduating student can take a reduced load.
 */
export const underloadedSemesters = (semesters: PlanSemester[], info: PrereqMap) => {
  const last = lastRegularWithCourses(semesters);
  return semesters.filter((semester) => {
    if (semester.summer || semester === last) return false;
    const credits = semesterCredits(semester, info);
    return credits > 0 && credits < MIN_CREDITS;
  });
};

export const lastRegularWithCourses = (semesters: PlanSemester[]) =>
  [...semesters].reverse().find((s) => !s.summer && s.items.length > 0);

export type ArrangeStrategy = "early" | "balanced";

export interface ArrangedPlan {
  strategy: ArrangeStrategy;
  /** The rearranged (movable) courses for each semester, in the plan's semester order */
  semesters: PlanItem[][];
  /** Courses whose prerequisites still aren't satisfied after arranging */
  warnings: number;
  /** Semesters that still end up under 12 credits */
  underMin: number;
}

/**
 * Rearranges the placed courses into valid semesters: every prerequisite lands in an
 * earlier semester, no semester goes over the credit limit, and used semesters get at
 * least 12 credits where the prerequisites allow it. Requirement cards (`fixed`) stay
 * where they are but count toward each semester's credits.
 */
export function arrangeCourses(
  movable: PlanItem[],
  fixed: PlanItem[][],
  /** Which semesters courses may be placed in (summers are left alone) */
  allowed: boolean[],
  info: PrereqMap,
  completed: Set<string>,
  maxCredits: number,
  strategy: ArrangeStrategy
): ArrangedPlan {
  const semesterCount = fixed.length;
  const codes = movable.map((item) => item.code);
  const itemByCode = new Map(movable.map((item) => [item.code, item]));
  const planCodeFor = new Map<string, string>();
  codes.forEach((code) => aliasesOf(code).forEach((alias) => planCodeFor.set(alias, code)));
  const done = withAliases(completed);
  const semesterOf = new Map<string, number>();
  const creditsFor = (code: string) => itemCredits(itemByCode.get(code)!, info);

  const loads = fixed.map((items) => items.reduce((sum, item) => sum + itemCredits(item, info), 0));
  const buckets: string[][] = Array.from({ length: semesterCount }, () => []);

  // depth-first order so that prerequisites are placed before the courses that need them
  const ordered: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (code: string) => {
    if (state.has(code)) return;
    state.set(code, "visiting");
    // coreqs too: they can't be placed before what they're paired with
    const course = info[code];
    [...(course?.prereq ?? []), ...(course?.coreq ?? []), ...(course?.concurrent ?? [])].forEach((group) =>
      group.forEach((prereq) => {
        const planned = planCodeFor.get(prereq);
        if (planned && planned !== code) visit(planned);
      })
    );
    state.set(code, "done");
    ordered.push(code);
  };
  [...codes].sort((a, b) => a.localeCompare(b)).forEach(visit);

  ordered.forEach((code) => {
    const course = info[code];
    const credits = creditsFor(code);

    // earliest semester allowed by prerequisites that are also in the plan
    let earliest = 0;
    const constrain = (groups: string[][], sameSemesterOk: boolean) =>
      groups.forEach((group) => {
        if (anyIn(group, done)) return;
        const placed = group.filter((c) => semesterOf.has(c)).map((c) => semesterOf.get(c)!);
        if (placed.length > 0) {
          earliest = Math.max(earliest, Math.min(...placed) + (sameSemesterOk ? 0 : 1));
        }
      });
    constrain(course?.prereq ?? [], false);
    constrain([...(course?.coreq ?? []), ...(course?.concurrent ?? [])], true);

    const candidates: number[] = [];
    for (let i = earliest; i < semesterCount; i++) {
      if (allowed[i] && loads[i] + credits <= maxCredits) candidates.push(i);
    }

    let target: number;
    if (candidates.length === 0) {
      // nothing has room: use the lightest allowed semester that prerequisites permit
      const open = Array.from({ length: semesterCount }, (_, i) => i).filter(
        (i) => allowed[i] && i >= earliest
      );
      const fallback = open.length > 0 ? open : [allowed.lastIndexOf(true)];
      target = fallback.reduce((best, i) => (loads[i] < loads[best] ? i : best), fallback[0]);
    } else if (strategy === "early") {
      target = candidates[0];
    } else {
      target = candidates.reduce((best, i) => (loads[i] < loads[best] ? i : best), candidates[0]);
    }

    aliasesOf(code).forEach((alias) => semesterOf.set(alias, target));
    loads[target] += credits;
    buckets[target].push(code);
  });

  const asSemesters = (): PlanSemester[] =>
    buckets.map((bucket, i) => ({
      id: `arranged-${i}`,
      term: "",
      yearIndex: Math.floor(i / 2),
      items: [
        ...fixed[i],
        ...bucket.map((code) => ({ ...itemByCode.get(code)!, id: `${code}-${i}` })),
      ],
    }));
  const violationCount = () => validatePlan(asSemesters(), info, completed).size;

  // Repair pass: top up any light semester by pulling a course in from another one,
  // as long as nothing goes over the limit and no new prerequisite problem appears.
  let guard = 0;
  let improved = true;
  while (improved && guard++ < 100) {
    improved = false;
    const light = loads.findIndex((load, i) => allowed[i] && load > 0 && load < MIN_CREDITS);
    if (light === -1) break;
    const baseline = violationCount();
    const sources = Array.from({ length: semesterCount }, (_, i) => i)
      .filter((i) => i !== light && allowed[i])
      .sort((a, b) => (a > light ? 0 : 1) - (b > light ? 0 : 1) || a - b);

    outer: for (const from of sources) {
      for (const code of buckets[from]) {
        const credits = creditsFor(code);
        const remaining = loads[from] - credits;
        if (loads[light] + credits > maxCredits) continue;
        if (remaining !== 0 && remaining < MIN_CREDITS) continue;
        buckets[from] = buckets[from].filter((c) => c !== code);
        buckets[light].push(code);
        if (violationCount() <= baseline) {
          loads[from] -= credits;
          loads[light] += credits;
          improved = true;
          break outer;
        }
        buckets[light] = buckets[light].filter((c) => c !== code);
        buckets[from].push(code);
      }
    }
  }

  return {
    strategy,
    semesters: buckets.map((bucket) => bucket.map((code) => itemByCode.get(code)!)),
    warnings: violationCount(),
    underMin: loads.filter((load, i) => allowed[i] && load > 0 && load < MIN_CREDITS).length,
  };
}

/**
 * True when the courses a requirement card names are done: any of them for
 * "ENC 1101 or ENC 1102", all of them for "PHY 2048 & 2048L".
 */
export function requirementMet(item: PlanItem, completed: Set<string>) {
  const label = item.label ?? "";
  const codes = codesInLabel(label);
  if (codes.length === 0) return false;
  const done = (code: string) => aliasesOf(code).some((alias) => completed.has(alias));
  return /\bor\b/i.test(label) ? codes.some(done) : codes.every(done);
}

/** Credits for finished courses that aren't on the plan (COP3502 and COP3502C count once). */
export function completedCreditsOffPlan(
  semesters: PlanSemester[],
  info: PrereqMap,
  completed: Set<string>
) {
  const onPlan = withAliases(
    semesters.flatMap((semester) => semester.items.filter((item) => !isRequirement(item)).map((item) => item.code))
  );
  const counted = new Set<string>();
  let sum = 0;
  completed.forEach((code) => {
    const key = code.replace(/(\d)C$/, "$1");
    if (counted.has(key) || onPlan.has(code)) return;
    const credits = aliasesOf(code).map((alias) => info[alias]?.credits).find((c) => c != null);
    if (credits == null) return;
    counted.add(key);
    sum += credits;
  });
  return sum;
}
