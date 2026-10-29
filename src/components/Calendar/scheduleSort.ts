import { Section } from "../CourseUI/CourseTypes";

export const SORT_OPTIONS = [
  { value: "earliestStart", label: "Earliest Start" },
  { value: "latestStart", label: "Latest Start" },
  { value: "earliestEnd", label: "Earliest End" },
  { value: "latestEnd", label: "Latest End" },
  { value: "mostCompact", label: "Most Compact" },
  { value: "fewestDays", label: "Fewest Days on Campus" },
  { value: "mostBalanced", label: "Most Balanced Week" },
  { value: "bestRated", label: "Best Rated Instructors" },
];

const DAYS = ["M", "T", "W", "R", "F", "S"];
const WEEKDAYS = 5;

type SectionStats = {
  begin: number;
  end: number;
  mask: number; // bit per day the section meets
  daily: number[]; // class minutes Mon-Fri
  rating: number; // 0 when no instructor is rated
};

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// The lead instructor is usually the only one with ratings, so take the best
export const sectionRating = (section: Section) =>
  Math.max(0, ...(section.instructors ?? []).map((i) => i?.avgRating || 0));

const statsFor = (section: Section): SectionStats => {
  const stats = {
    begin: Infinity,
    end: -Infinity,
    mask: 0,
    daily: new Array(WEEKDAYS).fill(0),
    rating: sectionRating(section),
  };
  for (const meetTime of section.meetTimes ?? []) {
    const begin = toMinutes(meetTime.meetTimeBegin);
    const end = toMinutes(meetTime.meetTimeEnd);
    stats.begin = Math.min(stats.begin, begin);
    stats.end = Math.max(stats.end, end);
    for (const day of meetTime.meetDays) {
      const index = DAYS.indexOf(day);
      if (index === -1) continue;
      stats.mask |= 1 << index;
      if (index < WEEKDAYS) stats.daily[index] += end - begin;
    }
  }
  return stats;
};

const countBits = (mask: number) => {
  let count = 0;
  for (; mask; mask &= mask - 1) count++;
  return count;
};

// Ranks combination numbers (see combinationAt) without decoding them.
// Lower key is better; combinations with no meeting times go last.
export const rankCombinations = (
  lists: Section[][],
  count: number,
  sort: string
): Uint32Array => {
  const stats = lists.map((list) => list.map(statsFor));
  const keys = new Float64Array(count);
  const daily = new Array(WEEKDAYS);

  for (let i = 0; i < count; i++) {
    let n = i;
    let begin = Infinity;
    let end = -Infinity;
    let mask = 0;
    let ratingSum = 0;
    let rated = 0;
    daily.fill(0);

    for (let k = lists.length - 1; k >= 0; k--) {
      const length = lists[k].length;
      const section = stats[k][n % length];
      n = Math.floor(n / length);
      begin = Math.min(begin, section.begin);
      end = Math.max(end, section.end);
      mask |= section.mask;
      if (section.rating) {
        ratingSum += section.rating;
        rated++;
      }
      if (sort === "mostBalanced") {
        for (let d = 0; d < WEEKDAYS; d++) daily[d] += section.daily[d];
      }
    }

    let key: number;
    switch (sort) {
      case "mostCompact": key = end - begin; break;
      case "earliestStart": key = begin; break;
      case "latestStart": key = -begin; break;
      case "earliestEnd": key = end; break;
      case "latestEnd": key = -end; break;
      // Ties go to the shorter day
      case "fewestDays": key = mask ? countBits(mask) * 1440 + (end - begin) : Infinity; break;
      case "mostBalanced": key = mask ? Math.round(spread(daily) * 10) : Infinity; break;
      case "bestRated": key = rated ? Math.round((-100 * ratingSum) / rated) : Infinity; break;
      default: key = 0;
    }
    keys[i] = key;
  }
  return orderByKey(keys);
};

// Keys are whole numbers, so key * count + index is unique and a plain
// numeric sort (much faster than a comparator) keeps ties in index order.
// Missing keys go last.
const orderByKey = (keys: Float64Array) => {
  const count = keys.length;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const key = keys[i];
    if (!Number.isFinite(key)) continue;
    if (key < min) min = key;
    if (key > max) max = key;
  }
  if (min === Infinity) min = max = 0;
  for (let i = 0; i < count; i++) {
    const key = Number.isFinite(keys[i]) ? keys[i] - min : max - min + 1;
    keys[i] = key * count + i;
  }
  keys.sort();
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = keys[i] % count;
  return order;
};

// Standard deviation of class minutes across Mon-Fri
const spread = (daily: number[]) => {
  let sum = 0;
  let squares = 0;
  for (const minutes of daily) {
    sum += minutes;
    squares += minutes * minutes;
  }
  const mean = sum / daily.length;
  return Math.sqrt(Math.max(0, squares / daily.length - mean * mean));
};
