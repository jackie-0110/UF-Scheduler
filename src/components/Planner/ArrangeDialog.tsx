import React, { useState } from "react";
import { IoClose } from "react-icons/io5";
import { formatCode, PrereqMap } from "../Cytoscape/prereqs";
import {
  ArrangedPlan,
  arrangeCourses,
  ArrangeStrategy,
  isRequirement,
  itemCredits,
  MIN_CREDITS,
  PlanItem,
  PlanSemester,
  creditLimitOf,
  semesterCredits,
  underloadedSemesters,
  validatePlan,
} from "./plannerLogic";

interface ArrangeDialogProps {
  semesters: PlanSemester[];
  info: PrereqMap;
  completed: Set<string>;
  onAdopt: (arranged: PlanItem[][]) => void;
  onClose: () => void;
}

const MIN_CAP = 6;
const MAX_CAP = 21;

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
  const [results, setResults] = useState<ArrangedPlan[]>([]);
  const [generated, setGenerated] = useState(false);
  const movable = semesters.flatMap((semester) =>
    semester.items.filter((item) => !isRequirement(item))
  );
  const fixed = semesters.map((semester) => semester.items.filter(isRequirement));
  const codes = movable.map((item) => item.code);
  const allowed = semesters.map((semester) => !semester.summer);
  // a big plan (say 120+ credits over eight semesters) needs a higher cap than 15 to fit
  const totalPlanned = semesters.reduce(
    (sum, semester) => sum + semester.items.reduce((s, item) => s + itemCredits(item, info), 0),
    0
  );
  const regularCount = allowed.filter(Boolean).length || 1;
  const [maxCredits, setMaxCredits] = useState(
    Math.min(MAX_CAP, Math.max(15, Math.ceil(totalPlanned / regularCount)))
  );
  // typed text, applied on blur or Enter so "18" isn't clamped after the "1"
  const [draft, setDraft] = useState(String(maxCredits));
  const changeMax = (value: number) => {
    const next = Number.isFinite(value) && value > 0 ? Math.max(MIN_CAP, Math.min(MAX_CAP, value)) : maxCredits;
    setMaxCredits(next);
    setDraft(String(next));
    // old options were built with the old cap
    setResults([]);
    setGenerated(false);
  };

  // How the plan is doing now, so an arrangement is only offered if it actually helps
  const current = {
    warnings: validatePlan(semesters, info, completed).size,
    over: semesters.filter((s) => semesterCredits(s, info) > creditLimitOf(s)).length,
    under: underloadedSemesters(semesters, info).length,
  };
  const score = (warnings: number, over: number, under: number) =>
    warnings * 10000 + over * 100 + under;

  const generate = () => {
    const all = (["early", "balanced"] as ArrangeStrategy[]).map((strategy) =>
      arrangeCourses(movable, fixed, allowed, info, completed, maxCredits, strategy)
    );
    const better = all.filter((result) => {
      const resultSemesters = semesters.map((semester, index) => ({
        ...semester,
        items: [...fixed[index], ...result.semesters[index]],
      }));
      const over = resultSemesters.filter((s) => semesterCredits(s, info) > creditLimitOf(s)).length;
      return (
        score(result.warnings, over, result.underMin) <
        score(current.warnings, current.over, current.under)
      );
    });
    setResults(better);
    setGenerated(true);
  };

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
              every prerequisite comes first and each semester has at least {MIN_CREDITS} credits
              where possible.
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
            <div className="planner-field">
              <span id="max-credits-label">Max credits per semester</span>
              <div className="planner-stepper" role="group" aria-labelledby="max-credits-label">
                <button
                  type="button"
                  onClick={() => changeMax(maxCredits - 1)}
                  disabled={maxCredits <= MIN_CAP}
                  aria-label="Fewer credits"
                >
                  −
                </button>
                <input
                  inputMode="numeric"
                  value={draft}
                  aria-labelledby="max-credits-label"
                  onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  onBlur={() => changeMax(Number(draft))}
                  onKeyDown={(e) => e.key === "Enter" && changeMax(Number(draft))}
                />
                <button
                  type="button"
                  onClick={() => changeMax(maxCredits + 1)}
                  disabled={maxCredits >= MAX_CAP}
                  aria-label="More credits"
                >
                  +
                </button>
              </div>
              <span className="planner-field-note">
                {MIN_CAP}–{MAX_CAP}. UF full-time is {MIN_CREDITS}+; over 18 needs approval.
              </span>
            </div>
            <button className="planner-primary" onClick={generate}>
              Generate options
            </button>

            {generated && results.length === 0 && (
              <p className="planner-hint">
                I couldn't find an arrangement that's better than your current plan
                {current.warnings + current.over + current.under === 0
                  ? ": it already meets every prerequisite and credit rule."
                  : ` (it has ${current.warnings} prerequisite problem${
                      current.warnings === 1 ? "" : "s"
                    }, ${current.over} overloaded and ${current.under} light semester${
                      current.under === 1 ? "" : "s"
                    }). Try a higher credit cap.`}
              </p>
            )}
            <div className="planner-options">
              {results.map((result) => (
                <div className="planner-option" key={result.strategy}>
                  <h3>{LABELS[result.strategy].title}</h3>
                  <p>{LABELS[result.strategy].blurb}</p>
                  <ul>
                    {result.semesters.map((bucket, index) => {
                      const all = [...fixed[index], ...bucket];
                      if (all.length === 0) return null;
                      const credits = all.reduce((sum, item) => sum + itemCredits(item, info), 0);
                      return (
                        <li key={index}>
                          <strong>
                            {semesters[index].term} · {credits} cr
                            {credits < MIN_CREDITS ? " ⚠" : ""}
                          </strong>
                          <span>
                            {bucket.map((item) => formatCode(item.code)).join(", ") || "Requirements only"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {result.underMin > 0 && (
                    <p className="planner-error">
                      {result.underMin} semester{result.underMin === 1 ? "" : "s"} still under{" "}
                      {MIN_CREDITS} credits (not enough courses, or prerequisites force it).
                    </p>
                  )}
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
