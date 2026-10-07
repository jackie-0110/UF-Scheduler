import React from "react";
import { Course, Section, websiteURL } from "../CourseTypes";
import { courseUIClasses } from "../CourseUIClasses";
import { BiSolidLockOpen, BiSolidLockAlt } from "react-icons/bi";

interface CourseDropdownProps {
  course: Course;
  selectedCourses: Course[];
  setSelectedCourses: React.Dispatch<React.SetStateAction<Course[]>>;
}

const convertTo12HourFormat = (time: string): string => {
  const [hour, minute] = time.split(":");
  const hourNumber = Number(hour);
  const ampm = hourNumber >= 12 ? "PM" : "AM";
  const hour12Format =
    hourNumber > 12 ? hourNumber - 12 : hourNumber === 0 ? 12 : hourNumber;
  return `${hour12Format}:${minute} ${ampm}`;
};

const CourseDropdown: React.FC<CourseDropdownProps> = ({
  course,
  selectedCourses,
  setSelectedCourses,
}) => {
  const { listItem, content } = courseUIClasses;

  const waitListAvailable = (section: Section) => {
    if (section.waitList.total === section.waitList.cap) {
      return section.waitList.total + "/" + section.waitList.cap + " (Full)";
    }
    return section.waitList.total + "/" + section.waitList.cap;
  };

  const isSectionSelected = (section: Section) => {
    const selectedCourse = selectedCourses.find((c) => c.code === course.code && c.name === course.name);
    if (selectedCourse) {
      const selectedSection = selectedCourse.sections.find(
        (s) => s.classNumber === section.classNumber
      );
      return selectedSection?.selected === true;
    }
    return false;
  };

  const toggleSectionSelected = (section: Section) => {
    let courseExists = false;
    const updatedCourses = selectedCourses.map((c) => {
      // Check both the course code and name to ensure they match
      if (c.code === course.code && c.name === course.name) {
        courseExists = true;
        return {
          ...c,
          inPerson: false,
          sections: c.sections.map((s) => {
            if (s.classNumber === section.classNumber) {
              return {
                ...s,
                selected: !s.selected,
              };
            } else {
              // Deselect all other sections
              return {
                ...s,
                selected: false,
              };
            }
          }),
        };
      }
      return c;
    });
  
    // If the course doesn't exist in selectedCourses, add it
    if (!courseExists) {
      const newCourse = {
        ...course,
        inPerson: false,
        sections: course.sections.map((s) => {
          if (s.classNumber === section.classNumber) {
            return {
              ...s,
              selected: true,
            };
          } else {
            return {
              ...s,
              selected: false,
            };
          }
        }),
      };
      updatedCourses.push(newCourse);
    } else {
      // Check if all sections are not selected
      const selectedCourse = updatedCourses.find(
        (c) => c.code === course.code && c.name === course.name
      );
      if (selectedCourse && !selectedCourse.sections.some((s) => s.selected)) {
        // Remove the course from selectedCourses if no sections are selected
        return setSelectedCourses((prev) =>
          prev.filter((c) => !(c.code === course.code && c.name === course.name))
        );
      }
    }
  
    setSelectedCourses(updatedCourses);
  };  

  const getRatingColor = (rating: number | null): string => {
    if (rating === null) return "text-gray-700"; // Default
    if (rating <= 2) return "text-red-600"; // Red
    if (rating < 4) return "text-amber-600"; // Yellow
    return "text-green-600"; // Green
  };

  const getDifficultyColor = (difficulty: number | null): string => {
    if (difficulty === null) return "text-gray-700"; // Default
    if (difficulty <= 2) return "text-green-600"; // Green
    if (difficulty < 4) return "text-amber-600"; // Yellow
    return "text-red-600"; // Red
  };

  const renderSectionInformation = (section: Section) => {
    return (
      <div>
        {/* Star Icon based on section selected status */}

        <div className="text-gray-700">
          {section.instructors.length > 1 ? (
            <strong>Instructors: </strong>
          ) : (
            <strong>Instructor: </strong>
          )}
          {section.instructors.map((instructor, index) => (
            <div
              key={index}
              className="text-gray-700 flex justify-between"
            >
              <div className="instructor-name ml-2 flex-1">
                {instructor.name}
              </div>
              {instructor.avgRating != null && (
                <>
                  <div className="instructor-rating flex-1">
                    {"Rating: "}
                    <a
                      className={`font-bold whitespace-nowrap ${getRatingColor(
                        instructor.avgRating
                      )} underline`}
                      href={`${websiteURL}${instructor.professorID}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {instructor.avgRating.toFixed(1)}/5
                    </a>
                  </div>
                  <div className="instructor-difficulty flex-1">
                    {"Difficulty: "}
                    <a
                      className={`font-bold whitespace-nowrap ${getDifficultyColor(
                        instructor.avgDifficulty
                      )} underline`}
                      href={`${websiteURL}${instructor.professorID}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {instructor.avgDifficulty.toFixed(1)}/5
                    </a>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Meeting Times */}
        <div className="text-gray-700">
          <strong>Meeting Times:</strong>{" "}
          {section.meetTimes.length > 0 ? (
            section.meetTimes.map((meetingTime) => (
              <div
                key={
                  meetingTime.meetDays +
                  meetingTime.meetTimeBegin +
                  meetingTime.meetTimeEnd
                }
                className={`ml-2 text-gray-700`}
              >
                <strong>{meetingTime.meetDays.join(", ")}: </strong> &nbsp;{" "}
                {convertTo12HourFormat(meetingTime.meetTimeBegin)} -{" "}
                {convertTo12HourFormat(meetingTime.meetTimeEnd)} @{" "}
                {meetingTime.meetBuilding} {meetingTime.meetRoom}
              </div>
            ))
          ) : (
            <span className={`${content} text-gray-700`}>
              N/A
            </span>
          )}
        </div>

        {/* Render other section details if needed */}
      </div>
    );
  };

  return (
    <div
      className={`space-y-2 text-sm`}
    >
      <div className="list-none">
        {course.sections
          .sort((a, b) => a.waitList.total - b.waitList.total)
          .map((section, index) => (
            <li
              key={index}
              className="my-2 rounded-lg bg-neutral-100 border border-neutral-200"
            >
              <div className="space-y-2 p-2">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <div className="font-bold text-gray-700 flex items-center">
                    Class # {section.classNumber} -{" "}
                    {!section.waitList.total && section.waitList.cap > 0 ? (
                      <span className="text-green-600 ml-1">Open Seats</span>
                    ) : !section.waitList.total && !section.waitList.cap ? (
                      <span className="text-red-600 ml-1">Seats Unknown</span>
                    ) : (
                      section.waitList.total &&
                      section.waitList.cap && (
                        <span className="text-accent-1 ml-1">
                          Wait List: {waitListAvailable(section)}
                        </span>
                      )
                    )}
                  </div>
                  {/* Star Icon based on section selected status */}
                  <button
                    type="button"
                    className={`course-action${
                      isSectionSelected(section) ? " active" : ""
                    }`}
                    aria-pressed={isSectionSelected(section)}
                    onClick={() => toggleSectionSelected(section)}
                    title={
                      isSectionSelected(section)
                        ? "Go back to considering every section"
                        : "Build schedules with only this section of the course"
                    }
                  >
                    {isSectionSelected(section) ? (
                      <BiSolidLockAlt />
                    ) : (
                      <BiSolidLockOpen />
                    )}
                    {isSectionSelected(section)
                      ? "Using this section"
                      : "Use only this section"}
                  </button>
                </div>
                {renderSectionInformation(section)}
              </div>
            </li>
          ))}
        {course.sections.length === 0 && (
          <div
            className={`${listItem} ${content} text-gray-700`}
          >
            No sections found.
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseDropdown;
