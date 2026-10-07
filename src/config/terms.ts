/**
 * Terms the course API has data for, newest first.
 * Keep in sync with the terms scraped in the backend's scraper workflow.
 */
export const TERMS = [
  { value: "spring 27", label: "Spring 27" },
  { value: "fall 26", label: "Fall 26" },
] as const;

export const DEFAULT_TERM: string = TERMS[0].value;

export const isKnownTerm = (value: string | null): value is string =>
  TERMS.some((term) => term.value === value);
