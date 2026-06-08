# Phase 61D — Close out the two deferred SaaS-mart rowset candidates (close-out)

**Status:** SHIPPED. Flipped the **last two dark rowset candidates** in
`data-engineering-saas-usage-revenue-quality-mart` to `serverGrade:true` — step
**3** (usage-by-type) and step **4** (active MRR) — each after a **real-browser
DuckDB-WASM byte-verification**. All **six** rowset steps (1–6) are now live
server-graded; step 7 stays `contains`. **No comparator change, no envelope
enforcement, no schema/migration, no float/tolerance comparator, no Phase 52
change, no route/projection/export edit.** Reviews: **`atlas-architect-reviewer`
→ PASS** + **`code-reviewer` → SHIP** (see §9).

ServerGrade count (authored source of truth): **8 → 10** (mart 4→6 + C2's 4
unchanged). DB-verified mart-scoped delta: **+2** (see §5 for the environment
caveat on the global count).

---

## 1. Browser-WASM verification (the gating evidence)

Rebuilt the throwaway harness (deleted after): atlas Vite dev (Node 24, port
5199, base `/`), a page importing the REAL `@/lib/duckdb/duckdbRunner`
`duckdbAdapter` (`@duckdb/duckdb-wasm@1.33.1-dev45.0` — the learner runtime) +
`@/lib/envelopeClient` `normalizeSqlRows`, ran each of the 6 committed queries
(extracted from the authored file) over the committed seed CSVs, replicating the
EXACT FE capture→submit transform (`project-workspace.tsx` stash
`{columns:[...result.columns], rows: normalizeSqlRows(result.rows)}` +
`decideCsvSetEqualSubmission` → `JSON.stringify({columns,rows})`). Drove headless
Chromium via `playwright-cli`; captured `window.__RESULTS__`.

| Step | Kind | Browser capture | Types | Committed | Byte-match | Decision |
|---|---|---|---|---|---|---|
| 1 | sql_resultset | `[[7,7]]` | number,number | `[[7,7]]` | ✅ | live (61C) — re-confirmed |
| 2 | sql_resultset | `[[13,7]]` | number,number | `[[13,7]]` | ✅ | live (61C) — re-confirmed |
| **3** | sql_resultset | `[[dashboard_view,3],[export,3],[query_run,7]]` | string,number | = | ✅ | **FLIP (61D)** |
| **4** | sql_resultset | `[[6,4950]]` | **number,number** | `[[6,4950]]` | ✅ | **FLIP (61D — cast fix)** |
| 5 | csv_set_equal | `[[at_risk,2],[churned,1],[healthy,4]]` | string,number | = | ✅ | live (61C) — re-confirmed |
| 6 | sql_resultset | `[[dup_account_ids,1],[invalid_usage_events,2],[orphan_usage_accounts,0]]` | string,number | = | ✅ | live (61C) — re-confirmed |

**Step 4 closed the 61C HUGEINT deferral.** In 61C, `sum(mrr_amount)` over an
INTEGER column returned **HUGEINT**, which the adapter renders as the STRING
`"4950"` (its `String(v)` fallback for non-bigint/number/string types) — so the
capture was `[[6,"4950"]]` and would have failed a correct learner CLOSED. 61D
casts the SUM to BIGINT, which routes through the adapter's bigint branch
(`duckdbRunner.ts` L106–116: BIGINT in safe-integer range → lossless Number).
The re-verified capture is `[[6,4950]]` (number,number) — a byte-match. **Step 3
re-confirmed byte-clean.** The four 61C-live rows (1,2,5,6) were also
re-confirmed at the current engine version (regression guard).

## 2. The flips

In `scripts/src/authored/data-engineering__saas-usage-revenue-quality-mart.ts`:
steps 3 and 4 spec `serverGrade:false → true`. Step 3's `columns`/`expectedRows`/
`query` are byte-identical to the 61C-verified values. Step 4's only query change
is wrapping `sum(mrr_amount)` in `cast(... as bigint)`, applied in THREE places so
the learner's natural capture is type-stable:
1. the **starterCode SELECT** (`select count(*) as active_accounts,
   cast(sum(mrr_amount) as bigint) as total_mrr`) — this line is OUTSIDE the
   learner's `-- TODO` (the learner fills only the `where` in the `active` CTE),
   so every completion carries the cast for free — no footgun;
2. the reference `query`;
3. the instruction prose build line.

`expectedRows` stays `[[6,4950]]`. Each flipped step's `instructionMd` now
honestly states "on Submit the server re-grades your captured result rows against
the expected output." `scripts/src/check-authored-saas-mart.ts` now pins the
EXACT all-six flip set (`FLIPPED={1,2,3,4,5,6}`, `flippedCount===6`,
`darkCount===0`) so the state can't silently drift.

## 3. Step-4 type-stability fix (why it is safe)

The server re-grades the LEARNER's FE-captured `{columns,rows}`, not a
server-run query. The risk in casting only the reference query would be a learner
whose natural query omits the cast and captures `[[6,"4950"]]` (string) → fails a
correct answer closed. That risk is eliminated because the cast lives in the
**starterCode SELECT the learner does not edit** — the learner fills only the
`where` predicate inside the `active` CTE. Therefore every learner completion
produces `cast(sum(mrr_amount) as bigint)` → BIGINT → Number → `[[6,4950]]`,
matching the committed `expectedRows`. No comparator/tolerance change was needed
or made.

## 4. Selected-flip + deferred rationale

Both remaining candidates flipped — there are no dark rowset rows left in this
project. Step 3 was a clean candidate held back only by 61C's max-4 budget; step
4 became safe once the cast made its capture type-stable. All six steps produce
integers / distinct counts / exact string labels (no floats, no tolerance), so
the comparator's exact `JSON.stringify` cell match is robust.

## 5. ServerGrade count (before / after) + environment caveat

| | csv_set_equal | sql_resultset | total |
|---|---|---|---|
| mart before 61D | 1 (step 5) | 3 (steps 1,2,6) | **4** |
| mart after 61D | 1 (step 5) | **5** (steps 1,2,3,4,6) | **6** |

**Authored source of truth (production/seed path): 8 → 10** = mart 6 + C2
(`analytics-engineer-semantic-layer-with-dbt-and-duckdb`) 4 (unchanged).

**Environment caveat (material).** The local Docker `atlas` DB (port 5434) was
found RESET to a base-only seed when this phase began — 0 candidates, no
`sql_resultset`/`csv_set_equal` steps, and neither the mart nor C2 present. An
out-of-scope re-seed (idempotent base seed, truncate+reload of the 47 self-attest
base projects) had wiped the prior `serverGrade=8` layered state. The mart was
reconstructed via the normal authoring pipeline (`backfill:phase61b-candidates` →
`author:project promote` → `audit --commit`, qualityScore **81.4 approved**); the
DB now shows the mart's **6** server-graded rows (5 sql + 1 csv), DB-confirmed.
**C2 was NOT reconstructed** — it is out of scope for this phase and its authored
source is byte-unchanged in git, so the production/seed-path global count is 10.
The "global DB total = 10" is therefore not directly DB-observable in this reset
environment (it reads 6, the mart only); the **mart delta (+2) is DB-verified**
and C2's untouched-ness is git-verified.

## 6. Gates (Node 24.16.0 + Docker PG :5434)

typecheck (4 projects) + `check:no-heuristic-runtime` **OK** ·
`check:authored-saas-mart` **OK** (pins the all-6 flip set) ·
`audit:sql-resultset-bc` **PASS** (5 opted-in mart rows, 32 checks, 0 failures —
correct capture passes; raw-SQL/malformed/empty/wrong-columns/missing-row/
extra-row FAIL CLOSED; 0 dark rows) · `audit:csv-set-equal-bc` **PASS** (1
opted-in, 5 checks, 0 failures) · `audit:contains-bc` **PASS** (3 steps, 21 subs,
0 mismatch) · `audit:authoring` **✓ publish-ready** (mart) · `audit:pedagogy`
**✓ fully enriched** (mart) · api-server **648/648** · atlas **170/170**.

**Integration tests: ENV-BLOCKED, not a regression.** The reset Docker DB is
under-migrated — the integration harness clones `public.portfolio_submission_snapshots`
which does not exist in this DB (a later-phase migration absent from the base
seed). This is unrelated to the 61D diff (which touches no schema/route/setup
code). Remediation when a full local baseline is wanted: `pnpm migrate` to apply
the missing migrations, then re-run. The `/submit` grading + export/ZIP-validity
contracts are covered by the api-server **unit** suite (648, includes the 91
export-unit + grading + envelopeGrade + portfolioZip tests), which passed.

## 7. /check, /submit, and no-leak

- **/submit safety** = the BC audits' "correct capture passes / negatives fail
  closed" — a correct learner on steps 1–6 passes; raw SQL / malformed / empty /
  wrong-columns / missing-row / extra-row fail CLOSED. **/check** writes no
  snapshot (unchanged).
- **No leak:** the flip changes only the `serverGrade` boolean; the
  project-detail projection (`routes/projects.ts`) returns only
  `serverGrade: boolean`, never `validationConfig`/`spec`/`expectedRows`/`query`.
  Portfolio artifact / repository JSON / ZIP assembly is byte-unchanged (no
  export-code edit) and classifies a step server-graded via the same
  `isServerGradeOptedIn` predicate — so a completed learner's evidence reflects
  steps 1–6 as server-graded, leak-free. Export unit tests (within api-server
  648) + ZIP validity (`portfolioZip.test.ts`) green over the unchanged shared
  path. (The DB round-trip integration variants are env-blocked per §6.)

## 8. Honest-claims (H3)

Flipped steps now honestly state the server re-grades on Submit; step 7
(`contains`, always server-enforced) is accurate. No authorship / tamper / cheat
/ job / certification copy. The `check` scans all learner-facing text for the
banned list → none.

## 9. Reviews

- **atlas-architect-reviewer → PASS** (no P0/P1). Independently traced authored-spec
  → promote → DB → /submit → comparator AND the FE capture path; **hand-traced the
  expected values against the committed fixtures** (step 4: 6 active accounts,
  A-007 churned 2025-05-31 excluded, sum 200+1500+50+1800+200+1200 = 4950 ✓; step
  3: dashboard_view 3 / export 3 / query_run 7, E-14 empty-type + E-15 negative
  excluded ✓). Confirmed the step-4 cast makes the NATURAL capture type-stable
  (`duckdbRunner.ts:106-116` bigint→Number vs `:118` String() fallback), no leak
  (`projects.ts:40-48` boolean-only projection), comparator byte-unchanged
  (`grading.ts` `gradeRowsetSubmission`, multiset path), C2 authored source
  byte-unchanged, RUBRIC frozen, no H3 overclaim.
  - **P2 (note, not blocking):** a learner who DELETES the pre-filled cast and
    types bare `sum(mrr_amount)` would capture HUGEINT→string `"4950"` → fail
    closed. NOT a regression — the instruction + starterCode both carry the cast,
    it is strictly better than the pre-61D state (where the natural path failed),
    and it is the same inherent property of every server-graded rowset step (any
    learner can rename a column and fail). No fix required.
  - **P2 (environmental, disclosed):** DB-gated api-server test files
    (`envelopeSubmit`, the two `*.integration`) are infra-gated in a sandbox
    without `DATABASE_URL` / `INTEGRATION_TEST_DB_ALLOW`; none touch the comparator
    / rowset grading / FE path. Same env caveat as §6.
- **code-reviewer → SHIP** (no P0/P1). Confirmed the diff is exactly the 2 source
  files; step 3 `query`/`columns`/`expectedRows` byte-identical; step 4's only
  query change is the BIGINT cast (3 places: instruction, starterCode SELECT
  outside the learner TODO, reference query), `expectedRows [[6,4950]]` unchanged;
  the check pins `{1..6}` and fails on any silent un-flip; no H3 phrase; no leak.
  P2s: env-blocked integration coverage + CRLF normalization (both
  pre-existing/tracked).

## 10. Invariants (confirmed)

mart `serverGrade` opted-in count **= 6** (csv 1 + sql 5); only `sql_resultset` +
`csv_set_equal` flipped; comparator (`gradeRowsetSubmission`/`grading.ts`)
**byte-unchanged**; envelope enforcement OFF; Phase 52 untouched; **no
schema/migration**; `RUBRIC_VERSION` frozen; archive=hide; C2 authored source
unchanged; project stays visible + approved (rubric 81.4). **Phase 61E not
started.**

## 11. Remaining / next

- The mart has **no dark rowset rows left** — all 6 are live.
- Restore a full local DB baseline before the next DB-dependent phase: `pnpm
  migrate` (adds `portfolio_submission_snapshots` etc.) + re-seed/re-promote C2 +
  mart, so the global serverGrade=10 is DB-observable and integration tests run.
- `.gitattributes` EOL-normalize `scripts/src/authored/**` (CRLF churn) — standing
  follow-up.
- Phase 61E / next density work: author the next WASM-native rowset project for
  more candidate supply (E4 factory track), under the full phase ritual.
