import { Section } from "../CourseUI/CourseTypes";
import { findClashPairs, sectionsOverlap } from "./calendarConflictUtils";

const section = (code: string, days: string[], begin: string, end: string) =>
  ({
    courseCode: code,
    courseName: code,
    meetTimes: [
      {
        meetDays: days,
        meetTimeBegin: begin,
        meetTimeEnd: end,
        meetBuilding: "",
        meetBldgCode: "",
        meetRoom: "",
      },
    ],
  } as unknown as Section);

const online = (code: string) =>
  ({ courseCode: code, courseName: code, meetTimes: [] } as unknown as Section);

test("overlap needs a shared day and overlapping times", () => {
  expect(sectionsOverlap(section("A", ["M"], "09:00", "10:00"), section("B", ["M"], "09:30", "10:30"))).toBe(true);
  expect(sectionsOverlap(section("A", ["M"], "09:00", "10:00"), section("B", ["T"], "09:30", "10:30"))).toBe(false);
  expect(sectionsOverlap(section("A", ["M"], "09:00", "10:00"), section("B", ["M"], "10:00", "11:00"))).toBe(false);
});

test("a pair is reported only when no section choice avoids the clash", () => {
  const cop = [section("COP3502", ["M"], "09:00", "10:00")];
  const mac = [section("MAC2311", ["M"], "09:30", "10:30")];
  const phy = [
    section("PHY2048", ["M"], "09:00", "10:00"),
    section("PHY2048", ["T"], "09:00", "10:00"),
  ];
  expect(findClashPairs([cop, mac, phy])).toEqual([{ a: "COP 3502", b: "MAC 2311" }]);
});

test("online sections never clash", () => {
  expect(findClashPairs([[online("A")], [online("B")]])).toEqual([]);
});
