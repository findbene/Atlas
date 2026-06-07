# Phase 0.z — C2 WASM-native fixture and validation repair
META: 2026-06-06 · SHIPPED (hidden/dark) · architect PASS + code-review SHIP · commit dd7784b

## 1. Task Received
Approved C2 validation repair (hidden/dark only): make the hidden C2 candidate's `csv_set_equal` validation runnable, fixture-backed, and regenerated from real DuckDB output — without promoting it or enabling server grading. Author seed fixtures, fix dataset-path bug, re-architect C2 SQL to be WASM-native, regenerate expected values from execution, reconcile the step-3/step-5 mismatch, keep dark, run gates, report.

## 2. Completion Status
**DONE.** Shipped dark, committed (`dd7784b`), pushed to main. Architect-reviewer **PASS** + code-reviewer **SHIP** (no P0/P1).

## 3. Files Changed (7 files, +488/−241)
- **NEW** `artifacts/atlas/public/datasets/seeds/{customers,subscriptions,orders}.csv`
- **EDIT** `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts` (5 code_sql steps)
- **NEW** `docs/phases/phase-0z-c2-wasm-native-validation-repair.md` (10-point close-out)
- **EDIT** `.agentic/progress.md`, `CLAUDE.md`

## 4. Scope Control / Hard Stops Check
All honored. No `serverGrade` (grader stays `BC_AUTO_PASS`). No row opted in. Candidate NOT promoted (still `candidateId`; `audit:csv-set-equal-bc` = "Visible csv_set_equal steps: 0"). No schema/migration, no envelope enforcement, no `PILOT_RUNTIME_KINDS` change, Phase 52 untouched, no codegen, no cloud/waves, no secrets, no force-push. Steps 4/6/7 (non-code_sql) untouched.

## 5. Implementation Details
**Fixtures:** `customers.csv` 8 rows incl 1 dup → 7 distinct (step-1 dedupe + step-2 SCD-2); `subscriptions.csv` 10 rows half-open `[start,end)` encoding the C-100 arc + June cohort; `orders.csv` realism-only.
**Dataset-path bug (B1):** dropped the double-`.csv` + bogus `.py`/`.yml`/`.sql` refs → `seeds/customers`, `seeds/subscriptions`.
**Re-architecture:** all 5 code_sql steps' starterCode + validation.query converted from dbt-Jinja (un-runnable in WASM) to self-contained inline-CTE DuckDB SQL over the seed tables; deterministic month spine (no `current_date`).
**Actual DuckDB output → before/after:** step 3 csv_set_equal C-100 arc `99/199/99/0` → `199/999/199/0`; step 5 June MRR `5847` → `2746` (**B4 fixed** — per-customer enterprise contracts dissolve the tier×price contradiction); steps 1 (7/7), 2 (0/0), 8 (NRR 1.05) unchanged but now fixture-backed.

## 6. Tests and Gates Run (Node 24.16.0; Docker PG :5434)
typecheck + check:no-heuristic-runtime **PASS** · execution-core **83/83** · atlas **159/159** · api-server **466/466** · curriculum-quality **132 pass** (1 env-only `COURSE_TAXONOMY` ENOENT) · `audit:authoring` **exit 0** · `audit:csv-set-equal-bc` **PASS (0 visible)** · `audit:contains-bc` **PASS 2/2**. **Execution verification:** all 5 committed validation.query strings reproduce the committed expected values byte-for-byte against the repo seeds (Python duckdb 1.5.3; re-confirmed by both reviewers).

## 7. Failures, Fixes, Surprises
- **Surprise (load-bearing):** the FE runtime never executes `validation.query`/`expectedRows` — it runs the learner's editor buffer and compares against `expectedOutputs` (custom keys → no-op). So `validation.*` was dead metadata; its only consumer is the server grader at a future flip.
- **B4 root fix:** modeled `mrr_amount` as per-customer contract value, not rigid tier×price.
- **Step 8** was Python-CLI typed code_sql (un-runnable in any in-browser runtime) → converted its editor to the WASM-native NRR SQL it resolves; CLI spec kept in prose + portfolio.
- Installed Python `duckdb` (local dev tool; did not touch the JS lockfile).

## 8. Current Git State
Branch `main`, HEAD `dd7784b`, pushed. Clean except hook-managed `.agentic/self-review.log`.

## 9. Current Project State
C2 candidate is runnable, fixture-backed, execution-derived, and **still hidden/dark**. Visible catalog unchanged (~60 projects; 0 visible csv_set_equal).

## 10. Remaining Risks / Blockers
- **R1 engine drift (low):** regenerated on duckdb 1.5.3; sandbox runs wasm 1.33.1-dev45.0. Mitigated by explicit casts; byte-verify in real browser before flip.
- **R2 (advisory):** enterprise-NRR `plan_tier` filter excludes churned/downgraded-out months — correct for this fixture; noted for future fixture authors.
- **R3:** step-8 lost its executable Python surface (accepted).
- **R4:** provisional client check is a no-op for these steps (pre-existing).
- **R5:** lockfile needs off-Windows regeneration.

## Is the 57B-flip now possible?
The data/validation blocker is RESOLVED; flip is mechanically unblocked but NOT executed. Remaining (deliberate, separate): promote candidate → `serverGrade:true` + re-seed → resolve 2 deferred P2s → OpenAPI/Orval regen → byte-verify in real-browser WASM.

## 11. Recommended Next Step
Real-browser WASM byte-verify + promotion decision before any live opt-in. → became Phase 0.zz.

## 12. Explicit Stop
Stopped after the repair. Candidate NOT promoted, `serverGrade` NOT set, 57B-flip not started.
