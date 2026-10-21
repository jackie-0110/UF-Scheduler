import { PrereqMap } from "../Cytoscape/prereqs";
import { PASSING_GRADES } from "./plannerLogic";

export type TranscriptStatus = "completed" | "in-progress" | "ignore";

export interface TranscriptRow {
  code: string;
  /** Catalog title when we know the course */
  title: string;
  grade?: string;
  status: TranscriptStatus;
  inCatalog: boolean;
  /** Raw line from the pasted text, shown so mismatches are easy to spot */
  line: string;
}

const CODE_RE = /\b([A-Z]{3})\s?(\d{4}[A-Z]?)\b/;
const GRADE_TOKENS = new Set([
  "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "E", "F",
  "W", "WF", "I", "IP", "S", "U", "P", "NG", "TR", "AP", "CR", "XF",
]);
const IN_PROGRESS_HEADER = /\b(in progress|currently enrolled|current term|registered)\b/i;
const SECTION_RESET = /^(fall|spring|summer)\s+\d{4}|transcript totals|courses? (completed|taken)/i;

/** The catalog sometimes lists COP3502C where a transcript says COP 3502 (and vice versa). */
const resolveCode = (code: string, info: PrereqMap) =>
  info[code] ? code : info[`${code}C`] ? `${code}C` : code;

/**
 * Reads pasted transcript or degree-audit text. Each line holding a course code becomes a row.
 * The grade is the last standalone grade-looking token on that line; a passing grade or
 * transfer/AP credit means completed, no grade means in progress, W/F/failing means ignore.
 */
export function parseTranscript(text: string, info: PrereqMap): TranscriptRow[] {
  const rows = new Map<string, TranscriptRow>();
  let inProgressSection = false;

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/\u00a0/g, " ").trim();
    const match = line.match(CODE_RE);
    if (!match) {
      // headers like "Courses In Progress" mark the ungraded rows that follow
      if (IN_PROGRESS_HEADER.test(line)) inProgressSection = true;
      else if (SECTION_RESET.test(line)) inProgressSection = false;
      return;
    }

    const code = resolveCode(`${match[1]}${match[2]}`, info);
    const rest = line.slice((match.index ?? 0) + match[0].length);
    const tokens = rest.split(/[\s,;|]+/).filter(Boolean);
    const grade = [...tokens].reverse().find((token) => GRADE_TOKENS.has(token));

    let status: TranscriptStatus;
    if (grade && PASSING_GRADES.has(grade)) status = "completed";
    else if (grade) status = "ignore"; // F, W, WF, I, U ...
    else status = inProgressSection || IN_PROGRESS_HEADER.test(rest) ? "in-progress" : "ignore";

    const previous = rows.get(code);
    // a retake: keep the better outcome (completed beats ignore)
    if (previous && previous.status === "completed" && status !== "completed") return;

    rows.set(code, {
      code,
      title: info[code]?.name ?? tokens.filter((t) => !GRADE_TOKENS.has(t)).slice(0, 8).join(" "),
      grade,
      status,
      inCatalog: !!info[code],
      line,
    });
  });

  return Array.from(rows.values());
}
