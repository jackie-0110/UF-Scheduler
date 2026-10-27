import axios from "axios";
import { API_URLS } from "../../config/api";
import { AttrMap } from "./transcriptPlan";

const cache: AttrMap = {};
// terms the course search has; older classes are usually still offered in one of them
const TERMS = [
  { term: "fall", year: "26" },
  { term: "spring", year: "27" },
];

/** Gen ed and Quest tags for each code, from the course search. Unknown codes are left out. */
export async function fetchCourseAttrs(codes: string[]): Promise<AttrMap> {
  const missing = codes.filter((code) => !(code in cache));
  await Promise.all(
    missing.map(async (code) => {
      for (const { term, year } of TERMS) {
        try {
          const { data } = await axios.post(API_URLS.GET_COURSES, {
            searchTerm: code,
            itemsPerPage: 5,
            startFrom: 0,
            term,
            year,
          });
          const match = (data as any[]).find((c) => c.code === code);
          if (!match) continue;
          const sections: any[] = match.sections ?? [];
          cache[code] = {
            genEd: Array.from(new Set(sections.flatMap((s) => s.genEd ?? []))),
            quest: Array.from(new Set(sections.flatMap((s) => s.quest ?? []))),
          };
          return;
        } catch {
          // try the next term
        }
      }
    })
  );
  return Object.fromEntries(codes.filter((code) => code in cache).map((code) => [code, cache[code]]));
}
