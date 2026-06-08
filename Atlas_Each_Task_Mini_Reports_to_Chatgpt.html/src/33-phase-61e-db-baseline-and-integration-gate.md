# Phase 61E — Restore full local DB baseline + integration gate
META: 2026-06-08 · COMPLETED · fix(infra/db-baseline) · source in wip 4da993d/1407eff, review-fixes 3375d8b

## 1. Task Received
Phase 61E — restore a fully-migrated local DB baseline so the global authored-source serverGrade state (sql 8 + csv 2 = 10) is DB-observable, and repair the integration gate that was env-blocked in 61D (reset DB missing `portfolio_submission_snapshots`). Hard stops: no new project, no new serverGrade flip, no comparator/validation-kind/envelope/Phase-52 change, no schema change unless a proven baseline defect makes it unavoidable, no new migration unless a real one is missing + reviewed, no broad seed/promote rewrite. Stop after 61E.

## 2. Completion Status
**COMPLETED.** Root cause was a **journal timestamp defect** (not a missing migration). Corrected it + applied the pending migration via the existing migrator; re-promoted C2 + Mart; DB now shows serverGrade **sql 8 + csv 2 = 10**; **integration restored 4/4**; added a `check:db-baseline` guard. Reviews: architect **PASS** + code-reviewer **SHIP** (0 P0/P1; both P2 sets applied).

## 3. Files Changed
Committed source: `lib/db/drizzle/meta/_journal.json` (one `when` field) · `scripts/src/check-db-baseline.ts` (NEW guard) · `scripts/package.json` (1 script line) · close-out `docs/phases/phase-61e-db-baseline-and-integration-gate.md` · `.agentic/progress.md`. **No migration `.sql`, no grader/comparator, no route, no authored C2/Mart `.ts`, no schema redesign, no new migration file.** Bulk landed in session-end wip `4da993d`/`1407eff` (pushed); review-fixes in `3375d8b`. Local DB ops (migrate, backfill, promote) ran against the throwaway Docker PG — not committed.

## 4. Scope Control / Hard Stops Check
New project? **no.** New serverGrade flip? **no.** Comparator/validation-kind/envelope/Phase-52? **untouched.** Schema redesign / new migration file? **no** (applied an existing pending migration; corrected one journal timestamp — a proven baseline defect). Broad seed/promote rewrite? **no.** Grader/route/authored copy? **unchanged.** Leak / H3? **untouched** (no learner-facing change). 61F started? **no.**

## 5. Implementation Details
The Drizzle migrator applies each journal entry whose `when` exceeds the max `created_at` already in `drizzle.__drizzle_migrations`. The committed journal had migration #0 (baseline) at `when=1779790340390` (2026) — later than 0001/0002. Once applied, the baseline poisoned `created_at=1779790340390`, permanently exceeding 0002's `when` → `pnpm migrate` silently skipped `0002_phase60b_portfolio_submission_snapshots`. Fix: corrected the journal entry-0 `when` → `1700000000000` (source) + un-poisoned the local DB's persisted baseline `created_at` (throwaway DB) → `pnpm migrate` applied 0002 cleanly. Re-promoted C2 + Mart through the existing authoring pipeline. Added a read-only guard asserting the migration + table + project + count state so this class can't silently recur.

## 6. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck (4) + check:no-heuristic **OK** · check:boot **OK** · **check:db-baseline OK (18/18)** · check:authored-saas-mart **OK** · audit:sql-resultset-bc **PASS** (8 opted-in, 51 checks, 0 fail; 1 dark = C2 s8 byte-identical to legacy) · audit:csv-set-equal-bc **PASS** (2 opted-in) · audit:contains-bc **PASS** (4/4) · audit:authoring **C2 + Mart ✓ publish-ready** · api-server **648/648** · atlas **170/170** · **integration 4/4 (RESTORED)**.

## 7. Failures, Fixes, and Surprises
- **`pnpm migrate` reported "OK" but applied nothing** (still 2/3 migrations) — the journal-timestamp poison. Diagnosed via the journal `when` values vs the persisted `created_at`.
- The DB had also been wiped of C2 + the mart candidates (out-of-scope re-seed from before 61D) — re-promoted both.
- Session-end hook auto-committed the bulk as wip (`4da993d`/`1407eff`, pushed) before a manual conventional commit; not rewritten (force-push to main = hard stop).

## 8. Current Git State
Branch `main`, HEAD `3375d8b` (review-fixes), pushed. 61E source in `4da993d`/`1407eff` (wip, pushed). Tree clean except hook-managed `self-review.log` + `HANDOFF.md`.

## 9. Current Project State After This Task
Local DB fully migrated (3/3); `portfolio_submission_snapshots` present; C2 (8 steps, 85.3 approved, visible) + Mart (7 steps, 81.4 approved, visible) restored; global serverGrade **= 10** (sql 8 + csv 2), DB-observable; integration gate green. No behavior change to graders/routes/authored content.

## 10. Remaining Risks / Blockers
- **Production/Neon migration state must be operator-verified** (run `check:db-baseline` against prod; if `__drizzle_migrations` row 0 = `created_at=1779790340390`, apply the same one-time correction). The committed journal edit is strictly non-harmful to any prod state.
- `check:db-baseline` is manual/DB-gated — wire into CI once a DB is provisioned there.
- `.gitattributes` CRLF follow-up still standing.

## 11. Recommended Next Step
Phase 61F (owner-gated) — next density / authoring work, under the full phase ritual. Do not begin unprompted. Optionally wire `check:db-baseline` into the phase ritual.

## 12. Explicit Stop Statement
**Stopped.** Local DB fully migrated; integration restored 4/4; C2 + Mart approved + visible; DB-observed serverGrade = 10; new baseline guard green; no grader/route/authored/Phase-52/envelope change. Reviews PASS/SHIP, all gates green. **Phase 61F NOT started.** Awaiting next instruction.

---

## 13. DB Baseline Root Cause
A **journal timestamp ordering defect**, not a missing migration. `lib/db/drizzle/meta/_journal.json` entry 0 (`0000_phase31_baseline`) carried `when=1779790340390` (≈2026-05-26) — later than 0001 (1748390400000, 2025-05) and 0002 (1749254400000, 2025-06). The Drizzle migrator applies entries with `when > max(applied created_at)`; the applied baseline persisted `created_at=1779790340390`, which permanently exceeds 0002's `when` → `pnpm migrate` silently skipped `0002_phase60b_portfolio_submission_snapshots`. That absent table made the integration harness's table-clone (`createTestSchema`) fail at setup → env-blocked. A future landmine for any migration 0003+ too. (Verified against drizzle-orm 0.45.2 `migrator.js:23` + `pg-core/dialect.js:56-71`.)

## 14. Migration/Baseline Repair Steps
1. **Source:** corrected `_journal.json` entry-0 `when` `1779790340390 → 1700000000000` (baseline now earliest; idx-order = time-order). The `.sql` files + hashes untouched (hash excludes `when`).
2. **Local DB (throwaway, not committed):** `update drizzle.__drizzle_migrations set created_at=1700000000000 where created_at=1779790340390`.
3. `pnpm migrate` → applied 0002 (`CREATE TABLE portfolio_submission_snapshots` + 3 FKs + 2 indexes). Verified 3/3 migrations; table present. No new migration, no schema redesign.

## 15. Re-Promotion Result for C2
`backfill:phase55-candidates` minted the C2 candidate (`c2dbc2db…`, idempotent). `author:project promote analytics-engineer-semantic-layer-with-dbt-and-duckdb` (inserted, 8 steps, course=analytics-engineer); `audit --commit` → **qualityScore 85.3, status approved, learner_visible=true**. Server-graded steps DB-confirmed: **sql 1, 2, 5 + csv 3** (step 8 `sql_resultset` stays dark = NRR float; steps 4,6 `exact`; 7 `contains`). Authored source unchanged.

## 16. Re-Promotion Result for SaaS Mart
`backfill:phase61b-candidates` (candidate already present). `promote` (updated, 7 steps); `audit --commit` → **81.4 approved, visible**. Server-graded steps **1,2,3,4,5,6**; step 7 `contains`. Unchanged from 61D.

## 17. DB-Observed ServerGrade Counts
`sql_resultset` = **8** (C2 1,2,5 + Mart 1,2,3,4,6); `csv_set_equal` = **2** (C2 3 + Mart 5); **total = 10**. Matches the authored source of truth — now directly DB-observable (it was not, in the 61D reset env).

## 18. Integration Gate Result
`vitest --config vitest.integration.config.ts` (`INTEGRATION_TEST_DB_ALLOW=1`): **2 files / 4 tests PASS** (were env-blocked at setup in 61D). No remaining env-block; no new regression; the `portfolio_submission_snapshots` round-trip now exercised.

## 19. Export Stack Verification Result
Export assembly unchanged this phase. Covered by the api-server unit suite (**648/648**, incl. export-unit + `portfolioZip` ZIP-validity tests) and the now-passing integration suite (exercises `/submit` snapshot writes + the snapshot table round-trip). Artifact / repository JSON / repository ZIP routes assemble from the same unchanged path. A live full-export ZIP round-trip (`zipfile.testzip()=None`) was not separately seeded (no learner completion authored) — unit + integration coverage stands in (61C/61D precedent).

## 20. No-Leak and Evidence-Honesty Verification
No route/projection/grader/authored-copy change this phase → trust contract byte-unchanged from 61D. Re-confirmed: `/check` writes no snapshot; `/submit` writes a snapshot only on a fresh pass + is idempotent on repeat (exercised by the now-passing `user-submit` + `user-fresh-submit-snapshot` integration tests); the project projection emits only the `serverGrade` boolean; no banned H3 claims (no learner-facing copy touched). BC audits confirm opt-in fail-closed across all 10 live rows.

## 21. Added Baseline Guard
`scripts/src/check-db-baseline.ts` (`check:db-baseline`, DB-gated, read-only, ~140 lines). Asserts: (1) all journal migrations applied (`applied === journal.entries.length` — the 61E root cause); (2) migration-created + core tables exist (`run_envelope_nonces`, `portfolio_submission_snapshots`, projects/steps/candidates/users); (3) C2 + Mart present/visible/approved with exact server-graded step sets (`[1,2,3,5]` / `[1,2,3,4,5,6]`); (4) global counts (sql 8 + csv 2 = 10). Parameterized SQL (no injection), exits non-zero on failure. Post-review (P2-a): the per-project query now filters `validation_type in ('sql_resultset','csv_set_equal')` to read identically to the global block. `EXPECTED_*` bumped per future flip (same discipline as `check:authored-saas-mart`).

## 22. Independent Review Results
- **atlas-architect-reviewer → PASS** (0 P0/P1): verified the journal-edit safety against the **actual drizzle-orm 0.45.2 source** — hash excludes `when` (`migrator.js:23`); apply rule `(no rows) OR (max(created_at) < when)`, strict `<`, idx order (`pg-core/dialect.js:56-71`); enumerated every DB state → no wrong apply/skip/re-apply; future 0003+ landmine removed. P2s: softened the close-out's prod-state inference to an operator-verify directive (applied); guard not yet CI-wired (noted).
- **code-reviewer → SHIP** (0 P0/P1): diff exactly the journal one-liner + guard + package.json line; JSON valid + monotonic; guard read-only, no injection, assertions match claims, sensible exit codes. P2s: added the `validation_type` filter to `serverGradedSteps` (applied); hardcoded `EXPECTED_*` is an intentional documented maintenance tax (noted).
