import React, { useState } from "react";
import { IoClose } from "react-icons/io5";
import { formatCode, PrereqMap } from "../Cytoscape/prereqs";
import {
  ArrangedPlan,
  arrangeCourses,
  ArrangeStrategy,
  creditsOf,
  PlanSemester,
} from "./plannerLogic";

interface ArrangeDialogProps {
  semesters: PlanSemester[];
  info: PrereqMap;
  completed: Set<string>;
  onAdopt: (arranged: string[][]) => void;
  onClose: () => void;
}

const LABELS: Record<ArrangeStrategy, { title: string; blurb: string }> = {
  early: {
    title: "Finish early",
    blurb: "Fills each semester up to your limit, so you finish as soon as the prerequisites allow.",
  },
  balanced: {
    title: "Balanced load",
    blurb: "Spreads credits across semesters so none is much heavier than the rest.",
  },
};

const ArrangeDialog: React.FC<ArrangeDialogProps> = ({
  semesters,
  info,
  completed,
  onAdopt,
  onClose,
}) => {
  const [maxCredits, setMaxCredits] = useState(15);
  const [results, setResults] = useState<ArrangedPlan[]>([]);
  const codes = semesters.flatMap((semester) => semester.items.map((item) => item.code));

  const generate = () =>
    setResults(
      (["early", "balanced"] as ArrangeStrategy[]).map((strategy) =>
        arrangeCourses(codes, semesters.length, info, completed, maxCredits, strategy)
      )
    );

  return (
    <div
      className="planner-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="planner-modal" role="dialog" aria-modal="true" aria-label="Arrange my plan">
        <div className="planner-modal-head">
          <div>
            <h2>Arrange my plan</h2>
            <p>
              Reorders the {codes.length} course{codes.length === 1 ? "" : "s"} you've placed so
              every prerequisite comes first.
            </p>
          </div>
          <button className="planner-icon-btn" onClick={onClose} aria-label="Close">
            <IoClose size={20} />
          </button>
        </div>

        {codes.length === 0 ? (
          <p className="planner-hint">Add some courses to your plan first.</p>
        ) : (
          <>
            <label className="planner-field">
              Max credits per semester
              <input
                type="number"
                min={6}
                max={21}
                value={maxCredits}
                onChange={(e) => setMaxCredits(Math.max(6, Math.min(21, Number(e.target.value))))}
              />
            </label>
            <button className="planner-primary" onClick={generate}>
              Generate options
            </button>

            <div className="planner-options">
              {results.map((result) => (
                <div className="planner-option" key={result.strategy}>
                  <h3>{LABELS[result.strategy].title}</h3>
                  <p>{LABELS[result.strategy].blurb}</p>
                  <ul>
                    {result.semesters.map((bucket, index) => {
                      if (bucket.length === 0) return null;
                      const credits = bucket.reduce((sum, code) => sum + creditsOf(info[code]), 0);
                      return (
                        <li key={index}>
                          <strong>
                            {semesters[index].term} · {credits} cr
                          </strong>
                          <span>{bucket.map(formatCode).join(", ")}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {result.warnings > 0 && (
                    <p className="planner-error">
                      {result.warnings} course{result.warnings === 1 ? "" : "s"} can't fit without
                      breaking a prerequisite or the credit limit.
                    </p>
                  )}
                  <button
                    className="planner-primary"
                    onClick={() => {
                      onAdopt(result.semesters);
                      onClose();
                    }}
                  >
                    Use this arrangement
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ArrangeDialog;
