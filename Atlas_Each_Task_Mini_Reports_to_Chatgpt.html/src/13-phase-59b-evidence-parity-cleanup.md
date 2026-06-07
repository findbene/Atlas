# Phase 59B — evidence-parity cleanup, deferred-P2 closure, live-row observation readiness
META: 2026-06-07 · COMPLETED · audit serverGrade-awareness + tests + comments (no behavior change) · commit a00feb7

## 1. Task Received
Phase 59B: close the remaining Phase 59 evidence/parity risks before Phase 60 — resolve or document deferred 59A/58A/58B evidence P2s, strengthen route/evidence tests, confirm the 2 live server-graded rows remain stable. Do not expand validation coverage or start portfolio work. Hard stops: no new serverGrade/opt-ins/flips, no envelope enforcement, no Phase 52/env/canary/schema/cloud/portfolio/cert change, no force-push, do not start Phase 60.

## 2. Completion Status
**COMPLETED.** Closed the deferred P2s (1 deferred-again with rationale), added tests, re-verified both live rows. Reviews architect **PASS** + code **SHIP** (no P0/P1). All gates green. Phase 60 not started.

## 3. Files Changed
- `lib/curriculum-quality/src/validationEnforcement.ts` — NEW pure helpers (isServerGradedRowset, classifyValidationKindWithSpec, tallyValidationKindsWithSpec); static classifier unchanged.
- `scripts/src/audit-project-authoring.ts` — wired spec-aware tally + `validationKindSpecs` report field; dropped unused import.
- `lib/curriculum-quality/src/validationEnforcement.test.ts` — tests for the 3 helpers.
- `artifacts/api-server/src/routes/user-check-submit-parity.test.ts` — /submit completed-transition + idempotency for a server-graded row.
- `artifacts/api-server/src/routes/projects.ts` — comment-only cross-reference (deriveServerGrade → isServerGradedRowset).
- `scripts/src/audit-csv-set-equal-bc.ts`, `audit-sql-resultset-bc.ts`, `authored-lineage.ts` — comment-only stale-wording fixes.
- `docs/phases/phase-59b-evidence-parity-cleanup.md`, `.agentic/progress.md`. Excluded (hook-managed): self-review.log, HANDOFF.md.
- **NOT in diff:** grading.ts, envelopeGrade.ts, user.ts, lib/db, lib/api-spec, generated codegen, schema/migrations.

## 4. Scope Control / Hard Stops Check
new serverGrade/opt-ins/flips? **no** · envelope enforcement? **no** · Phase 52? **no** · env/canary? **no** · schema/migration? **no** · OpenAPI/codegen? **no** (deferred) · production/cloud/portfolio/GitHub/cert? **no** · grading/route behavior changed? **no** (reporting + tests + comments only) · force-push? **no** · secrets? **no** · Phase 60 started? **no**.

## 5. Deferred P2 Review Result
- `/submit` completed-transition not in 59A parity file → **FIXED** (added test).
- `audit:authoring` mislabels server-graded rowset kinds client-provisional (R1) → **FIXED** (serverGrade-aware classifier).
- OpenAPI `serverGrade` description polish → **DEFERRED** (embedded in yaml + 3 generated files; regen = ~95-file CRLF churn; current text accurate/not-misleading; ride next orval regen).
- Stale evidence-contract wording (57B–59A) → **FIXED** (comment-only).
- `.gitattributes` EOL for test/script files (code P2-b) → **DEFERRED** (separate tracked follow-up).

## 6. Implementation Details
The classifier change is the substance and is reporting-only. `isServerGradedRowset` is logically identical to the runtime `deriveServerGrade` (same `csv_set_equal | sql_resultset` gate, same null/object guards, same strict `serverGrade === true`), so the audit's `enforced` label corresponds exactly to the rows the server actually commit-grades — no drift, no false-enforced upgrade. The histogram splits a mixed kind into `<kind>` (dark) + `<kind> (server-graded)` (enforced); totals still sum to the step count. No runtime grading path touched.

## 7. Live-Row Re-Verification Result
`audit:sql-resultset-bc` (C2 step 2) + `audit:csv-set-equal-bc` (C2 step 3) re-run **PASS**: correct `{columns,rows}` passes; raw SQL / malformed JSON / wrong columns / missing row / extra unmatched row / wrong row value all fail closed; non-opted rows BC. Route-level parity additionally pinned by the expanded parity test.

## 8. Evidence/Parity Test Result
- `validationEnforcement.test.ts`: +3 describe blocks (isServerGradedRowset, classifyValidationKindWithSpec, tallyValidationKindsWithSpec) — green (incl. non-boolean serverGrade, non-rowset, malformed config, split-bucket tally).
- `user-check-submit-parity.test.ts`: +2 — `/submit` completed-transition (projectComplete + email once) + idempotent re-submit (no double XP/ledger; monotonic passed; evidence not overwritten). Reviewer mutation-confirmed non-vacuous.

## 9. No-Leak Verification Result
Unchanged from 59A and re-confirmed: neither `/check` nor `/submit` exposes validationConfig/spec/expectedRows/expectedRowsHash/the reference query, on PASS or FAIL. No response shaping changed this phase.

## 10. Integration Limitation Statement
Full app UI boot remains **blocked by Phase 0.2** (Replit connector coupling). Best verified paths: (a) browser DuckDB-WASM adapter capture → live route grader (58B); (b) route-level supertest parity tests against the real `/check` + `/submit` handlers (59A/59B). No full-app E2E.

## 11. Independent Review Results
- **architect-reviewer: PASS** — classifier no-false-enforced, no behavior change, audit totals conserved, tests non-vacuous, invariants intact. P2s: DB-gate reproducibility (env — I ran green on Docker PG); OpenAPI deferral concurred.
- **code-reviewer: SHIP** — isServerGradedRowset logically byte-identical to deriveServerGrade; both new /submit tests traced through real route code; totals conserved; scope clean. P2-a (4-copy predicate drift) → **FIXED** (cross-ref comment); P2-b (.gitattributes) → **DEFERRED**.

## 12. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck + check:no-heuristic-runtime **PASS** · api-server **526/526** (+2) · curriculum-quality **152/153** (+9; only failure = env-only COURSE_TAXONOMY ENOENT) · audit:authoring exit 0 (**97% enforced / 3% client-provisional**; `sql_resultset (server-graded) [enforced]` + `csv_set_equal (server-graded) [enforced]`) · audit:sql-resultset-bc PASS (3 dark + 1 opted-in) · audit:csv-set-equal-bc PASS · audit:contains-bc 3/3. serverGrade counts csv:1 / sql:1.

## 13. Failures, Fixes, and Surprises
No code failures. Pleasant: the serverGrade-aware audit landed cleanly — the histogram now self-documents which rowset rows are live server-enforced. Reviewers flagged the 4-copy opt-in predicate as a drift surface (deliberate, zero-dep boundary) → added a cross-reference comment. Both BC-audit + authoring gates need Docker PG (DATABASE_URL); reviewers ran on Node-22/no-DB so they could not re-run those three — I ran them green on Docker PG and the audit-file diffs are comment-only, so behavior is unchanged.

## 14. Current Git State
Branch `main`, HEAD `a00feb7` (this archive commit follows). Pushed after archive. Working tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md`.

## 15. Remaining Risks / Blockers
- Deferred: OpenAPI `serverGrade` description (ride next orval regen); `.gitattributes` EOL normalization for generated + test + script files.
- Observe the live opted-in rows in a real env before any new opt-in.
- Full app UI boot blocked by Phase 0.2.

## 16. Recommended Next Step
**Phase 60** (portfolio / GitHub artifact, E2). Owner approval required to start.

## 17. Explicit Stop Statement
Stopped after Phase 59B. Phase 60 / broader expansion NOT started. Ready for next instruction.
