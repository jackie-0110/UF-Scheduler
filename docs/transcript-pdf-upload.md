# Scope: transcript PDF upload for the planner

Status: not built. Spiked on 2026-10-21; this records what was learned.

## Goal
Let a student drop their unofficial transcript PDF into the planner's "My progress" dialog instead
of copying and pasting text. The extracted text goes through the existing `parseTranscript`
(`src/components/Planner/transcriptParser.ts`), so the review table, grade handling and "apply to
my plan" flow stay the same.

## Approach (client-side only, nothing is uploaded)
1. Add `pdfjs-dist@3.11.174`. Newer majors (4+) were not tried; 3.11 is the last line known to
   build under Create React App 5 / webpack 5.
2. Copy `node_modules/pdfjs-dist/build/pdf.worker.min.js` (about 1 MB) into `public/` and point
   `GlobalWorkerOptions.workerSrc` at `${process.env.PUBLIC_URL}/pdf.worker.min.js`.
   Importing the worker through `new URL(..., import.meta.url)` built fine but failed at runtime
   ("Setting up fake worker failed ... WorkerMessageHandler"), so use the public-folder copy.
3. Lazy-load pdf.js (`import()`) only when a file is chosen, so the main bundle does not grow.
4. For each page, group text items by their y coordinate, sort left to right, join into lines.
5. Pass the lines to `parseTranscript`.

## Spike result
A text-based PDF (the planner's own export) extracted in about 240 ms in headless Chromium, with
lines reconstructed correctly (`COP 3502C   Programming Fundamentals 1   4`).
Bundle cost was not measured. The worker is a separate 1 MB file, and a lazy `import()` keeps the
library itself out of the main bundle.

## Unknowns and risks
- **Real transcript layout.** I have not seen a ONE.UF unofficial transcript PDF. Multi-column
  layouts, term headers on separate lines and grade columns far from the course code may need
  tuning of the line grouping (y tolerance) and of `parseTranscript`. Needs one redacted sample.
- **Scanned or image-only PDFs** produce no text. Detect "almost no text found" and fall back to
  the paste tab with a clear message. OCR (tesseract.js, about 10 MB of data) is out of scope.
- **Password-protected PDFs**: show an error, do not prompt.
- **Privacy**: parsing stays in the browser; nothing is sent to a server. Say so in the UI.
- Degree audits (DegreeWorks style) list "needed" courses with codes but no grades, so
  `parseTranscript` ignores ungraded rows outside an "In Progress" section.

## Work estimate
Small: about one focused session. Dependency and worker setup, a drag-and-drop or file picker in the
Transcript tab, the line-grouping helper with a test, an "image-only PDF" message, and tuning on a
real sample.

## Not in scope
OCR, importing from ONE.UF / DegreeWorks directly (needs UF login), saving transcripts anywhere.
