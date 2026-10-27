import { completedCreditsOffPlan, createDefaultSemesters, PlanItem, requirementMet } from "./plannerLogic";
import { PrereqInfo, PrereqMap } from "../Cytoscape/prereqs";

const course = (code: string, prereq: string[][] = []): PrereqInfo => ({
  code,
  name: code,
  credits: 3,
  dept: "Test",
  prereq,
  softPrereq: [],
  coreq: [],
  concurrent: [],
  minGrade: null,
  standing: null,
  requirements: [],
  notes: [],
});

const info: PrereqMap = Object.fromEntries(
  [
    course("COP3502C"),
    course("COP3503C", [["COP3502"]]),
    course("COP3530", [["COP3503"]]),
    course("COP4600", [["COP3530"]]),
    course("CEN3031", [["COP3503"]]),
    course("ENC1101"),
  ].map((c) => [c.code, c])
);

const req = (label: string): PlanItem => ({ id: label, code: `REQ:${label}`, label, credits: 3 });

test("requirement cards read 'or' as any and '&' as all", () => {
  const done = new Set(["ENC1102", "PHY2048"]);
  expect(requirementMet(req("ENC 1101 or ENC 1102"), done)).toBe(true);
  expect(requirementMet(req("PHY 2048 & 2048L"), done)).toBe(false);
  expect(requirementMet(req("Quest 1"), done)).toBe(false);
});

test("finished courses off the plan count once, whatever the spelling", () => {
  expect(completedCreditsOffPlan(createDefaultSemesters(2026), info, new Set(["COP3502C", "COP3502", "ENC1101"]))).toBe(6);
});
