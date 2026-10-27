import { PrereqMap } from "../Cytoscape/prereqs";
import {
  aliasesOf,
  codesInLabel,
  isRequirement,
  itemCredits,
  newItemId,
  PlanItem,
  PlanSemester,
  requirementMet,
} from "./plannerLogic";
import { extendTimeline, retime, termOrder, termStatus } from "./terms";

/** Gen ed and Quest tags for a course, from the course search data */
export interface CourseAttrs {
  genEd: string[];
  quest: string[];
}
export type AttrMap = Record<string, CourseAttrs>;

export interface TakenCourse {
  code: string;
  credits?: number;
  term?: string;
  grade?: string;
  inProgress?: boolean;
  examCredit?: boolean;
}

export interface TranscriptPlan {
  semesters: PlanSemester[];
  start: string;
  /** Courses placed into the terms they were taken */
  placed: number;
  /** AP / transfer credit kept off the timeline */
  examCredit: string[];
  /** Which taken course filled which requirement card */
  matches: { code: string; requirement: string }[];
  /** Taken courses that didn't fill anything on the plan */
  extra: string[];
  /** Model plan courses and requirements still to take */
  remaining: number;
  /** Years added because the rest didn't fit */
  addedYears: number;
  /** Summer credits taken plus planned, and whether the 9-credit rule applies */
  summer: { applies: boolean; credits: number };
}

/** Florida BOG 6.016: 9 credits in summer terms for students entering with under 60 */
export const SUMMER_REQUIRED = 9;
// a usual full summer (A + B sessions)
const SUMMER_LOAD = 9;

const GEN_ED_WORDS: [RegExp, string][] = [
  [/humanities/i, "Humanities"],
  [/social|behavioral/i, "Social Science"],
  [/biological/i, "Biological Science"],
  [/physical/i, "Physical Science"],
  [/mathematics/i, "Mathematics"],
  [/composition/i, "Composition"],
  [/international/i, "International"],
];

/** "Quest 2 (Gen Ed Social and Behavioral Sciences)" -> quest 2, any gen ed ignored */
export function cardNeeds(label: string): { quest?: string; genEd: string[]; elective?: { minLevel: number } } {
  const quest = label.match(/\bquest\s*(\d)/i);
  if (quest) return { quest: `QUEST ${quest[1]}`, genEd: [] };
  const genEd = /gen ed|state core|science laboratory/i.test(label)
    ? GEN_ED_WORDS.filter(([re]) => re.test(label)).map(([, name]) => name)
    : [];
  if (genEd.length) return { genEd };
  // free electives only; technical, approved and subject electives depend on the major
  if (/^electives?\b/i.test(label.trim()) && !/technical|approved|math|science/i.test(label)) {
    return { genEd: [], elective: { minLevel: /3000/.test(label) ? 3000 : 0 } };
  }
  return { genEd: [] };
}

const level = (code: string) => Number(code.slice(3, 4)) * 1000;

/**
 * Rebuilds a plan from a transcript:
 *  1. the timeline starts at the first term on the transcript
 *  2. every past term (and the current one, if it has in-progress classes) holds
 *     exactly the classes taken then, marked done or in progress
 *  3. model-plan courses and requirement cards those classes cover drop out,
 *     including gen ed / Quest / elective cards matched by course attributes
 *  4. everything left is repacked into the open terms, prerequisites first,
 *     adding a year at the end if it doesn't fit
 */
export function planFromTranscript(
  plan: PlanSemester[],
  taken: TakenCourse[],
  info: PrereqMap,
  attrs: AttrMap,
  now: string,
  alreadyDone: Set<string> = new Set()
): TranscriptPlan {
  const inClass = taken.filter((t) => t.term && !t.examCredit);
  const examCredit = taken.filter((t) => !t.term || t.examCredit);
  const firstTerm = inClass
    .map((t) => t.term!)
    .reduce((first, term) => (termOrder(term) < termOrder(first) ? term : first), plan[0].term);

  let timeline = retime(plan, firstTerm);
  while (termOrder(timeline[timeline.length - 1].term) < termOrder(now)) {
    timeline = extendTimeline(timeline);
  }

  const byTerm = new Map<string, TakenCourse[]>();
  inClass.forEach((t) => byTerm.set(t.term!, [...(byTerm.get(t.term!) ?? []), t]));

  // 1–2: fill taken terms, collect what they displace
  const pool: PlanItem[] = [];
  const locked = timeline.map((semester) => {
    const status = termStatus(semester.term, now);
    return status === "past" || (status === "current" && byTerm.has(semester.term));
  });
  const takenItems = new Map<string, PlanItem>();
  timeline = timeline.map((semester, i) => {
    if (!locked[i]) return semester;
    pool.push(...semester.items);
    const items = (byTerm.get(semester.term) ?? []).map((t) => {
      const item: PlanItem = {
        id: newItemId(),
        code: t.code,
        taken: t.inProgress ? "in-progress" : "done",
        grade: t.grade,
        // the transcript's own credits, for classes missing from the catalog
        credits: info[t.code] ? undefined : t.credits ?? 3,
      };
      aliasesOf(t.code).forEach((alias) => takenItems.set(alias, item));
      return item;
    });
    return { ...semester, items };
  });

  // 3: what the transcript covers
  const takenCodes = new Set<string>();
  [...taken.map((t) => t.code), ...Array.from(alreadyDone)].forEach((code) =>
    aliasesOf(code).forEach((alias) => takenCodes.add(alias))
  );
  const isTaken = (code: string) => aliasesOf(code).some((alias) => takenCodes.has(alias));
  // each taken class fills one thing
  const used = new Set<string>();
  const use = (code: string) => aliasesOf(code).forEach((alias) => used.add(alias));
  const unused = () =>
    taken.map((t) => t.code).filter((code, i, all) => all.indexOf(code) === i && !used.has(code));

  // copies, so trimming a card's credits never touches the saved plan
  const homeOf = new Map<string, number>();
  timeline.forEach((semester, i) => {
    if (!locked[i]) semester.items.forEach((item) => homeOf.set(item.id, i));
  });
  let candidates: PlanItem[] = [
    ...pool,
    ...timeline.flatMap((semester, i) => (locked[i] ? [] : semester.items)),
  ].map((item) => ({ ...item }));

  candidates = candidates.filter((item) => {
    if (isRequirement(item)) return true;
    if (!isTaken(item.code)) return true;
    use(item.code);
    return false;
  });

  const matches: { code: string; requirement: string }[] = [];
  const fill = (card: PlanItem, code: string) => {
    use(code);
    matches.push({ code, requirement: card.label ?? "Requirement" });
    const holder = takenItems.get(code);
    if (holder) holder.counts = [...(holder.counts ?? []), card.label ?? "Requirement"];
  };

  // requirement cards that name their courses ("ENC 1101 or ENC 1102")
  candidates = candidates.filter((item) => {
    if (!isRequirement(item) || !requirementMet(item, takenCodes)) return true;
    codesInLabel(item.label ?? "").filter(isTaken).forEach((code) => fill(item, code));
    return false;
  });

  // Quest, then gen ed, then free electives: most specific first
  const cards = candidates
    .filter(isRequirement)
    .map((item) => ({ item, needs: cardNeeds(item.label ?? ""), left: item.credits ?? 3 }))
    .filter(({ needs }) => needs.quest || needs.genEd.length || needs.elective)
    .sort((a, b) => rank(a.needs) - rank(b.needs));
  const finished = new Set<PlanItem>();
  cards.forEach((card) => {
    for (const code of unused()) {
      if (card.left <= 0) break;
      const a = attrs[code] ?? attrs[aliasesOf(code)[1]];
      const fits = card.needs.quest
        ? !!a?.quest.includes(card.needs.quest)
        : card.needs.genEd.length
        ? !!a?.genEd.some((g) => card.needs.genEd.includes(g))
        : level(code) >= (card.needs.elective?.minLevel ?? 0);
      if (!fits) continue;
      fill(card.item, code);
      card.left -= info[code]?.credits ?? 3;
    }
    if (card.left <= 0) finished.add(card.item);
    else if (card.left < (card.item.credits ?? 3)) card.item.credits = card.left;
  });
  candidates = candidates.filter((item) => !finished.has(item));

  // 4: repack what's left into the open terms
  const done = new Set(takenCodes);
  let addedYears = 0;
  // Florida: students who start with under 60 credits need 9 from summer terms
  const creditsOf = (t: TakenCourse) => info[t.code]?.credits ?? t.credits ?? 3;
  const examCredits = examCredit.reduce((sum, t) => sum + creditsOf(t), 0);
  const summerRule = examCredits < 60;
  const takenSummer = inClass
    .filter((t) => t.term!.startsWith("Summer"))
    .reduce((sum, t) => sum + creditsOf(t), 0);

  const build = (): PlanSemester[] => {
    const isOpen = timeline.map((s, i) => !locked[i]);
    const allowed = timeline.map((s, i) => isOpen[i] && !s.summer);
    // cards that name courses ("EGN 4952 or CIS 4914") keep their model-plan term, and
    // anything the model plan put in a summer that's still ahead stays in that summer;
    // other electives, gen eds and courses are free to move
    const fixed = timeline.map((s, i) =>
      isOpen[i]
        ? candidates.filter(
            (item) =>
              homeOf.get(item.id) === i &&
              (s.summer || (isRequirement(item) && codesInLabel(item.label ?? "").length > 0))
          )
        : s.items
    );
    // room in upcoming summers, only as much as the summer rule still needs
    const loadOf = (items: PlanItem[]) => items.reduce((sum, item) => sum + itemCredits(item, info), 0);
    let need = summerRule
      ? Math.max(0, SUMMER_REQUIRED - takenSummer - fixed.reduce((sum, items, i) => sum + (isOpen[i] && timeline[i].summer ? loadOf(items) : 0), 0))
      : 0;
    const summerCap = timeline.map((s, i) => {
      if (!isOpen[i] || !s.summer) return 0;
      // a class is ~3 credits, so even 1 missing credit needs room for one
      const room = need > 0 ? Math.min(Math.max(need, 3), SUMMER_LOAD - loadOf(fixed[i])) : 0;
      need -= room;
      return room > 0 ? loadOf(fixed[i]) + room : 0;
    });
    const fixedSet = new Set(fixed.flat());
    const movable = candidates.filter((item) => !fixedSet.has(item));
    const total = candidates.reduce((sum, item) => sum + itemCredits(item, info), 0);
    const openCount = allowed.filter(Boolean).length || 1;
    const cap = Math.min(18, Math.max(15, Math.ceil(total / openCount)));
    const { placed, overflow } = pack(movable, fixed, allowed, cap, info, done, homeOf, summerCap);
    if (overflow && addedYears < 2) {
      addedYears++;
      timeline = extendTimeline(timeline);
      locked.push(...timeline.slice(locked.length).map(() => false));
      return build();
    }
    return timeline.map((s, i) => ({ ...s, items: [...fixed[i], ...placed[i]] }));
  };
  const semesters = build();
  const summerCredits = semesters
    .filter((s) => s.summer)
    .reduce((sum, s) => sum + s.items.reduce((t, item) => t + itemCredits(item, info), 0), 0);

  return {
    semesters,
    start: firstTerm,
    placed: inClass.length,
    examCredit: examCredit.map((t) => t.code),
    summer: { applies: summerRule, credits: summerCredits },
    matches,
    extra: unused(),
    remaining: candidates.length,
    addedYears,
  };
}

/** Course a plan item stands for when ordering: itself, or the first course a card names */
const courseOf = (item: PlanItem, info: PrereqMap) => {
  const code = isRequirement(item) ? codesInLabel(item.label ?? "")[0] : item.code;
  return code ? info[code] ?? info[aliasesOf(code)[1]] : undefined;
};
const providesOf = (item: PlanItem) =>
  (isRequirement(item) ? codesInLabel(item.label ?? "") : [item.code]).flatMap(aliasesOf);

/**
 * Earliest-fit packing: courses before generic cards, prerequisites first,
 * model-plan order as the tiebreak (overdue items from past terms go first).
 * Each item lands in the first open term after its prerequisites (or with its
 * coreqs) that has room under `cap`.
 */
const HARD_CAP = 18;

function pack(
  movable: PlanItem[],
  fixed: PlanItem[][],
  allowed: boolean[],
  cap: number,
  info: PrereqMap,
  done: Set<string>,
  homeOf: Map<string, number>,
  /** Credits a summer may hold; 0 keeps it closed */
  summerCap: number[]
) {
  const loads = fixed.map((items, i) =>
    allowed[i] || summerCap[i] > 0 ? items.reduce((sum, item) => sum + itemCredits(item, info), 0) : 0
  );
  const isGeneric = (item: PlanItem) =>
    isRequirement(item) && codesInLabel(item.label ?? "").length === 0;
  const placed: PlanItem[][] = fixed.map(() => []);
  const at = new Map<string, number>();
  fixed.forEach((items, i) => items.forEach((item) => providesOf(item).forEach((c) => at.set(c, i))));
  const inPlan = new Set(movable.flatMap(providesOf));

  const key = (item: PlanItem) => [
    isRequirement(item) && codesInLabel(item.label ?? "").length === 0 ? 1 : 0,
    homeOf.get(item.id) ?? -1,
  ];
  const queue = movable
    .map((item, order) => ({ item, order, k: key(item) }))
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.order - b.order)
    .map(({ item }) => item);

  const groups = (item: PlanItem) => {
    const course = courseOf(item, info);
    return {
      before: course?.prereq ?? [],
      alongside: [...(course?.coreq ?? []), ...(course?.concurrent ?? [])],
    };
  };
  // a group matters only if nothing in it is done and some of it is on the plan
  const pending = (group: string[]) =>
    !group.some((c) => done.has(c)) && group.some((c) => at.has(c) || inPlan.has(c));
  const ready = (item: PlanItem) => {
    const { before, alongside } = groups(item);
    return [...before, ...alongside].filter(pending).every((group) => group.some((c) => at.has(c)));
  };

  let overflow = false;
  const lastOpen = allowed.lastIndexOf(true);
  while (queue.length) {
    const index = Math.max(0, queue.findIndex(ready));
    const [item] = queue.splice(index, 1);
    const { before, alongside } = groups(item);
    let earliest = 0;
    const after = (list: string[][], gap: number) =>
      list.filter(pending).forEach((group) => {
        const spots = group.filter((c) => at.has(c)).map((c) => at.get(c)!);
        if (spots.length) earliest = Math.max(earliest, Math.min(...spots) + gap);
      });
    after(before, 1);
    after(alongside, 0);
    const credits = itemCredits(item, info);
    // first try the target load, then up to 18 (UF's limit without approval)
    // before giving up and adding a year
    // gen eds and electives may use summer room; major courses stay in fall/spring,
    // since most aren't offered in summer
    // summer room exists only while the summer rule still needs credits, so it
    // gets first pick of the gen eds and electives
    const fits = (limit: number) => {
      if (isGeneric(item)) {
        for (let i = earliest; i < allowed.length; i++) {
          if (summerCap[i] > 0 && loads[i] + credits <= summerCap[i]) return i;
        }
      }
      for (let i = earliest; i < allowed.length; i++) {
        if (allowed[i] && loads[i] + credits <= limit) return i;
      }
      return -1;
    };
    let target = fits(cap);
    if (target === -1) target = fits(HARD_CAP);
    if (target === -1) {
      overflow = true;
      target = Math.max(lastOpen, 0);
    }
    loads[target] += credits;
    placed[target].push(item);
    providesOf(item).forEach((c) => at.set(c, target));
  }
  return { placed, overflow };
}

const rank = (needs: ReturnType<typeof cardNeeds>) =>
  needs.quest ? 0 : needs.genEd.length === 1 ? 1 : needs.genEd.length ? 2 : 3;
