# Phase 61B — Author next WASM-native rowset evidence project (close-out)

**Status:** SHIPPED. One net-new intermediate **Data-Engineering** project —
`data-engineering-saas-usage-revenue-quality-mart` ("SaaS Product Usage & Revenue
Quality Mart") — authored WASM-native and deterministic, creating **6 fresh dark
rowset candidates** (5 `sql_resultset` + 1 `csv_set_equal`, ALL `serverGrade:false`)
for a future controlled server-grade flip. Visible + approved (rubric **81.4**).
**No new serverGrade:true, no comparator change, no envelope enforcement, no
schema/migration, no float/tolerance grading.** Independent reviews:
**`atlas-architect-reviewer` → PASS** + **`code-reviewer` → SHIP**, no P0/P1; the
single converging P2 (step-6 starterCode handed the answer) fixed in-phase.

---

## 1. Why this phase

Phase 61A surfaced a candidate-supply problem: live server-graded evidence was
concentrated entirely in one project (C2), and C2's only remaining dark rowset (step
8, NRR float) needs a tolerance comparator to flip. To grow server-graded density we
need MORE WASM-native, fixture-backed, deterministic rowset projects. Phase 61B
authors the first such project on the Data-Engineering backbone — the catalog's
highest-value auto-gradeable lane per the 2026 taxonomy research.

## 2. The project

A realistic ELT-to-mart Data-Engineering workflow on DuckDB over 3 committed CSV
fixtures — zero cloud, zero credentials, zero network, zero randomness, zero timing.
Seven steps:

| # | Step | Kind | Validated output (DuckDB-verified) |
|---|---|---|---|
| 1 | Type + dedupe raw accounts (latest load wins) | sql_resultset | `[[7,7]]` |
| 2 | Clean usage stream (drop invalid rows) | sql_resultset | `[[13,7]]` |
| 3 | Intermediate usage-by-type model | sql_resultset | `[[dashboard_view,3],[export,3],[query_run,7]]` |
| 4 | Active-MRR revenue model (as-of 2025-06-01) | sql_resultset | `[[6,4950]]` |
| 5 | Final account revenue-quality mart (health label) | csv_set_equal | `[[at_risk,2],[churned,1],[healthy,4]]` |
| 6 | Data-quality audit (CI gate) | sql_resultset | `[[dup_account_ids,1],[invalid_usage_events,2],[orphan_usage_accounts,0]]` |
| 7 | Data-quality runbook | contains (enforced) | required phrases present |

All six rowset steps ship **dark** (`serverGrade:false`) with `columns` +
`expectedRows` pre-populated, so a future phase can flip any of them with a one-line
`serverGrade:true` change AFTER a real-browser DuckDB-WASM byte-verification.

## 3. Datasets / fixtures

`artifacts/atlas/public/datasets/saas-mart/` — `accounts.csv` (8 rows incl. 1
duplicate load), `usage_events.csv` (15 rows incl. 2 invalid), `subscriptions.csv`
(7 rows incl. 1 churned). Registered in DuckDB-WASM by the existing runner as the
tables `"saas-mart/accounts"` etc. (table name = the `datasetRefs` string). Every
validated output is an integer / distinct count / exact string label — the most
type-stable shape (no floats, no tolerance), so each is a clean future flip candidate.

## 4. Verification

- **DuckDB execution:** all 6 candidate queries re-executed against the committed
  seeds in real DuckDB (Python `duckdb` 1.5.3); every `expectedRows` matches
  byte-for-byte. Both reviewers independently reproduced the results.
- **Engine note:** verified in DuckDB 1.5.3, not WASM 1.33.1-dev45.0. This is
  acceptable because the rows are DARK (do not grade) — a future flip re-verifies in
  the real browser runtime, the established discipline. Outputs are integer/label only,
  where the WASM BIGINT→Number capture is lossless and type-stable.

## 5. Wiring + promotion

- `scripts/src/authored/data-engineering__saas-usage-revenue-quality-mart.ts` (the project).
- `authored-lineage.ts` — `COURSE_FOR_AUTHORED_SLUG` (+`"data-engineering"`) and a new
  `NET_NEW_FOR_SLUG_PHASE61B` map. `authored/index.ts` — import + `AUTHORED_PROJECTS`.
- `backfill-phase61b-candidates.ts` (mirrors Phase 55) minted the `project_candidates`
  row (`source='phase61b_net_new'`, candidate `7e9c1a2b…`). `author:project promote`
  inserted the project + 7 steps (visible); `author:project audit … --commit` scored it
  **81.4 → approved**.
- DB changes live in the throwaway Docker PG only; the committed authored `.ts` +
  lineage + backfill are the source of truth (no schema/migration).

## 6. ServerGrade count (before / after)

| | csv_set_equal | sql_resultset | total |
|---|---|---|---|
| before 61B | 1 (C2 step 3) | 3 (C2 steps 1, 2, 5) | **4** |
| after 61B | 1 | 3 | **4** |

**Unchanged.** All 6 new rowset steps are dark. Confirmed by DB query.

## 7. Gates (Node 24.16.0 + Docker PG :5434)

typecheck (4) + `check:no-heuristic-runtime` **OK** · `check:authored-saas-mart`
**OK** (all authoring-contract assertions) · `audit:authoring` → **publish-ready** ·
`audit:quality` → **81.4 approved** · `audit:sql-resultset-bc` **PASS** (6 dark rows
byte-identical to legacy auto-pass; 3 opted-in unchanged, 0 failures) ·
`audit:csv-set-equal-bc` **PASS** (1 dark + 1 opted-in) · `audit:contains-bc` **PASS**
(4 visible contains incl. the new step 7) · `audit:pedagogy` → project **fully
enriched** · api-server **648/648** · atlas **170/170**.

## 8. Focused authoring test

`scripts/src/check-authored-saas-mart.ts` (registered `check:authored-saas-mart`)
asserts: slug↔course, candidateId↔lineage, 7 sequential steps, exactly 6 rowset
candidates (5 sql + 1 csv) + 1 contains, **every rowset step dark**, columns +
expectedRows present with matching width, ORDER BY on every multi-row query, and **no
H3 banned claims** in learner-facing copy.

## 9. Reviews

- **architect → PASS** (no P0/P1): dark discipline sound (comparator short-circuits on
  `serverGrade !== true`), no-leak projection intact, H3 honest, determinism + lineage
  + invariants verified, candidate-supply value confirmed, live-flip deferral correct.
- **code-reviewer → SHIP** (no P0/P1): reproduced all 6 queries + stress-tested
  learner-solution variance (the cleaning predicate converges on 13/2 across 3 valid
  variants; no `=0` duration ambiguity; no NULL anti-join trap). **P2-1 fixed in-phase:**
  step-6 `starterCode` had complete CTE bodies — stubbed to match the scaffold
  convention of steps 1/2/4/5. Rubric gaps (8 unrecognized stack tags; simulated-runner)
  judged acceptable — same class as C2, advisory only.

## 10. Honest-claims (H3)

Rowset-step copy attributes grading only to the in-browser DuckDB adapter ("for
immediate feedback"; "the server commit-grader auto-passes"), never to server
verification of the dark steps. Step 7 (`contains`) is genuinely server-enforced and is
described as such. No authorship/tamper/cheat/job-guarantee/certification copy.

## 11. Invariants (confirmed)

`serverGrade` opted-in count **= 4** (unchanged); no other validation kind flipped;
comparator (`gradeRowsetSubmission`) byte-unchanged; envelope enforcement OFF; Phase 52
canary untouched; **no schema/migration**; `RUBRIC_VERSION` frozen; archive=hide (purely
additive registry edits, no deletes); 404-not-403; 9-course taxonomy
(`course='data-engineering'`). **Phase 61C not started.**

## 12. Remaining / next

- The 6 new dark rows are future flip candidates. A future phase can flip them
  (one-line `serverGrade:true`) AFTER real-browser DuckDB-WASM byte-verification +
  re-running the BC audit — the C2/61A discipline. Integer/label outputs make them the
  safest class to flip (no tolerance needed).
- C2 step 8 (NRR float) still needs a tolerance-aware comparator before it can flip.
- Browser-level (real WASM 1.33.1) capture of these queries is the verification gate for
  any future flip, not for this dark authoring phase.
