/**
 * Terms the course API has data for; the first is the default.
 * Keep in sync with the terms scraped in the backend's scraper workflow.
 */
export const TERMS = [
  { value: "fall 26", label: "Fall 26" },
  // Scraped without a UF login, so sections have no meeting times yet
  { value: "spring 27", label: "Spring 27 (no times yet)" },
] as const;

export const DEFAULT_TERM: string = TERMS[0].value;

export const isKnownTerm = (value: string | null): value is string =>
  TERMS.some((term) => term.value === value);
