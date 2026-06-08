# Phase 61A — Server-Graded Evidence Coverage Expansion Batch
META: 2026-06-08 · COMPLETED · live server-grade flip (+2 rows) · commit 11e60c6

## 1. Task Received
Phase 61A — controlled expansion of live server-graded evidence coverage beyond the current 2 rows (1 csv + 1 sql, both in C2). Inventory the `sql_resultset`/`csv_set_equal` candidates, verify thoroughly (fixtures, runtime, determinism, no-leak, honesty), and flip ONLY rows that pass every evidence-safety gate (target 2–5, prefer 3–5, don't force; flip none + report if none safe). Hard stops: no GitHub OAuth/publishing; no envelope enforcement; no Phase 52; no schema/migration unless a proven defect; no answer-key/validationConfig/expectedRows/comparator-diagnostic leaks; no broad/"flip everything"; no other validation kind; do not start Phase 61B.

## 2. Completion Status
**COMPLETED.** Flipped **2** byte-verified rows (C2 steps 1 + 5, `sql_resultset`); deferred step 8 (float). serverGrade 2 → 4. Reviews architect **PASS** + code-reviewer **SHIP** (no P0/P1); 1 P2 fixed in-phase. All audits + gates green; live export stack verified. Committed `11e60c6`, pushed `main`. Phase 61B not started.

## 3. Files Changed
Commit `11e60c6` (2 source + docs): `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts` (steps 1+5 flip + step-1 instruction honesty + header docblock), `artifacts/api-server/src/lib/grading-c2-flip.test.ts`(new), `docs/phases/phase-61a-…md`(new), `.agentic/progress.md`. DB flip propagated via `author:project promote` (not committed — throwaway PG; source of truth is the authored .ts).

## 4. Scope Control / Hard Stops Check
Other validation kind? **no** (only sql_resultset). Broad/flip-everything? **no** (2 of 3 candidates, surgical). Envelope enforcement? **no** (OFF). Phase 52? **untouched.** Schema/migration? **no.** Comparator change? **no** (grading.ts byte-unchanged). GitHub/publishing? **no.** Answer-key/spec/diagnostic leak? **no** (verified). Phase 61B started? **no.**

## 5. Implementation Details
Converted steps 1 + 5 validation specs from the legacy scalar `expectedRow` shape to the server-grade rowset shape: added `serverGrade:true` + `columns` + `expectedRows` (the browser-verified capture), kept `query` + `expectedRow` (tolerated by the guard, ignored by the comparator). The runtime comparator (`gradeRowsetSubmission`) is unchanged. The flip reaches the DB through the existing authoring pipeline (`author:project promote` — delete+reinsert steps from the authored source, preserving `qualityStatus`/visibility). New focused test pins the flip contract.

## 6. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck (4) + `check:no-heuristic-runtime` **OK** · **check:boot OK** · api-server unit **639/639** (+9 flip-contract) · atlas **170/170** · **integration 4/4** · `audit:sql-resultset-bc` PASS (dark 1 / opted-in 3, 19 checks 0 failures) · `audit:csv-set-equal-bc` PASS (1) · `audit:contains-bc` 3/3 · `audit:authoring` exit 0 · live export-stack server-graded reflection + no-leak + valid ZIP.

## 7. Failures, Fixes, and Surprises
- **Seed doesn't propagate flips** — the idempotent `seed` left steps 1/5 dark (it doesn't overwrite existing validation_config). The production flip path is `author:project promote` (delete+reinsert), which propagated it + preserved visibility/approval.
- **Re-author clears snapshots** — promote cascade-deletes `portfolio_submission_snapshots` (stepId FK) but `user_step_completions` (keyed by stepNumber) survive, so the e2e learner stayed completed for the export verification.
- Reviewers' P2 (stale header docblock) fixed in-phase.

## 8. Current Git State
Branch `main`. Feature **`11e60c6`** (2 source + docs) on top of `24fdbb8`, pushed. Archive commit follows. Working tree clean except hook-managed files. Dev-only WASM harness created + deleted (not committed).

## 9. Current Project State After This Task
serverGrade count = **4** (csv 1 + sql 3). C2 visible+approved; a completed learner's portfolio now shows 4 server-graded steps. All invariants intact; comparator + routes + Phase 52 + envelope unchanged.

## 10. Remaining Risks / Blockers
Coverage still concentrated in C2 (only WASM-native rowset project). Comparator is type-strict (number≠string) — correctness rests on the browser byte-verify holding at engine 1.33.1-dev45.0 (current); re-verify if the WASM engine version ever changes. Step 8 (float) needs a tolerance-aware comparator before flipping.

## 11. Recommended Next Step
Observe the 2 newly-live rows in a real env. **Phase 61B (owner-gated):** (a) author the next WASM-native fixture-backed rowset project to create fresh flip candidates (authoring-factory track), and/or (b) add a dark, BC-audited numeric-tolerance/round-aware rowset comparator option to unlock float-valued steps like C2 step 8.

## 12. Explicit Stop Statement
**Stopped.** 2 byte-verified rows flipped to server-graded; step 8 deferred with rationale; serverGrade 2→4; no-leak + honesty preserved across `/check`, `/submit`, artifact, repository JSON + ZIP. Reviews PASS/SHIP, gates + audits green, committed `11e60c6`. **Phase 61B NOT started.** Awaiting next instruction.

---

## 13. Candidate Inventory Summary
Entire `sql_resultset`/`csv_set_equal` universe = ONE visible+approved project (C2). Candidates (dark rowset steps): **step 1** sql (counts), **step 5** sql (MRR sum), **step 8** sql (NRR float). Steps 2 (sql) + 3 (csv) already live (58B/57B-flip). All candidates: visible, approved, fixture-backed (seeds/customers.csv + subscriptions.csv), WASM-native self-contained inline-CTE SQL (no dbt/Jinja), deterministic, execution-derived expected values, zero cloud/credential/network/timing/randomness deps, no leak risk, honest learner prompts.

## 14. Selected Batch Rationale
**Flipped steps 1 + 5** — the two **integer-valued** outputs, where the comparator's exact `JSON.stringify` cell match is robust to any DuckDB-WASM numeric representation: step 1 counts (BIGINT→Number 7,7), step 5 `round(sum::double,0)`→2746 (`JSON.stringify(2746.0)==="2746"`). Both are canonical single-answer outputs the step instructs, and meaningful portfolio evidence (staging dedupe; the MRR metric).

## 15. Rejected Candidates and Reasons
**Step 8 (enterprise NRR = `1.05`) — DEFERRED.** Byte-verified clean (`[[1.05]]` number) but a **float ratio**: the comparator has no numeric tolerance, so a correct learner whose query returns the unrounded ratio / a DECIMAL / a differently-rounded value would fail closed with no escape hatch. A tolerance/round-aware contract is a comparator change (out of 61A scope). Conservatively deferred (brief: "reject … too ambiguous to grade safely"). No other project has a rowset step → batch necessarily ≤ 3.

## 16. Runtime Verification Results
Re-executed the EXACT shipped step 1/5/8 queries over the committed seed CSVs through the real `duckdbAdapter` + `normalizeSqlRows`. All `ok:true`. The committed `expectedRows` for steps 1/5 (`[[7,7]]`, `[[2746]]`) equal the real capture; `audit:sql-resultset-bc` then independently confirmed the correct `{columns,rows}` capture PASSES each opted-in row and 6 negative classes FAIL CLOSED (19 checks, 0 failures).

## 17. Browser-WASM Verification Results
Real Chromium, real `duckdbAdapter`, `@duckdb/duckdb-wasm@1.33.1-dev45.0` (the learner runtime; engine unchanged since 0.zz), dev-only harness deleted after:
```
step 1  columns=[n,n_unique]  rows=[[7,7]]   types=[number,number]
step 5  columns=[value]       rows=[[2746]]  types=[number]
step 8  columns=[value]       rows=[[1.05]]  types=[number]
```
Byte-identical to Phase 0.zz; clean number types (no bigint/Decimal/float drift). Confirms the flipped `expectedRows` == the FE capture in the actual runtime.

## 18. ServerGrade Count Before/After
Before: **2** (csv_set_equal 1 = step 3; sql_resultset 1 = step 2). After: **4** (csv_set_equal 1 = step 3; sql_resultset **3** = steps 1, 2, 5). Δ = +2 sql rows. Step 8 + all non-C2 steps unchanged.

## 19. No-Leak Verification Across Export Stack
The flip changes only the narrow `serverGrade` boolean; it adds NO leak channel (the assembly chokepoint never returns validationConfig/expectedRows/scalar expectedRow). Verified LIVE (real API + re-authored DB) across `/portfolio-artifact`, `/portfolio-repository` (JSON), and `/portfolio-repository.zip`: no `validationConfig`/`expectedRows`/`expectedRowsHash`/`serverGradeFlag`/`spec`; the answer values `7,7` / `2746` / `one_current` ALL absent; no banned claims; ZIP valid (Python `zipfile.testzip()`=None). `/check`+`/submit` route code unchanged.

## 20. Portfolio ZIP Evidence Result After New Flips
A completed learner's artifact + ZIP now classify **steps 1, 2, 3, 5 as `server-graded`** in VALIDATION_EVIDENCE (was steps 2, 3) — the evidence-density goal — while remaining leak-free, carrying only the allowed Atlas-verified claim + honest limitations, and producing a valid archive.

## 21. Independent Review Results
- **atlas-architect-reviewer → PASS** (no P0/P1): type-stability sound (integer outputs cannot drift through the BIGINT→Number / DOUBLE→number capture); spec valid; no-leak intact; invariants hold (csv 1 / sql 3); step-8 deferral judgment sound; `needs-run` fail-safe correct.
- **code-reviewer → SHIP** (no P0/P1): traced the capture→comparator chain byte-by-byte (reproduced in a standalone harness); spec validity + non-vacuous tests confirmed; scope = 2 files.
- **P2 fixed in-phase (both):** the stale project-header docblock ("client-provisional / commit-grader auto-passes") updated to the actual server-graded posture + the step-8 deferral note.
