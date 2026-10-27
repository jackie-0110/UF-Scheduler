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
  /** "Fall 2025" when the transcript says which term it was taken */
  term?: string;
  /** AP/IB/AICE, transfer, dual enrollment or other credit not earned in a UF class */
  examCredit?: boolean;
  /** Credits from the transcript, used when the catalog doesn't have the course */
  credits?: number;
  /** Raw line from the pasted text, shown so mismatches are easy to spot */
  line: string;
}

// "AML L000" / "MAS U000" are transfer credit with no UF equivalent (lower / upper division)
const CODE_RE = /\b([A-Z]{3})\s?(\d{4}[A-Z]?|[LU]\d{3})\b/;
export const isTransferCode = (code: string) => /^[A-Z]{3}[LU]\d{3}/.test(code);
const GRADE_TOKENS = new Set([
  "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "E", "F",
  "W", "WF", "I", "IP", "S", "U", "P", "NG", "TR", "AP", "CR", "XF",
]);
const IN_PROGRESS_HEADER = /\b(in progress|currently enrolled|current term|registered)\b/i;
// ONE.UF writes "Spr 2026" and "Sum 2026"; "Summer A/B/C 2026" are all one summer here
const SEASON = "(fall|fal|spring|spr|summer|sum)";
const SESSION = "(?:\\s+(?:session\\s+)?[abc])?";
const SEASON_NAMES: Record<string, string> = { fal: "Fall", spr: "Spring", sum: "Summer" };
const SECTION_RESET = new RegExp(
  `^${SEASON}${SESSION}\\s+\\d{4}|transcript totals|courses? (completed|taken)`,
  "i"
);
const REPEAT_LINE = /^repeat code\b/i;

/** The catalog sometimes lists COP3502C where a transcript says COP 3502 (and vice versa). */
const resolveCode = (code: string, info: PrereqMap) =>
  info[code] ? code : info[`${code}C`] ? `${code}C` : code;

const TERM_START = new RegExp(`^${SEASON}${SESSION}\\s+(\\d{4})\\b`, "i");
const seasonName = (word: string) =>
  SEASON_NAMES[word.toLowerCase()] ?? word[0].toUpperCase() + word.slice(1).toLowerCase();
// grades UF posts for credit by exam or transfer rather than a class taken here
const EXAM_GRADES = new Set(["P", "TR", "AP", "CR"]);

const TERM_LINE = new RegExp(`^${SEASON}${SESSION}\\s+\\d{4}\\s*$`, "i");
const CREDITS_THEN_GRADE = /(?:^|[\s|])(\d{1,2}(?:\.\d+)?)(?:[\s|]+)([A-Z][+-]?|--)?(?=[\s|]|$)/;
const CREDITS_CELL = /^\d{1,2}(?:\.\d+)?$/;
// a full-time load tops out around here; more in one term means prior credit is mixed in
const MAX_TERM_CREDITS = 21;

interface TranscriptRecord {
  text: string;
  /** Under a "Repeat Code: R" note: an attempt that earned no credit */
  repeat: boolean;
}

/**
 * Pasting the ONE.UF "Course History" table gives either one tab-separated row per course or
 * one cell per line. Glue each code line to the cells after it so both read as a single record.
 */
function toRecords(text: string): TranscriptRecord[] {
  const records: TranscriptRecord[] = [];
  let repeatNext = false;
  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/ /g, " ").trim();
    if (!line) return;
    // the repeat note sits on its own line above the course it belongs to
    if (REPEAT_LINE.test(line)) {
      repeatNext = true;
      return;
    }
    const last = records.length - 1;
    const isBoundary = TERM_LINE.test(line) || /^(term|course)\b.*\b(title|credits)\b/i.test(line);
    const isCourse = CODE_RE.test(line);
    if (isBoundary || isCourse || last < 0) {
      records.push({ text: line, repeat: isCourse && repeatNext });
      if (isCourse) repeatNext = false;
    } else records[last].text += `\t${line}`;
  });
  return records;
}

/** Title, credits and grade from tab cells: the cell after the code, then the first plain number and the cell after it. */
function readCells(text: string) {
  const cells = text.split("\t").map((cell) => cell.trim());
  const codeCell = cells.findIndex((cell) => CODE_RE.test(cell));
  if (cells.length < 3 || codeCell < 0) return null;
  for (let i = codeCell + 1; i < cells.length; i++) {
    if (!CREDITS_CELL.test(cells[i])) continue;
    const next = cells[i + 1];
    return {
      title: i > codeCell + 1 ? cells[codeCell + 1] : undefined,
      credits: Number(cells[i]),
      grade: next && GRADE_TOKENS.has(next) ? next : undefined,
    };
  }
  return null;
}

/**
 * ONE.UF files AP, transfer and dual-enrollment credit under the first term, sorted by subject,
 * then lists that term's UF classes in a second sorted run. When the first term holds more than
 * anyone could take, everything before the last break in subject order is prior credit.
 */
function splitPriorCredit(rows: TranscriptRow[], order: { code: string; term?: string }[]) {
  const first = order.find((o) => o.term)?.term;
  if (!first) return;
  const inFirst = order.filter((o) => o.term === first).map((o) => o.code);
  const byCode = new Map(rows.map((row) => [row.code, row]));
  const credits = (code: string) => byCode.get(code)?.credits ?? 3;
  if (inFirst.reduce((sum, code) => sum + credits(code), 0) <= MAX_TERM_CREDITS) return;

  let split = -1;
  inFirst.forEach((code, i) => {
    if (i > 0 && code.slice(0, 3) < inFirst[i - 1].slice(0, 3)) split = i;
  });
  if (split < 0) return;
  const head = inFirst.slice(0, split);
  const tail = inFirst.slice(split);
  // only trust the break if the head looks like prior credit and the tail like one term
  const headHasTransfer = head.some((code) => isTransferCode(code) || byCode.get(code)?.examCredit);
  const tailCredits = tail.reduce((sum, code) => sum + credits(code), 0);
  if (!headHasTransfer || tailCredits > MAX_TERM_CREDITS) return;
  const tailSet = new Set(tail);
  head.forEach((code) => {
    const row = byCode.get(code);
    if (row && !tailSet.has(code) && row.status === "completed") row.examCredit = true;
  });
}

/**
 * Reads pasted transcript, course history or degree-audit text. Each record holding a course
 * code becomes a row. The grade is the cell after the credits when there is one, otherwise the
 * last standalone grade-looking token. A passing grade or AP/IB/transfer credit (P, TR) means
 * completed, no grade means in progress, W/F/failing means ignore.
 */
export function parseTranscript(text: string, info: PrereqMap): TranscriptRow[] {
  const rows = new Map<string, TranscriptRow>();
  const order: { code: string; term?: string }[] = [];
  let inProgressSection = false;
  let currentTerm: string | undefined;

  toRecords(text).forEach(({ text: line, repeat }) => {
    const termMatch = line.match(TERM_START);
    if (termMatch) currentTerm = `${seasonName(termMatch[1])} ${termMatch[2]}`;
    const match = line.match(CODE_RE);
    if (!match) {
      // headers like "Courses In Progress" mark the ungraded rows that follow
      if (IN_PROGRESS_HEADER.test(line)) inProgressSection = true;
      else if (SECTION_RESET.test(line) || TERM_LINE.test(line)) inProgressSection = false;
      return;
    }
    // a repeated attempt earns no credit; the attempt that counts is listed separately
    if (repeat || /\brepeat\b/i.test(line)) return;

    let code = resolveCode(`${match[1]}${match[2]}`, info);
    const transfer = isTransferCode(code);
    const rest = line.slice((match.index ?? 0) + match[0].length);
    const tokens = rest.split(/[\s,;|]+/).filter(Boolean);

    let credits: number | undefined;
    let grade: string | undefined;
    const cells = readCells(line);
    if (cells) {
      credits = cells.credits;
      grade = cells.grade;
    } else {
      const creditsCell = rest.match(CREDITS_THEN_GRADE);
      const cellGrade = creditsCell?.[2] && creditsCell[2] !== "--" ? creditsCell[2] : undefined;
      credits = creditsCell ? Number(creditsCell[1]) : undefined;
      grade =
        cellGrade && GRADE_TOKENS.has(cellGrade)
          ? cellGrade
          : creditsCell
          ? undefined
          : [...tokens].reverse().find((token) => GRADE_TOKENS.has(token));
    }
    const hasCredits = credits !== undefined;

    let status: TranscriptStatus;
    if (grade && PASSING_GRADES.has(grade)) status = "completed";
    else if (grade) status = "ignore"; // F, W, WF, I, U ...
    else status = inProgressSection || hasCredits || IN_PROGRESS_HEADER.test(rest) ? "in-progress" : "ignore";

    // several transfer placeholders can share a code ("MAS U000" twice): keep each
    if (transfer && rows.has(code)) {
      let n = 2;
      while (rows.has(`${code}-${n}`)) n++;
      code = `${code}-${n}`;
    }

    const previous = rows.get(code);
    // a retake: keep the better outcome
    if (previous && previous.status === "completed" && status !== "completed") return;

    order.push({ code, term: currentTerm });
    rows.set(code, {
      code,
      title: info[code]?.name ?? cells?.title ?? tokens.filter((t) => !GRADE_TOKENS.has(t) && !/^[\d.]+$/.test(t)).slice(0, 8).join(" "),
      grade,
      status,
      inCatalog: !!info[code],
      line: line.replace(/\t/g, "  "),
      term: currentTerm,
      credits,
      examCredit: transfer ? status === "completed" : !!grade && EXAM_GRADES.has(grade),
    });
  });

  const result = Array.from(rows.values());
  splitPriorCredit(result, order);
  return result;
}
