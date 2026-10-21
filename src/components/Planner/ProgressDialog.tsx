import React, { useState } from "react";
import { IoClose } from "react-icons/io5";
import { formatCode, PrereqMap } from "../Cytoscape/prereqs";
import { aliasesOf, isRequirement, meetsMinimumGrade, PlanItem, PlanSemester } from "./plannerLogic";
import { majorNames } from "./majorPlans";
import { parseTranscript, TranscriptRow, TranscriptStatus } from "./transcriptParser";

interface ProgressDialogProps {
  semesters: PlanSemester[];
  info: PrereqMap;
  completed: Set<string>;
  onLoadMajor: (major: string) => void;
  onSetItemDone: (item: PlanItem, done: boolean) => void;
  onCompleteThrough: (semesterIndex: number) => void;
  onApplyTranscript: (entries: { code: string; grade?: string }[]) => void;
  onClose: () => void;
}

type Tab = "checklist" | "transcript";

const ProgressDialog: React.FC<ProgressDialogProps> = ({
  semesters,
  info,
  completed,
  onLoadMajor,
  onSetItemDone,
  onCompleteThrough,
  onApplyTranscript,
  onClose,
}) => {
  const [tab, setTab] = useState<Tab>("checklist");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<TranscriptRow[] | null>(null);
  const [applied, setApplied] = useState<number | null>(null);

  const hasPlan = semesters.some((semester) => semester.items.length > 0);
  const isDone = (item: PlanItem) =>
    isRequirement(item) ? !!item.done : aliasesOf(item.code).some((alias) => completed.has(alias));

  const readTranscript = () => {
    setApplied(null);
    setRows(parseTranscript(text, info));
  };

  const setStatus = (code: string, status: TranscriptStatus) =>
    setRows((prev) => prev && prev.map((row) => (row.code === code ? { ...row, status } : row)));

  const apply = () => {
    if (!rows) return;
    const entries = rows
      .filter((row) => row.status !== "ignore")
      .map((row) => ({ code: row.code, grade: row.status === "completed" ? row.grade : undefined }));
    onApplyTranscript(entries);
    setApplied(entries.length);
  };

  const counts = rows
    ? {
        completed: rows.filter((r) => r.status === "completed").length,
        progress: rows.filter((r) => r.status === "in-progress").length,
        ignored: rows.filter((r) => r.status === "ignore").length,
      }
    : null;

  return (
    <div
      className="planner-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="planner-modal" role="dialog" aria-modal="true" aria-label="My progress">
        <div className="planner-modal-head">
          <div>
            <h2>My progress</h2>
            <p>Tell the planner what you've already finished. Everything stays in your browser.</p>
          </div>
          <button className="planner-icon-btn" onClick={onClose} aria-label="Close">
            <IoClose size={20} />
          </button>
        </div>

        <div className="planner-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "checklist"}
            className={tab === "checklist" ? "active" : ""}
            onClick={() => setTab("checklist")}
          >
            Checklist
          </button>
          <button
            role="tab"
            aria-selected={tab === "transcript"}
            className={tab === "transcript" ? "active" : ""}
            onClick={() => setTab("transcript")}
          >
            Paste transcript
          </button>
        </div>

        {tab === "checklist" && (
          <>
            {!hasPlan ? (
              <>
                <p className="planner-hint">Start by choosing your major to load its plan.</p>
                <select
                  className="planner-major wide"
                  value=""
                  onChange={(e) => e.target.value && onLoadMajor(e.target.value)}
                  aria-label="Choose your major"
                >
                  <option value="">Choose your major…</option>
                  {majorNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="planner-field wide">
                  I've completed everything through
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value !== "") onCompleteThrough(Number(e.target.value));
                    }}
                  >
                    <option value="">Pick a semester…</option>
                    {semesters.map((semester, index) =>
                      semester.items.length === 0 ? null : (
                        <option key={semester.id} value={index}>
                          {semester.term}
                        </option>
                      )
                    )}
                  </select>
                </label>
                <div className="planner-checklist">
                  {semesters.map((semester, index) =>
                    semester.items.length === 0 ? null : (
                      <div key={semester.id} className="planner-check-group">
                        <h3>{semester.term}</h3>
                        {semester.items.map((item) => (
                          <label key={item.id} className="planner-check">
                            <input
                              type="checkbox"
                              checked={isDone(item)}
                              onChange={(e) => onSetItemDone(item, e.target.checked)}
                            />
                            <span>
                              <strong>
                                {isRequirement(item) ? "Requirement" : formatCode(item.code)}
                              </strong>{" "}
                              {info[item.code]?.name ?? item.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </>
        )}

        {tab === "transcript" && (
          <>
            <p className="planner-hint">
              In ONE.UF open your unofficial transcript (or degree audit), select all, copy, and
              paste it here. I look for course codes and grades on each line.
            </p>
            <textarea
              className="planner-textarea"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setRows(null);
                setApplied(null);
              }}
              placeholder={"COP 3502C  Programming Fundamentals 1  A  4.00\nMAC 2311  Analytic Geometry and Calculus 1  B+  4.00"}
              aria-label="Transcript text"
            />
            <button className="planner-primary" onClick={readTranscript} disabled={!text.trim()}>
              Read transcript
            </button>

            {rows && rows.length === 0 && (
              <p className="planner-error">
                I couldn't find any course codes (like COP 3502). Check that you copied the course
                lines.
              </p>
            )}
            {rows && counts && rows.length > 0 && (
              <>
                <p className="planner-hint">
                  Found {rows.length} courses: {counts.completed} completed, {counts.progress} in
                  progress, {counts.ignored} ignored (failed, withdrawn, or no grade). Fix any
                  status that looks wrong, then apply.
                </p>
                <div className="planner-table-wrap">
                  <table className="planner-table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Grade</th>
                        <th>Counts as</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const low =
                          row.status === "completed" && !meetsMinimumGrade(row.grade, "C");
                        return (
                          <tr key={row.code}>
                            <td>
                              <strong>{formatCode(row.code)}</strong>
                              <div className="planner-table-sub">
                                {row.title || "Unknown title"}
                                {!row.inCatalog && " · not in this term's catalog"}
                              </div>
                            </td>
                            <td>
                              {row.grade ?? "—"}
                              {low && <div className="planner-table-sub warn">Below a C</div>}
                            </td>
                            <td>
                              <select
                                value={row.status}
                                onChange={(e) =>
                                  setStatus(row.code, e.target.value as TranscriptStatus)
                                }
                                aria-label={`Status for ${formatCode(row.code)}`}
                              >
                                <option value="completed">Completed</option>
                                <option value="in-progress">In progress</option>
                                <option value="ignore">Ignore</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button className="planner-primary" onClick={apply}>
                  Apply to my plan
                </button>
                {applied !== null && (
                  <p className="planner-ok">
                    Marked {applied} courses as done. Close this window to see your plan update.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProgressDialog;
