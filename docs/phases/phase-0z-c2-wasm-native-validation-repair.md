# Phase 0.z — C2 WASM-native fixture and validation repair (close-out)

**Status:** SHIPPED. Candidate remains **hidden/dark** — not promoted, no row opted in, `serverGrade`
absent. Architect-reviewer **PASS** + code-reviewer **SHIP** (no P0/P1; 2 advisory P2s recorded below).

Candidate: `analytics-engineer-semantic-layer-with-dbt-and-duckdb` (Phase 55 C2). Goal: make the
`csv_set_equal` validation (step 3) **runnable, fixture-backed, and regenerated from real DuckDB
output** so a future `serverGrade:true` flip is safe — without promoting the candidate or enabling
server grading. Supersedes the read-only proposal `phase-0y-c2-fixture-repair-proposal.md` (Repair A).

---

## 1. Files changed
- **NEW fixtures** (`artifacts/atlas/public/datasets/seeds/`): `customers.csv`, `subscriptions.csv`,
  `orders.csv`.
- **EDITED** `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts` — the 5
  `code_sql` steps (1, 2, 3, 5, 8): starterCode + `validation.query` converted from dbt-Jinja to
  self-contained WASM-native inline-CTE SQL; `datasetRefs` corrected; expected values regenerated from
  execution; instruction prose reconciled. Steps 4/6/7 (`exact`/`contains`, non-`code_sql`) untouched.
- **EDITED** `.agentic/progress.md` (0.z log). This close-out doc (NEW).

## 2. Exact fixtures added and why
| File | Why | Shape |
|---|---|---|
| `seeds/customers.csv` | Step 1 dedupe assertion + step 2 SCD-2 + the grid's distinct customer set | 8 rows, C-100..C-106, **1 duplicate `customer_id` (C-101)** → 7 distinct. `customer_id,email,plan_tier,signup_date,country_code,loaded_at`. |
| `seeds/subscriptions.csv` | Drives steps 3 (C-100 arc), 5 (June MRR), 8 (enterprise NRR) | 10 rows; half-open `[start_date,end_date)` periods. `customer_id,plan_tier,mrr_amount,start_date,end_date`. |
| `seeds/orders.csv` | dbt-project realism only (the narrative ships 3 seed CSVs); **not read by any runnable query** | 9 rows matching the `stg_orders` contract `order_id,customer_id,order_amount_cents,order_ts,loaded_at`. |

Design choice that dissolves the Phase-0.y **B4** contradiction: `mrr_amount` is a **per-customer
contract value** (enterprise deals legitimately vary: $1,000 / $1,100), not a rigid tier×price. This is
both more realistic and removes the $5,847-vs-$3,891 arithmetic that never reconciled.

## 3. Exact dataset-path bug fixed
- **B1 (double `.csv`)**: the runner (`duckdbRunner.ts:47`) computes `datasetUrl(ref) = datasets/<ref>.csv`
  and registers a table named exactly `"<ref>"`. The old refs carried `.csv` (e.g. `"seeds/subscriptions.csv"`)
  → fetched `…/subscriptions.csv.csv` (404). Fixed: refs are now extension-less `"seeds/customers"` /
  `"seeds/subscriptions"`, resolving to the real files and registering clean quoted table names.
- Removed **bogus non-CSV refs** that would 404 on a SQL run: step 2 `"models/marts/dim_customer.sql"`,
  step 5 `"models/metrics/_metric_mrr.sql"`, step 8 `"bin/metric.py" / "models/metrics/metrics.yml"`.
- **B3 (dbt-model references)**: validator queries that read `mart_subscription_monthly` / `stg_*`
  (dbt models the WASM sandbox never builds) are replaced with self-contained inline-CTE pipelines over
  the seed tables. **B5** (wrong-shape `orders.csv`) resolved by the new `seeds/orders.csv`.

## 4. Actual DuckDB output used to regenerate expected values
Executed the **exact committed `validation.query` strings** against the **repo** seed CSVs in real
DuckDB (engine 1.5.3), mimicking the runner's `CREATE OR REPLACE TABLE "<ref>" AS read_csv_auto(...)`
path and the adapter's cell coercion. Independently reproduced by **both** reviewers.

```
STEP1  count          -> [[7, 7]]
STEP2  scd2 invariants -> [["one_current", 0], ["overlap", 0]]
STEP3  C-100 arc       -> [["2025-04-01",199,true,false,false,false],
                           ["2025-05-01",999,false,true,false,false],
                           ["2025-06-01",199,false,false,true,false],
                           ["2025-07-01",  0,false,false,false,true]]
STEP5  june MRR        -> [[2746]]
STEP8  enterprise NRR  -> [[1.05]]
```

## 5. Before/after expected values
| Step | Kind | Before | After | Note |
|---|---|---|---|---|
| 1 | sql_resultset | `{n:7,nUnique:7}` | `{n:7,nUnique:7}` | unchanged — now genuinely fixture-backed + runnable |
| 2 | sql_resultset | `[one_current:0, overlap:0]` | same | unchanged — runnable (lag/lead SCD-2 over seed) |
| 3 | **csv_set_equal** | `[99 / 199 / 99 / 0]` arc | `[199 / 999 / 199 / 0]` arc | reconciled to canonical Pro/Enterprise tiers; flags identical pattern |
| 5 | sql_resultset | `{value:5847}` | `{value:2746}` | **B4 fixed** — real sum of 6 active June subs |
| 8 | sql_resultset | `{value:1.05}` | `{value:1.05}` | unchanged target, now backed by C-102/C-104 cohort ($2,000 prior, +$100 → 1.05) |

`expectedOutputs.metricMrr202506` also updated 5847 → 2746. Instruction prose for steps 3, 5, 8 updated
to match (C-100 arc, the $2,746 breakdown, the enterprise-cohort NRR narrative).

## 6. Is the candidate still hidden?
**Yes.** Still a `candidateId` candidate (`:60`), no `projectId`, no visibility flag. `audit:csv-set-equal-bc`
reports **"Visible csv_set_equal steps: 0"** after re-seed. Not promoted.

## 7. Confirmation no row was opted in
**Confirmed.** No `serverGrade` key anywhere in the candidate (grep empty). `gradeCsvSetEqual`
(`grading.ts:388`) returns `BC_AUTO_PASS` whenever `serverGrade !== true`. `csv_set_equal` is NOT in
`PILOT_RUNTIME_KINDS` (`envelopeGrade.ts`) nor `ATLAS_ENVELOPE_REQUIRED_KINDS`. `grading.ts` /
`envelopeGrade.ts` were not touched. The grader stays fully DARK.

## 8. All gate results (Node 24.16.0 shell-scoped; local Docker PG `atlas-pg`, port 5434)
- `pnpm run typecheck` (+ `check:no-heuristic-runtime`) — **PASS** (all 4 packages).
- execution-core **83/83** · atlas **159/159** · api-server **466/466**.
- curriculum-quality **132 pass / 1 fail** — the single fail is the pre-existing environmental
  `COURSE_TAXONOMY` test (`ENOENT .local/course-skill-maps.md`, gitignored), unrelated to this phase.
- `audit:authoring` — **exit 0** (visible catalog 92 steps = 90 self_attest + 2 contains; 0 csv_set_equal).
- `audit:csv-set-equal-bc` — **PASS** (0 visible; dark on both gradeSubmission + gradeEnvelopeCapture paths).
- `audit:contains-bc` — **PASS** 2/2 steps, 14 submissions, 0 mismatch.
- **Execution verification**: all 5 committed queries reproduce the committed expected values against the
  repo seeds (Python duckdb 1.5.3 harness; re-confirmed by both reviewers). Audits run against Docker PG
  (owner-approved local path; no Neon URL available).

## 9. Is the 57B-flip now technically possible, or still blocked?
**The data/validation blocker is RESOLVED; the flip is now mechanically unblocked but not yet executed.**
Of the three 0.y blockers: (ii) fixtures-absent + path bug → **fixed**; (iii) queries-target-unbuilt-dbt-
models + inconsistent expected values → **fixed** (WASM-native + execution-derived). The step-3 starterCode
output now equals `expectedRows` byte-for-byte (column order + number types + real booleans), which is the
exact contract a `serverGrade:true` flip compares the FE capture against. Remaining for the flip (each a
deliberate, separate step — NOT done here):
1. **Promote** the candidate to a visible project (decision + lineage).
2. Set `serverGrade: true` on step 3 (+ re-seed).
3. Resolve the 2 deferred 57B-prereq P2s (popstate envelope/capture clear; `needs-run` UX).
4. Add `serverGrade` to the OpenAPI `ProjectStep` + Orval regen for type-honesty.
A true Node-24 `pnpm install` baseline + byte-verifying the capture in the **real browser** DuckDB-WASM
(engine `1.33.1-dev45.0`, vs the 1.5.3 used here) should precede the live flip.

## 10. Remaining risks
- **R1 — Engine drift (low).** Expected values were regenerated with DuckDB **1.5.3**; the sandbox runs
  duckdb-wasm **1.33.1-dev45.0**. Mitigated by explicit casts (`::date`, `::double`, `::varchar`) so output
  types are engine-stable, and by small-integer/boolean/string cells that coerce losslessly. Confirm in the
  real browser before flip.
- **R2 — Enterprise-NRR filter dead branches (advisory, code-review P2).** `mart.plan_tier =
  coalesce(s.plan_tier,'churned')`, so the step-8 `plan_tier='enterprise'` filter structurally excludes
  churned/downgraded-out enterprise-months. With this fixture (C-102 flat, C-104 pure expansion) `1.05` is
  correct, but a future fixture adding an enterprise→lower-tier downgrade would NOT see it in enterprise NRR.
  SQL left unchanged (correct for the committed golden); flagged for future fixture authors.
- **R3 — Step-8 lost its executable Python surface (accepted trade, both reviewers).** The editor changed
  from a `bin/metric.py` CLI (never runnable by the SQL validator, and not runnable in either in-browser
  runtime) to the WASM-native NRR SQL it resolves. The CLI spec remains in the instruction prose +
  portfolio field. A future multi-file/Pyodide step type could restore an executable CLI surface.
- **R4 — Provisional client check is a no-op for these steps (pre-existing).** `validateExpected` keys off
  typed `expectedOutputs.rows/stdout/metrics`; the candidate uses scalar custom keys, so the in-browser
  provisional check trivially passes. Enforcement comes from the server grader at flip-time, not the
  provisional path. Out of scope for 0.z.
- **R5 — Lockfile** still Linux/CI-targeted; regenerate `pnpm-lock.yaml` off-Windows (unchanged from 0.y).
