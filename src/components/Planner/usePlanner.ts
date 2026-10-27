import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrereqInfo } from "../Cytoscape/usePrereqData";
import { PrereqMap } from "../Cytoscape/prereqs";
import { createDefaultSemesters, isRequirement, newItemId, PlanItem, PlanSemester } from "./plannerLogic";
import { isTerm, retime, termOf } from "./terms";

const PLAN_KEY = "plannerPlan";
const NOW_KEY = "plannerNow";
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (parsed.some((semester) => semester.summer)) return parsed;
        // older saves had only the eight fall/spring semesters: add the summer columns
        const upgraded = createDefaultSemesters(START_YEAR);
        const regular = upgraded.filter((semester) => !semester.summer);
        parsed.forEach((semester, index) => {
          if (regular[index]) regular[index].items = semester.items;
        });
        return upgraded;
      }
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
    () =>
      new Set(
        semesters.flatMap((semester) =>
          semester.items.filter((item) => !isRequirement(item)).map((item) => item.code)
        )
      ),
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

  /** Swaps the movable courses for `arranged` (one list per semester); requirement cards stay put. */
  const adoptArrangement = useCallback((arranged: PlanItem[][]) => {
    setSemesters((prev) =>
      prev.map((s, index) => ({
        ...s,
        items: [
          ...s.items.filter(isRequirement),
          ...(arranged[index] ?? []).map((item) => ({ ...item, id: newItemId() })),
        ],
      }))
    );
  }, []);

  /** Marks a requirement card as satisfied (or not). */
  const setItemDone = useCallback((itemId: string, done: boolean) => {
    setSemesters((prev) =>
      prev.map((s) => ({
        ...s,
        items: s.items.map((item) => (item.id === itemId ? { ...item, done } : item)),
      }))
    );
  }, []);

  /** Marks every requirement card in the first `count` semesters as satisfied. */
  const completeRequirementsThrough = useCallback((count: number) => {
    setSemesters((prev) =>
      prev.map((s, index) =>
        index < count
          ? { ...s, items: s.items.map((item) => (isRequirement(item) ? { ...item, done: true } : item)) }
          : s
      )
    );
  }, []);

  /** Replaces the whole timeline (a transcript can move the start or add years). */
  const replaceSemesters = useCallback((next: PlanSemester[]) => setSemesters(next), []);

  /** Starts the plan at another term; each course keeps its relative semester. */
  const setStart = useCallback(
    (term: string) => setSemesters((prev) => (prev[0]?.term === term ? prev : retime(prev, term))),
    []
  );

  /** Marks every course in a term finished and every requirement card there met. */
  const markSemesterDone = useCallback((semesterId: string) => {
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semesterId
          ? {
              ...s,
              items: s.items.map((item) =>
                isRequirement(item) ? { ...item, done: true } : { ...item, taken: "done" as const }
              ),
            }
          : s
      )
    );
  }, []);

  /** Replaces every semester's items (used when loading a major's model plan). */
  const replaceItems = useCallback((items: PlanItem[][]) => {
    setSemesters((prev) => prev.map((s, index) => ({ ...s, items: items[index] ?? [] })));
  }, []);

  return {
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
  };
}

/** The term you're in: today's by default, or one you picked. */
export function useNowTerm() {
  const [picked, setPicked] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(NOW_KEY);
      return stored && isTerm(stored) ? stored : null;
    } catch {
      return null;
    }
  });
  const auto = termOf(new Date());
  const setNow = useCallback(
    (term: string | null) => {
      setPicked(term === auto ? null : term);
      try {
        if (term && term !== auto) localStorage.setItem(NOW_KEY, term);
        else localStorage.removeItem(NOW_KEY);
      } catch {
        // storage unavailable
      }
    },
    [auto]
  );
  return { now: picked ?? auto, isAuto: !picked, setNow };
}
