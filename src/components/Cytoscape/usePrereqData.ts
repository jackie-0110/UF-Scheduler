import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URLS } from "../../config/api";
import { baseCode, buildUnlockIndex, buildVariantIndex, PrereqMap } from "./prereqs";

const COMPLETED_KEY = "completedCourses";
const GRADES_KEY = "completedGrades";
const cache = new Map<string, PrereqMap>();

export function usePrereqInfo(term: string, year: string) {
  const key = `${term}_${year}`;
  const [info, setInfo] = useState<PrereqMap | null>(cache.get(key) ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const cached = cache.get(key);
    if (cached) {
      setInfo(cached);
      setError(false);
      return;
    }
    let cancelled = false;
    setInfo(null);
    setError(false);
    axios
      .get<PrereqMap>(API_URLS.GET_PREREQS, { params: { term, year } })
      .then((response) => {
        cache.set(key, response.data);
        if (!cancelled) setInfo(response.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key, term, year]);

  const variants = useMemo(() => (info ? buildVariantIndex(info) : new Map<string, string[]>()), [info]);
  const unlocks = useMemo(() => (info ? buildUnlockIndex(info) : new Map<string, string[]>()), [info]);

  return { info, variants, unlocks, error };
}

const readCompleted = (): Set<string> => {
  try {
    const stored = localStorage.getItem(COMPLETED_KEY);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set();
  }
};

const readGrades = (): Record<string, string> => {
  try {
    const stored = localStorage.getItem(GRADES_KEY);
    return stored ? (JSON.parse(stored) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

/** Courses the student has already finished (and their grades), kept in localStorage. */
export function useCompletedCourses(variants: Map<string, string[]>) {
  const [completed, setCompleted] = useState<Set<string>>(readCompleted);
  const [grades, setGrades] = useState<Record<string, string>>(readGrades);

  useEffect(() => {
    try {
      localStorage.setItem(GRADES_KEY, JSON.stringify(grades));
    } catch {
      // storage unavailable
    }
  }, [grades]);

  useEffect(() => {
    try {
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(Array.from(completed)));
    } catch {
      // storage unavailable: progress just won't persist
    }
  }, [completed]);

  /** Marks a course and its lab/lecture variants (CHM2046 + CHM2046L). */
  const setCourseCompleted = useCallback(
    (code: string, done: boolean) => {
      const codes = variants.get(baseCode(code)) ?? [code];
      setCompleted((prev) => {
        const next = new Set(prev);
        codes.forEach((c) => (done ? next.add(c) : next.delete(c)));
        return next;
      });
    },
    [variants]
  );

  /** Marks many courses at once, e.g. from a pasted transcript, optionally with grades. */
  const markCompleted = useCallback(
    (entries: { code: string; grade?: string }[]) => {
      setCompleted((prev) => {
        const next = new Set(prev);
        entries.forEach(({ code }) =>
          (variants.get(baseCode(code)) ?? [code]).forEach((c) => next.add(c))
        );
        return next;
      });
      setGrades((prev) => {
        const next = { ...prev };
        entries.forEach(({ code, grade }) => {
          if (!grade) return;
          (variants.get(baseCode(code)) ?? [code]).forEach((c) => (next[c] = grade));
        });
        return next;
      });
    },
    [variants]
  );

  const clearCompleted = useCallback(() => {
    setCompleted(new Set());
    setGrades({});
  }, []);

  return { completed, grades, setCourseCompleted, markCompleted, clearCompleted };
}
