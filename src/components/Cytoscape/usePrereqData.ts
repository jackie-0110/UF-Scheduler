import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URLS } from "../../config/api";
import { baseCode, buildUnlockIndex, buildVariantIndex, normalizeCredits, PrereqMap } from "./prereqs";

const COMPLETED_KEY = "completedCourses";
const GRADES_KEY = "completedGrades";
const cache = new Map<string, PrereqMap>();
const inflight = new Map<string, Promise<PrereqMap>>();
const STORE_PREFIX = "prereqInfo:";

const readStored = (key: string): PrereqMap | null => {
  try {
    const stored = localStorage.getItem(STORE_PREFIX + key);
    return stored ? normalizeCredits(JSON.parse(stored) as PrereqMap) : null;
  } catch {
    return null;
  }
};

/** One request per term, shared by every caller; also refreshes the saved copy. */
export function fetchPrereqs(term: string, year: string): Promise<PrereqMap> {
  const key = `${term}_${year}`;
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = axios
    .get<PrereqMap>(API_URLS.GET_PREREQS, { params: { term, year } })
    .then((response) => {
      normalizeCredits(response.data);
      cache.set(key, response.data);
      try {
        localStorage.setItem(STORE_PREFIX + key, JSON.stringify(response.data));
      } catch {
        // storage full or unavailable: skip the saved copy
      }
      return response.data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

/** Start loading ahead of time so the first visit to Planner/Prerequisites isn't waiting on a cold server. */
export function prefetchPrereqs() {
  [["fall", "26"], ["spring", "27"]].forEach(([term, year]) => {
    fetchPrereqs(term, year).catch(() => undefined);
  });
}

export function usePrereqInfo(term: string, year: string) {
  const key = `${term}_${year}`;
  // show the saved copy right away, then swap in fresh data when it arrives
  const [info, setInfo] = useState<PrereqMap | null>(() => cache.get(key) ?? readStored(key));
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const known = cache.get(key) ?? readStored(key);
    setInfo(known);
    setError(false);
    if (cache.has(key)) return;
    fetchPrereqs(term, year)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        if (!cancelled && !known) setError(true);
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
