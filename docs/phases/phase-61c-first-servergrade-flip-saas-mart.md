# Phase 61C — First controlled serverGrade flip in the SaaS mart (close-out)

**Status:** SHIPPED. Flipped **4** of the 6 Phase-61B dark rowset candidates in
`data-engineering-saas-usage-revenue-quality-mart` to `serverGrade:true` — steps
**1, 2, 5, 6** (3 `sql_resultset` + 1 `csv_set_equal`) — each after a **real-browser
DuckDB-WASM byte-verification**. serverGrade live count **4 → 8**. Steps 3 + 4 stay
dark. **No comparator change, no envelope enforcement, no schema/migration, no
float/tolerance comparator, no Phase 52 change.** Reviews: **`atlas-architect-reviewer`
→ PASS** + **`code-reviewer` → SHIP**, no P0/P1.

---

## 1. Browser-WASM verification (the gating evidence)

Rebuilt the 0.zz/61A dev-only harness (deleted after): booted the atlas Vite dev
server (Node 24, port 5199, no BASE_PATH), a page importing the REAL
`@/lib/duckdb/duckdbRunner` `duckdbAdapter` (`@duckdb/duckdb-wasm@1.33.1-dev45.0` —
the learner runtime) ran each of the 6 committed queries (extracted from the authored
file) over the committed seed CSVs; the csv step applied the real `normalizeSqlRows`;
drove headless Chromium via `playwright-cli`; captured `window.__RESULTS__`.

| Step | Kind | Browser output | Types | Committed | Byte-match | Decision |
|---|---|---|---|---|---|---|
| 1 | sql_resultset | `[[7,7]]` | number,number | `[[7,7]]` | ✅ | **FLIP** |
| 2 | sql_resultset | `[[13,7]]` | number,number | `[[13,7]]` | ✅ | **FLIP** |
| 3 | sql_resultset | `[[dashboard_view,3],[export,3],[query_run,7]]` | string,number | = | ✅ | defer (max-4 cap) |
| 4 | sql_resultset | `[[6,"4950"]]` | number,**string** | `[[6,4950]]` | ❌ | **defer (HUGEINT)** |
| 5 | csv_set_equal | `[[at_risk,2],[churned,1],[healthy,4]]` | string,number | = | ✅ | **FLIP** |
| 6 | sql_resultset | `[[dup_account_ids,1],[invalid_usage_events,2],[orphan_usage_accounts,0]]` | string,number | = | ✅ | **FLIP** |

**Step 4 caught a real WASM-vs-CLI divergence:** `sum(INTEGER)` returns **HUGEINT**,
which the adapter renders as the STRING `"4950"` (its `String(v)` fallback for
non-bigint types) — not the Number `4950` that the CLI DuckDB 1.5.3 yielded in 61B. A
flip would fail a correct learner CLOSED. `count(*)`/`count(distinct)` (steps 1/2)
return BIGINT → lossless Number and match. This is exactly why the browser gate exists.

## 2. The flip

In `scripts/src/authored/data-engineering__saas-usage-revenue-quality-mart.ts`: steps
1, 2, 5, 6 spec `serverGrade:false → true` (specs otherwise byte-identical to the
61B-verified `columns`/`expectedRows`/`query`). Each flipped step's `instructionMd`
updated to honest server-graded copy ("on Submit the server re-grades your captured
result rows against the expected output"). Header docblock updated. Step 4 carries a
deferral comment documenting the HUGEINT finding + the prescribed future fix
(`cast(sum(mrr_amount) as bigint)` + re-verify). `scripts/src/check-authored-saas-mart.ts`
now pins the EXACT flip set (1,2,5,6 true; 3,4 dark; exactly 4 flipped + 2 dark) so the
state can't silently drift.

## 3. Selected flip rationale

The 4 flipped rows are the most type-stable AND the strongest recruiter evidence:
step 1 (dedupe correctness), step 2 (explicit cleaning), step 5 (the final
health-labelled mart — the deliverable, and the only `csv_set_equal`), step 6 (the
CI-ready data-quality audit — the trust signal). All produce integers / distinct
counts / exact string labels (no floats, no tolerance), so the comparator's exact
`JSON.stringify` cell match is robust. Of the 5 byte-matching candidates, step 3 was
deferred only to respect the brief's max-4 flip budget (it stays a clean future
candidate).

## 4. Deferred candidate rationale

- **Step 3** — byte-matched clean; deferred solely by the max-4 cap. Ready to flip in a
  future batch with no rework.
- **Step 4** — DEFERRED: HUGEINT → string `"4950"` ≠ committed number `4950`. Stays dark
  (harmless; the comparator short-circuits on `serverGrade !== true`). A future flip
  must first `cast(sum(mrr_amount) as bigint)` (so the capture is BIGINT → Number) plus
  guide the learner's query, then re-verify in-browser.

## 5. ServerGrade count (before / after)

| | csv_set_equal | sql_resultset | total |
|---|---|---|---|
| before 61C | 1 (C2 step 3) | 3 (C2 steps 1,2,5) | **4** |
| after 61C | **2** (C2 s3 + mart s5) | **6** (C2 s1,2,5 + mart s1,2,6) | **8** |

DB-confirmed. **C2's 4 server-graded rows unchanged** (steps 1,2,3,5 still `true`).

## 6. Gates (Node 24.16.0 + Docker PG :5434)

typecheck (4) + `check:no-heuristic-runtime` **OK** · `check:authored-saas-mart` **OK**
(pins the flip set) · `audit:sql-resultset-bc` **PASS** (6 opted-in DB rows, 38 checks,
0 failures — correct capture passes, raw-SQL/malformed/empty/wrong-columns/missing-row/
extra-row FAIL CLOSED; 3 dark rows byte-identical to legacy) · `audit:csv-set-equal-bc`
**PASS** (2 opted-in, 10 checks, 0 failures) · `audit:authoring` publish-ready ·
`audit:contains-bc` PASS · `audit:pedagogy` fully-enriched · api-server **648/648** ·
atlas **170/170** · **integration 4/4**.

## 7. /check, /submit, and no-leak

- **/submit safety** = the BC audit's "correct capture passes / 6 negative classes fail
  closed" — a correct learner on steps 1,2,5,6 passes; raw SQL / malformed / empty /
  wrong-columns / missing-row / extra-row fail CLOSED. **/check** writes no snapshot
  (unchanged).
- **No leak:** the flip changes only the `serverGrade` boolean; the project-detail
  projection (`routes/projects.ts`) returns only `serverGrade: boolean`, never
  `validationConfig`/`spec`/`expectedRows`/`query`. Reviewers confirmed the inert
  `expectedRow` is read nowhere. Portfolio artifact / repository JSON / ZIP assembly is
  byte-unchanged (no export-code edit) and classifies a step server-graded via the same
  `isServerGradeOptedIn` predicate — so a completed learner's evidence reflects steps
  1,2,5,6 as server-graded, leak-free (export unit 91/91 + integration 4/4 green over
  the unchanged shared path; ZIP validity covered by `portfolioZip.test.ts`).

## 8. Honest-claims (H3)

Flipped steps now honestly state the server re-grades on Submit; dark steps (3,4) make
no server-enforcement claim; step 7 (`contains`, always server-enforced) is accurate.
No authorship/tamper/cheat/job/certification copy. The `check` scans all learner-facing
text for the banned list → none.

## 9. Reviews

- **architect → PASS** (no P0/P1): traced authored-spec → promote → DB → /submit →
  comparator AND the FE capture path; flip type-stability sound (BIGINT→Number vs
  HUGEINT→string), step-4 deferral + fix correct, no comparator drift (same
  `normalizeSqlRows` in harness + live FE), no leak, /check & /submit safe, invariants
  intact, C2 unchanged, count 4→8.
- **code-reviewer → SHIP** (no P0/P1): diff is exactly 4 boolean flips + honest copy +
  comments; `columns`/`expectedRows`/`query` byte-identical to 61B; the check pins
  {1,2,5,6}; step-4 deferral verified against the comparator (`JSON.stringify` quoting);
  scope = 2 files.
- P2s (non-blocking, already addressed or pre-existing): BC audits were re-run green on
  the Node-24 baseline this session (reviewers' sandboxes lack `DATABASE_URL`); the
  inert `expectedRow` is a pre-existing optional cleanup; CRLF EOL is the standing
  `.gitattributes` follow-up.

## 10. Invariants (confirmed)

`serverGrade` opted-in count **= 8** (csv 2 + sql 6); only `sql_resultset` +
`csv_set_equal` flipped; comparator (`gradeRowsetSubmission`/`grading.ts`)
**byte-unchanged**; envelope enforcement OFF; Phase 52 untouched; **no schema/migration**;
`RUBRIC_VERSION` frozen; archive=hide; C2's server-graded rows unchanged; project stays
visible + approved. **Phase 61D not started.**

## 11. Remaining / next

- Steps 3 (clean future candidate) + 4 (needs the bigint-cast + re-verify) remain dark
  flip candidates for a future batch.
- Observe the 4 newly-live rows in a real env before the next flip batch.
- A future phase could author the next WASM rowset project (more candidate supply) or
  fix + flip step 4 / flip step 3.
