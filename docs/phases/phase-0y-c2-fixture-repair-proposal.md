# Phase 0.y — C2 fixture repair PROPOSAL (read-only; no files created, no expectedRows changed)

**Status:** PROPOSAL ONLY. Awaiting owner approval. Hard stops respected — no fixture authored, no
`expectedRows` modified, no candidate promoted, no opt-in.

Candidate: `analytics-engineer-semantic-layer-with-dbt-and-duckdb` (Phase 55 C2, **hidden candidate**,
not a visible row). Focus: step 3 `csv_set_equal` (Monthly subscription snapshot mart, customer C-100).

---

## 1. How the SQL runner resolves fixtures (verified)

`artifacts/atlas/src/lib/duckdb/duckdbRunner.ts:47-49,57-68`:
```
datasetUrl(ref) = `${BASE_URL}datasets/${ref}.csv`
registerCsv(ref): CREATE OR REPLACE TABLE "<ref>" AS SELECT * FROM read_csv_auto('<ref>.csv', header=true)
```
So a `datasetRef` of `X` must exist as a file at `artifacts/atlas/public/datasets/X.csv`, and becomes a
DuckDB table literally **named `X`**.

## 2. What exists vs what the candidate needs

- **Present:** `artifacts/atlas/public/datasets/orders.csv` ONLY (8 rows; columns `order_id,customer_id,amount,status`).
- **Referenced by C2 step 3:** `datasetRefs: ["seeds/subscriptions.csv"]`. Step 1 also references
  `seeds/customers.csv`, `seeds/orders.csv`, `seeds/subscriptions.csv`.
- **Missing:** `seeds/subscriptions.csv`, `seeds/customers.csv`, `seeds/orders.csv` — none exist under
  `public/datasets/`.

## 3. Bugs found (each requires an authored-content change — flagged, NOT done)

- **B1 — double `.csv` extension.** Ref `"seeds/subscriptions.csv"` → `datasetUrl` appends `.csv` →
  fetch `datasets/seeds/subscriptions.csv.csv`. The ref should be `"seeds/subscriptions"` (no extension),
  resolving to `datasets/seeds/subscriptions.csv`. Every C2 datasetRef carries this bug.
- **B2 — naming inconsistency.** The rest of the catalog uses the `fixtures/<name>` namespace
  (e.g. `analytics-engineer__beginner-spreadsheet-to-sql-models` → `fixtures/dim_customer_expected.csv`).
  C2 uniquely uses `seeds/<name>`. Either works mechanically (subdir under `datasets/`), but pick one.
- **B3 — execution-contract mismatch (the deep blocker).** The step-3 validation query is
  `… FROM mart_subscription_monthly …`; step 1 queries `FROM stg_customers`. Those are **dbt models**.
  The DuckDB-WASM adapter does **no dbt compilation** — it registers only the datasetRef CSVs as raw
  tables and runs raw SQL. So `mart_subscription_monthly` / `stg_*` never exist in the sandbox; the
  query errors ("table not found"). The tabular checks therefore cannot produce real rows from seeds
  alone. (Today harmless: server commit-grader auto-passes, csv_set_equal dark — but the check is
  decorative, and a `serverGrade:true` flip would fail-closed for every learner.)
- **B4 — hand-authored expected values are internally inconsistent.** Step 5 states June-2025 MRR
  `= $5,847` but its own breakdown `3×$999 + 4×$199 + 2×$49 = $3,891`. Step 3's C-100 tiers ($99 → $199)
  don't map to step 5's tiers ($49 / $199 / $999). The `expectedRows`/`expectedRow` were computed by
  hand, not from execution, and do not reconcile. **They must be regenerated from real output, not trusted.**
- **B5 — `orders.csv` shape mismatch.** The existing `datasets/orders.csv`
  (`order_id,customer_id,amount,status`) does NOT match step 1's `stg_orders` contract
  (`order_id, customer_id, order_amount_cents, order_ts, loaded_at`). It belongs to a different
  project; C2 needs its own orders fixture.

## 4. Proposed fixtures (paths, columns, min rows) — for owner approval, NOT created

Place under `artifacts/atlas/public/datasets/seeds/` (and drop the `.csv` from the refs per B1):

| File | Columns (from starter SQL contracts) | Min rows |
|---|---|---|
| `customers.csv` | `customer_id, email, plan_tier, signup_date, country_code, loaded_at` | ~8 raw incl **1 duplicate `customer_id`** (step 1 asserts 8→7 after dedupe). Must include `C-100`. |
| `subscriptions.csv` | `customer_id, plan_tier, mrr_amount, start_date, end_date` | Enough to encode C-100's arc **and** make step-5's monthly aggregate reconcile (see §6). |
| `orders.csv` | `order_id, customer_id, order_amount_cents, order_ts, loaded_at` | ~5-10 (step 1's source contract; not directly asserted by step 3). |

**`customers.csv` is required** (not optional): `stg_customers` → `dim_customer` (SCD-2) → the mart's
customer grid all depend on it, and step 1 asserts its post-dedupe count.

## 5. C-100 lifecycle the `subscriptions.csv` rows must represent (step 3 expectation)

C-100: **new 2025-04 @ $99 → expansion 2025-05 @ $199 → contraction 2025-06 @ $99 → churn 2025-07 ($0)**,
yielding exactly these 4 mart rows (the current `expectedRows`):
```
2025-04-01,  99, true,  false, false, false
2025-05-01, 199, false, true,  false, false
2025-06-01,  99, false, false, true,  false
2025-07-01,   0, false, false, false, true
```
The fixture rows must drive the mart's `mrr_by_month` left-join + `LAG` logic to produce this — i.e. a
subscription row active in 04 @99, a change to @199 effective 05, a change to @99 effective 06, and an
`end_date` causing 07 to be $0.

## 6. How `expectedRows` should be regenerated (the honest path)

Because of **B3**, you cannot get real rows by running the validator query against the WASM sandbox as
authored. Two viable repairs (owner picks):

- **Repair A — make the checks WASM-native (recommended).** Rewrite C2's `sql_resultset`/`csv_set_equal`
  validation queries to be **self-contained raw SQL over the registered seed tables** (inline CTEs that
  reproduce staging→mart, no `{{ ref(...) }}`, no `FROM mart_subscription_monthly`). Then run each query
  in real DuckDB over the fixtures, capture the adapter's `{columns, rows}` output **byte-for-byte**, and
  replace the hand-authored `expectedRows`/`expectedRow` with the captured values. This is the only path
  that makes the client-provisional feedback actually run, and the only path that makes a future
  `serverGrade` flip safe.
- **Repair B — dbt-build source of truth.** Run the full reference solution (`dbt-core` + `dbt-duckdb`)
  over the fixtures locally, materialize the models, run the validator query against the built mart,
  capture output, and use it to (i) regenerate expected values and (ii) cross-check Repair A's inline SQL.
  Does not by itself fix the WASM sandbox (which has no dbt) — pair with A.

Either way: **design ONE consistent fixture set, run it, and derive ALL expected values from the run** —
fixing B4 in the process (the $5,847-vs-$3,891 contradiction disappears when numbers come from execution).

## 7. Scope of the real repair (all authored-content changes — owner approval required)

1. Author `customers.csv` + `subscriptions.csv` + `orders.csv` (consistent, C-100 arc + step-5 totals).
2. Fix all C2 `datasetRefs` (drop `.csv`, per B1; settle `seeds/` vs `fixtures/` per B2).
3. Re-architect C2's SQL validation queries to be WASM-runnable (Repair A) — touches the authored project.
4. Regenerate every `expectedRows` / `expectedRow` / `expectedOutputs` from real execution (fixes B4).
5. Only then can the candidate be **promoted to visible** and the step-3 `serverGrade:true` flip considered.

## 8. Flip verdict
**57B-flip remains BLOCKED — more fundamentally than 57C anticipated.** Three layers, all open:
(i) the C2 candidate is hidden (0 visible csv_set_equal steps in the seeded catalog); (ii) the input
fixtures are absent + the datasetRef path is bugged; (iii) the validation queries target dbt models the
WASM sandbox never builds, and the hand-authored expected values are internally inconsistent.

## 9. Owner approval needed next
Approve a follow-up **C2 repair phase** to: author the 3 fixtures, fix datasetRefs, re-architect the SQL
checks to be WASM-native (Repair A), regenerate all expected values from real DuckDB output, and (separately)
decide on candidate promotion. No opt-in until all of that lands green.
