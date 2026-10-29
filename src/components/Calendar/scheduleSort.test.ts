import { Section } from "../CourseUI/CourseTypes";
import { rankCombinations } from "./scheduleSort";

const section = (
  meets: [string[], string, string][],
  rating = 0,
  bldg = "0042"
): Section =>
  ({
    classNumber: "",
    courseCode: "X",
    instructors: rating ? [{ name: "A", avgRating: rating, avgDifficulty: 3, professorID: 1 }] : [],
    meetTimes: meets.map(([meetDays, meetTimeBegin, meetTimeEnd]) => ({
      meetDays,
      meetTimeBegin,
      meetTimeEnd,
      meetBuilding: "CSE",
      meetBldgCode: bldg,
      meetRoom: "1",
    })),
  } as unknown as Section);

const rank = (lists: Section[][], sort: string) => {
  const count = lists.reduce((p, l) => p * l.length, 1);
  return Array.from(rankCombinations(lists, count, sort));
};

test("fewest days prefers schedules that share days", () => {
  const a = [section([[["M", "W"], "09:00", "10:00"]])];
  const b = [
    section([[["T", "R"], "09:00", "10:00"]]),
    section([[["M", "W"], "11:00", "12:00"]]),
  ];
  expect(rank([a, b], "fewestDays")[0]).toBe(1);
});

test("most balanced spreads class time across the week", () => {
  const a = [section([[["M", "W", "F"], "09:00", "10:00"]])];
  const b = [
    section([[["M", "W", "F"], "11:00", "12:00"]]),
    section([[["T", "R"], "11:00", "12:30"]]),
  ];
  expect(rank([a, b], "mostBalanced")[0]).toBe(1);
});

test("best rated averages rated sections and puts unrated last", () => {
  const a = [section([[["M"], "09:00", "10:00"]], 3), section([[["M"], "09:00", "10:00"]], 5)];
  const b = [section([[["T"], "09:00", "10:00"]], 4)];
  expect(rank([a, b], "bestRated")).toEqual([1, 0]);
  expect(rank([[section([[["M"], "09:00", "10:00"]])], [section([[["T"], "09:00", "10:00"]], 2)]], "bestRated")).toEqual([0]);
  expect(rank([[section([[["M"], "09:00", "10:00"]]), section([[["M"], "09:00", "10:00"]], 1)]], "bestRated")).toEqual([1, 0]);
});

test("time sorts keep their old order", () => {
  const a = [section([[["M"], "10:00", "11:00"]]), section([[["M"], "08:00", "09:00"]])];
  expect(rank([a], "earliestStart")).toEqual([1, 0]);
  expect(rank([a], "latestEnd")).toEqual([0, 1]);
});
