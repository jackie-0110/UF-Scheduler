import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";
import { PiEyeBold, PiEyeSlashBold } from "react-icons/pi";
import { Course } from "../CourseUI/CourseTypes";
import CourseDropdown from "../CourseUI/CourseDropdown/CourseDropdown";
import PrerequisiteList from "../CourseUI/PrerequisiteList";
import "./CourseDetailDialog.css";

interface CourseDetailDialogProps {
  course: Course;
  selectedCourses: Course[];
  setSelectedCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  setLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  onSearch: (query: string) => void;
  onClose: () => void;
}

const CourseDetailDialog: React.FC<CourseDetailDialogProps> = ({
  course,
  selectedCourses,
  setSelectedCourses,
  setLoaded,
  onSearch,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleHidden = () => {
    setSelectedCourses((prev) =>
      prev.map((c) =>
        c.code === course.code && c.name === course.name
          ? { ...c, excludedFromSchedule: !c.excludedFromSchedule }
          : c
      )
    );
    setLoaded(true);
  };

  const code = course.code.replace(/([A-Z]+)/g, "$1 ");
  const hidden = !!course.excludedFromSchedule;

  return createPortal(
    <div className="course-dialog-backdrop" onClick={onClose}>
      <div
        className="course-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="course-dialog-head">
          <div>
            <h2 id="course-dialog-title">
              {code}
              {course.termInd !== " " && course.termInd !== "C"
                ? ` - ${course.termInd}`
                : ""}
            </h2>
            <p>{course.name}</p>
          </div>
          <button
            type="button"
            className="course-dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            <IoClose size={20} />
          </button>
        </header>
        <div className="course-dialog-body">
          <section>
            <span className="csu-label">Description</span>
            <p>
              {course.description
                ? course.description.replace("(P)", "").trim()
                : "No description listed."}
            </p>
          </section>
          <section className="result-prereqs">
            <span className="csu-label">Prereqs</span>
            <PrerequisiteList
              prerequisites={course.prerequisites}
              onCourseCode={onSearch}
            />
          </section>
          <div className="course-dialog-actions">
            <button type="button" onClick={() => onSearch(course.code)}>
              Find in course search
            </button>
            <button type="button" onClick={toggleHidden}>
              {hidden ? (
                <PiEyeSlashBold size={15} aria-hidden />
              ) : (
                <PiEyeBold size={15} aria-hidden />
              )}
              {hidden ? "Include in schedules" : "Hide from schedules"}
            </button>
          </div>
          <CourseDropdown
            course={course}
            selectedCourses={selectedCourses}
            setSelectedCourses={setSelectedCourses}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CourseDetailDialog;
