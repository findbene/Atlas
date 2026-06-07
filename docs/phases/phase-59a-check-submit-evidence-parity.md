# Phase 59A — `/check` vs `/submit` evidence-parity baseline + scoped hardening (close-out)

**Status:** SHIPPED. An **audit/hardening** phase: established the `/check` ↔ `/submit` evidence contract,
verified parity for the two live server-graded rows, and added regression tests + a contract-matrix doc.
**No behavior change** — the audit found no defect. No new opt-ins/flips, envelope enforcement OFF,
Phase 52 untouched.

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer` → SHIP**, no P0/P1. Their
shared P2 (no-leak test only exercised the passing path) was **fixed this phase**; the docstring/BC and
progress/close-out P2s were also fixed. One P2 deferred with rationale (below).

---

## 1. Audit conclusion (no defect)

`/check` and `/submit` share ONE pure comparator (`gradeSubmission` → `gradeRowsetSubmission` for the rowset
kinds). For the two live server-graded rows, parity is structural, not incidental:

- `/check` (`user.ts:805`) grades via `gradeSubmission(step, submission)` and performs **zero** side effects
  (no DB writes, never queries `user_step_completions`; response omits the reward fields).
- `/submit` (`user.ts:424`) grades via `envelopeCapture ? gradeEnvelopeCapture : gradeSubmission`. The
  envelope branch is unreachable for the live rows (envelope enforcement OFF: `PILOT_RUNTIME_KINDS={json_equal}`,
  `ATLAS_ENVELOPE_REQUIRED_KINDS` empty, `isEnvelopeEnforcedFor` false), so `/submit` falls through to the
  same `gradeSubmission(step, submission)` as `/check`. Even if the envelope branch were active, the csv/sql
  envelope branches serialize `{columns,rows}` and call the same comparator — one comparator, cannot disagree.
- Neither route leaks answer keys: responses carry only `{status, feedback}` (+ `/submit` reward fields);
  `validationConfig`/`spec`/`expectedRows`/`expectedRowsHash`/the reference `query` are never serialized.
  Comparator feedback for csv/sql reports column names + structural mismatch (count/missing/unexpected/width),
  never expected cell VALUES.

Full per-route + per-kind detail: `docs/check-submit-evidence-contract.md`.

## 2. Files changed

- `docs/check-submit-evidence-contract.md` — **NEW.** Authoritative `/check` vs `/submit` behavior table +
  per-kind evidence-contract matrix (contains, exact, numeric_tolerance, json_equal, csv_set_equal,
  sql_resultset): check/submit behavior, server-graded vs client-provisional, durable-evidence, XP/progress,
  answer-key-leak, status; the `/check` ≠ durable-evidence boundary; H3 honesty; limitations.
- `artifacts/api-server/src/routes/user-check-submit-parity.test.ts` — **NEW.** Supertest regression against
  the real `/check` + `/submit` handlers (db mocked). Proves, for both live kinds: grading parity + fail-closed
  parity (6 negatives); `/check` writes nothing (no tx/insert/update) even on a passing server-graded row;
  `/submit` persists completion + XP on fresh pass; no answer-key leak on PASS **and** FAIL paths (incl. the
  expected row-set never appearing); non-opted sql_resultset **and** csv_set_equal rows BC on both routes.
- `docs/phases/phase-59a-check-submit-evidence-parity.md` — this close-out.
- `.agentic/progress.md` — Phase 59A entry.
- Excluded (hook-managed): `.agentic/self-review.log`, `HANDOFF.md`. **No route/comparator/schema/env change.**

## 3. `/check` vs `/submit` inventory

Backend: `user.ts` `/check` (805) + `/submit` (424); shared `gradeSubmission` (`grading.ts`); `/submit`-only
`gradeEnvelopeCapture` (`envelopeGrade.ts`, off). FE callers: `project-workspace.tsx` Check/Submit handlers
via `decideCsvSetEqualSubmission` (sends `{columns,rows}` JSON when `serverGrade && isSqlStep`). Persistence
(submit only): `user_step_completions`, `user_progress`, `user_xp`, `xp_transactions`, all inside one
`db.transaction` under `pg_advisory_xact_lock`; post-commit best-effort `bumpStreak` + completion email.
Telemetry: envelope verify/fallback metrics (envelope path only). The server-grade signal exposed to the
client is the narrow `step.serverGrade: boolean` (`deriveServerGrade`, gated to `csv_set_equal | sql_resultset`).

## 4. Evidence-contract matrix summary

See `docs/check-submit-evidence-contract.md` §2. Key points: `exact`/`contains` server-enforced (feedback
reveals the expected short string/needle **by design**); `numeric_tolerance`/`json_equal` commit-path
auto-pass (contract-shaped; Phase 52 envelope canary separate + operator-pending); `csv_set_equal` and
`sql_resultset` server-enforced for exactly 1 opted-in row each (C2 step 3 / step 2), client-provisional
otherwise, **no cell-value leak**. `/check` never writes durable evidence; `/submit` writes durable evidence
+ XP only on a fresh pass.

## 5. Live-row verification

For C2 step 2 (`sql_resultset`) and step 3 (`csv_set_equal`), the parity test confirms on BOTH routes:
correct `{columns,rows}` → `passed "Correct!"`; raw SQL / malformed JSON / wrong columns / missing row /
extra unmatched row / wrong row value → `failed` (identical feedback on both routes). `/check` creates no
durable completion/evidence; `/submit` creates the intended completion + XP on fresh pass. (The browser-WASM
→ live-grader leg for these exact captures was proven in Phase 58B.)

## 6. No-leak verification

Neither route exposes `validationConfig` / `spec` / `expectedRows` / `expectedRowsHash` / hidden specs / the
reference query — on PASS or FAIL. The strengthened test asserts the serialized expected row-set never
appears in either response on any path. `deriveServerGrade` returns only the boolean (pinned separately by
`projects-server-grade.test.ts`).

## 7. Integration path / limitation

Route relationship verified via supertest against the real `/check` + `/submit` Express handlers (db mocked).
The browser DuckDB-WASM → live-grader leg was verified in 58B. **Full app UI cannot boot** (Replit connector
coupling, Phase 0.2 pending), so no full-app E2E — the route harness + 58B capture are the closest verified paths.

## 8. Reviews

- **architect: PASS** — traced parity (real, not asserted), `/check` no-side-effect, no-leak, matrix accuracy;
  confirmed scope + invariants. P2: no-leak test weak (OK-only) → **FIXED** (PASS+FAIL + expected row-set
  absence); missing phase docs / progress entry → **FIXED**; test docstring BC overclaim → **FIXED** (added
  non-opted csv BC case).
- **code-reviewer: SHIP** — mutation-tested the parity test (non-vacuous: flipping the xp-ledger assertion
  failed it), dumped real negative feedback to confirm the no-leak thesis. P1: progress.md stale → **FIXED**.
  P2(a): strengthen no-leak → **FIXED**. P2(b): completed-transition path untested here → **DEFERRED** (out of
  scope for a parity test; covered by `user-submit.test.ts` H2).

## 9. Tests & gates (Node 24 + Docker PG :5434)

typecheck + check:no-heuristic-runtime **PASS** · api-server **524/524** (+22: parity suite incl. strengthened
no-leak + csv BC) · `audit:sql-resultset-bc` PASS (3 dark + 1 opted-in) · `audit:csv-set-equal-bc` PASS ·
`audit:contains-bc` 3/3 · `audit:authoring` exit 0. atlas + curriculum-quality **not run** (untouched — no FE
or content/spec change). serverGrade counts: csv:1, sql:1.

## 10. Final invariants (confirmed)

Exactly 1 `csv_set_equal` + 1 `sql_resultset` opted in; no new `serverGrade:true`; no new validation-kind
flips; C2 visible+approved; envelope enforcement OFF; Phase 52 untouched; no schema/env/canary/production/
cloud/wave/cert-marketing change. `RUBRIC_VERSION` frozen. Phase 60 not started.

## 11. Remaining risks / next

- Deferred: `/submit` completed-transition path not re-covered by the parity file (covered by H2); OpenAPI
  `serverGrade` description polish + `audit:authoring` serverGrade-awareness (R1) still pending from 58A/58B.
- Observe the live opted-in rows in a real env before any new opt-in.
- **Phase 60** (portfolio / GitHub artifact, E2) is next — **owner approval required; not started.**
