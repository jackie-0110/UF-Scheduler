import { Course } from "./CourseTypes";
import { getCourseTags } from "./courseTags";

const course = (sections: object[]) => ({ sections } as unknown as Course);

test("collects Quest, Gen Ed and writing tags across sections", () => {
  expect(
    getCourseTags(
      course([
        { quest: ["QUEST 1"], genEd: ["Humanities"], grWriting: "2" },
        { quest: [], genEd: ["International", "Humanities"], grWriting: "6" },
      ])
    )
  ).toEqual(["Quest 1", "Humanities", "International", "Writing 6k"]);
});

test("no designations means no tags", () => {
  expect(getCourseTags(course([{ quest: [], genEd: [], grWriting: "N" }]))).toEqual([]);
  expect(getCourseTags(course([{}]))).toEqual([]);
});
