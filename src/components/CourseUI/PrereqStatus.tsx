import { useMemo } from "react";
import { PiCheckCircleFill, PiLockSimpleBold } from "react-icons/pi";
import { evaluateCourse } from "../Cytoscape/prereqs";
import { usePrereqInfo } from "../Cytoscape/usePrereqData";
import { describeMissing } from "./lookup";

const readCompleted = () => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem("completedCourses") || "[]"));
  } catch {
    return new Set<string>();
  }
};

const joinAnd = (items: string[]) =>
  items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;

// Checks the course's prereqs against the classes marked as taken in the Planner
const PrereqStatus: React.FC<{ code: string; term: string; year: string }> = ({ code, term, year }) => {
  const { info, variants } = usePrereqInfo(term, year);
  const completed = useMemo(readCompleted, []);
  if (!info) return null;
  if (!completed.size) {
    return (
      <p className="prereq-status muted">
        Mark the classes you've taken in the Planner and this will check the prereqs for you.
      </p>
    );
  }
  const result = evaluateCourse(code, info, completed, variants);
  if (result.status === "unknown") return null;
  if (result.status === "completed") {
    return (
      <p className="prereq-status good">
        <PiCheckCircleFill /> You've already taken this.
      </p>
    );
  }
  if (result.status === "eligible") {
    return (
      <p className="prereq-status good">
        <PiCheckCircleFill /> You've met the prereqs.
      </p>
    );
  }
  return (
    <p className="prereq-status bad">
      <PiLockSimpleBold /> Still need {joinAnd(describeMissing(result.missing))}.
    </p>
  );
};

export default PrereqStatus;
