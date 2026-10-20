import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URLS } from "../../config/api";
import { baseCode, buildUnlockIndex, buildVariantIndex, PrereqMap } from "./prereqs";

const COMPLETED_KEY = "completedCourses";
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

/** Courses the student has already finished, kept in localStorage. */
export function useCompletedCourses(variants: Map<string, string[]>) {
  const [completed, setCompleted] = useState<Set<string>>(readCompleted);

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

  const clearCompleted = useCallback(() => setCompleted(new Set()), []);

  return { completed, setCourseCompleted, clearCompleted };
}
