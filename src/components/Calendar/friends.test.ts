import {
  busyByDay,
  decodeSchedule,
  encodeSchedule,
  formatBlock,
  freeTogether,
  SharedClass,
  sharedCourses,
  upsertFriend,
} from "./friends";

const cls = (code: string, classNumber: string, ...meets: [string, string, string][]): SharedClass => ({
  code,
  name: code,
  classNumber,
  meets: meets.map(([d, s, e]) => [d, s, e, ""]),
});

test("schedule survives a round trip through the link, unicode included", () => {
  const schedule = {
    v: 1 as const,
    name: "Zoë",
    term: "fall",
    year: "26",
    classes: [cls("COP3530", "11456", ["W", "10:40", "11:30"])],
  };
  expect(decodeSchedule(encodeSchedule(schedule))).toEqual(schedule);
  expect(encodeSchedule(schedule)).not.toMatch(/[+/=]/);
});

test("garbage links decode to null", () => {
  expect(decodeSchedule("not-a-schedule")).toBeNull();
  expect(decodeSchedule(btoa(JSON.stringify({ v: 2 })))).toBeNull();
});

test("busy blocks merge overlaps per day", () => {
  const busy = busyByDay([
    cls("A", "1", ["MW", "9:35", "10:25"]),
    cls("B", "2", ["M", "10:00", "11:30"]),
  ]);
  expect(busy[0]).toEqual([{ start: 575, end: 690 }]);
  expect(busy[2]).toEqual([{ start: 575, end: 625 }]);
  expect(busy[1]).toEqual([]);
});

test("free time skips gaps under 30 minutes and stays inside 8am–6pm", () => {
  const mine = [{ start: 7 * 60 + 25, end: 9 * 60 }, { start: 10 * 60 + 40, end: 11 * 60 + 30 }];
  const theirs = [{ start: 11 * 60 + 45, end: 12 * 60 + 35 }, { start: 17 * 60, end: 19 * 60 }];
  expect(freeTogether(mine, theirs)).toEqual([
    { start: 540, end: 640 },
    { start: 755, end: 1020 },
  ]);
  expect(freeTogether([], [])).toEqual([{ start: 480, end: 1080 }]);
});

test("shared courses flag same vs different sections and skip personal events", () => {
  const mine = [cls("COP3530", "11456"), cls("", "")];
  const theirs = [cls("COP3530", "11473"), cls("MAC2312", "1"), cls("", "")];
  expect(sharedCourses(mine, theirs)).toEqual([
    { code: "COP3530", name: "COP3530", sameSection: false, classNumber: "11473" },
  ]);
  expect(sharedCourses([cls("COP3530", "11473")], theirs)[0].sameSection).toBe(true);
});

test("times format compactly", () => {
  expect(formatBlock({ start: 540, end: 640 })).toBe("9–10:40am");
  expect(formatBlock({ start: 690, end: 795 })).toBe("11:30am–1:15pm");
});

test("re-sharing replaces the friend's older schedule for that term", () => {
  const a = { v: 1 as const, name: "Sam", term: "fall", year: "26", classes: [] };
  const b = { ...a, classes: [cls("X", "1")] };
  const other = { ...a, term: "spring", year: "27" };
  expect(upsertFriend([a, other], b)).toEqual([b, other]);
});
