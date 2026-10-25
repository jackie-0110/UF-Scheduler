import { useState } from "react";
import { IoClose, IoLaptopOutline } from "react-icons/io5";
import { Section } from "../CourseUI/CourseTypes";
import InstructorRatings from "./InstructorRatings";

const sectionKey = (s: Section) => `${s.courseCode}|${s.classNumber}`;

const hasFinal = (finalExam?: string) =>
  !!finalExam?.trim() && finalExam.trim().toLowerCase() !== "none";

// Classes with no weekly meeting (usually online) can't go on the grid,
// so they get a row of chips under it instead.
const NoMeetingStrip: React.FC<{ sections: Section[] }> = ({ sections }) => {
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (!sections.length) return null;
  const open = sections.find((s) => sectionKey(s) === openKey);

  return (
    <div className="no-meeting-strip" aria-label="Classes without a weekly meeting time">
      <div className="no-meeting-row">
        <span className="no-meeting-label">
          <IoLaptopOutline size={15} aria-hidden />
          No set time
        </span>
        {sections.map((section) => {
          const key = sectionKey(section);
          const isOpen = key === openKey;
          return (
            <button
              key={key}
              type="button"
              className={`no-meeting-chip${isOpen ? " open" : ""}`}
              style={{ borderLeftColor: section.color }}
              aria-expanded={isOpen}
              onClick={() => setOpenKey(isOpen ? null : key)}
              title={section.courseName}
            >
              <strong>{section.courseCode.replace(/([A-Z]+)/g, "$1 ")}</strong>
              <span>{section.courseName}</span>
            </button>
          );
        })}
      </div>
      {open && (
        <div className="no-meeting-detail" role="region" aria-label={`${open.courseCode} details`}>
          <button
            type="button"
            className="week-grid-popover-close"
            onClick={() => setOpenKey(null)}
            aria-label="Close"
          >
            <IoClose size={16} />
          </button>
          <div className="week-grid-popover-title">
            <i style={{ backgroundColor: open.color }} />
            {open.courseCode.replace(/([A-Z]+)/g, "$1 ")}
          </div>
          <div className="week-grid-popover-name">{open.courseName}</div>
          <dl>
            <dt>Time</dt>
            <dd>No weekly meeting; often online or TBA</dd>
            {/^\d+$/.test(open.classNumber ?? "") && (
              <>
                <dt>Class #</dt>
                <dd>{open.classNumber}</dd>
              </>
            )}
            <dt>Credits</dt>
            <dd>{open.credits}</dd>
            {open.startDate && open.endDate && (
              <>
                <dt>Dates</dt>
                <dd>
                  {open.startDate} – {open.endDate}
                </dd>
              </>
            )}
            {hasFinal(open.finalExam) && (
              <>
                <dt>Final</dt>
                <dd>{open.finalExam}</dd>
              </>
            )}
          </dl>
          <InstructorRatings instructors={open.instructors} />
        </div>
      )}
    </div>
  );
};

export default NoMeetingStrip;
