import React from "react";
import { useDroppable } from "@dnd-kit/core";
import CourseCard from "./CourseCard";
import { PrereqMap } from "../Cytoscape/prereqs";
import {
  creditLimitOf,
  isRequirement,
  MIN_CREDITS,
  PlanSemester,
  PlanViolation,
  semesterCredits,
} from "./plannerLogic";
import { TermStatus } from "./terms";
import { IoCheckmarkCircle } from "react-icons/io5";

interface SemesterColumnProps {
  semester: PlanSemester;
  status: TermStatus;
  /** Final term: under 12 credits is fine (reduced load to graduate) */
  isLast?: boolean;
  onMarkDone: () => void;
  info: PrereqMap;
  violations: Map<string, PlanViolation>;
  completed: Set<string>;
  onRemove: (itemId: string) => void;
  onToggleCompleted: (code: string) => void;
}

const SemesterColumn: React.FC<SemesterColumnProps> = ({
  semester,
  status,
  isLast,
  onMarkDone,
  info,
  violations,
  completed,
  onRemove,
  onToggleCompleted,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `sem:${semester.id}` });
  const [season, year] = semester.term.split(" ");
  const credits = semesterCredits(semester, info);
  const limit = creditLimitOf(semester);
  const overloaded = credits > limit;
  const underloaded = !semester.summer && !isLast && credits > 0 && credits < MIN_CREDITS;
  const isDone = (item: (typeof semester.items)[number]) =>
    isRequirement(item) ? !!item.done : item.taken === "done" || completed.has(item.code);
  const allDone = semester.items.length > 0 && semester.items.every(isDone);
  const inProgress = semester.items.some((item) => item.taken === "in-progress");
  // load warnings only matter for terms you can still change
  const warnLoad = status === "future" || (status === "current" && !inProgress);

  return (
    <div className={`planner-semester${semester.summer ? " summer" : ""} ${status}`}>
      <div className="planner-semester-head">
        <div>
          <span className="planner-season">{season}</span>
          <span className="planner-year">{year}</span>
          {status === "current" && <span className="planner-term-tag now">Now</span>}
          {status === "past" && allDone && (
            <span className="planner-term-tag done">
              <IoCheckmarkCircle size={12} aria-hidden /> Done
            </span>
          )}
          {status === "past" && !allDone && semester.items.length > 0 && (
            <button
              type="button"
              className="planner-term-tag action"
              onClick={onMarkDone}
              title="Mark every course this term as finished"
            >
              Mark done
            </button>
          )}
        </div>
        <span
          className={`planner-credit-chip${warnLoad && (overloaded || underloaded) ? " over" : ""}`}
          title={
            !warnLoad
              ? undefined
              : underloaded
              ? `Under ${MIN_CREDITS} credits: below full-time status`
              : overloaded
              ? `Over ${limit} credits`
              : undefined
          }
        >
          {credits}
          {warnLoad && (overloaded || underloaded) ? " ⚠" : ""} cr
        </span>
      </div>
      <div className="planner-progress">
        <div
          className={warnLoad && (overloaded || underloaded) ? "over" : ""}
          style={{ width: `${Math.min(100, (credits / limit) * 100)}%` }}
        />
      </div>
      <div
        ref={setNodeRef}
        className={`planner-dropzone${isOver ? " over" : ""}${overloaded ? " overloaded" : ""}`}
      >
        {semester.items.map((item) => (
          <CourseCard
            key={item.id}
            dragId={`item:${item.id}`}
            code={item.code}
            course={info[item.code]}
            label={item.label}
            credits={item.credits}
            requirement={isRequirement(item)}
            done={isRequirement(item) ? item.done : undefined}
            violation={violations.get(item.id)}
            completed={item.taken === "done" || completed.has(item.code)}
            taken={item.taken}
            grade={item.grade}
            counts={item.counts}
            onRemove={() => onRemove(item.id)}
            onToggleCompleted={() => onToggleCompleted(item.code)}
          />
        ))}
        {semester.items.length === 0 && (
          <span className="planner-empty">
            {status === "past" ? "nothing taken" : "drag courses here"}
          </span>
        )}
      </div>
    </div>
  );
};

export default SemesterColumn;
