import { PlanItem, PlanSemester } from "./plannerLogic";

const SEASONS = ["Spring", "Summer", "Fall"] as const;
export type Season = (typeof SEASONS)[number];

/** "Fall 2025" -> a number that sorts terms in calendar order */
export function termOrder(term: string): number {
  const [season, year] = term.split(" ");
  const index = SEASONS.indexOf(season as Season);
  return index < 0 || !year ? NaN : Number(year) * 3 + index;
}

const termAt = (order: number) => `${SEASONS[order % 3]} ${Math.floor(order / 3)}`;

export const isTerm = (text: string) => /^(Spring|Summer|Fall) \d{4}$/.test(text);

/** The term a date falls in, by UF's calendar: spring Jan–Apr, summer May–Jul, fall Aug–Dec. */
export function termOf(date: Date): string {
  const month = date.getMonth();
  const season: Season = month <= 3 ? "Spring" : month <= 6 ? "Summer" : "Fall";
  return `${season} ${date.getFullYear()}`;
}

export type TermStatus = "past" | "current" | "future";

export function termStatus(term: string, now: string): TermStatus {
  const diff = termOrder(term) - termOrder(now);
  return diff < 0 ? "past" : diff === 0 ? "current" : "future";
}

/**
 * Semesters from `start` until `regularCount` fall/spring terms, with a summer
 * between each spring and fall. Ids are the term itself so they stay stable.
 */
export function buildTimeline(start: string, regularCount = 8): PlanSemester[] {
  const semesters: PlanSemester[] = [];
  let order = termOrder(start);
  let regular = 0;
  // academic years begin each fall
  let year = 0;
  while (regular < regularCount) {
    const term = termAt(order);
    const summer = term.startsWith("Summer");
    if (term.startsWith("Fall") && semesters.length > 0) year++;
    semesters.push({
      id: term.toLowerCase().replace(" ", "-"),
      term,
      yearIndex: year,
      items: [],
      ...(summer ? { summer: true } : {}),
    });
    if (!summer) regular++;
    order++;
  }
  return semesters;
}

/**
 * Moves a plan onto a new timeline, keeping each course in the same relative
 * semester (your 3rd fall/spring stays your 3rd), and summers likewise.
 */
export function retime(semesters: PlanSemester[], start: string, regularCount?: number): PlanSemester[] {
  const regularOld = semesters.filter((s) => !s.summer);
  const summerOld = semesters.filter((s) => s.summer);
  const next = buildTimeline(start, Math.max(regularCount ?? 0, regularOld.length, 8));
  let r = 0;
  let m = 0;
  return next.map((semester) => {
    const source = semester.summer ? summerOld[m++] : regularOld[r++];
    return { ...semester, items: source ? source.items : [] };
  });
}

/** Adds one more academic year (fall, spring, summer before it) to the end. */
export function extendTimeline(semesters: PlanSemester[], years = 1): PlanSemester[] {
  const regular = semesters.filter((s) => !s.summer).length;
  const longer = buildTimeline(semesters[0].term, regular + years * 2);
  const byTerm = new Map(semesters.map((s) => [s.term, s.items] as [string, PlanItem[]]));
  return longer.map((s) => ({ ...s, items: byTerm.get(s.term) ?? [] }));
}

/** A few terms either side of `around`, for start / current pickers. */
export function termChoices(around: string, before = 9, after = 6, summers = false): string[] {
  const center = termOrder(around);
  const out: string[] = [];
  for (let order = center - before; order <= center + after; order++) {
    const term = termAt(order);
    if (summers || !term.startsWith("Summer")) out.push(term);
  }
  return out;
}
