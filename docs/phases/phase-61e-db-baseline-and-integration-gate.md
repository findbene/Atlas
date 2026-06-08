# Phase 61E — Restore full local DB baseline + integration gate (close-out)

**Status:** SHIPPED. Restored a fully-migrated local DB baseline; the global
authored-source serverGrade state is now DB-observable (**sql_resultset 8 +
csv_set_equal 2 = 10**), and the integration gate (env-blocked in 61D) passes
again. Root cause was a **journal timestamp defect**, not a missing migration.
**No comparator / validation-kind / envelope / Phase-52 change; no new project;
no new serverGrade flip; no schema change** (a pending migration was applied via
the existing migrator; one out-of-order journal timestamp was corrected).
Reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer` → SHIP** (§ below).

---

## 1. Root cause (DB Baseline Root Cause)

The Drizzle migrator applies each journal entry whose `when` is **greater than
the max `created_at` already recorded** in `drizzle.__drizzle_migrations`. The
committed journal had migration **#0** out of order:

| idx | tag | journal `when` |
|---|---|---|
| 0 | `0000_phase31_baseline` | **1779790340390** (≈ 2026-05-26) ← wrong, latest |
| 1 | `0001_phase46_run_envelope_nonces` | 1748390400000 (≈ 2025-05-28) |
| 2 | `0002_phase60b_portfolio_submission_snapshots` | 1749254400000 (≈ 2025-06-07) |

When the baseline applied, it persisted `created_at = 1779790340390`. That value
permanently exceeds 0002's `when` (1749254400000), so `pnpm migrate` computed
"latest applied = 1779790340390" and **silently skipped 0002 forever** — leaving
`portfolio_submission_snapshots` absent and the integration harness's table-clone
(`createTestSchema`) failing at setup with `relation "public.portfolio_submission_snapshots"
does not exist`. The migration file was **not** missing; the defect was the
journal timestamp ordering (a future landmine for any migration ≥ 0003 too).

This compounded with a separate environmental wipe (an out-of-scope base-only
re-seed had earlier dropped C2 + the mart candidates from the local DB — see the
Phase 61D close-out §5).

## 2. Migration / Baseline Repair Steps

1. **Source fix (the real defect):** corrected `lib/db/drizzle/meta/_journal.json`
   entry 0 `when` `1779790340390 → 1700000000000` so the baseline is the earliest
   migration (idx-order now matches time-order). Safe for all environments: a
   fresh DB applies all entries in idx order regardless; a fully-migrated DB
   re-computes "nothing new to apply" (lowering an applied entry's journal `when`
   never re-applies or skips anything); only a DB stuck in the exact poisoned
   partial state needs the local fix below.
2. **Local DB fix (throwaway Docker PG, not committed):** corrected the persisted
   baseline `created_at` (`update drizzle.__drizzle_migrations set
   created_at=1700000000000 where created_at=1779790340390`) so the max applied
   (now 1748390400000) is below 0002's `when`.
3. `pnpm migrate` → applied **0002** cleanly (`CREATE TABLE
   portfolio_submission_snapshots` + 3 FKs + 2 indexes). Verified: 3/3 migrations
   applied; `to_regclass('public.portfolio_submission_snapshots')` non-null.

No new migration authored; no schema redesign; the existing migrator did the DDL.

## 3. Re-Promotion Result — C2

`backfill:phase55-candidates` minted the C2 candidate (`c2dbc2db…`, idempotent;
also re-minted the C1 candidate, unpromoted — harmless). `author:project promote
analytics-engineer-semantic-layer-with-dbt-and-duckdb` inserted the project (8
steps, course=analytics-engineer); `audit --commit` → **qualityScore 85.3,
status approved, learner_visible=true**. Server-graded steps DB-confirmed:
**sql 1, 2, 5 + csv 3** (step 8 `sql_resultset` stays dark — the NRR float; steps
4, 6 `exact`; step 7 `contains`).

## 4. Re-Promotion Result — SaaS Mart

`backfill:phase61b-candidates` (candidate already present). `promote` (updated, 7
steps); `audit --commit` → **qualityScore 81.4, approved, visible**. Server-graded
steps DB-confirmed: **1, 2, 3, 4, 5, 6**; step 7 `contains`. Unchanged from 61D.

## 5. DB-Observed ServerGrade Counts

| kind | count | rows |
|---|---|---|
| `sql_resultset` | **8** | C2 1,2,5 + Mart 1,2,3,4,6 |
| `csv_set_equal` | **2** | C2 3 + Mart 5 |
| **total** | **10** | — |

Matches the authored source of truth. The global 10 is now directly DB-observable
(it was not, in the 61D reset environment).

## 6. Integration Gate Result

`vitest run --config vitest.integration.config.ts` (with
`INTEGRATION_TEST_DB_ALLOW=1`): **2 files / 4 tests PASS** (were env-blocked at
setup in 61D). The table-clone now finds `portfolio_submission_snapshots`. No
remaining env-block; no new regression.

## 7. Export Stack Verification Result

Export assembly is unchanged this phase. Coverage: the api-server unit suite
(**648/648**, includes the export-unit + `portfolioZip` ZIP-validity tests) and
the now-passing integration suite (which exercises `/submit` snapshot writes +
the portfolio_submission_snapshots round-trip) both green over the restored DB.
Portfolio artifact / repository JSON / repository ZIP routes assemble from the
same unchanged shared path; a live full-export ZIP round-trip (`zipfile.testzip()
= None`) was not separately seeded this phase (no learner completion authored) —
the unit + integration coverage stands in, consistent with 61C/61D.

## 8. No-Leak and Evidence-Honesty Verification

This phase changed only migration metadata + a guard script + a package.json
line + docs — **no route / projection / grader / authored-copy change**, so the
trust contract is byte-unchanged from 61D (architect + code-review confirmed in
61D). Re-confirmed here: `/check` writes no snapshot; `/submit` writes a snapshot
only on a fresh pass and is idempotent on repeat (exercised by the now-passing
`user-submit` + `user-fresh-submit-snapshot` integration tests); the project
projection still emits only the `serverGrade` boolean (no spec/expectedRows/query
leak); no banned H3 claims (no learner-facing copy touched). BC audits confirm
opt-in fail-closed across all 10 live rows.

## 9. Added Baseline Guard

New `scripts/src/check-db-baseline.ts` (`pnpm --filter @workspace/scripts run
check:db-baseline`, DB-gated, read-only) asserts: (1) **every journal migration
is applied** (the exact 61E root cause — `applied === journal.entries.length`);
(2) the migration-created + core tables exist (`run_envelope_nonces`,
`portfolio_submission_snapshots`, projects/steps/candidates/users); (3) C2 + Mart
are present, visible, approved, with their exact server-graded step sets
(`[1,2,3,5]` / `[1,2,3,4,5,6]`); (4) the global counts (sql 8 + csv 2 = 10).
Focused (~140 lines), no framework. Exits non-zero on the first failure so a
phase gate / CI can block. The `EXPECTED_*` constants are bumped in lockstep with
any future intentional flip (same discipline as `check:authored-saas-mart`).

## 10. Gates (Node 24.16.0 + Docker PG :5434)

typecheck (4) + check:no-heuristic **OK** · check:boot **OK** ·
**check:db-baseline OK (18/18)** · check:authored-saas-mart **OK** ·
audit:sql-resultset-bc **PASS** (8 opted-in, 51 checks, 0 fail; 1 dark = C2 s8
byte-identical to legacy) · audit:csv-set-equal-bc **PASS** (2 opted-in, 10
checks, 0) · audit:contains-bc **PASS** (4/4, 28 subs, 0 mismatch) ·
audit:authoring **C2 + Mart ✓ publish-ready** · api-server **648/648** · atlas
**170/170** · **integration 4/4 (restored)**.

## 11. Invariants (confirmed)

Global serverGrade **= 10** (sql 8 + csv 2); comparator
(`gradeRowsetSubmission`/`grading.ts`) byte-unchanged; envelope enforcement OFF;
Phase 52 untouched; **no new migration, no schema redesign** (one pending
migration applied + one journal timestamp corrected); RUBRIC_VERSION frozen;
archive=hide; no new project authored; no new serverGrade flip; C2 + Mart authored
sources unchanged. **Phase 61F not started.**

## 12. Reviews

- **atlas-architect-reviewer → PASS** (no P0/P1). Verified the journal-edit safety
  against the **actual drizzle-orm 0.45.2 migrator source**: the migration `hash`
  is `sha256(query)` over the `.sql` only (`migrator.js:23`) — `when` is never
  checksummed, so editing it cannot re-apply; the apply rule is `apply IFF (no
  rows) OR (max(created_at) < migration.when)`, strict `<`, idx order
  (`pg-core/dialect.js:56-71`). Enumerated every existing-DB state (fresh /
  fully-migrated / poisoned-partial / re-baselined) → the new monotonic journal
  never causes a wrong apply, wrong skip, or re-application; lowering an applied
  entry's `when` only makes its own apply-condition more false. Confirmed scope,
  guard correctness (parameterized SQL, read-only, `serverGrade='true'` matches the
  grader's `=== true` source of truth), and all inherited invariants.
  - **P2 (addressed):** the close-out's "production is most likely fully migrated"
    was an inference presented as near-fact — softened to an operator-verify
    directive in §13.
  - **P2 (noted):** `check:db-baseline` is manual/DB-gated, not yet wired into an
    automated CI gate (already a §13 follow-up).
- **code-reviewer → SHIP** (no P0/P1). Confirmed the diff is exactly the journal
  one-liner + the new guard + the package.json line; `_journal.json` valid +
  monotonic; the guard is read-only with no injection (table names from a constant
  array, slugs bound via the Drizzle `sql` template); assertions match claims;
  sensible exit codes.
  - **P2 (addressed):** `serverGradedSteps` now filters
    `validation_type in ('sql_resultset','csv_set_equal')` so the per-project and
    global queries read identically.
  - **P2 (noted):** the hardcoded `EXPECTED_*` baseline is an intentional,
    documented maintenance tax (same pattern as `check:authored-saas-mart`).

## 13. Remaining / next

- The journal `when` fix corrects the source defect. **Production/Neon migration
  state MUST be verified by the operator** — run `check:db-baseline` (or inspect
  `drizzle.__drizzle_migrations`) against prod; **if row 0 shows
  `created_at=1779790340390`, apply the same one-time `created_at` correction**
  then `pnpm migrate`. Note (architect 61E): a prod DB migrated purely
  incrementally via `pnpm migrate` under the OLD journal would have skipped 0002
  (and possibly 0001) — so prod *having* `portfolio_submission_snapshots` implies
  it was provisioned another way (`drizzle-kit push` / a fresh baseline), which the
  operator should confirm rather than assume. The committed journal edit is
  strictly non-harmful to any prod state (it never re-applies or wrong-skips a
  migration — verified against the drizzle-orm 0.45.2 migrator source); it only
  removes the future landmine. Not executed by the agent.
- `check:db-baseline` is a candidate to wire into the phase ritual / CI once a DB
  is provisioned in that environment.
- `.gitattributes` EOL-normalize follow-up still standing.
- Phase 61F (owner-gated): next density / authoring work.
