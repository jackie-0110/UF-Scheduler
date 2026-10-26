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

test("unwraps parentheses around a whole part but keeps inner groups", () => {
  expect(
    splitPrereqs(
      "Prereq: BME 3060 and (CHM 3217 or (CHM 2210 and CHM 2211) with minimum grades of C)."
    )
  ).toEqual(["BME 3060", "CHM 3217 or (CHM 2210 and CHM 2211) with minimum grades of C"]);
});

test("leaves side-by-side groups alone", () => {
  expect(splitPrereqs("(CSD_BHS) with junior standing or (CSD_UMN)")).toEqual([
    "(CSD_BHS) with junior standing or (CSD_UMN)",
  ]);
});

test("splits on ampersands", () => {
  expect(splitPrereqs("EMA 3010 & (EGM 3520 with a C) & MAS 3114")).toEqual([
    "EMA 3010",
    "EGM 3520 with a C",
    "MAS 3114",
  ]);
});

test("splits sentences so a coreq gets its own part", () => {
  expect(
    splitPrereqs("Prereq: (PHY 2048 or PHY 2060) and (MAC 2311 or MAC 3472). Coreq: PHY 2049.")
  ).toEqual(["PHY 2048 or PHY 2060", "MAC 2311 or MAC 3472", "Coreq: PHY 2049"]);
});
