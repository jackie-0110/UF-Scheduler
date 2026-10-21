import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrereqInfo } from "../Cytoscape/usePrereqData";
import { PrereqMap } from "../Cytoscape/prereqs";
import { createDefaultSemesters, newItemId, PlanSemester } from "./plannerLogic";

const PLAN_KEY = "plannerPlan";
const START_YEAR = 2026;

/** Courses from every term the backend has data for; the newest term wins on conflicts. */
export function usePlannerCatalog() {
  const fall = usePrereqInfo("fall", "26");
  const spring = usePrereqInfo("spring", "27");

  const info = useMemo<PrereqMap | null>(() => {
    if (!fall.info && !spring.info) return null;
    return { ...(fall.info ?? {}), ...(spring.info ?? {}) };
  }, [fall.info, spring.info]);

  return {
    info,
    loading: !info && !(fall.error && spring.error),
    error: fall.error && spring.error,
  };
}

const readPlan = (): PlanSemester[] => {
  try {
    const stored = localStorage.getItem(PLAN_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PlanSemester[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fall back to an empty plan
  }
  return createDefaultSemesters(START_YEAR);
};

export function usePlan() {
  const [semesters, setSemesters] = useState<PlanSemester[]>(readPlan);

  useEffect(() => {
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(semesters));
    } catch {
      // storage unavailable: the plan just won't persist
    }
  }, [semesters]);

  const placedCodes = useMemo(
    () => new Set(semesters.flatMap((semester) => semester.items.map((item) => item.code))),
    [semesters]
  );

  const addCourse = useCallback((semesterId: string, code: string) => {
    setSemesters((prev) => {
      if (prev.some((s) => s.items.some((item) => item.code === code))) return prev;
      return prev.map((s) =>
        s.id === semesterId ? { ...s, items: [...s.items, { id: newItemId(), code }] } : s
      );
    });
  }, []);

  const moveItem = useCallback((itemId: string, semesterId: string) => {
    setSemesters((prev) => {
      const item = prev.flatMap((s) => s.items).find((i) => i.id === itemId);
      if (!item) return prev;
      return prev.map((s) => {
        const without = s.items.filter((i) => i.id !== itemId);
        return s.id === semesterId ? { ...s, items: [...without, item] } : { ...s, items: without };
      });
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setSemesters((prev) =>
      prev.map((s) => ({ ...s, items: s.items.filter((i) => i.id !== itemId) }))
    );
  }, []);

  const clearPlan = useCallback(() => {
    setSemesters((prev) => prev.map((s) => ({ ...s, items: [] })));
  }, []);

  /** Replaces the plan's courses with `arranged` (one list of codes per semester). */
  const adoptArrangement = useCallback((arranged: string[][]) => {
    setSemesters((prev) =>
      prev.map((s, index) => ({
        ...s,
        items: (arranged[index] ?? []).map((code) => ({ id: newItemId(), code })),
      }))
    );
  }, []);

  return { semesters, placedCodes, addCourse, moveItem, removeItem, clearPlan, adoptArrangement };
}
