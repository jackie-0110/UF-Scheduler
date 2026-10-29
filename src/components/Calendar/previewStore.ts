import { useSyncExternalStore } from "react";
import { Section } from "../CourseUI/CourseTypes";

// The section under the mouse in the course list, shown faintly on the week grid
let previewed: Section | null = null;
const listeners = new Set<() => void>();

export const setPreviewSection = (section: Section | null) => {
  if (section === previewed) return;
  previewed = section;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const usePreviewSection = () => useSyncExternalStore(subscribe, () => previewed);

export type GhostBlock = { day: number; start: number; end: number; title: string; location: string };

const DAY_INDEX: Record<string, number> = { M: 0, T: 1, W: 2, R: 3, F: 4 };
const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const ghostBlocks = (section: Section, title: string): GhostBlock[] =>
  (section.meetTimes ?? []).flatMap((m) =>
    m.meetDays
      .filter((d) => d in DAY_INDEX)
      .map((d) => ({
        day: DAY_INDEX[d],
        start: toMinutes(m.meetTimeBegin),
        end: toMinutes(m.meetTimeEnd),
        title,
        location: `${m.meetBuilding} ${m.meetRoom}`.trim(),
      }))
  );
