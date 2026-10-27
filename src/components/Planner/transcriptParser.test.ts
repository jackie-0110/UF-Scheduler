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

  it("reads tab-separated rows, counts P as completed, skips L000 placeholders", () => {
    const rows = parseTranscript(history, info);
    expect(rows.map((r) => [r.code, r.grade, r.status])).toEqual([
      ["COP3502C", "A", "completed"],
      ["MAC2311", "P", "completed"],
    ]);
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
