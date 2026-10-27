import prereqs from "./__fixtures__/prereqs-cs.json";
import { PrereqMap } from "../Cytoscape/prereqs";
import { buildMajorPlan } from "./majorPlans";
import { aliasesOf, isRequirement, itemCredits, PlanSemester, validatePlan } from "./plannerLogic";
import { buildTimeline, termStatus } from "./terms";
import { AttrMap, cardNeeds, planFromTranscript, TakenCourse } from "./transcriptPlan";

// Real catalog data and the real CS (Herbert Wertheim) model plan
const info = prereqs as unknown as PrereqMap;
const MAJOR = "Computer Science | Herbert Wertheim College of Engineering";

const modelPlan = (start: string): PlanSemester[] => {
  const timeline = buildTimeline(start);
  const items = buildMajorPlan(MAJOR, info, timeline);
  return timeline.map((s, i) => ({ ...s, items: items[i] }));
};

// Gen ed tags as the course search API reports them for Fall 2026
const attrs: AttrMap = {
  ARH1030: { genEd: ["Humanities"], quest: ["QUEST 1"] },
  AMH2010: { genEd: ["Social Science"], quest: [] },
  PSY2012: { genEd: ["Social Science"], quest: [] },
  CHM1020: { genEd: ["Physical Science"], quest: [] },
  ENC1101: { genEd: ["Composition"], quest: [] },
};

// A sophomore: two terms done, third in progress, plus AP psychology
const transcript: TakenCourse[] = [
  { code: "PSY2012", term: "Fall 2025", grade: "P", examCredit: true },
  { code: "COP3502C", term: "Fall 2025", grade: "A" },
  { code: "MAC2311", term: "Fall 2025", grade: "B+" },
  { code: "ENC1101", term: "Fall 2025", grade: "A" },
  { code: "ARH1030", term: "Fall 2025", grade: "B" },
  { code: "COP3503C", term: "Spring 2026", grade: "A-" },
  { code: "MAC2312", term: "Spring 2026", grade: "B" },
  { code: "COT3100", term: "Spring 2026", grade: "B+" },
  { code: "AMH2010", term: "Spring 2026", grade: "B" },
  { code: "CHM1020", term: "Spring 2026", grade: "B" },
  { code: "COP3530", term: "Fall 2026", inProgress: true },
  { code: "MAC2313", term: "Fall 2026", inProgress: true },
  { code: "CDA3101", term: "Fall 2026", inProgress: true },
  { code: "PHY2048", term: "Fall 2026", inProgress: true },
  { code: "PHY2048L", term: "Fall 2026", inProgress: true },
];

const NOW = "Fall 2026";
const before = modelPlan("Fall 2026");
const result = planFromTranscript(before, transcript, info, attrs, NOW);
const codesIn = (s: PlanSemester) => s.items.map((i) => i.code);
const termOf = (term: string) => result.semesters.find((s) => s.term === term)!;
const future = result.semesters.filter((s) => termStatus(s.term, NOW) === "future");

describe("plan rebuilt from a transcript (real CS model plan)", () => {
  test("the timeline starts at the first term on the transcript", () => {
    expect(result.start).toBe("Fall 2025");
    expect(result.semesters[0].term).toBe("Fall 2025");
  });

  test("past terms hold exactly what was taken, marked done; AP credit stays off the timeline", () => {
    expect(codesIn(termOf("Fall 2025")).sort()).toEqual(["ARH1030", "COP3502C", "ENC1101", "MAC2311"]);
    expect(codesIn(termOf("Spring 2026")).sort()).toEqual(["AMH2010", "CHM1020", "COP3503C", "COT3100", "MAC2312"]);
    expect(termOf("Fall 2025").items.every((i) => i.taken === "done")).toBe(true);
    expect(result.examCredit).toEqual(["PSY2012"]);
  });

  test("the current term holds the in-progress classes", () => {
    expect(termOf("Fall 2026").items.every((i) => i.taken === "in-progress")).toBe(true);
    expect(codesIn(termOf("Fall 2026"))).toHaveLength(5);
  });

  test("nothing taken shows up again later", () => {
    const taken = new Set(transcript.flatMap((t) => aliasesOf(t.code)));
    future.forEach((s) => s.items.forEach((i) => expect(taken.has(i.code)).toBe(false)));
  });

  test("requirement cards are filled by what they name or by gen ed / Quest tags", () => {
    const filled = Object.fromEntries(result.matches.map((m) => [m.requirement, m.code]));
    expect(filled["Quest 1 (Gen Ed Humanities)"]).toBe("ARH1030");
    expect(filled["ENC 1101 or ENC 1102"]).toBe("ENC1101");
    expect(filled["State Core Gen Ed Biological or Physical Sciences"]).toBe("CHM1020");
    const left = future.flatMap((s) => s.items.filter(isRequirement).map((i) => i.label));
    expect(left).not.toContain("Quest 1 (Gen Ed Humanities)");
    expect(left).not.toContain("PHY 2048 & 2048L");
  });

  test("it still finishes on time (8 fall/spring terms) without going over 18 credits", () => {
    expect(result.addedYears).toBe(0);
    expect(result.semesters[result.semesters.length - 1].term).toBe("Spring 2029");
  });

  test("every model-plan course not yet taken is still planned, exactly once", () => {
    const taken = new Set(transcript.flatMap((t) => aliasesOf(t.code)));
    const needed = before
      .flatMap((s) => s.items)
      .filter((i) => !isRequirement(i) && !taken.has(i.code))
      .map((i) => i.code)
      .sort();
    const planned = future.flatMap((s) => s.items.filter((i) => !isRequirement(i)).map((i) => i.code)).sort();
    expect(planned).toEqual(needed);
  });

  test("the new plan breaks no prerequisites and no term goes over 18 credits", () => {
    // terms already taken are history, so only planned courses are checked
    const done = new Set(transcript.filter((t) => !t.inProgress).flatMap((t) => aliasesOf(t.code)));
    const problems = validatePlan(result.semesters, info, done);
    const plannedIds = new Set(future.flatMap((s) => s.items.map((i) => i.id)));
    expect(Array.from(problems.keys()).filter((id) => plannedIds.has(id))).toEqual([]);
    future
      .filter((s) => !s.summer)
      .forEach((s) => expect(s.items.reduce((sum, i) => sum + itemCredits(i, info), 0)).toBeLessThanOrEqual(18));
  });
});

describe("reading requirement cards", () => {
  test("Quest wins over the gen ed in brackets", () => {
    expect(cardNeeds("Quest 1 (Gen Ed Humanities)")).toEqual({ quest: "QUEST 1", genEd: [] });
  });
  test("gen ed categories", () => {
    expect(cardNeeds("State Core Gen Ed Biological or Physical Sciences").genEd).toEqual([
      "Biological Science",
      "Physical Science",
    ]);
  });
  test("only free electives match any course; technical electives depend on the major", () => {
    expect(cardNeeds("Elective (3000 level or above, not in major)").elective).toEqual({ minLevel: 3000 });
    expect(cardNeeds("Technical elective").elective).toBeUndefined();
  });
});


describe("summers", () => {
  const summerCredits = (r: ReturnType<typeof planFromTranscript>, term: string) =>
    r.semesters.find((s) => s.term === term)?.items.reduce((sum, i) => sum + itemCredits(i, info), 0) ?? 0;

  test("no summer taken yet: the next summer gets 9 credits of gen eds / electives, no major courses", () => {
    const summer = termOf("Summer 2027");
    expect(summerCredits(result, "Summer 2027")).toBe(9);
    expect(summer.items.every((i) => isRequirement(i) && !/\d{4}/.test(i.label ?? ""))).toBe(true);
    expect(result.summer).toEqual({ applies: true, credits: 9 });
  });

  test("summer classes on the transcript land in that summer and count toward the 9", () => {
    const withSummer: TakenCourse[] = [
      ...transcript,
      { code: "AMH2020", term: "Summer 2026", grade: "A" },
      { code: "SPN1130", term: "Summer 2026", grade: "B" },
      { code: "IUF1000", term: "Summer 2026", grade: "A" },
    ];
    const r = planFromTranscript(before, withSummer, info, attrs, NOW);
    expect(r.semesters.find((s) => s.term === "Summer 2026")!.items.map((i) => i.code).sort()).toEqual([
      "AMH2020",
      "IUF1000",
      "SPN1130",
    ]);
    // 9 done already, so nothing is planned for later summers
    r.semesters
      .filter((s) => s.summer && termStatus(s.term, NOW) === "future")
      .forEach((s) => expect(s.items).toEqual([]));
  });

  test("if now is a summer with classes in progress, the rest starts in fall", () => {
    const inSummer: TakenCourse[] = [
      ...transcript.filter((t) => t.term !== "Fall 2026"),
      { code: "COP3530", term: "Summer 2026", inProgress: true },
    ];
    const r = planFromTranscript(before, inSummer, info, attrs, "Summer 2026");
    expect(r.semesters.find((s) => s.term === "Summer 2026")!.items.map((i) => i.taken)).toEqual(["in-progress"]);
    expect(r.semesters.find((s) => s.term === "Fall 2026")!.items.length).toBeGreaterThan(0);
  });

  test("students who arrived with 60+ credits of AP / transfer aren't held to the summer rule", () => {
    const lotsOfCredit: TakenCourse[] = [
      ...transcript,
      ...Array.from({ length: 20 }, (_, n) => ({ code: `XXX${1000 + n}`, examCredit: true, grade: "TR" })),
    ];
    const r = planFromTranscript(before, lotsOfCredit, info, attrs, NOW);
    expect(r.summer.applies).toBe(false);
    r.semesters
      .filter((s) => s.summer && termStatus(s.term, NOW) === "future")
      .forEach((s) => expect(s.items).toEqual([]));
  });
});

test("a summer short by 1 credit still gets a class planned", () => {
  const eight: TakenCourse[] = [
    ...transcript,
    { code: "AMH2020", term: "Summer 2026", grade: "A" },
    { code: "SPN1130", term: "Summer 2026", grade: "B" },
  ];
  const fixture = { ...info, SPN1130: { ...info.COP3530, code: "SPN1130", credits: 5, prereq: [] } };
  const r = planFromTranscript(before, eight, fixture, attrs, NOW);
  expect(r.summer.credits).toBeGreaterThanOrEqual(9);
});
