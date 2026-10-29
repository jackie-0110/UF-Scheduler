import { Section } from "./CourseTypes";
import { describeMissing, sectionFit } from "./lookup";

const sec = (courseCode: string, days: string[], begin: string, end: string): Section =>
  ({
    courseCode,
    courseName: courseCode,
    classNumber: courseCode + begin,
    meetTimes: days.length ? [{ meetDays: days, meetTimeBegin: begin, meetTimeEnd: end, meetBuilding: "", meetBldgCode: "", meetRoom: "" }] : [],
  } as unknown as Section);

const schedule = [sec("COP3530", ["M", "W"], "10:40", "11:30"), sec("MAC2312", ["T"], "13:55", "14:45")];

test("a section that overlaps names the class it clashes with", () => {
  expect(sectionFit(sec("CHM2045", ["W"], "11:00", "11:50"), "CHM2045", schedule)).toEqual({
    kind: "clash",
    with: "COP 3530",
  });
  expect(sectionFit(sec("CHM2045", ["F"], "11:00", "11:50"), "CHM2045", schedule)).toEqual({ kind: "fits" });
});

test("other sections of a course already in the schedule are judged without it", () => {
  expect(sectionFit(sec("COP3530", ["M"], "10:40", "11:30"), "COP3530", schedule)).toEqual({ kind: "fits" });
});

test("no schedule or no meeting times give no verdict", () => {
  expect(sectionFit(sec("CHM2045", ["W"], "11:00", "11:50"), "CHM2045", [])).toEqual({ kind: "none" });
  expect(sectionFit(sec("CHM2045", [], "", ""), "CHM2045", schedule)).toEqual({ kind: "online" });
});

test("missing prereq groups read as 'A or B'", () => {
  expect(describeMissing([["CHM1025", "CHM2045"], ["MAC1147"]])).toEqual(["CHM 1025 or CHM 2045", "MAC 1147"]);
});
