import React, { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { IoClose, IoSchoolOutline, IoWarningOutline } from "react-icons/io5";
import { formatCode, PrereqInfo } from "../Cytoscape/prereqs";
import { creditsOf, PlanViolation } from "./plannerLogic";

const CS_PREFIXES = ["COP", "CIS", "CDA", "COT", "CEN", "CAP", "CNT", "CGS"];
const MATH_PREFIXES = ["MAC", "MAP", "MAS", "STA", "MTG"];

export function deptAccent(code: string) {
  const prefix = code.slice(0, 3);
  if (CS_PREFIXES.includes(prefix)) return "var(--csu-blue)";
  if (MATH_PREFIXES.includes(prefix)) return "#10b981";
  if (prefix === "PHY") return "#8b5cf6";
  return "#f59e0b";
}

interface CourseCardProps {
  dragId: string;
  code: string;
  course?: PrereqInfo;
  violation?: PlanViolation;
  completed?: boolean;
  onRemove?: () => void;
  onToggleCompleted?: () => void;
}

export const CourseCardBody: React.FC<
  Omit<CourseCardProps, "dragId"> & { dragging?: boolean }
> = ({ code, course, violation, completed, onRemove, onToggleCompleted, dragging }) => {
  const [open, setOpen] = useState(false);
  const accent = violation ? "#f59e0b" : completed ? "#16a34a" : deptAccent(code);
  return (
    <div
      className={`planner-card${dragging ? " dragging" : ""}`}
      style={{ borderLeftColor: accent }}
    >
      <div className="planner-card-main">
        <div className="planner-card-top">
          <span className="planner-card-code">{formatCode(code)}</span>
          {onToggleCompleted && (
            <button
              type="button"
              className={`planner-icon-btn${completed ? " active" : ""}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleCompleted}
              aria-label={completed ? "Mark as not completed" : "Mark as completed"}
              title={completed ? "Mark as not completed" : "Mark as completed"}
            >
              <IoSchoolOutline size={14} />
            </button>
          )}
          {violation && (
            <span className="planner-warn-wrap">
              <button
                type="button"
                className="planner-icon-btn warn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setOpen((value) => !value)}
                aria-label="Prerequisite warning"
              >
                <IoWarningOutline size={15} />
              </button>
              {open && (
                <div className="planner-warn-pop" role="dialog">
                  <strong>Missing prerequisites</strong>
                  <ul>
                    {violation.missing.map((group, index) => (
                      <li key={index}>{group.map(formatCode).join(" or ")}</li>
                    ))}
                  </ul>
                  <p>Move these to an earlier semester, or mark them completed.</p>
                </div>
              )}
            </span>
          )}
        </div>
        <p className="planner-card-name">{course?.name ?? "Not in the course data"}</p>
        <span className="planner-card-credits">{creditsOf(course)} CR</span>
      </div>
      {onRemove && (
        <button
          type="button"
          className="planner-card-remove"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          aria-label={`Remove ${formatCode(code)}`}
        >
          <IoClose size={13} />
        </button>
      )}
    </div>
  );
};

const CourseCard: React.FC<CourseCardProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.dragId,
  });
  return (
    <div
      ref={setNodeRef}
      className="planner-draggable"
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }}
      {...listeners}
      {...attributes}
    >
      <CourseCardBody {...props} />
    </div>
  );
};

export default CourseCard;
