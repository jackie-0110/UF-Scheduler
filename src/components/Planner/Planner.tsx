import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  IoCheckmarkCircleOutline,
  IoClose,
  IoDownloadOutline,
  IoSparklesOutline,
  IoTrashOutline,
  IoWarningOutline,
} from "react-icons/io5";
import ClipLoader from "react-spinners/ClipLoader";
import { useCompletedCourses } from "../Cytoscape/usePrereqData";
import { buildVariantIndex, formatCode } from "../Cytoscape/prereqs";
import CatalogSidebar from "./CatalogSidebar";
import { CourseCardBody } from "./CourseCard";
import SemesterColumn from "./SemesterColumn";
import ArrangeDialog from "./ArrangeDialog";
import ProgressDialog from "./ProgressDialog";
import { useNowTerm, usePlan, usePlannerCatalog } from "./usePlanner";
import { termChoices, termOf, termStatus } from "./terms";
import { AttrMap, planFromTranscript, SUMMER_REQUIRED, TranscriptPlan } from "./transcriptPlan";
import { TranscriptRow } from "./transcriptParser";
import {
  completedCredits,
  completedCreditsOffPlan,
  DEGREE_CREDITS,
  isRequirement,
  MIN_CREDITS,
  itemCredits,
  lastRegularWithCourses,
  PlanSemester,
  totalCredits,
  underloadedSemesters,
  validatePlan,
} from "./plannerLogic";
import { buildMajorPlan, majorNames } from "./majorPlans";
import { exportPlanToPdf } from "./plannerPdf";
import "./PlannerStyles.css";

const NO_VARIANTS = new Map<string, string[]>();
const MAJOR_KEY = "plannerMajor";

const Planner: React.FC = () => {
  const { info, loading, error } = usePlannerCatalog();
  // Marking COP3502C completed also marks COP3502, so the prerequisite graph agrees
  const variants = useMemo(() => (info ? buildVariantIndex(info) : NO_VARIANTS), [info]);
  const { completed, grades, credits: transcriptCredits, setCourseCompleted, markCompleted } =
    useCompletedCourses(variants);
  const {
    semesters,
    placedCodes,
    addCourse,
    moveItem,
    removeItem,
    clearPlan,
    adoptArrangement,
    replaceItems,
    replaceSemesters,
    setStart,
    markSemesterDone,
    setItemDone,
    completeRequirementsThrough,
  } = usePlan();
  const { now, isAuto, setNow } = useNowTerm();
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showSummers, setShowSummers] = useState(false);
  // the plan as it was before a transcript repacked it
  const [undo, setUndo] = useState<{ before: PlanSemester[]; result: TranscriptPlan } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  // courses already taken are history: no prerequisite warnings on them
  const violations = useMemo(() => {
    if (!info) return new Map();
    const all = validatePlan(semesters, info, completed, grades);
    semesters.forEach((semester) =>
      semester.items.forEach((item) => item.taken && all.delete(item.id))
    );
    return all;
  }, [semesters, info, completed, grades]);
  // finished courses that aren't on the plan still count toward the degree
  const offPlan = info ? completedCreditsOffPlan(semesters, info, completed, transcriptCredits) : 0;
  const credits = info ? totalCredits(semesters, info) + offPlan : 0;
  const doneCredits = info ? completedCredits(semesters, info, completed) + offPlan : 0;
  const lightSemesters = info ? underloadedSemesters(semesters, info).length : 0;
  const summerCredits = info
    ? semesters
        .filter((s) => s.summer)
        .reduce((sum, s) => sum + s.items.reduce((t, item) => t + itemCredits(item, info), 0), 0)
    : 0;

  // remembered so a transcript rebuild knows which major's electives apply
  const [major, setMajor] = useState(() => {
    try {
      return localStorage.getItem(MAJOR_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });

  const loadMajor = (name: string) => {
    if (!name || !info) return;
    const hasWork = semesters.some((semester) => semester.items.length > 0);
    if (hasWork && !window.confirm(`Replace your current plan with the ${name} model plan?`)) {
      return;
    }
    replaceItems(buildMajorPlan(name, info, semesters));
    setMajor(name);
    try {
      localStorage.setItem(MAJOR_KEY, name);
    } catch {
      // storage unavailable
    }
  };

  const lastTerm = lastRegularWithCourses(semesters);

  const startChoices = useMemo(() => {
    const choices = termChoices(now, 15, 3);
    const start = semesters[0]?.term;
    return start && !choices.includes(start) ? [start, ...choices] : choices;
  }, [now, semesters]);

  const yearGroups = useMemo(() => {
    const groups: { label: string; items: typeof semesters }[] = [];
    semesters.forEach((semester) => {
      if (semester.summer && !showSummers && semester.items.length === 0) return;
      const last = groups[groups.length - 1];
      if (last && last.label === `Year ${semester.yearIndex + 1}`) last.items.push(semester);
      else groups.push({ label: `Year ${semester.yearIndex + 1}`, items: [semester] });
    });
    return groups;
  }, [semesters, showSummers]);

  const toggleCompleted = (code: string) => setCourseCompleted(code, !completed.has(code));

  const setItemCompleted = (item: { id: string; code: string }, done: boolean) => {
    if (isRequirement(item as never)) setItemDone(item.id, done);
    else setCourseCompleted(item.code, done);
  };

  const completeThrough = (index: number) => {
    const codes = semesters
      .slice(0, index + 1)
      .flatMap((semester) => semester.items.filter((item) => !isRequirement(item)))
      .map((item) => ({ code: item.code }));
    markCompleted(codes);
    completeRequirementsThrough(index + 1);
  };

  const applyTranscript = (rows: TranscriptRow[], attrs: AttrMap) => {
    const kept = rows.filter((row) => row.status !== "ignore");
    markCompleted(
      kept
        .filter((row) => row.status === "completed")
        .map((row) => ({ code: row.code, grade: row.grade, credits: row.credits }))
    );
    if (!info) return;
    const result = planFromTranscript(
      semesters,
      kept.map((row) => ({
        code: row.code,
        term: row.term,
        grade: row.grade,
        inProgress: row.status === "in-progress",
        examCredit: row.examCredit,
        credits: row.credits,
      })),
      info,
      attrs,
      now,
      completed,
      major
    );
    setUndo({ before: semesters, result });
    setShowDetails(false);
    replaceSemesters(result.semesters);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveDrag(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    if (!over) return;

    if (over.startsWith("sem:")) {
      const semesterId = over.slice(4);
      if (active.startsWith("catalog:")) {
        addCourse(semesterId, active.slice(8));
        if (isPast(semesterId)) setCourseCompleted(active.slice(8), true);
      } else if (active.startsWith("item:")) {
        const found = findItem(active.slice(5));
        moveItem(active.slice(5), semesterId);
        // a past term holds what was taken, so moving in or out changes that
        if (found && !isRequirement(found.item) && isPast(semesterId) !== isPast(found.semesterId)) {
          setCourseCompleted(found.item.code, isPast(semesterId));
        }
      }
    } else if (over === "catalog" && active.startsWith("item:")) {
      removePlanned(active.slice(5));
    }
  };

  const findItem = (itemId: string) => {
    for (const semester of semesters) {
      const item = semester.items.find((i) => i.id === itemId);
      if (item) return { item, semesterId: semester.id };
    }
    return null;
  };

  const isPast = (semesterId: string) => {
    const semester = semesters.find((s) => s.id === semesterId);
    return !!semester && termStatus(semester.term, now) === "past";
  };

  // Taking a course out of a past term means it wasn't taken then
  const removePlanned = (itemId: string) => {
    const found = findItem(itemId);
    removeItem(itemId);
    if (found && !isRequirement(found.item) && isPast(found.semesterId)) {
      setCourseCompleted(found.item.code, false);
    }
  };

  const activeCode = (() => {
    if (!activeDrag) return null;
    if (activeDrag.startsWith("catalog:")) return activeDrag.slice(8);
    const id = activeDrag.slice(5);
    return semesters.flatMap((s) => s.items).find((item) => item.id === id)?.code ?? null;
  })();

  const handleExport = async () => {
    if (!info) return;
    setExporting(true);
    try {
      await exportPlanToPdf(semesters, info, violations, Array.from(completed));
    } finally {
      setExporting(false);
    }
  };

  if (loading || !info) {
    return (
      <div className="planner-status">
        {error ? (
          <p className="planner-error">
            Couldn't load the course data. The server may be waking up; try again in a moment.
          </p>
        ) : (
          <>
            <ClipLoader color="#0f44cd" size={60} />
            <p className="planner-hint">Loading course data. The first visit can take up to 30 seconds while the server wakes up.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="planner">
      <div className="planner-toolbar">
        <div className="planner-title">
          <strong>Degree planner</strong>
          <span>Drag courses into semesters</span>
        </div>
        <div className="planner-terms" aria-label="Your timeline">
          <label>
            <span>Started</span>
            <select value={semesters[0]?.term} onChange={(e) => setStart(e.target.value)}>
              {startChoices.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </label>
          <label title={isAuto ? "From today's date" : "You picked this; choose today's term to follow the date again"}>
            <span>Now</span>
            <select value={now} onChange={(e) => setNow(e.target.value)}>
              {termChoices(termOf(new Date()), 6, 6, true).map((term) => (
                <option key={term} value={term}>
                  {term}
                  {term === termOf(new Date()) ? " (today)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="planner-chip">
          Credits <b>{credits}</b> / {DEGREE_CREDITS}
        </span>
        {doneCredits > 0 && (
          <span className="planner-chip done" title="Credits you've already completed">
            {doneCredits} done
          </span>
        )}
        {credits > 0 && (
          <span
            className={`planner-chip${summerCredits >= SUMMER_REQUIRED ? " done" : ""}`}
            title={`Florida requires ${SUMMER_REQUIRED} credits from summer terms if you started with fewer than 60 credits of AP / transfer credit. Counts summer classes taken and planned.`}
          >
            Summer <b>{summerCredits}</b> / {SUMMER_REQUIRED}
          </span>
        )}
        {violations.size > 0 ? (
          <span className="planner-chip warn">
            <IoWarningOutline size={14} /> {violations.size} prereq
            {violations.size === 1 ? "" : "s"}
          </span>
        ) : null}
        {lightSemesters > 0 && (
          <span
            className="planner-chip warn"
            title={`Full-time status needs at least ${MIN_CREDITS} credits per semester`}
          >
            <IoWarningOutline size={14} /> {lightSemesters} under {MIN_CREDITS} cr
          </span>
        )}
        {violations.size === 0 && lightSemesters === 0 && credits > 0 && (
          <span className="planner-chip ok">
            <IoCheckmarkCircleOutline size={14} /> Valid
          </span>
        )}
        <div className="planner-spacer" />
        <select
          className="planner-major"
          value=""
          onChange={(e) => loadMajor(e.target.value)}
          aria-label="Start from a major's model plan"
        >
          <option value="">Start from a major…</option>
          {majorNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button className="planner-ghost" onClick={() => setProgressOpen(true)}>
          <IoCheckmarkCircleOutline size={15} /> My progress
        </button>
        <button
          className={`planner-ghost${showSummers ? " on" : ""}`}
          onClick={() => setShowSummers((value) => !value)}
          aria-pressed={showSummers}
        >
          Summers
        </button>
        <button className="planner-ghost" onClick={() => setArrangeOpen(true)}>
          <IoSparklesOutline size={15} /> Arrange
        </button>
        <button className="planner-ghost" onClick={clearPlan} disabled={placedCodes.size === 0}>
          <IoTrashOutline size={15} /> Clear
        </button>
        <button className="planner-primary" onClick={handleExport} disabled={exporting}>
          <IoDownloadOutline size={15} /> {exporting ? "Exporting…" : "Export PDF"}
        </button>
      </div>

      {undo && (
        <div className="planner-banner" role="status">
          <div className="planner-banner-row">
            <IoSparklesOutline size={15} aria-hidden />
            <span>
              Rebuilt from your transcript: {undo.result.placed} classes placed in the terms you took
              them, {undo.result.matches.length} requirement
              {undo.result.matches.length === 1 ? "" : "s"} filled, {undo.result.remaining} left to
              plan
              {undo.result.addedYears > 0
                ? ` (added ${undo.result.addedYears} year${undo.result.addedYears === 1 ? "" : "s"} to fit them)`
                : ""}
              .
              {undo.result.summer.applies && undo.result.summer.credits > 0
                ? ` Summers hold ${undo.result.summer.credits} credits toward the ${SUMMER_REQUIRED}-credit summer rule.`
                : ""}
            </span>
            <button className="planner-ghost" onClick={() => setShowDetails((v) => !v)}>
              {showDetails ? "Hide details" : "Details"}
            </button>
            <button
              className="planner-ghost"
              onClick={() => {
                replaceSemesters(undo.before);
                setUndo(null);
              }}
            >
              Undo
            </button>
            <button className="planner-icon-btn" onClick={() => setUndo(null)} aria-label="Dismiss">
              <IoClose size={16} />
            </button>
          </div>
          {showDetails && (
            <div className="planner-banner-details">
              {undo.result.matches.length > 0 && (
                <div>
                  <span className="csu-label">Counted toward</span>
                  <ul>
                    {undo.result.matches.map((m) => (
                      <li key={m.code + m.requirement}>
                        <b>{formatCode(m.code)}</b> → {m.requirement}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {undo.result.examCredit.length > 0 && (
                <div>
                  <span className="csu-label">Prior credit (AP, transfer, dual enrollment)</span>
                  <p>{undo.result.examCredit.map(formatCode).join(", ")}</p>
                </div>
              )}
              {undo.result.extra.length > 0 && (
                <div>
                  <span className="csu-label">Didn't fill a listed requirement</span>
                  <p>
                    {undo.result.extra.map(formatCode).join(", ")}. These may still count as
                    electives or toward a major-specific requirement; check your degree audit.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="planner-body">
          <CatalogSidebar
            info={info}
            placedCodes={placedCodes}
            completed={completed}
            onToggleCompleted={toggleCompleted}
          />
          <div className="planner-grid">
            {yearGroups.map((group, index) => (
              <div className="planner-year-group" key={group.label}>
                <div className={`planner-year-label${index % 2 === 0 ? " accent" : ""}`}>
                  {group.label}
                </div>
                <div className="planner-year-pair">
                  {group.items.map((semester) => (
                    <SemesterColumn
                      key={semester.id}
                      semester={semester}
                      status={termStatus(semester.term, now)}
                      isLast={semester === lastTerm}
                      onMarkDone={() => {
                        markCompleted(
                          semester.items.filter((item) => !isRequirement(item)).map((item) => ({ code: item.code }))
                        );
                        markSemesterDone(semester.id);
                      }}
                      info={info}
                      violations={violations}
                      completed={completed}
                      onRemove={removePlanned}
                      onToggleCompleted={toggleCompleted}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeCode ? (
            <CourseCardBody code={activeCode} course={info[activeCode]} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {progressOpen && (
        <ProgressDialog
          semesters={semesters}
          nextOpen={now}
          info={info}
          completed={completed}
          onLoadMajor={loadMajor}
          onSetItemDone={setItemCompleted}
          onCompleteThrough={completeThrough}
          onApplyTranscript={applyTranscript}
          onClose={() => setProgressOpen(false)}
        />
      )}

      {arrangeOpen && (
        <ArrangeDialog
          semesters={semesters}
          info={info}
          completed={completed}
          onAdopt={adoptArrangement}
          onClose={() => setArrangeOpen(false)}
        />
      )}
    </div>
  );
};

export default Planner;
