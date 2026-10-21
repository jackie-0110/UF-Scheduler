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

const TERM_LINE = /^(fall|spring|summer)\s+\d{4}\s*$/i;
const CREDITS_THEN_GRADE = /(?:^|[\s|])\d{1,2}(?:\.\d+)?(?:[\s|]+)([A-Z][+-]?|--)?(?=[\s|]|$)/;

/**
 * Pasting the ONE.UF "Course History" table gives either one tab-separated row per course or
 * one cell per line. Glue each code line to the cells after it so both read as a single record.
 */
function toRecords(text: string): string[] {
  const records: string[] = [];
  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/\u00a0/g, " ").trim();
    if (!line) return;
    const last = records.length - 1;
    const isBoundary = TERM_LINE.test(line) || /^(term|course)\b.*\b(title|credits)\b/i.test(line);
    if (isBoundary || CODE_RE.test(line) || last < 0) records.push(line);
    else records[last] += `\t${line}`;
  });
  return records;
}

/**
 * Reads pasted transcript, course history or degree-audit text. Each record holding a course
 * code becomes a row. The grade is the cell after the credits when there is one, otherwise the
 * last standalone grade-looking token. A passing grade or AP/IB/transfer credit (P, TR) means
 * completed, no grade means in progress, W/F/failing means ignore.
 */
export function parseTranscript(text: string, info: PrereqMap): TranscriptRow[] {
  const rows = new Map<string, TranscriptRow>();
  let inProgressSection = false;

  toRecords(text).forEach((record) => {
    const line = record;
    const match = line.match(CODE_RE);
    if (!match) {
      // headers like "Courses In Progress" mark the ungraded rows that follow
      if (IN_PROGRESS_HEADER.test(line)) inProgressSection = true;
      else if (SECTION_RESET.test(line) || TERM_LINE.test(line)) inProgressSection = false;
      return;
    }

    const code = resolveCode(`${match[1]}${match[2]}`, info);
    const rest = line.slice((match.index ?? 0) + match[0].length);
    const tokens = rest.split(/[\s,;|]+/).filter(Boolean);
    const creditsCell = rest.match(CREDITS_THEN_GRADE);
    const hasCredits = !!creditsCell;
    const cellGrade = creditsCell?.[1] && creditsCell[1] !== "--" ? creditsCell[1] : undefined;
    const grade =
      cellGrade && GRADE_TOKENS.has(cellGrade)
        ? cellGrade
        : hasCredits
        ? undefined
        : [...tokens].reverse().find((token) => GRADE_TOKENS.has(token));

    let status: TranscriptStatus;
    if (grade && PASSING_GRADES.has(grade)) status = "completed";
    else if (grade) status = "ignore"; // F, W, WF, I, U ...
    else status = inProgressSection || hasCredits || IN_PROGRESS_HEADER.test(rest) ? "in-progress" : "ignore";

    const previous = rows.get(code);
    // a retake or a "repeat code" double count: keep the better outcome
    if (previous && previous.status === "completed" && status !== "completed") return;
    if (/repeat/i.test(line) && previous) return;

    rows.set(code, {
      code,
      title: info[code]?.name ?? tokens.filter((t) => !GRADE_TOKENS.has(t) && !/^[\d.]+$/.test(t)).slice(0, 8).join(" "),
      grade,
      status,
      inCatalog: !!info[code],
      line: line.replace(/\t/g, "  "),
    });
  });

  return Array.from(rows.values());
}
