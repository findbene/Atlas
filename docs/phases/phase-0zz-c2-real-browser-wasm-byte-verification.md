# Phase 0.zz — C2 real-browser DuckDB-WASM byte verification (close-out)

**Status:** VERIFIED — **PASS, all 5 steps byte-identical** in the real browser DuckDB-WASM runtime.
No mismatch → **no `expectedRows` changed**. Candidate remains **hidden/dark**; no row opted in; no
`serverGrade:true`. No production/schema/env/canary change. Phase 52 untouched.

Resolves Phase-0.z residual **R1** (engine drift): the expected values were regenerated on local
duckdb **1.5.3**; this phase proves the **actual learner runtime** — `@duckdb/duckdb-wasm@1.33.1-dev45.0`
in a real browser, through the real `duckdbAdapter` — produces those exact values.

---

## 1. How browser DuckDB-WASM was executed
The **actual learner path**, with **zero new dependencies** (lockfile is frozen-mismatch — no install):
- Booted the Atlas frontend **Vite** dev server (Node 24.16.0 shell-scoped; `PORT=5199 BASE_PATH=/`,
  via PowerShell to avoid git-bash MSYS mangling `/` → a Windows path). Vite 7.3.2 served the page; the
  app's Clerk/Express coupling is not on the harness page so it booted clean.
- A dev-only harness page (`wasm-verify.html` + `wasm-verify-main.ts`, at the atlas root) imported the
  **real `@/lib/duckdb/duckdbRunner` `duckdbAdapter`** and called `duckdbAdapter.run({language:'sql',
  code, datasetRefs})` for each step — the identical code path `project-workspace.tsx` uses on "Run".
  It applied an inlined copy of `normalizeSqlRows` (the csv_set_equal capture normalizer) to step 3.
- The committed step queries/expected values were extracted **from the authored file itself** (a tsx
  script imported the project object → `wasm-verify-cases.json`), so the harness ran the **exact shipped
  strings**, not a re-typed copy.
- Drove a real headless **Chromium** (chromium-1223) via `playwright-cli` (`open` + `eval window.__RESULTS__`).
- DuckDB-WASM selected the **MVP** bundle (no SharedArrayBuffer/COOP-COEP needed); seed CSVs fetched
  from `/datasets/seeds/*.csv` (corrected `/` base).
- **All harness/extractor/artifacts deleted after capture**; only `.gitignore` (+`.playwright-cli/`) and
  the docs persist.

## 2. Did hidden-candidate access require a harness?
**Yes.** The candidate is hidden (learner routes → 404, no existence leak) and the full app can't boot
(Replit connector coupling, Phase 0.2 pending), so navigating the UI to it was neither possible nor
desirable. A **dev-only harness** that calls the real adapter directly was the smallest safe path — it
exercises the exact WASM execution path **without promoting the candidate** or touching DB/visibility.

## 3. Actual browser-WASM output per step
```
step 1 [sql_resultset]  columns=[n,n_unique]                rows=[[7,7]]                       types=[number,number]
step 2 [sql_resultset]  columns=[check,value]               rows=[[one_current,0],[overlap,0]] types=[string,number]
step 3 [csv_set_equal]  columns=[month_start,mrr_amount,is_new_customer,is_expansion_this_month,
                                 is_contraction_this_month,is_churned_this_month]
                        rows=[["2025-04-01",199,true,false,false,false],
                              ["2025-05-01",999,false,true,false,false],
                              ["2025-06-01",199,false,false,true,false],
                              ["2025-07-01",  0,false,false,false,true]]
                        types per row=[string,number,boolean,boolean,boolean,boolean]
step 5 [sql_resultset]  columns=[value]                     rows=[[2746]]                      types=[number]
step 8 [sql_resultset]  columns=[value]                     rows=[[1.05]]                      types=[number]
```
All `ok:true`, no runtime errors.

## 4. Byte-compare per step
| Step | Browser-WASM `{columns,rows}` | Committed expected | Result |
|---|---|---|---|
| 1 | `[[7,7]]` | `{n:7,nUnique:7}` | **MATCH** |
| 2 | `[[one_current,0],[overlap,0]]` | `[{check:one_current,value:0},{check:overlap,value:0}]` | **MATCH** |
| 3 | 6-col, 4 rows (above) | `expectedRows` (above) | **MATCH** (after `normalizeSqlRows`) |
| 5 | `[[2746]]` | `{value:2746}` | **MATCH** |
| 8 | `[[1.05]]` | `{value:1.05}` | **MATCH** |
Harness `match:true` for all 5.

## 5. Is step 3 safe for a future `serverGrade:true`?
**Yes.** The future flip compares the FE capture (`normalizeSqlRows(adapter.rows)` of the learner's run)
against `validation.spec.expectedRows`. In the real browser:
- **columns** match exactly (order + names).
- **rows** match exactly (4 rows, correct order; comparator is multiset/order-insensitive anyway).
- **numeric types**: `mrr_amount` arrives as JS **number** (`199`,`999`,`0`) — not bigint, not string —
  so it serializes identically to the committed numbers; the comparator's `JSON.stringify` canonicalization
  agrees.
- **date strings**: `month_start` is the **string** `"2025-04-01"` (from `::varchar`), matching expected.
- **booleans**: real JS `true`/`false`, matching expected.
- `normalizeSqlRows(rows) === expectedRows` (deep-equal). The flip contract holds in the real engine.

## 6. Any mismatch, type drift, or path issue?
**None.** Zero mismatches; cell types are number/string/boolean exactly as the comparator expects (no
bigint/Decimal drift between duckdb 1.5.3 and wasm 1.33.1-dev45.0 for these queries). Only console entry
was a benign `favicon.ico` 404 (unrelated). Seed-path resolution worked once `BASE_PATH=/` was set
correctly (an MSYS quirk on the first git-bash launch, fixed by relaunching under PowerShell — a
harness-runtime issue, not a repo issue).

## 7. Does the candidate remain hidden?
**Yes.** No promotion. `audit:csv-set-equal-bc` post-verification = "Visible csv_set_equal steps: 0".
Extraction confirmed step-3 spec `serverGrade=null`.

## 8. Confirmation no row was opted in
**Confirmed.** `serverGrade` absent on every step (extraction reported `serverGrade=null` for all 5).
No DB row opted in; grader stays DARK (`gradeCsvSetEqual` → `BC_AUTO_PASS`).

## 9. Gate results
- **Focused browser/DuckDB-WASM verification** — PASS (5/5 byte-identical, above).
- `pnpm run typecheck` (+ `check:no-heuristic-runtime`) — **PASS** (no persistent code change; harness deleted).
- `audit:csv-set-equal-bc` — **PASS** (0 visible). `audit:contains-bc` — **PASS** 2/2, 14 subs. `audit:authoring`
  — exit 0 (90 self_attest + 2 contains; 0 visible csv_set_equal).
- atlas tests not re-run (no persistent frontend change — harness removed; 0.z run was 159/159).
- Only persistent change this phase: `.gitignore` gains `.playwright-cli/` (tooling hygiene) + these docs.

## 10. Can the 57B-flip begin next?
**Yes — the validation is now proven safe in the real runtime.** Remaining flip steps are product/mechanics,
each deliberate and out of 0.zz scope:
1. **Promote** the C2 candidate to a visible project (decision + lineage).
2. Set `serverGrade: true` on step 3 + re-seed.
3. Resolve the 2 deferred 57B-prereq P2s (popstate envelope/capture clear; `needs-run` UX).
4. Add `serverGrade` to OpenAPI `ProjectStep` + Orval regen.
5. Heed 0.z **R2** (enterprise-NRR `plan_tier` filter dead branches) when authoring future fixtures.
A true Node-24 `pnpm install` baseline + the Phase-0.2 connector decouple remain the broader prerequisites
for running the whole app, but the **step-3 csv_set_equal grading path is verified end-to-end**.
