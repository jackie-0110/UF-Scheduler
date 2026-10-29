import axios from "axios";
import { API_URLS } from "../../config/api";
import { Course } from "../CourseUI/CourseTypes";
import { SharedSchedule } from "./friends";

// Builds a course list from a friend's schedule, each course locked to their section
export const pickFriendSections = (friend: SharedSchedule, found: Course[][]) => {
  const courses: Course[] = [];
  const missing: string[] = [];
  friend.classes
    .filter((c) => c.code)
    .forEach((c, i) => {
      const course = (found[i] ?? []).find(
        (candidate) =>
          candidate.code === c.code &&
          candidate.sections.some((s) => String(s.classNumber) === c.classNumber)
      );
      if (!course) {
        missing.push(c.code);
        return;
      }
      courses.push({
        ...course,
        creditsEditable: course.sections[0]?.credits === "VAR",
        sections: course.sections.map((s) => ({
          ...s,
          selected: String(s.classNumber) === c.classNumber,
        })),
      });
    });
  return { courses, missing };
};

export const fetchFriendCourses = async (friend: SharedSchedule) => {
  const codes = friend.classes.filter((c) => c.code).map((c) => c.code);
  const found = await Promise.all(
    codes.map((code) =>
      axios
        .post(API_URLS.GET_COURSES, {
          searchTerm: code,
          itemsPerPage: 10,
          startFrom: 0,
          term: friend.term,
          year: friend.year,
        })
        .then((response) => response.data as Course[])
        .catch(() => [] as Course[])
    )
  );
  return pickFriendSections(friend, found);
};
