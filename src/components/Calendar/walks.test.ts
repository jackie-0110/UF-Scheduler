import { Section } from "../CourseUI/CourseTypes";
import { findBuilding, findWalks, walkMinutes } from "./walks";

const section = (code: string, days: string[], begin: string, end: string, bldg: string, building: string): Section =>
  ({
    courseCode: code,
    meetTimes: [{ meetDays: days, meetTimeBegin: begin, meetTimeEnd: end, meetBldgCode: bldg, meetBuilding: building, meetRoom: "1" }],
  } as unknown as Section);

test("looks up zero-padded building numbers", () => {
  expect(findBuilding("0042")?.name).toBe("Computer Sciences/Engineering");
  expect(findBuilding("0022")?.name).toBe("Carleton Auditorium");
  expect(findBuilding("")).toBeNull();
});

test("nearby buildings are a short walk", () => {
  const minutes = walkMinutes(findBuilding("0042")!, findBuilding("0655")!);
  expect(minutes).toBeGreaterThan(2);
  expect(minutes).toBeLessThan(15);
});

test("groups repeated walks by day and flags tight ones", () => {
  const walks = findWalks([
    section("MAC2312", ["M", "W", "F"], "09:35", "10:25", "0655", "LIT"),
    section("COP3530", ["M", "W", "F"], "10:40", "11:30", "0042", "CSE"),
    // far across campus with a 15 min break
    section("ENC3246", ["M", "W", "F"], "11:45", "12:35", "0720", "MAEB"),
  ]);
  expect(walks).toHaveLength(2);
  expect(walks[0].days).toEqual(["M", "W", "F"]);
  expect(walks[0].gap).toBe(15);
  expect(walks.every((w) => w.minutes > 0)).toBe(true);
});

test("ignores long breaks and same-building classes", () => {
  expect(
    findWalks([
      section("A", ["T"], "08:30", "09:20", "0042", "CSE"),
      section("B", ["T"], "09:35", "10:25", "0042", "CSE"),
      section("C", ["T"], "13:00", "14:00", "0655", "LIT"),
    ])
  ).toEqual([]);
});
