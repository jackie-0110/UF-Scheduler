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

interface SemesterColumnProps {
  semester: PlanSemester;
  info: PrereqMap;
  violations: Map<string, PlanViolation>;
  completed: Set<string>;
  onRemove: (itemId: string) => void;
  onToggleCompleted: (code: string) => void;
}

const SemesterColumn: React.FC<SemesterColumnProps> = ({
  semester,
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
  const underloaded = !semester.summer && credits > 0 && credits < MIN_CREDITS;

  return (
    <div className={`planner-semester${semester.summer ? " summer" : ""}`}>
      <div className="planner-semester-head">
        <div>
          <span className="planner-season">{season}</span>
          <span className="planner-year">{year}</span>
        </div>
        <span
          className={`planner-credit-chip${overloaded || underloaded ? " over" : ""}`}
          title={
            underloaded
              ? `Under ${MIN_CREDITS} credits: below full-time status`
              : overloaded
              ? `Over ${limit} credits`
              : undefined
          }
        >
          {credits}
          {overloaded || underloaded ? " ⚠" : ""} cr
        </span>
      </div>
      <div className="planner-progress">
        <div
          className={overloaded || underloaded ? "over" : ""}
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
            violation={violations.get(item.id)}
            completed={completed.has(item.code)}
            onRemove={() => onRemove(item.id)}
            onToggleCompleted={() => onToggleCompleted(item.code)}
          />
        ))}
        {semester.items.length === 0 && <span className="planner-empty">drag courses here</span>}
      </div>
    </div>
  );
};

export default SemesterColumn;
