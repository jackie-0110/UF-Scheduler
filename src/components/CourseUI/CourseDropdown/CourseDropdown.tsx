import React from "react";
import { Course, Section } from "../CourseTypes";
import { BiSolidLockOpen, BiSolidLockAlt } from "react-icons/bi";
import { PiXBold, PiArrowCounterClockwiseBold } from "react-icons/pi";
import InstructorRatings from "../InstructorRatings";
import "./CourseDropdown.css";

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
                excluded: false,
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
              excluded: false,
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

  const isSectionExcluded = (section: Section) => {
    const selectedCourse = selectedCourses.find((c) => c.code === course.code && c.name === course.name);
    return (
      selectedCourse?.sections.find((s) => s.classNumber === section.classNumber)?.excluded === true
    );
  };

  // Leaves one section out of every schedule; adds the course if it isn't selected yet
  const toggleSectionExcluded = (section: Section) => {
    const flip = (s: Section): Section =>
      s.classNumber === section.classNumber
        ? { ...s, excluded: !s.excluded, selected: false }
        : s;
    const isThis = (c: Course) => c.code === course.code && c.name === course.name;
    if (selectedCourses.some(isThis)) {
      setSelectedCourses(
        selectedCourses.map((c) => (isThis(c) ? { ...c, sections: c.sections.map(flip) } : c))
      );
    } else {
      setSelectedCourses([
        ...selectedCourses,
        { ...course, sections: course.sections.map((s) => flip({ ...s, selected: false })) },
      ]);
    }
  };

  const seatStatus = (section: Section) => {
    const { total, cap } = section.waitList;
    if (!total && cap > 0) return { tone: "open", text: "Open seats" };
    if (!total && !cap) return { tone: "unknown", text: "Seats unknown" };
    return { tone: "wait", text: `Wait list ${waitListAvailable(section)}` };
  };

  return (
    <div className="section-list">
      <span className="csu-label">Sections</span>
      <ul>
        {course.sections
          .sort((a, b) => a.waitList.total - b.waitList.total)
          .map((section, index) => {
            const selected = isSectionSelected(section);
            const excluded = isSectionExcluded(section);
            const seats = seatStatus(section);
            return (
              <li
                key={index}
                className={`section-card${selected ? " selected" : ""}${excluded ? " excluded" : ""}`}
              >
                <div className="section-card-head">
                  <div className="section-card-title">
                    <strong>Class #{section.classNumber}</strong>
                    <span className={`seat-pill ${seats.tone}`}>{seats.text}</span>
                  </div>
                  {!excluded && (
                  <button
                    type="button"
                    className={`course-action${selected ? " active" : ""}`}
                    aria-pressed={selected}
                    onClick={() => toggleSectionSelected(section)}
                    title={
                      selected
                        ? "Go back to considering every section"
                        : "Build schedules with only this section of the course"
                    }
                  >
                    {selected ? <BiSolidLockAlt /> : <BiSolidLockOpen />}
                    {selected ? "Using this section" : "Use only this section"}
                  </button>
                  )}
                  <button
                    type="button"
                    className="section-exclude"
                    onClick={() => toggleSectionExcluded(section)}
                    title={
                      excluded
                        ? "Consider this section again"
                        : "Leave this section out of every schedule"
                    }
                    aria-label={excluded ? "Restore this section" : "Exclude this section"}
                  >
                    {excluded ? <PiArrowCounterClockwiseBold /> : <PiXBold />}
                    {excluded && "Excluded · restore"}
                  </button>
                </div>
                {section.meetTimes.length > 0 ? (
                  <ul className="section-times">
                    {section.meetTimes.map((meetingTime) => (
                      <li
                        key={
                          meetingTime.meetDays +
                          meetingTime.meetTimeBegin +
                          meetingTime.meetTimeEnd
                        }
                      >
                        <b>{meetingTime.meetDays.join(" ")}</b>
                        <span>
                          {convertTo12HourFormat(meetingTime.meetTimeBegin)} –{" "}
                          {convertTo12HourFormat(meetingTime.meetTimeEnd)}
                        </span>
                        <span className="section-room">
                          {meetingTime.meetBuilding} {meetingTime.meetRoom}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="section-online">No weekly meeting time (online or TBA)</p>
                )}
                <InstructorRatings instructors={section.instructors} />
              </li>
            );
          })}
      </ul>
      {course.sections.length === 0 && (
        <p className="section-online">No sections found.</p>
      )}
    </div>
  );
};

export default CourseDropdown;
