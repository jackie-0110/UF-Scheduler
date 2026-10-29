import { useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { formatCode, PrereqMap } from "../Cytoscape/prereqs";
import { PlanSemester, semesterCredits } from "./plannerLogic";
import { TermStatus } from "./terms";

interface MoveSheetProps {
  code: string;
  title: string;
  requirement: boolean;
  /** semester the card sits in now; null for catalog cards */
  fromId: string | null;
  semesters: PlanSemester[];
  statusOf: (semester: PlanSemester) => TermStatus;
  info: PrereqMap;
  completed: boolean;
  onMove: (semesterId: string) => void;
  onRemove: () => void;
  onToggleCompleted: () => void;
  onClose: () => void;
}

// Tap instead of drag: pick where a course goes. Dragging on a phone fights
// with scrolling, so this is the main way to plan there.
const MoveSheet: React.FC<MoveSheetProps> = ({
  code,
  title,
  requirement,
  fromId,
  semesters,
  statusOf,
  info,
  completed,
  onMove,
  onRemove,
  onToggleCompleted,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="planner-modal-backdrop move-sheet-backdrop" onClick={onClose}>
      <div
        className="planner-modal move-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Move ${title}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="planner-modal-head">
          <div>
            <h2>{requirement ? title : formatCode(code)}</h2>
            {!requirement && <p>{title}</p>}
          </div>
          <button type="button" className="cart-close" onClick={onClose} aria-label="Close">
            <IoClose size={20} />
          </button>
        </div>
        <span className="csu-label">{fromId ? "Move to" : "Add to"}</span>
        <ul className="move-sheet-terms">
          {semesters.map((semester) => {
            const status = statusOf(semester);
            const here = semester.id === fromId;
            return (
              <li key={semester.id}>
                <button
                  type="button"
                  disabled={here}
                  onClick={() => onMove(semester.id)}
                  className={status}
                >
                  <span>{semester.term}</span>
                  <span className="move-sheet-tag">
                    {here
                      ? "here now"
                      : status === "past"
                      ? "taken"
                      : status === "current"
                      ? "now"
                      : ""}
                  </span>
                  <span className="move-sheet-credits">{semesterCredits(semester, info)} cr</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="move-sheet-actions">
          {!requirement && (
            <button type="button" className="planner-ghost" onClick={onToggleCompleted}>
              {completed ? "Mark not completed" : "Mark completed"}
            </button>
          )}
          {fromId && (
            <button type="button" className="planner-ghost danger" onClick={onRemove}>
              Remove from plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoveSheet;
