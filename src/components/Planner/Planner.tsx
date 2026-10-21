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
  IoDownloadOutline,
  IoSparklesOutline,
  IoTrashOutline,
  IoWarningOutline,
} from "react-icons/io5";
import ClipLoader from "react-spinners/ClipLoader";
import { useCompletedCourses } from "../Cytoscape/usePrereqData";
import { buildVariantIndex } from "../Cytoscape/prereqs";
import CatalogSidebar from "./CatalogSidebar";
import { CourseCardBody } from "./CourseCard";
import SemesterColumn from "./SemesterColumn";
import ArrangeDialog from "./ArrangeDialog";
import { usePlan, usePlannerCatalog } from "./usePlanner";
import {
  DEGREE_CREDITS,
  MIN_CREDITS,
  totalCredits,
  underloadedSemesters,
  validatePlan,
} from "./plannerLogic";
import { buildMajorPlan, majorNames } from "./majorPlans";
import { exportPlanToPdf } from "./plannerPdf";
import "./PlannerStyles.css";

const NO_VARIANTS = new Map<string, string[]>();

const Planner: React.FC = () => {
  const { info, loading, error } = usePlannerCatalog();
  // Marking COP3502C completed also marks COP3502, so the prerequisite graph agrees
  const variants = useMemo(() => (info ? buildVariantIndex(info) : NO_VARIANTS), [info]);
  const { completed, setCourseCompleted } = useCompletedCourses(variants);
  const {
    semesters,
    placedCodes,
    addCourse,
    moveItem,
    removeItem,
    clearPlan,
    adoptArrangement,
    replaceItems,
  } = usePlan();
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showSummers, setShowSummers] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const violations = useMemo(
    () => (info ? validatePlan(semesters, info, completed) : new Map()),
    [semesters, info, completed]
  );
  const credits = info ? totalCredits(semesters, info) : 0;
  const lightSemesters = info ? underloadedSemesters(semesters, info).length : 0;

  const loadMajor = (major: string) => {
    if (!major || !info) return;
    const hasWork = semesters.some((semester) => semester.items.length > 0);
    if (hasWork && !window.confirm(`Replace your current plan with the ${major} model plan?`)) {
      return;
    }
    replaceItems(buildMajorPlan(major, info, semesters));
  };

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

  const handleDragStart = (event: DragStartEvent) => setActiveDrag(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    if (!over) return;

    if (over.startsWith("sem:")) {
      const semesterId = over.slice(4);
      if (active.startsWith("catalog:")) addCourse(semesterId, active.slice(8));
      else if (active.startsWith("item:")) moveItem(active.slice(5), semesterId);
    } else if (over === "catalog" && active.startsWith("item:")) {
      removeItem(active.slice(5));
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
          <ClipLoader color="#0f44cd" size={60} />
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
        <span className="planner-chip">
          Credits <b>{credits}</b> / {DEGREE_CREDITS}
        </span>
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
                      info={info}
                      violations={violations}
                      completed={completed}
                      onRemove={removeItem}
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
