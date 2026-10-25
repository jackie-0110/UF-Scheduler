import { splitPrereqs } from "./prereqText";

test("splits on and, commas and semicolons", () => {
  expect(splitPrereqs("Prereq: MAC 2311 and PHY 2048; CHM 2045, junior standing")).toEqual([
    "MAC 2311",
    "PHY 2048",
    "CHM 2045",
    "junior standing",
  ]);
});

test("keeps or-clauses and parentheses together", () => {
  expect(splitPrereqs("(COP 3502 and COP 3503) or CIS 3020 with a C or higher")).toEqual([
    "(COP 3502 and COP 3503) or CIS 3020 with a C or higher",
  ]);
});

test("empty or N/A gives no parts", () => {
  expect(splitPrereqs("")).toEqual([]);
  expect(splitPrereqs("N/A")).toEqual([]);
  expect(splitPrereqs(undefined)).toEqual([]);
});

test("does not split inside words like 'band'", () => {
  expect(splitPrereqs("Marching band experience")).toEqual(["Marching band experience"]);
});

test("drops the sentence's final period", () => {
  expect(splitPrereqs("Prereq: CDA 3101, COP 3530, and COP 4600.")).toEqual([
    "CDA 3101",
    "COP 3530",
    "COP 4600",
  ]);
});
