/**
 * Phase 42 — Pure helpers for classifying how Atlas actually enforces each
 * `project_steps.validation_type` value at runtime.
 *
 * Used by `scripts/src/audit-project-authoring.ts` (Phase 35) to add a
 * read-only "Validation enforcement breakdown" section to the audit
 * summary so author + reviewer can see, at a glance, which validation
 * kinds the server's `/check` + `/submit` grader actually evaluates vs.
 * which kinds are contract-shaped metadata that fall through to a
 * generic auto-pass.
 *
 * No DB imports. No side effects. Lives in `@workspace/curriculum-quality`
 * so it's testable inside the existing vitest harness without bolting a
 * vitest config onto `@workspace/scripts` (matches the Phase 35
 * `authoringAudit.ts` precedent).
 *
 * Source-of-truth references (do not duplicate the rules here — encode
 * them):
 *
 *   - Server commit-path grader: `artifacts/api-server/src/lib/grading.ts`
 *     (`gradeSubmission`). The switch covers exactly: `self_attest`,
 *     `exact`, `contains`, `regex`. Every other value falls through to
 *     `{ passed: true, feedback: "Step completed." }`.
 *
 *   - Client provisional grader (SQL Run path only):
 *     `lib/execution-core/src/validate.ts` (`validateExpected`). When a
 *     SQL step has structured `expectedOutputs.rows` / `.stdout` /
 *     `.stdoutMatches`, the DuckDB-WASM adapter routes the run through
 *     this helper and emits a PROVISIONAL pass/fail. The provisional
 *     result NEVER commits — only the server `/check` + `/submit` grader
 *     can mark a step `passed`. So SQL-shaped kinds give the learner
 *     immediate UI feedback but still rely on the server grader for the
 *     authoritative outcome.
 *
 *   - DB enum: `lib/db/src/schema/enums.ts` → `validationTypeEnum` covers
 *     the 9 strings classified below. Anything not in the enum is
 *     rejected at insert.
 */

/**
 * The 9 strings allowed by the `validation_type` DB enum (Phase 31
 * baseline; see `lib/db/src/schema/enums.ts → validationTypeEnum`).
 * Kept as a frozen array (not imported from `@workspace/db`) to keep
 * this lib zero-dep on db packages — the audit script that consumes us
 * already pulls from the DB. If the enum changes, this array AND the
 * `STATUS_BY_KIND` table below must be updated together (the
 * `Record<...>` type makes that a typecheck error, not a silent drift).
 */
export const ENFORCEMENT_VALIDATION_KINDS = [
  "self_attest",
  "exact",
  "contains",
  "regex",
  "numeric_tolerance",
  "csv_set_equal",
  "csv_ordered",
  "json_equal",
  "sql_resultset",
] as const;

/**
 * The 9-string union the DB enum recognizes. Named
 * `EnforcementValidationKind` (not `ValidationKind`) to avoid colliding
 * with the existing `ValidationKind` export from `./authoring.ts`, which
 * is the authoring-side union. The two unions overlap but are
 * deliberately decoupled — this one's contract is "what does the DB
 * enum hold + what does the runtime do with each value", which is what
 * the audit guardrail needs.
 */
export type EnforcementValidationKind =
  (typeof ENFORCEMENT_VALIDATION_KINDS)[number];

/**
 * Enforcement status answers the question:
 *   "When the learner clicks Submit, what actually decides pass/fail?"
 *
 * - `enforced` — Server commit-grader (`lib/grading.ts`) inspects the
 *   submission against the step's rule and returns a real pass/fail.
 *   `self_attest` is `enforced` (it's *intentionally* auto-pass; that's
 *   its contract, not a fallthrough).
 *
 * - `client-provisional` — Server falls through to auto-pass at commit
 *   time, BUT the client (`validateExpected` in execution-core) gives
 *   the learner real provisional feedback during Run (SQL only today).
 *   The committed grade is still auto-pass, so the platform should treat
 *   these as honest contract-shapes rather than as machine-enforced.
 *
 * - `contract-shaped` — Server falls through to auto-pass at commit time
 *   AND no client-side provisional grader exists for this kind. The
 *   `expectedOutputs` metadata documents the contract for human reviewers
 *   and for local reproduction (`docker-compose up`); the platform itself
 *   does not check it.
 *
 * - `unknown` — Defensive: a value that's somehow in the DB but not in
 *   our classifier. Treated as `contract-shaped` for risk purposes; the
 *   audit surfaces it so the author can fix the typo.
 */
export type EnforcementStatus =
  | "enforced"
  | "client-provisional"
  | "contract-shaped"
  | "unknown";

const STATUS_BY_KIND: Record<EnforcementValidationKind, EnforcementStatus> = {
  self_attest: "enforced",
  exact: "enforced",
  contains: "enforced",
  regex: "enforced",
  // SQL kinds: client-provisional via `validateExpected` when the step
  // produces tabular RunResult (DuckDB-WASM adapter route). Server
  // commit-grader still auto-passes — provisional is UI feedback only.
  // `csv_ordered` is the order-sensitive sibling of `csv_set_equal`
  // (`validateExpected` flips on `expected.orderSensitive`). Same
  // enforcement story as the order-insensitive variants — provisional
  // client check, server auto-pass.
  sql_resultset: "client-provisional",
  csv_set_equal: "client-provisional",
  csv_ordered: "client-provisional",
  // Python-only structured kinds: no client validator path today, no
  // server grader. Pure contract metadata.
  json_equal: "contract-shaped",
  numeric_tolerance: "contract-shaped",
};

/**
 * Classify a validation_type string. Tolerant of `null` / `undefined`
 * (caller may pass a column value directly) and of unknown strings
 * (returns `'unknown'`, never throws).
 */
export function classifyValidationKind(
  kind: string | null | undefined,
): EnforcementStatus {
  if (!kind) return "unknown";
  if ((ENFORCEMENT_VALIDATION_KINDS as readonly string[]).includes(kind)) {
    return STATUS_BY_KIND[kind as EnforcementValidationKind];
  }
  return "unknown";
}

/**
 * Human-readable explanation of an enforcement status. Used by the audit
 * to print a one-liner alongside each kind in the breakdown.
 */
export function describeEnforcement(status: EnforcementStatus): string {
  switch (status) {
    case "enforced":
      return "server commit-grader evaluates submission";
    case "client-provisional":
      return "client gives provisional feedback (SQL Run); server commit-grader auto-passes";
    case "contract-shaped":
      return "no runtime grader; expectedOutputs is contract metadata for local repro + human review";
    case "unknown":
      return "value not recognized by the classifier (defensive fallback — DB enum is the actual hard gate at insert)";
  }
}

/**
 * Convenience tally over a flat list of validation_type values. Returns a
 * map keyed by kind with `{count, status}` so the caller can both sort
 * and group by enforcement status without re-classifying.
 *
 * Unknown kinds are recorded under their original string so the operator
 * can grep for the typo.
 */
export type KindTallyEntry = { count: number; status: EnforcementStatus };

export function tallyValidationKinds(
  kinds: Array<string | null | undefined>,
): Map<string, KindTallyEntry> {
  const tally = new Map<string, KindTallyEntry>();
  for (const raw of kinds) {
    const key = raw ?? "(null)";
    const status = classifyValidationKind(raw);
    const prev = tally.get(key);
    if (prev) prev.count++;
    else tally.set(key, { count: 1, status });
  }
  return tally;
}
