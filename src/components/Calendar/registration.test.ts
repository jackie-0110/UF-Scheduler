import { Course, Section } from "../CourseUI/CourseTypes";
import { buildCart, meetingSummary } from "./registration";

const meet = (meetDays: string[], meetTimeBegin: string, meetTimeEnd: string, meetBuilding = "CAR", meetRoom = "100") => ({
  meetDays, meetTimeBegin, meetTimeEnd, meetBuilding, meetBldgCode: "", meetRoom,
});

const section = (courseCode: string, classNumber: string, meetTimes: any[], rating = 0): Section =>
  ({
    courseCode,
    classNumber,
    courseName: courseCode,
    meetTimes,
    instructors: rating ? [{ name: "A", avgRating: rating, avgDifficulty: 2, professorID: 1 }] : [],
  } as unknown as Section);

const lecture = meet(["T"], "13:55", "14:45");
const a1 = section("COP3530", "1", [lecture, meet(["W"], "10:40", "11:30", "MCCA", "G186")]);
const a2 = section("COP3530", "2", [lecture, meet(["W"], "12:50", "13:40", "RNK", "110")], 4);
const a3 = section("COP3530", "3", [lecture, meet(["W"], "09:35", "10:25")], 5);
const b1 = section("MAC2312", "9", [meet(["W"], "09:35", "10:25")]);
const b2 = section("MAC2312", "8", [meet(["M"], "08:30", "09:20")]);

const courses = [
  { code: "COP3530", sections: [a1, a2, a3] },
  { code: "MAC2312", sections: [b1, b2] },
] as unknown as Course[];

test("backups skip sections that clash with the rest of the schedule", () => {
  const cart = buildCart([a1, b1], courses);
  const cop = cart.find((row) => row.section === a1)!;
  // a3 meets at the same time as MAC2312
  expect(cop.backups.map((s) => s.classNumber)).toEqual(["2"]);
});

test("courses with fewer fallbacks come first", () => {
  const cart = buildCart([a1, b1], courses);
  expect(cart.map((row) => row.fits)).toEqual([1, 1]);
  const tight = buildCart([a3, b2], courses);
  expect(tight[0].section.courseCode).toBe("MAC2312");
});

test("backups fold the shared lecture", () => {
  expect(meetingSummary(a2, a1)).toBe("Same lecture, W 12:50–1:40 · RNK 110");
  expect(meetingSummary(a1)).toBe("T 1:55–2:45 · CAR 100, W 10:40–11:30 · MCCA G186");
  expect(meetingSummary(section("X", "1", []))).toBe("Online · no set time");
});
