# Phase 61B — Author next WASM-native rowset evidence project (Item 4)
META: 2026-06-08 · COMPLETED · feat(curriculum) · commit 94830a3

## 1. Task Received
Item 4 of the 4-item run: **Phase 61B — author ONE new portfolio-worthy, WASM-native, deterministic Data-Engineering project** that creates fresh rowset candidates for a FUTURE server-grade flip (the candidate-supply gap from 61A). Hard stops: no new serverGrade:true (all rowset steps DARK), no comparator change, no envelope enforcement, no schema/migration, no float/tolerance grading, no secrets, no GitHub OAuth/publishing, no answer-key leak; do not start Phase 61C.

## 2. Completion Status
**COMPLETED.** Authored `data-engineering-saas-usage-revenue-quality-mart` (7 steps; 6 dark rowset candidates + 1 contains), all queries DuckDB-verified, minted + promoted + approved (rubric 81.4, visible). serverGrade count unchanged = 4. Reviews architect **PASS** + code-reviewer **SHIP** (no P0/P1); 1 P2 fixed in-phase. All gates green. Committed `94830a3`. Phase 61C not started.

## 3. Files Changed
New: `scripts/src/authored/data-engineering__saas-usage-revenue-quality-mart.ts`; `artifacts/atlas/public/datasets/saas-mart/{accounts,usage_events,subscriptions}.csv`; `scripts/src/backfill-phase61b-candidates.ts`; `scripts/src/check-authored-saas-mart.ts`; `docs/phases/phase-61b-…md`. Modified: `scripts/src/authored-lineage.ts` (COURSE map + NET_NEW_FOR_SLUG_PHASE61B); `scripts/src/authored/index.ts` (import+register); `scripts/package.json` (backfill + check scripts); `.agentic/progress.md`. DB changes (candidate/project/steps) live in throwaway Docker PG — NOT committed.

## 4. Scope Control / Hard Stops Check
App/grading code? **no** (authored content + scripts only). DB schema/migration? **no.** New serverGrade:true? **no** (all 6 rowsets dark; DB-confirmed count still 4). Comparator/envelope? **no.** Production touched? **no.** Phase 52? **no.** OpenAPI/codegen? **no.** Answer-key/spec leak? **no** (verified). Unexpected file? **no** (additive registry edits only).

## 5. Implementation Details
A realistic ELT-to-mart DE workflow on DuckDB over 3 committed CSVs: type+dedupe accounts (latest-load-wins ROW_NUMBER) → clean usage stream (drop invalid) → usage-by-type intermediate → active-MRR revenue model (half-open window) → final account revenue-quality mart with mutually-exclusive health labels → DQ audit (dup/invalid/orphan) → runbook. Helpers: `validationConfig`/`pedagogyConfig`/`projectMeta`/`portfolioArtifact`. Each rowset spec carries `serverGrade:false` + `columns` + `expectedRows` (pre-populated for a one-line future flip) + scalar `expectedRow` on single-row steps.

## 6. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck(4)+no-heuristic **OK** · `check:authored-saas-mart` **OK** · `audit:authoring` publish-ready · `audit:quality` **81.4 approved** · `audit:sql-resultset-bc` **PASS** (6 dark + 3 opted-in, 0 failures) · `audit:csv-set-equal-bc` **PASS** (1 dark + 1 opted-in) · `audit:contains-bc` **PASS** · `audit:pedagogy` fully-enriched · api-server **648/648** · atlas **170/170**. All 6 queries re-run byte-exact in real DuckDB 1.5.3.

## 7. Failures, Fixes, and Surprises
- `node` couldn't import `@workspace/db` (ESM dir import) — used `tsx` for ad-hoc DB queries.
- promote defaults `learner_visible=true` + `quality_status=unreviewed`; approval comes from `author:project audit … --commit` (rubric≥70). Scored 81.4 → approved.
- The `audit:quality` "Candidates" section scores the thin candidate proposal (23.4) — NOT the promoted project (81.4); don't confuse them.
- Reviewer P2: step-6 `starterCode` had complete CTE bodies (not a scaffold) — stubbed + re-promoted.

## 8. Current Git State
Branch `main`, commit **`94830a3`** (source + fixtures + close-out + progress), pushed after archive. Tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md` and 3 pre-existing untracked blueprint files. DB state in Docker PG only.

## 9. Current Project State After This Task
A new visible+approved Data-Engineering project exists with 6 dark rowset candidates ready for a future flip. serverGrade live count unchanged = 4. All invariants intact. **All four items of the owner run are complete** (plan persisted, research persisted, Phase 0.2 shipped, Phase 61B shipped).

## 10. Remaining Risks / Blockers
- Expected rowsets verified in DuckDB **1.5.3**, not WASM **1.33.1-dev45.0** — acceptable for DARK rows (no grading impact); any future flip must re-verify in the real browser runtime first.
- C2 step 8 (NRR float) still needs a tolerance comparator before it can flip.

## 11. Recommended Next Step
Recommended next step (owner-gated): observe the new project in a real env; then **Phase 61C** — either flip a subset of these 6 dark rows to serverGrade:true (after real-browser DuckDB-WASM byte-verification, per the 61A discipline) and/or author the next WASM-native rowset project to keep growing density. Classify: owner approval.

## 12. Explicit Stop Statement
Stopped. Phase 61B COMPLETED + committed; all 4 items of the run done. **Phase 61C NOT started.** Awaiting your next instruction.

---

## 13. New Project Summary
`data-engineering-saas-usage-revenue-quality-mart` — intermediate, course `data-engineering`, language `sql`, 7 steps, 240 min / 720 XP, candidate `7e9c1a2b-3d4e-4f5a-9b6c-7d8e9f0a1b2c`. Visible + approved (81.4). A trust-first SaaS account mart: raw ingestion → typed/deduped staging → cleaned usage → usage-by-type → active MRR → health-labeled mart → DQ audit → runbook. Zero cloud/credentials/network — clones + runs in DuckDB in under a minute.

## 14. Dataset and Fixture Design
3 CSVs in `artifacts/atlas/public/datasets/saas-mart/`, registered by the existing DuckDB-WASM runner as tables `"saas-mart/<name>"` (table name = the `datasetRefs` string; no httpfs/read_csv in authored SQL): `accounts.csv` (8 rows, A-002 loaded twice → dedupe to 7), `usage_events.csv` (15 rows, E-14 empty-type+negative + E-15 negative → 13 valid), `subscriptions.csv` (7 rows, A-007 churned 2025-05-31 → excluded from June active). Designed so every validated output is a hand-checkable integer / distinct count / exact label — deterministic, ASCII/LF, no CRLF drift, no ROW_NUMBER ties (the duplicate has distinct `loaded_at`).

## 15. Validation Candidate Inventory
6 NEW dark rowset candidates (all `serverGrade:false`), each with `columns`+`expectedRows` pre-populated and DuckDB-verified:
- step 1 sql_resultset `[n,n_unique]` = `[[7,7]]`
- step 2 sql_resultset `[valid_events,active_accounts]` = `[[13,7]]`
- step 3 sql_resultset `[event_type,event_count]` = `[[dashboard_view,3],[export,3],[query_run,7]]`
- step 4 sql_resultset `[active_accounts,total_mrr]` = `[[6,4950]]`
- step 5 csv_set_equal `[health_label,account_count]` = `[[at_risk,2],[churned,1],[healthy,4]]`
- step 6 sql_resultset `[check_name,flagged_count]` = `[[dup_account_ids,1],[invalid_usage_events,2],[orphan_usage_accounts,0]]`
Plus step 7 `contains` (server-enforced). Audit partition after promote: sql_resultset dark **6** (5 new + C2 step 8) / opted-in 3; csv_set_equal dark **1** (new) / opted-in 1.

## 16. DuckDB-WASM Compatibility Verification
All 6 queries re-executed against the committed seeds in real DuckDB (Python `duckdb` 1.5.3); every `expectedRows` matched byte-for-byte. Both reviewers independently reproduced. Patterns used are all WASM-supported and mirror the C2 gold file (qualify ROW_NUMBER, generate_series unused here, date casts, half-open window join, group-by + order-by, union-all audit). Integer/label outputs → lossless BIGINT→Number capture, type-stable across the WASM→JSON→comparator path. NOTE: engine 1.5.3 ≠ learner WASM 1.33.1-dev45.0; acceptable for dark rows — a future flip re-verifies in the real browser, the established discipline.

## 17. Future ServerGrade Candidate Rationale
The 6 dark rows are the safest possible future-flip class: every output is an integer, a distinct count, an integer sum, or an exact string label — no floats, no ratios, no tolerance. The comparator's exact `JSON.stringify` cell match is robust to any DuckDB numeric representation for these values. Specs already carry the server-grade shape (`columns`+`expectedRows`), so each flip is a one-line `serverGrade:true` change after a real-browser byte-verification + BC-audit re-run.

## 18. Rejected / Avoided Validation Designs
- **No floats / ratios** (e.g. churn rate, NRR, averages) — deliberately avoided; they would need the tolerance comparator that C2 step 8 is still blocked on. Every metric here is rounded/exact-integer by construction.
- **No `current_date` / timing / randomness / cloud** — all pinned to fixed literals over committed seeds for byte-reproducibility.
- **No `numeric_tolerance` / `json_equal` / `self_attest`** kinds — the project biases to the strongest deterministic kinds (sql_resultset / csv_set_equal / contains), matching the C2 discipline.
- Multi-row results without `ORDER BY` avoided — steps 3/5/6 all carry explicit ordering.

## 19. No-Leak and Honesty Verification
The project-detail step projection (`routes/projects.ts`) is an explicit allowlist returning only `serverGrade: boolean` — it never spreads `validationConfig`/`spec`/`expectedRows`/`query`; L5 literal lines are gated behind authenticated per-user hint endpoints (architect + code-reviewer both confirmed). Learner-facing copy attributes the dark rowset grading only to the in-browser adapter ("immediate feedback"; "the server commit-grader auto-passes"), never claiming server verification; step 7 (`contains`) is truthfully described as server-enforced. `check:authored-saas-mart` scanned all learner-facing text for the H3 banned list → **none**.

## 20. Existing ServerGrade Count Verification
DB query (visible steps with `validation_config->'spec'->>'serverGrade' = 'true'`), before and after promote + re-promote: `csv_set_equal = 1`, `sql_resultset = 3`, **total = 4 — UNCHANGED.** No row was flipped live.

## 21. Portfolio Export Compatibility Result
The export stack (`portfolioRepository.ts`, `portfolioZip.ts`, the artifact/repository/zip routes, the 60B assembly chokepoint) is **byte-unchanged** by this phase — no api-server/lib/route edit. A new dark-graded project does not alter any existing completion snapshot or the assembly of existing artifacts; it simply becomes an available project. The artifact/repository-JSON/ZIP routes therefore remain functional and leak-free (verified live across the export stack in 61A; unaffected here). No new snapshot was created (no learner completed the new project).

## 22. Independent Review Results
- **atlas-architect-reviewer → PASS** (no P0/P1): independently reproduced all 6 queries, hand-traced step-5 health logic + step-1 tie-freedom, confirmed the live grader short-circuits on `serverGrade !== true` (`grading.ts:625,678`), the no-leak projection, H3 honesty, determinism, the candidateId lineage triple-match, and every invariant. "No fixes required."
- **code-reviewer → SHIP** (no P0/P1): reproduced all 6 in python duckdb + stress-tested learner-solution variance (cleaning predicate converges on 13/2 across 3 valid variants; no `=0`-duration ambiguity; no NULL anti-join trap). **P2-1 fixed in-phase** (step-6 starterCode stubbed to scaffold convention). Rubric gaps (unrecognized stack tags; simulated runner) judged acceptable — same class as C2, advisory only.
