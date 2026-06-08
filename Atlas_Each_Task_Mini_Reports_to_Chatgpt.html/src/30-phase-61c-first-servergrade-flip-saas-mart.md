# Phase 61C — First controlled serverGrade flip in the SaaS mart
META: 2026-06-08 · COMPLETED · feat(curriculum) · live flip (+4 rows) · commit 1c3c709

## 1. Task Received
Phase 61C — flip the SAFEST subset (min 2 / prefer 3-4 / max 4) of the 6 Phase-61B dark rowset candidates in `data-engineering-saas-usage-revenue-quality-mart` to `serverGrade:true`, **only** rows whose real-browser DuckDB-WASM output byte-matches the committed `columns`+`expectedRows`. Hard stops: only sql_resultset/csv_set_equal; no comparator/float-tolerance/envelope/schema/Phase-52 change; no leak; don't force the count; don't start 61D.

## 2. Completion Status
**COMPLETED.** Browser-WASM-verified all 6; flipped **4** (steps 1,2,5,6); deferred 3 (max-4 cap) + 4 (HUGEINT→string mismatch). serverGrade **4 → 8**. Reviews architect **PASS** + code-reviewer **SHIP** (no P0/P1). All gates green. Committed `1c3c709`. 61D not started.

## 3. Files Changed
2 source: `scripts/src/authored/data-engineering__saas-usage-revenue-quality-mart.ts` (4 `serverGrade:false→true` + honest server-graded instruction copy on flipped steps + step-4 deferral comment + docblock) · `scripts/src/check-authored-saas-mart.ts` (pins the exact flip set). + `docs/phases/phase-61c-…md`, `.agentic/progress.md`. DB flip propagated via `author:project promote` (throwaway Docker PG — not committed). Dev-only browser harness created + deleted (not committed).

## 4. Scope Control / Hard Stops Check
Only sql/csv kinds flipped? **yes** (3 sql + 1 csv). Other kind? **no.** Comparator change? **no** (grading.ts byte-unchanged). Float/tolerance comparator? **no** (step 4 deferred BECAUSE it's type-unstable). Envelope enforcement? **no** (OFF). Schema/migration? **no.** Phase 52? **untouched.** Leak? **no** (verified). Forced count? **no** (4 of 5 passing, capped at max). GitHub/publishing? **no.** 61D started? **no.**

## 5. Implementation Details
Each flipped step's spec `serverGrade:false → true` with `columns`/`expectedRows`/`query` byte-identical to the 61B-verified values. The runtime comparator `gradeRowsetSubmission` is unchanged — the flip only changes which path the row takes (dark auto-pass → live re-grade of the FE-captured `{columns,rows}`). Propagated to DB via `author:project promote` (delete+reinsert steps, preserves visibility/approval). The `check` now asserts the exact flip set so it can't drift.

## 6. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck (4) + no-heuristic **OK** · `check:authored-saas-mart` **OK** · `audit:sql-resultset-bc` PASS (6 opted-in, 38 checks, 0 failures; 3 dark byte-identical to legacy) · `audit:csv-set-equal-bc` PASS (2 opted-in, 10 checks, 0 failures) · `audit:authoring` publish-ready · `audit:contains-bc` PASS · `audit:pedagogy` fully-enriched · api-server **648/648** · atlas **170/170** · **integration 4/4**.

## 7. Failures, Fixes, and Surprises
- **Browser byte-verify caught step 4** (`sum(INTEGER)`→HUGEINT→adapter `String()` fallback → `"4950"` string ≠ committed number `4950`; CLI DuckDB 1.5.3 gave Number). Exactly the WASM-vs-CLI divergence the gate exists for — deferred step 4.
- First Vite boot failed (`node node_modules/vite/bin/vite.js` — wrong path in a pnpm workspace) → re-booted via `pnpm exec vite`.
- The `.vite-61c.log` file handle stayed locked briefly after killing Vite → deleted after release.

## 8. Current Git State
Branch `main`, commit **`1c3c709`** (2 source + close-out + progress). Archive commit (this) follows. Tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md`. All browser-harness artifacts deleted.

## 9. Current Project State After This Task
serverGrade live count = **8** (csv 2 + sql 6). The new project's steps 1,2,5,6 are live server-graded; 3,4 dark; 7 contains. A completed learner's portfolio now classifies 4 steps in this project as server-graded. All invariants intact; C2 unchanged; comparator + routes + Phase 52 + envelope unchanged.

## 10. Remaining Risks / Blockers
Steps 3 (clean) + 4 (needs `cast(sum as bigint)` + re-verify) remain dark future candidates. The flipped rows' correctness rests on the browser byte-verify holding at engine 1.33.1-dev45.0 (current) — re-verify if the WASM engine version ever changes.

## 11. Recommended Next Step
Observe the 4 newly-live rows in a real env. **Phase 61D (owner-gated):** fix + flip step 4 (cast to bigint) and/or flip step 3, and/or author the next WASM rowset project for more candidate supply.

## 12. Explicit Stop Statement
**Stopped.** 4 browser-verified rows flipped to server-graded; steps 3+4 deferred with rationale; serverGrade 4→8; no-leak + honesty preserved; C2 unchanged. Reviews PASS/SHIP, gates + audits green, committed `1c3c709`. **Phase 61D NOT started.** Awaiting next instruction.

---

## 13. Candidate Inventory Table
| Step | Kind | Before | Browser byte-match | Type stability | Ordering | Leak risk | Decision |
|---|---|---|---|---|---|---|---|
| 1 | sql_resultset | dark | ✅ `[[7,7]]` num,num | BIGINT→Number (lossless) | n/a (1 row) | none | **FLIP** |
| 2 | sql_resultset | dark | ✅ `[[13,7]]` num,num | BIGINT→Number | n/a | none | **FLIP** |
| 3 | sql_resultset | dark | ✅ usage-by-type | str,num stable | ORDER BY event_type | none | defer (max-4 cap) |
| 4 | sql_resultset | dark | ❌ `[[6,"4950"]]` | **HUGEINT→string** | n/a | none | **defer** |
| 5 | csv_set_equal | dark | ✅ health-dist | str,num stable | ORDER BY health_label | none | **FLIP** |
| 6 | sql_resultset | dark | ✅ DQ-audit | str,num stable | ORDER BY check_name | none | **FLIP** |

## 14. Browser-WASM Verification Results
Real Chromium (playwright-cli), real atlas Vite, real `@/lib/duckdb/duckdbRunner` `duckdbAdapter`, `@duckdb/duckdb-wasm@1.33.1-dev45.0` (the learner runtime), over the committed seed CSVs, queries extracted from the authored file (no drift), csv step through the real `normalizeSqlRows`. Captures:
```
step1 columns=[n,n_unique]            rows=[[7,7]]                       types=[number,number]      MATCH
step2 columns=[valid_events,active_accounts] rows=[[13,7]]              types=[number,number]      MATCH
step3 columns=[event_type,event_count] rows=[[dashboard_view,3],[export,3],[query_run,7]] types=[string,number]×3  MATCH
step4 columns=[active_accounts,total_mrr] rows=[[6,"4950"]]             types=[number,string]      MISMATCH (committed [[6,4950]])
step5 columns=[health_label,account_count] rows=[[at_risk,2],[churned,1],[healthy,4]] types=[string,number]×3 MATCH
step6 columns=[check_name,flagged_count] rows=[[dup_account_ids,1],[invalid_usage_events,2],[orphan_usage_accounts,0]] types=[string,number]×3 MATCH
```
All `ok:true`. Harness deleted after capture.

## 15. Selected Flip Rationale
Flipped the 4 most type-stable AND strongest-evidence rows: step 1 (dedupe correctness), step 2 (explicit cleaning), step 5 (the final health-labelled mart — the deliverable + the only csv), step 6 (CI-ready data-quality audit — the trust signal). All integer/distinct-count/exact-label → the comparator's exact `JSON.stringify` cell match is robust. 3 sql + 1 csv → diverse evidence.

## 16. Deferred Candidate Rationale
- **Step 3** byte-matched clean; deferred only to respect the max-4 budget — a ready future candidate, no rework.
- **Step 4** DEFERRED: `sum(INTEGER)` → HUGEINT → adapter `String(v)` fallback → `"4950"` (string) ≠ committed number `4950`; a flip would fail a correct learner CLOSED. Stays dark (comparator short-circuits on `serverGrade !== true`). Future fix: `cast(sum(mrr_amount) as bigint)` (→ BIGINT → Number) + re-verify in-browser. Documented in a step-4 spec comment.

## 17. ServerGrade Count Before/After
Before: **4** (csv_set_equal 1 = C2 s3; sql_resultset 3 = C2 s1,2,5). After: **8** (csv_set_equal **2** = C2 s3 + mart s5; sql_resultset **6** = C2 s1,2,5 + mart s1,2,6). Δ = +3 sql + 1 csv. DB-confirmed.

## 18. Exact Flipped Step Numbers
`data-engineering-saas-usage-revenue-quality-mart` steps **1, 2, 5, 6** → `serverGrade:true`. Steps 3, 4 → `serverGrade:false` (dark). Step 7 → `contains` (untouched). DB per-step verified: 1=true,2=true,3=false,4=false,5=true,6=true,7=null. The `check` pins this set (`FLIPPED={1,2,5,6}`, flippedCount===4, darkCount===2).

## 19. No-Leak Verification Across /check, /submit, Artifact, JSON, and ZIP
The flip changes only the `serverGrade` boolean — no new leak channel. `routes/projects.ts` projection returns only `serverGrade: boolean` (never validationConfig/spec/expectedRows/query); the inert `expectedRow` is read nowhere (both reviewers confirmed). **/submit:** the BC audit proves a correct capture passes and raw-SQL/malformed/empty/wrong-columns/missing-row/extra-row FAIL CLOSED. **/check:** writes no snapshot (unchanged). **Artifact / repository JSON / ZIP:** assembly byte-unchanged (no export-code edit); a step is classified server-graded via the same `isServerGradeOptedIn` predicate, so a completed learner's evidence reflects steps 1,2,5,6 leak-free. Export unit 91/91 + integration 4/4 green over the unchanged shared path.

## 20. Portfolio ZIP Evidence Result
The export stack is byte-unchanged, so the ZIP path is unaffected by the flip; a completed learner's ZIP would classify steps 1,2,5,6 of this project as `server-graded` in VALIDATION_EVIDENCE (via the unchanged classifier), remain leak-free, and stay a valid archive (`portfolioZip.test.ts` covers `zipfile.testzip()=None`-equivalent validity; the 91 export unit + 4 integration tests pass). No new learner completion was seeded this phase (no snapshot created).

## 21. Existing C2 Regression Result
C2 (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`) server-graded steps DB-confirmed **unchanged**: steps 1, 2, 5 (`sql_resultset`) + step 3 (`csv_set_equal`) all still `serverGrade:true`; step 8 still dark. C2 not touched by this phase.

## 22. Independent Review Results
- **atlas-architect-reviewer → PASS** (no P0/P1): traced authored-spec → promote → DB → /submit → comparator AND the FE capture path; flip type-stability sound (BIGINT→Number vs HUGEINT→string); step-4 deferral + prescribed fix correct; no comparator drift (same `normalizeSqlRows` in harness + live FE); no leak; /check & /submit safe; invariants intact; C2 unchanged; 4→8.
- **code-reviewer → SHIP** (no P0/P1): diff is exactly 4 boolean flips + honest copy + comments; `columns`/`expectedRows`/`query` byte-identical to 61B (`94830a3`); check pins {1,2,5,6}; step-4 deferral verified against the comparator's `JSON.stringify` quoting; scope = 2 files.
- P2s (non-blocking): BC audits re-run green here on Node 24 + Docker PG (reviewer sandboxes lack DATABASE_URL); inert `expectedRow` = pre-existing optional cleanup; CRLF EOL = standing `.gitattributes` follow-up.
