import { useEffect, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { Section } from "../CourseUI/CourseTypes";
import InstructorRatings from "../CourseUI/InstructorRatings";
import { contrastText } from "./WeekGrid";

const sectionKey = (s: Section) => `${s.courseCode}|${s.classNumber}`;

const hasFinal = (finalExam?: string) =>
  !!finalExam?.trim() && finalExam.trim().toLowerCase() !== "none";

const spacedCode = (code: string) => code.replace(/([A-Z]+)/g, "$1 ").trim();

// Classes with no weekly meeting (usually online) can't go on the grid,
// so they get a row of chips above it instead.
const NoMeetingStrip: React.FC<{ sections: Section[] }> = ({ sections }) => {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openKey) return;
    const close = (event: MouseEvent) => {
      if (!stripRef.current?.contains(event.target as Node)) setOpenKey(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openKey]);

  if (!sections.length) return null;
  const open = sections.find((s) => sectionKey(s) === openKey);

  return (
    <div
      className="no-meeting-strip"
      ref={stripRef}
      aria-label="Classes without a weekly meeting time"
    >
      <span className="csu-label">Online · no set time</span>
      <div className="no-meeting-row">
        {sections.map((section) => {
          const key = sectionKey(section);
          const isOpen = key === openKey;
          return (
            <button
              key={key}
              type="button"
              className="no-meeting-chip"
              style={{
                backgroundColor: section.color,
                color: contrastText(section.color),
              }}
              aria-expanded={isOpen}
              onClick={() => setOpenKey(isOpen ? null : key)}
            >
              <strong>{spacedCode(section.courseCode)}</strong>
              <span>{section.courseName}</span>
            </button>
          );
        })}
      </div>
      {open && (
        <div
          className="week-grid-popover no-meeting-popover"
          role="dialog"
          aria-label={`${open.courseCode} details`}
        >
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
            {spacedCode(open.courseCode)}
          </div>
          <div className="week-grid-popover-name">{open.courseName}</div>
          <dl>
            <dt>Time</dt>
            <dd>No weekly meeting</dd>
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
