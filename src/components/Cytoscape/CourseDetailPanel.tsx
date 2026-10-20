import React from "react";
import { IoClose, IoCheckmarkCircle } from "react-icons/io5";
import {
  baseCode,
  CourseEvaluation,
  CourseGroups,
  formatCode,
  PrereqInfo,
  PrereqMap,
} from "./prereqs";

interface CourseDetailPanelProps {
  code: string;
  info: PrereqMap;
  evaluation: CourseEvaluation;
  completed: Set<string>;
  unlocks: string[];
  onToggleCompleted: (done: boolean) => void;
  onSelect: (code: string) => void;
  onSearch: (code: string) => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<CourseEvaluation["status"], string> = {
  completed: "Completed",
  eligible: "You can take this",
  almost: "One step away",
  locked: "Locked",
  unknown: "Not offered this term",
};

const Groups: React.FC<{
  title: string;
  groups: CourseGroups;
  completed: Set<string>;
  onSelect: (code: string) => void;
}> = ({ title, groups, completed, onSelect }) => {
  if (groups.length === 0) return null;
  return (
    <div className="detail-section">
      <h4>{title}</h4>
      {groups.map((group, index) => (
        <div className="detail-group" key={index}>
          {group.length > 1 && <span className="detail-group-label">One of</span>}
          <div className="detail-chips">
            {group.map((code) => {
              const done = completed.has(code);
              return (
                <button
                  key={code}
                  className={`detail-chip${done ? " done" : ""}`}
                  onClick={() => onSelect(code)}
                >
                  {done && <IoCheckmarkCircle size={14} />}
                  {formatCode(code)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const CourseDetailPanel: React.FC<CourseDetailPanelProps> = ({
  code,
  info,
  evaluation,
  completed,
  unlocks,
  onToggleCompleted,
  onSelect,
  onSearch,
  onClose,
}) => {
  const course: PrereqInfo | undefined = info[code];
  const isCompleted = evaluation.status === "completed";

  return (
    <aside className="course-detail" aria-label={`Details for ${formatCode(code)}`}>
      <button className="detail-close" onClick={onClose} aria-label="Close details">
        <IoClose size={20} />
      </button>
      <h3>{formatCode(baseCode(code))}</h3>
      <p className="detail-name">{course?.name ?? "This course isn't offered this term."}</p>
      <div className="detail-meta">
        <span className={`status-pill status-${evaluation.status}`}>
          {STATUS_LABEL[evaluation.status]}
        </span>
        {course?.credits != null && <span>{course.credits} credits</span>}
      </div>

      {evaluation.status === "almost" && (
        <p className="detail-hint">
          Still needed: {evaluation.missing[0].map(formatCode).join(" or ")}
        </p>
      )}
      {evaluation.status === "locked" && (
        <p className="detail-hint">
          {evaluation.missing.length} requirements left (each group below that has no checkmark).
        </p>
      )}

      <div className="detail-actions">
        <button className="detail-primary" onClick={() => onToggleCompleted(!isCompleted)}>
          {isCompleted ? "Undo completed" : "Mark as completed"}
        </button>
        {course && (
          <button className="detail-secondary" onClick={() => onSearch(code)}>
            Find sections
          </button>
        )}
      </div>

      {course && (
        <>
          <Groups
            title="Prerequisites"
            groups={course.prereq}
            completed={completed}
            onSelect={onSelect}
          />
          <Groups
            title="Or with permission / other route"
            groups={course.softPrereq}
            completed={completed}
            onSelect={onSelect}
          />
          <Groups
            title="Take at the same time"
            groups={[...course.coreq, ...course.concurrent]}
            completed={completed}
            onSelect={onSelect}
          />
          {course.minGrade && (
            <p className="detail-note">Minimum grade of {course.minGrade} required.</p>
          )}
          {course.requirements.length > 0 && (
            <div className="detail-section">
              <h4>Also required</h4>
              <ul>
                {course.requirements.map((req) => (
                  <li key={req}>{req}</li>
                ))}
              </ul>
            </div>
          )}
          {course.notes.length > 0 && (
            <div className="detail-section">
              <h4>Notes</h4>
              <ul>
                {course.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {course.prereq.length === 0 &&
            course.softPrereq.length === 0 &&
            course.requirements.length === 0 && (
              <p className="detail-note">No prerequisites.</p>
            )}
        </>
      )}

      {unlocks.length > 0 && (
        <div className="detail-section">
          <h4>Unlocks</h4>
          <div className="detail-chips">
            {unlocks.slice(0, 12).map((unlockCode) => (
              <button key={unlockCode} className="detail-chip" onClick={() => onSelect(unlockCode)}>
                {formatCode(unlockCode)}
              </button>
            ))}
            {unlocks.length > 12 && <span className="detail-more">+{unlocks.length - 12} more</span>}
          </div>
        </div>
      )}
    </aside>
  );
};

export default CourseDetailPanel;
