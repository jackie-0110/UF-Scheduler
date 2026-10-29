jest.mock("axios", () => ({ post: jest.fn() }));

import { Course } from "../CourseUI/CourseTypes";
import { pickFriendSections } from "./copyFriend";

const course = (code: string, numbers: number[]) =>
  ({ code, name: code, sections: numbers.map((n) => ({ classNumber: n, credits: 3 })) } as unknown as Course);

test("each course is locked to the friend's section; missing ones are reported", () => {
  const friend = {
    v: 1 as const,
    name: "Alex",
    term: "fall",
    year: "26",
    classes: [
      { code: "COP3530", name: "", classNumber: "11473", meets: [] },
      { code: "", name: "Busy", classNumber: "", meets: [] },
      { code: "CHM2045", name: "", classNumber: "999", meets: [] },
    ],
  };
  const { courses, missing } = pickFriendSections(friend, [
    [course("COP3530", [11456, 11473])],
    [course("CHM2045", [15001])],
  ]);
  expect(courses).toHaveLength(1);
  expect(courses[0].sections.map((s) => s.selected)).toEqual([false, true]);
  expect(missing).toEqual(["CHM2045"]);
});
