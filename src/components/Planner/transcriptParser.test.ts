import { parseTranscript } from "./transcriptParser";
import { meetsMinimumGrade, validatePlan, PlanSemester } from "./plannerLogic";
import { PrereqInfo, PrereqMap } from "../Cytoscape/prereqs";

const course = (code: string, overrides: Partial<PrereqInfo> = {}): PrereqInfo => ({
  code,
  name: `${code} title`,
  credits: 3,
  dept: "Test",
  prereq: [],
  softPrereq: [],
  coreq: [],
  concurrent: [],
  minGrade: null,
  standing: null,
  requirements: [],
  notes: [],
  ...overrides,
});

const info: PrereqMap = {
  COP3502C: course("COP3502C"),
  MAC2311: course("MAC2311"),
  COP3503C: course("COP3503C", { prereq: [["COP3502"]], minGrade: "C" }),
};

describe("parseTranscript", () => {
  it("reads codes and grades, resolving the lecture+lab C suffix", () => {
    const rows = parseTranscript(
      "COP 3502  Programming Fundamentals 1  A  4.00\nMAC 2311 Calculus 1 B+ 4.00",
      info
    );
    expect(rows.map((r) => [r.code, r.grade, r.status])).toEqual([
      ["COP3502C", "A", "completed"],
      ["MAC2311", "B+", "completed"],
    ]);
  });

  it("ignores failed and withdrawn courses", () => {
    const rows = parseTranscript("COP 3502 Programming W\nMAC 2311 Calculus F", info);
    expect(rows.every((r) => r.status === "ignore")).toBe(true);
  });

  it("treats ungraded rows under an In Progress header as in progress", () => {
    const rows = parseTranscript("Courses In Progress\nCOP 3503C Programming Fundamentals 2", info);
    expect(rows[0].status).toBe("in-progress");
  });

  it("counts transfer and AP credit as completed", () => {
    expect(parseTranscript("MAC 2311 Calculus 1 TR 4.00", info)[0].status).toBe("completed");
  });

  it("keeps the passing attempt when a course was retaken", () => {
    const rows = parseTranscript("COP 3502 Programming F\nCOP 3502 Programming B", info);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("completed");
  });

  it("finds nothing in text without course codes", () => {
    expect(parseTranscript("Hello world\nno courses here", info)).toEqual([]);
  });
});

describe("minimum grades", () => {
  it("compares letter grades", () => {
    expect(meetsMinimumGrade("B", "C")).toBe(true);
    expect(meetsMinimumGrade("D", "C")).toBe(false);
    expect(meetsMinimumGrade(undefined, "C")).toBe(true);
    expect(meetsMinimumGrade("TR", "C")).toBe(true);
  });

  it("a completed prerequisite with too low a grade does not count", () => {
    const semesters: PlanSemester[] = [
      { id: "s0", term: "Fall", yearIndex: 0, items: [{ id: "a", code: "COP3503C" }] },
    ];
    const completed = new Set(["COP3502C"]);
    expect(validatePlan(semesters, info, completed, { COP3502C: "B" }).size).toBe(0);
    expect(validatePlan(semesters, info, completed, { COP3502C: "D" }).size).toBe(1);
  });
});

describe("parseTranscript course history table", () => {
  const history = [
    "Fall 2025\tCOP 3502\tProgramming Fundamentals 1\t4\tA\t--",
    "Fall 2025\tMAC 2311\tCalculus 1\t4\tP\t--",
    "Fall 2025\tAML L000\tTransfer AML Course\t3\tB\t--",
    "Fall 2025\tMAC 2311\tCalculus 1\t4\tP\tRepeat Code",
  ].join("\n");

  it("reads tab-separated rows, counts P as completed, keeps L000 transfer credit, skips repeats", () => {
    const rows = parseTranscript(history, info);
    expect(rows.map((r) => [r.code, r.grade, r.status, r.examCredit])).toEqual([
      ["COP3502C", "A", "completed", false],
      ["MAC2311", "P", "completed", true],
      ["AMLL000", "B", "completed", true],
    ]);
    expect(rows[2].credits).toBe(3);
  });

  it("reads one cell per line", () => {
    const rows = parseTranscript(
      "Fall 2025\nCOP 3502\nProgramming Fundamentals 1\n4\nB-\n--\nFall 2025\nMAC 2311\nCalculus 1\n4\nP\n--",
      info
    );
    expect(rows.map((r) => [r.code, r.grade, r.status])).toEqual([
      ["COP3502C", "B-", "completed"],
      ["MAC2311", "P", "completed"],
    ]);
  });

  it("treats a graded-less row with credits as in progress", () => {
    const rows = parseTranscript("Fall 2026\tCOP 3503\tProgramming Fundamentals 2\t3\t\t--", info);
    expect(rows[0].status).toBe("in-progress");
  });
});

describe("transcript terms", () => {
  it("tags each row with its term, from the row or the term line above it", () => {
    const rows = parseTranscript(
      "Fall 2025\tCOP 3502\tProgramming Fundamentals 1\t4\tA\t--\nSpring 2026\nMAC 2311 Calculus 1 B+ 4.00",
      info
    );
    expect(rows.map((r) => [r.code, r.term])).toEqual([
      ["COP3502C", "Fall 2025"],
      ["MAC2311", "Spring 2026"],
    ]);
  });

  it("marks P and TR grades as exam or transfer credit", () => {
    const rows = parseTranscript("Fall 2025\tMAC 2311\tCalculus 1\t4\tP\t--", info);
    expect(rows[0].examCredit).toBe(true);
  });
});

describe("summer terms", () => {
  it("reads Summer A / B / C sessions as that year's summer", () => {
    const rows = parseTranscript(
      "Summer A 2026\tCOP 3502\tProgramming Fundamentals 1\t4\tA\t--\nSummer C 2026\nMAC 2311 Calculus 1 B 4.00",
      info
    );
    expect(rows.map((r) => r.term)).toEqual(["Summer 2026", "Summer 2026"]);
  });
});

it("keeps the transcript's credits for each class", () => {
  expect(parseTranscript("Fall 2025\tSPN 1130\tBeginning Spanish 1\t5\tB+\t--", info)[0].credits).toBe(5);
});

describe("ONE.UF course history (term line above each course)", () => {
  // shape of a real paste: prior credit filed under the first term in one subject-sorted run,
  // then that term's UF classes, "Spr" / "Sum" terms, repeat notes and ungraded current classes
  const paste = [
    "Fall 2025", "", "AML L000\tTransfer AML Course\t3\tB\tNo data available",
    "Fall 2025", "", "ENC 1101\tExpos and Argu Writing\t3\tP\tWriting Requirement 6000 Words",
    "Fall 2025", "", "Repeat Code: R – Repeated Course (count in GPA but no credit awarded)", "",
    "MAC 2311\tAnalyt Geom and Calc 1\t4\tP\tMath Requirement",
    "Fall 2025", "", "MAC 2311\tAnalyt Geom and Calc 1\t4\tA\tMath Requirement",
    "Fall 2025", "", "MAS U000\tTransfer MAS Course\t2\tA\tNo data available",
    "Fall 2025", "", "MAS U000\tTransfer MAS Course\t3\tA\tNo data available",
    "Fall 2025", "", "MAS 4105\tLinear Algebra 1\t4\tA\tNo data available",
    "Fall 2025", "", "PHY 2048\tPhysics With Calc 1\t3\tB\tNo data available",
    "Fall 2025", "", "COP 3502C\tProg Fundamentals 1\t4\tA\tNo data available",
    "Fall 2025", "", "EGN 4912\tEngineering Research\t2\tS\tNo data available",
    "Spr 2026", "", "COP 3503C\tProg Fundamentals 2\t4\tA\tNo data available",
    "Sum 2026", "", "COP 3530\tData Struc/Algorithms\t3\tA\tMath Requirement",
    "Fall 2026", "", "CEN 3031\tIntro Software Engr\t3\tNo data available\tMath Requirement",
  ].join("\n");
  const rows = parseTranscript(paste, info);
  const row = (code: string) => rows.find((r) => r.code === code)!;

  it("reads Spr / Sum terms", () => {
    expect(row("COP3503C").term).toBe("Spring 2026");
    expect(row("COP3530").term).toBe("Summer 2026");
  });

  it("an ungraded class with credits is in progress", () => {
    expect(row("CEN3031").status).toBe("in-progress");
    expect(row("CEN3031").grade).toBeUndefined();
  });

  it("repeat attempts earn nothing; the attempt that counts is kept once", () => {
    expect(rows.filter((r) => r.code === "MAC2311")).toHaveLength(1);
    expect(row("MAC2311").grade).toBe("A");
  });

  it("keeps each transfer placeholder with its own credits", () => {
    expect([row("MASU000").credits, row("MASU000-2").credits]).toEqual([2, 3]);
  });

  it("the first subject-sorted run of an overfull first term is prior credit", () => {
    ["AMLL000", "ENC1101", "MAC2311", "MASU000", "MAS4105", "PHY2048"].forEach((code) =>
      expect([code, row(code).examCredit]).toEqual([code, true])
    );
    ["COP3502C", "EGN4912"].forEach((code) => expect([code, row(code).examCredit]).toEqual([code, false]));
  });

  it("an ordinary first term is left alone", () => {
    const light = parseTranscript(
      "Fall 2025\nMAC 2311\tCalc 1\t4\tA\t--\nFall 2025\nCOP 3502\tProg 1\t4\tA\t--\nFall 2025\nAML L000\tTransfer\t3\tB\t--",
      info
    );
    expect(light.find((r) => r.code === "MAC2311")!.examCredit).toBe(false);
  });
});
