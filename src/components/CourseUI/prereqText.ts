// Splits a catalog prerequisite sentence into its "and" parts so each reads on
// its own line. Never splits on "or" ("C or higher") or inside parentheses.
export const splitPrereqs = (raw?: string): string[] => {
  const text = (raw ?? "").replace(/^Prereq:\s*/i, "").trim();
  if (!text || text === "N/A") return [];
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  const push = (end: number) => {
    const part = text.slice(start, end).trim();
    if (part) parts.push(part);
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === ";" || ch === ",")) {
      push(i);
      start = i + 1;
    } else if (depth === 0) {
      const match = /^\s+and\s+/i.exec(text.slice(i, i + 12));
      if (match) {
        push(i);
        start = i + match[0].length;
        i = start - 1;
      }
    }
  }
  push(text.length);
  return parts;
};

export const COURSE_CODE = /\b([A-Z]{3})\s?(\d{4}[A-Z]?)\b/g;
