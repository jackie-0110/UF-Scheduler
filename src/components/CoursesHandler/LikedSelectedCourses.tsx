import React from "react";
import { Course, Section } from "../CourseUI/CourseTypes";
import ColorHash from "color-hash";
import { IoClose } from "react-icons/io5";
import "./LikedSelectedStyles.css";

interface LikedSelectedCoursesProps {
  selectedCourses: Course[];
  setSelectedCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  setLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  customAppointments: any[];
  setCustomAppointments: React.Dispatch<React.SetStateAction<any[]>>;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setDebouncedSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setSearchTrigger: React.Dispatch<React.SetStateAction<boolean>>;
}

const colorHash = new ColorHash({
  saturation: [0.6, 0.61, 0.62, 0.63, 0.64, 0.65, 0.66, 0.67, 0.68, 0.69, 0.7],
  lightness: [0.4, 0.5, 0.6],
});

const getHashedColor = (course: Course) => {
  return colorHash.hex(course.code + course.name);
};

// Function to get the contrast color of the text based on the background color hex
function getContrastYIQ(hexcolor: string){
  var r = parseInt(hexcolor.substring(1,3),16);
  var g = parseInt(hexcolor.substring(3,5),16);
  var b = parseInt(hexcolor.substring(5,7),16);
  var yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? 'black' : 'white';
}

const getSelectedSection = (course: Course): Section | undefined => {
  return course.sections.find((section: Section) => section.selected === true);
};

const LikedSelectedCourses: React.FC<LikedSelectedCoursesProps> = ({
  selectedCourses,
  setSelectedCourses,
  setLoaded,
  customAppointments,
  setCustomAppointments,
  setSearchTerm,
  setDebouncedSearchTerm,
  setSearchTrigger,
}) => {
  const getCourseBackgroundColor = (course: Course) => {
    const hashedColor = getHashedColor(course);
    course.sections.map((section: Section) => {
      section.color = hashedColor;
    });
    return {
      backgroundColor: hashedColor,
    };
  };

  const handleBadgeClick = (course: Course) => {
    // Populate search box with course code and trigger search
    const searchQuery = course.code;
    setSearchTerm(searchQuery);
    setDebouncedSearchTerm(searchQuery);
    setSearchTrigger((prev) => !prev); // Toggle to trigger the search
  };

  const handleRemoveCourse = (e: React.MouseEvent, course: Course) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    setSelectedCourses((prevSelectedCourses) =>
      prevSelectedCourses.filter(
        (selectedCourse) =>
          selectedCourse.code !== course.code ||
          selectedCourse.name !== course.name
      )
    );
    setLoaded(true);
  };

  const handleRemoveAppointment = (e: React.MouseEvent, appointment: any) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    setCustomAppointments((prevAppointments) =>
      prevAppointments.filter(
        (selectedAppointment) => !(selectedAppointment === appointment)
      )
    );
    setLoaded(true);
  };

  if (selectedCourses.length === 0 && customAppointments.length === 0) {
    return null;
  }

  return (
    <div className="selected-chips" aria-label="Selected courses and events">
      {selectedCourses.map((course: Course) => {
        const selectedSection = getSelectedSection(course);
        const color = getHashedColor(course);
        const code = course.code.replace(/([A-Z]+)/g, "$1 ");
        const details = [
          course.name,
          course.inPerson ? "in-person sections only" : "",
          selectedSection ? `class # ${selectedSection.classNumber}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div
            key={`${course.code}|${course.name}`}
            className="course-chip fade-in"
            style={{
              ...getCourseBackgroundColor(course),
              color: getContrastYIQ(color),
            }}
            title={details}
          >
            <button
              type="button"
              className="course-chip-label"
              onClick={() => handleBadgeClick(course)}
            >
              <strong>
                {code}
                {course.termInd !== " " && course.termInd !== "C"
                  ? `- ${course.termInd}`
                  : ""}
              </strong>
              <span>
                {course.sections[0].credits} cr
                {selectedSection ? ` · #${selectedSection.classNumber}` : ""}
                {course.inPerson ? " · in-person" : ""}
              </span>
            </button>
            <button
              type="button"
              className="course-chip-remove"
              onClick={(e) => handleRemoveCourse(e, course)}
              aria-label={`Remove ${code}`}
            >
              <IoClose size={14} />
            </button>
          </div>
        );
      })}
      {customAppointments.map((appointment: any, index: number) => (
        <div
          key={`event-${index}`}
          className="course-chip fade-in"
          style={{
            backgroundColor: appointment.color,
            color: getContrastYIQ(appointment.color),
          }}
          title="Recurring event"
        >
          <span className="course-chip-label">
            <strong>{appointment.courseName}</strong>
            <span>
              {appointment.meetTimes
                .map((meetTime: any) => meetTime.meetDays.join(""))
                .join(", ")}{" "}
              {appointment.meetTimes[0].meetTimeBegin.replace(/^0/, "")}–
              {appointment.meetTimes[0].meetTimeEnd.replace(/^0/, "")}
            </span>
          </span>
          <button
            type="button"
            className="course-chip-remove"
            onClick={(e) => handleRemoveAppointment(e, appointment)}
            aria-label={`Remove ${appointment.courseName}`}
          >
            <IoClose size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
export default LikedSelectedCourses;
