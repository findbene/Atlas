/**
 * Phase 25 — Pure parser for grading-feedback strings.
 *
 * Mirrors the literal feedback strings emitted by the server-side
 * `gradeSubmission` helper in `artifacts/api-server/src/lib/grading.ts`.
 * Defensive by design: any unrecognized string falls through to
 * `{ kind: "generic" }` so the panel's raw-feedback rendering still
 * works. If the server-side strings ever drift, the parser unit tests
 * fail loudly before users see broken UI.
 *
 * Pure module. No React, no DOM, no network. Safe to call from anywhere.
 */

export type Remediation =
  | { kind: "exact-diff"; expected: string; actual: string }
  | { kind: "contains-miss"; needle: string; actual: string }
  | { kind: "regex-miss"; actual: string }
  | { kind: "generic" };

const EXACT_PREFIX = "Expected: ";
const CONTAINS_PREFIX = "Your output should contain: ";
const REGEX_MISS = "Your output doesn't match the expected pattern.";
const REGEX_CONFIG_ERROR = "Invalid regex pattern in grading config.";

export function parseRemediation(
  feedback: string | null | undefined,
  submission: string | null | undefined,
): Remediation {
  const f = feedback ?? "";
  const actual = submission ?? "";

  // Use startsWith + slice (NOT split on ":") so expected/needle values
  // that themselves contain colons or whitespace round-trip verbatim.
  if (f.startsWith(EXACT_PREFIX)) {
    return {
      kind: "exact-diff",
      expected: f.slice(EXACT_PREFIX.length),
      actual,
    };
  }
  if (f.startsWith(CONTAINS_PREFIX)) {
    return {
      kind: "contains-miss",
      needle: f.slice(CONTAINS_PREFIX.length),
      actual,
    };
  }
  if (f === REGEX_MISS) {
    return { kind: "regex-miss", actual };
  }
  // Config errors (REGEX_CONFIG_ERROR) and everything else → generic so
  // the panel just shows the raw feedback line. Config errors are an
  // authoring bug, not a learner mistake — no remediation to surface.
  return { kind: "generic" };
}
