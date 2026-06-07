# Phase 59A — /check-vs-/submit evidence-parity baseline + scoped hardening
META: 2026-06-07 · COMPLETED · audit + tests + contract doc (no behavior change) · commit 75f3930

## 1. Task Received
Phase 59A: audit + harden the `/check` ↔ `/submit` evidence relationship — establish the evidence contract, find mismatches, fix only clearly-scoped low-risk defects, verify the 2 live server-graded rows on both routes, no-leak verify, add focused tests, preserve all hardening invariants. Hard stops: no new serverGrade/opt-ins/flips, no envelope enforcement, no Phase 52/env/canary/schema/production/cloud/wave/cert change, no force-push, no secrets, do not start Phase 60.

## 2. Completion Status
**COMPLETED.** Audit found **no defect**; shipped the contract-matrix doc + parity/no-leak/BC regression test. Reviews architect **PASS** + code **SHIP** (no P0/P1). All gates green. Phase 60 not started.

## 3. Files Changed
- `docs/check-submit-evidence-contract.md` — **NEW** (per-route behavior + per-kind evidence matrix).
- `artifacts/api-server/src/routes/user-check-submit-parity.test.ts` — **NEW** (parity regression).
- `docs/phases/phase-59a-check-submit-evidence-parity.md` — **NEW** (close-out).
- `.agentic/progress.md` — 59A entry.
- Excluded (hook-managed): `.agentic/self-review.log`, `HANDOFF.md`. **No route/comparator/schema/env change.**

## 4. Scope Control / Hard Stops Check
new serverGrade/opt-ins/flips? **no** · envelope enforcement? **no** · Phase 52? **no** · env/canary? **no** · schema/migration? **no** · OpenAPI/codegen? **no** · production/cloud/waves/cert-marketing? **no** · route logic edited? **no** (doc + test only) · force-push? **no** · secrets? **no** · Phase 60 started? **no**.

## 5. /check vs /submit Inventory
`/check` (`user.ts:805`): auth → enrollment gate (403, before step lookup) → step (404) → `gradeSubmission` → `{status, feedback}`. **Zero side effects.** `/submit` (`user.ts:424`): same gates → `envelopeCapture ? gradeEnvelopeCapture : gradeSubmission` → tx (advisory lock): upsert `user_step_completions`, gate XP+ledger on `isFreshPass`, update `user_progress` (completed when allStepsPassed) → post-commit `bumpStreak` + completion email → `{status, feedback, xpEarned, attempt, isFirstPass, projectComplete}`. Shared comparator = `gradeSubmission`→`gradeRowsetSubmission`. FE: `decideCsvSetEqualSubmission` (both Check + Submit) sends `{columns,rows}` JSON when `serverGrade && isSqlStep`. Server-grade signal to client = narrow `step.serverGrade` boolean only (`deriveServerGrade`).

## 6. Evidence-Contract Matrix Summary
`exact`/`contains` server-enforced (feedback reveals expected short string/needle by design); `numeric_tolerance`/`json_equal` commit-path auto-pass (contract-shaped; Phase 52 separate/operator-pending); `csv_set_equal` + `sql_resultset` server-enforced for exactly 1 opted-in row each (C2 step 3 / step 2), client-provisional otherwise, **no cell-value leak** (feedback = column names + structural mismatch only). `/check` never writes durable evidence; `/submit` writes durable evidence + XP only on fresh pass. Full table: `docs/check-submit-evidence-contract.md`.

## 7. Implementation Details
No code/behavior change — the audit proved parity is structural (one comparator; `/submit` envelope branch unreachable while enforcement OFF, and funnels to the same comparator even if reached). Deliverables are the matrix doc + a supertest regression exercising the real `/check` + `/submit` handlers (db mocked via the `user-submit.test.ts` transaction-mock pattern).

## 8. Live-Row Verification Result
For C2 step 2 (`sql_resultset`) + step 3 (`csv_set_equal`), the test confirms on BOTH routes: correct `{columns,rows}` → `passed "Correct!"`; raw SQL / malformed JSON / wrong columns / missing row / extra unmatched row / wrong value → `failed` with identical feedback across routes. `/check` creates no durable completion/evidence (no tx/insert/update) even on a passing server-graded row; `/submit` creates the intended completion + XP on fresh pass. (Browser-WASM → live-grader leg for these captures proven in 58B.)

## 9. No-Leak Verification Result
Neither route exposes `validationConfig`/`spec`/`expectedRows`/`expectedRowsHash`/hidden specs/the reference query — on PASS **or** FAIL. The strengthened test asserts the serialized expected row-set never appears in either response on any path. `deriveServerGrade` returns only the boolean (pinned by `projects-server-grade.test.ts`). No leak found.

## 10. Integration Verification Result
Route relationship verified via supertest against the real `/check` + `/submit` Express handlers (db mocked). Browser DuckDB-WASM → live-grader leg verified in 58B. **Full app UI boot blocked by Phase 0.2** → no full-app E2E; route harness + 58B capture are the closest verified paths.

## 11. Independent Review Results
- **architect-reviewer: PASS** — confirmed parity is real (not asserted), `/check` no-side-effect, no-leak, matrix accuracy, scope/invariants. P2s: no-leak test OK-only → **FIXED**; missing close-out/progress → **FIXED**; docstring BC overclaim → **FIXED**.
- **code-reviewer: SHIP** — mutation-tested the parity test (non-vacuous), dumped real negative feedback to confirm no-leak. P1 progress.md stale → **FIXED**; P2 strengthen no-leak → **FIXED**; P2 completed-transition untested → **DEFERRED** (covered by `user-submit.test.ts` H2).

## 12. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck + check:no-heuristic-runtime **PASS** · api-server **524/524** (+22 parity suite) · audit:sql-resultset-bc PASS (3 dark + 1 opted-in) · audit:csv-set-equal-bc PASS · audit:contains-bc 3/3 · audit:authoring exit 0. atlas + curriculum-quality not run (untouched). serverGrade counts csv:1 / sql:1.

## 13. Failures, Fixes, and Surprises
No code failures. Reviewers correctly caught that progress.md/close-out hadn't been written yet (I'd deferred docs to pre-commit) and that the first no-leak assertion was near-vacuous (OK-path only) — both fixed (strengthened to PASS+FAIL + expected-row-set absence; added non-opted csv BC case). Pleasant: code-reviewer mutation-tested the parity test and confirmed it's non-vacuous.

## 14. Current Git State
Branch `main`, HEAD `75f3930` (this archive commit follows). Pushed after archive. Working tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md`.

## 15. Remaining Risks / Blockers
- Deferred: `/submit` completed-transition path not re-covered by the parity file (covered by H2); OpenAPI `serverGrade` description polish + `audit:authoring` serverGrade-awareness (R1) pending from 58A/58B.
- Observe the live opted-in rows in a real env before any new opt-in.
- Full app UI boot blocked by Phase 0.2 (integration via route harness + 58B capture).

## 16. Recommended Next Step
**Phase 60** (portfolio / GitHub artifact, E2). Owner approval required to start.

## 17. Explicit Stop Statement
Stopped after Phase 59A. Phase 60 / broader expansion NOT started. Ready for next instruction.
