# Phase 61A — server-graded evidence coverage expansion batch (close-out)

**Status:** SHIPPED. Expands live server-graded evidence coverage from 2 rows to
**4** by flipping two byte-verified `sql_resultset` steps (C2 steps 1 + 5) from
dark → `serverGrade:true`. Preserves every evidence-honesty, no-leak, BC, and
runtime-safety invariant. **No GitHub OAuth/publishing, no envelope enforcement,
no Phase 52 change, no schema/migration, no comparator change.**

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer`
→ SHIP**, no P0/P1. The single converging P2 (a stale internal header comment)
was fixed in-phase.

---

## 1. Candidate inventory

The entire `sql_resultset` / `csv_set_equal` universe is inside ONE visible,
approved project — C2 (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`).
No other project carries a rowset step. C2's rowset steps:

| Step | Kind | Before | Fixtures | Runtime | Deterministic | Leak risk | Decision |
|---|---|---|---|---|---|---|---|
| 1 | sql_resultset | dark | seeds/customers | DuckDB-WASM (self-contained CTE) | yes (integer counts) | none | **FLIP** |
| 2 | sql_resultset | **live** | seeds/customers | DuckDB-WASM | yes | none | (already live, 58B) |
| 3 | csv_set_equal | **live** | seeds/customers+subscriptions | DuckDB-WASM | yes | none | (already live, 57B-flip) |
| 5 | sql_resultset | dark | seeds/customers+subscriptions | DuckDB-WASM | yes (integer sum 2746) | none | **FLIP** |
| 8 | sql_resultset | dark | seeds/customers+subscriptions | DuckDB-WASM | float ratio 1.05 | none | **DEFER** |

All candidates are visible, approved, fixture-backed, WASM-native (self-contained
inline-CTE SQL over the committed seed CSVs — NOT dbt/Jinja), execution-derived,
and free of cloud/credential/network/timing/randomness dependencies.

## 2. Selected batch + rationale

**Flipped: C2 steps 1 and 5** — the two rows whose canonical output is
**integer-valued**, so the comparator's exact `JSON.stringify` cell comparison is
robust against any DuckDB-WASM numeric-type representation:
- step 1: `count(*) , count(distinct customer_sk)` → BIGINT → JS `Number` 7, 7.
- step 5: `round(sum(mrr_amount)::double, 0)` → DOUBLE → JS `number` 2746
  (`JSON.stringify(2746.0) === "2746"`).

Both are meaningful portfolio evidence (staging dedupe correctness; the MRR
metric value) and are the canonical, single-answer outputs the step instructs.

## 3. Rejected / deferred candidates

- **Step 8 (enterprise NRR = `1.05`)** — byte-verified CLEAN in the browser
  (rows `[[1.05]]`, type number), but **deferred**: it is a **float ratio**, and
  the comparator has no numeric tolerance. A correct learner whose query yields
  the unrounded ratio (`1.0500000001`), a `DECIMAL`, or a differently-rounded
  value would fail closed with no escape hatch. Adding a tolerance/round-aware
  contract is a comparator change (out of 61A scope). Flipping the integer-valued
  rows first and deferring the float is the conservative, brief-aligned call
  ("reject … too ambiguous to grade safely"). Step 8 stays dark + BC-audit-clean.
- No other project has a rowset step, so the batch is necessarily ≤ 3; 2 flipped.

## 4. Runtime + browser-WASM verification

Re-verified the EXACT shipped step 1/5/8 queries in the **real learner runtime**
— real Chromium, the real `duckdbAdapter`, `@duckdb/duckdb-wasm@1.33.1-dev45.0`
(unchanged since Phase 0.zz), over the committed seed CSVs, through the real
`normalizeSqlRows` capture normalizer (dev-only harness, deleted after):

```
step 1  columns=[n,n_unique]  rows=[[7,7]]    types=[number,number]
step 5  columns=[value]       rows=[[2746]]   types=[number]
step 8  columns=[value]       rows=[[1.05]]   types=[number]
```

All `ok:true`, byte-identical to 0.zz, clean number types (no bigint/Decimal/float
drift). The committed `expectedRows` (`[[7,7]]`, `[[2746]]`) are therefore exactly
the real FE capture → a correct learner's submission passes.

## 5. The flip

In `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts`:
- step 1 spec += `serverGrade:true, columns:["n","n_unique"], expectedRows:[[7,7]]`
  (kept `query` + scalar `expectedRow` for the client provisional path).
- step 5 spec += `serverGrade:true, columns:["value"], expectedRows:[[2746]]`.
- step 1 `instructionMd`: removed the now-false "the server commit-grader
  auto-passes" claim → it now states the server re-grades on Submit (H3).
- the project-header docblock updated to reflect the 4 server-graded steps + the
  step-8 deferral (the P2 both reviewers flagged).

The flip propagates to the DB via the existing authoring pipeline
(`author:project promote <slug>` — delete + re-insert steps from the authored
source, preserving `qualityStatus`/visibility). No schema/migration. The
committed authored file is the source of truth.

## 6. ServerGrade count before / after

| | csv_set_equal | sql_resultset | total |
|---|---|---|---|
| before | 1 (step 3) | 1 (step 2) | **2** |
| after | 1 (step 3) | **3 (steps 1, 2, 5)** | **4** |

C2 remains visible + approved; step 8 + all non-C2 steps unchanged.

## 7. Audit / grading verification (Node 24 + Docker PG, after `promote`)

- `audit:sql-resultset-bc` — **PASS**: dark 1 (step 8) byte-identical to legacy
  auto-pass; opted-in 3 (steps 1, 2, 5), **19 opt-in checks, 0 failures** — the
  correct `{columns, rows}` capture PASSES for each, and every negative (raw SQL,
  malformed JSON, empty, wrong-columns, missing-row, extra-unmatched-row) FAILS
  CLOSED.
- `audit:csv-set-equal-bc` PASS (1 opted-in, unchanged) · `audit:contains-bc` 3/3
  · `audit:authoring` exit 0 (the authoring guard accepts the new specs).
- New durable unit test `artifacts/api-server/src/lib/grading-c2-flip.test.ts`
  (9 tests) pins the step 1/5 flip contract + the step-8-kind dark BC.

## 8. No-leak verification across the export stack

The flip changes only the narrow `serverGrade` boolean (the FE sees it via
`deriveServerGrade`; the artifact classifies via `isServerGradeOptedIn`). It adds
NO new leak channel — the assembly chokepoint never returns `validationConfig` /
`expectedRows` / scalar `expectedRow`. Verified on the LIVE stack (real API +
re-authored DB) across `/portfolio-artifact`, `/portfolio-repository` (JSON), and
`/portfolio-repository.zip`: no `validationConfig` / `expectedRows` /
`expectedRowsHash` / `serverGradeFlag` / `spec`, and the answer values
(`7,7` / `2746` / `one_current`) are ALL absent. No banned claims. ZIP valid
(Python `zipfile.testzip()` = None).

## 9. Portfolio evidence result after the flip

A completed learner's artifact + ZIP now classify **steps 1, 2, 3, 5 as
`server-graded`** in VALIDATION_EVIDENCE (was 2, 3) — the evidence-density goal
of the phase — while remaining leak-free and carrying only the allowed
Atlas-verified claim + honest limitations.

## 10. Evidence-honesty verification

Step 1's learner instruction no longer claims the commit-grader auto-passes; it
now honestly states server re-grading. No new authorship/job/certification/
tamper/cheat copy. The portfolio copy is generated from runtime classification
(not authored strings), so the (now-corrected) internal comment was never
learner-facing.

## 11. Independent reviews

- **architect → PASS** (no P0/P1): type-stability sound (integer outputs cannot
  drift); spec valid; no-leak intact; invariants hold (csv 1 / sql 3); step-8
  deferral judgment sound; `needs-run` fail-safe correct.
- **code-reviewer → SHIP** (no P0/P1): traced the capture→comparator chain
  byte-by-byte; spec validity + non-vacuous tests confirmed; scope = 2 files.
- **P2 fixed in-phase:** the stale project-header docblock ("client-provisional /
  commit-grader auto-passes") updated to the actual server-graded posture.

## 12. Tests & gates (Node 24 + Docker PG :5434)

typecheck (4) + `check:no-heuristic-runtime` **OK** · **check:boot OK** ·
api-server unit **639/639** (+9 flip-contract) · atlas **170/170** ·
**integration 4/4** · `audit:sql-resultset-bc` PASS (dark 1 / opted-in 3, 0
failures) · `audit:csv-set-equal-bc` PASS (1) · `audit:contains-bc` 3/3 ·
`audit:authoring` exit 0 · live export-stack server-graded reflection + no-leak +
valid ZIP verified.

## 13. Final invariants (confirmed)

`csv_set_equal` opted-in **= 1** (unchanged); `sql_resultset` opted-in **= 3**
(steps 1, 2, 5; +2 this phase); no other validation kind flipped; envelope
enforcement **OFF**; Phase 52 untouched; **no schema/migration**; comparator
(`gradeRowsetSubmission`) byte-unchanged; artifact/repository/ZIP routes
authenticated + read-only; `/check` writes no snapshots; `/submit` snapshot
behaviour unchanged; C2 stays visible + approved; `RUBRIC_VERSION` frozen.
**Phase 61B not started.**

## 14. Remaining limitations / Phase 61B recommendation

- Coverage is still concentrated in C2 (the only WASM-native, fixture-backed
  rowset project). Broader server-graded density needs MORE such projects
  authored (fixtures + WASM-native validation + execution-derived expectedRows +
  browser byte-verification) — that is the authoring-factory track, not a flip.
- Step 8 (NRR float) is a 1-line future flip IF the comparator gains a
  numeric-tolerance / round-aware option (a separate, reviewed comparator change).
- **Phase 61B (owner-gated):** either (a) author the next WASM-native rowset
  project so there are fresh flip candidates, or (b) add a tolerance-aware rowset
  comparator option (dark + BC audit) to unlock float-valued steps like C2 step 8.
  Observe the 2 newly-live rows in a real env before the next batch.
