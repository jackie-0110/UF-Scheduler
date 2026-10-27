/**
 * Prerequisite data from /api/prereqs and the "what can I take?" logic built on it.
 * Requirements are an AND of OR groups: [["MAC2312"], ["MAC2512", "MAC3473"]] means
 * MAC2312 AND (MAC2512 OR MAC3473).
 */

export type CourseGroups = string[][];

export interface PrereqInfo {
  code: string;
  name: string;
  credits: number | null;
  dept: string;
  prereq: CourseGroups;
  softPrereq: CourseGroups;
  coreq: CourseGroups;
  concurrent: CourseGroups;
  minGrade: string | null;
  standing: string | null;
  requirements: string[];
  notes: string[];
}

export type PrereqMap = Record<string, PrereqInfo>;

/** The API sends "VAR" for variable-credit courses and ".5" as text; keep credits numeric. */
export function normalizeCredits(map: PrereqMap): PrereqMap {
  Object.values(map).forEach((course) => {
    const raw = course.credits as unknown;
    if (typeof raw === "number" || raw == null) return;
    const value = Number(raw);
    course.credits = Number.isFinite(value) ? value : null;
  });
  return map;
}

export type CourseStatus = "completed" | "eligible" | "almost" | "locked" | "unknown";

export interface CourseEvaluation {
  status: CourseStatus;
  /** Prerequisite groups the student has not satisfied yet */
  missing: CourseGroups;
}

/** CHM2046L -> CHM2046: the graph shows a course and its lab as one node. */
export const baseCode = (code: string) => code.replace(/[A-Z]+$/, "");

/** Graph node ids look like "COP\n3502". */
export const nodeIdToCode = (id: string) => id.replace(/\s+/g, "");

// "MASU000-2" is a second transfer placeholder with the same code; show it as "MAS U000"
export const formatCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3).replace(/-\d+$/, "")}`;

export function buildVariantIndex(info: PrereqMap): Map<string, string[]> {
  const index = new Map<string, Set<string>>();
  const add = (code: string) => {
    const base = baseCode(code);
    if (!index.has(base)) index.set(base, new Set());
    index.get(base)!.add(code);
  };
  Object.values(info).forEach((course) => {
    add(course.code);
    [course.prereq, course.softPrereq, course.coreq, course.concurrent].forEach((groups) =>
      groups.forEach((group) => group.forEach(add))
    );
  });
  return new Map(Array.from(index, ([base, codes]) => [base, Array.from(codes).sort()]));
}

/** The code that stands for a graph node: the plain course if it exists, else its first variant. */
export function primaryCode(base: string, variants: Map<string, string[]>, info: PrereqMap) {
  const codes = variants.get(base) ?? [base];
  return codes.find((c) => c === base && info[c]) ?? codes.find((c) => info[c]) ?? codes[0];
}

export function evaluateCourse(
  code: string,
  info: PrereqMap,
  completed: Set<string>,
  variants: Map<string, string[]>
): CourseEvaluation {
  const codes = variants.get(baseCode(code)) ?? [code];
  if (codes.some((c) => completed.has(c))) return { status: "completed", missing: [] };

  const course = info[code];
  if (!course) return { status: "unknown", missing: [] };

  const missing = course.prereq.filter((group) => !group.some((c) => completed.has(c)));
  if (missing.length === 0) return { status: "eligible", missing };
  return { status: missing.length === 1 ? "almost" : "locked", missing };
}

/** Courses that list `code` as a prerequisite or corequisite. */
export function buildUnlockIndex(info: PrereqMap): Map<string, string[]> {
  const unlocks = new Map<string, Set<string>>();
  Object.values(info).forEach((course) => {
    [course.prereq, course.softPrereq].forEach((groups) =>
      groups.forEach((group) =>
        group.forEach((prereq) => {
          const base = baseCode(prereq);
          if (!unlocks.has(base)) unlocks.set(base, new Set());
          unlocks.get(base)!.add(course.code);
        })
      )
    );
  });
  return new Map(Array.from(unlocks, ([base, codes]) => [base, Array.from(codes).sort()]));
}
