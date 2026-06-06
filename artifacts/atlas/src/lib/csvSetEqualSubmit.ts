/**
 * Phase 57B-prereq — client submission-shape decision for `csv_set_equal`.
 *
 * This is the staged-hybrid (Option C, docs/phases/phase-57c-csv-set-equal-trust-decision.md)
 * foundation. It decides — purely, with no React/DOM dependency so it is unit
 * testable — WHAT string a step's Check/Submit should send to the server:
 *
 *   1. RAW (legacy) — for every step that is NOT server-graded. The learner's
 *      raw editor contents (`code` or `textAnswer`) are sent verbatim, exactly
 *      as before this phase. Today EVERY visible row takes this branch because
 *      no row carries `spec.serverGrade: true`, so this phase is DARK: it does
 *      not change a single learner-visible submission.
 *
 *   2. CSV_SET_EQUAL — for a `csv_set_equal` step whose server response exposed
 *      `serverGrade: true` AND for which a FRESH DuckDB result has been captured
 *      (the learner Ran the query and hasn't edited/reset/navigated since). The
 *      submission becomes the canonical JSON contract the server comparator
 *      expects (`grading.ts#gradeCsvSetEqual`): `{"columns": [...], "rows": [[...]]}`.
 *
 *   3. NEEDS_RUN — for a server-graded `csv_set_equal` step with NO fresh
 *      capture. The caller must prompt the learner to Run first rather than
 *      silently sending stale or empty rows. (Fail-safe, never fail-closed at
 *      the wrong moment: we refuse to guess.)
 *
 * Why a boolean `serverGrade` and not the full spec: the GET /projects/:slug
 * response exposes only a narrow derived boolean. Expected rows, hashes,
 * fixture paths and answer keys never reach the client — the comparison happens
 * server-side. This helper therefore keys off that single boolean.
 */

export type CsvCell = string | number | boolean | null;

/** A successful DuckDB-WASM run captured for the active step. */
export interface CsvSetEqualCapture {
  columns: string[];
  rows: CsvCell[][];
}

export interface DecideSubmissionArgs {
  /** Derived `step.serverGrade` from GET /projects/:slug (false for all rows today). */
  serverGrade: boolean;
  /** The learner's raw editor contents — `code` for code steps, `textAnswer` otherwise. */
  rawSubmission: string;
  /** The freshest DuckDB capture for this step, or null if none / invalidated. */
  capture: CsvSetEqualCapture | null;
}

export type SubmissionDecision =
  /** Send the raw editor contents verbatim (legacy path). */
  | { kind: "raw"; submission: string }
  /** Send the canonical `{columns,rows}` JSON for server-side comparison. */
  | { kind: "csv_set_equal"; submission: string }
  /** No fresh capture exists; caller must ask the learner to Run first. */
  | { kind: "needs-run" };

/** A capture is usable only if it has at least one column. Zero ROWS is a
 *  legitimate result (a query that returns nothing), but a result with no
 *  COLUMNS can never form a valid `csv_set_equal` submission, so we treat it
 *  as "not captured" and ask the learner to Run. */
function isUsableCapture(capture: CsvSetEqualCapture | null): capture is CsvSetEqualCapture {
  return (
    capture !== null &&
    Array.isArray(capture.columns) &&
    capture.columns.length > 0 &&
    Array.isArray(capture.rows)
  );
}

/**
 * Decide the submission shape for a step's Check/Submit.
 *
 * Pure and synchronous. The returned `submission` (for raw/csv kinds) is the
 * exact string to hand to the Check/Submit mutation.
 */
export function decideCsvSetEqualSubmission(
  args: DecideSubmissionArgs,
): SubmissionDecision {
  // Not server-graded → byte-identical legacy behavior. This is the branch
  // every visible row takes today.
  if (args.serverGrade !== true) {
    return { kind: "raw", submission: args.rawSubmission };
  }

  // Server-graded csv_set_equal: we need a fresh capture to form the contract.
  if (!isUsableCapture(args.capture)) {
    return { kind: "needs-run" };
  }

  return {
    kind: "csv_set_equal",
    submission: JSON.stringify({
      columns: args.capture.columns,
      rows: args.capture.rows,
    }),
  };
}
