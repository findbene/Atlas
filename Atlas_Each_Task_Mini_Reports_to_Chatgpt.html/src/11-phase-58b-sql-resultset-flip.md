# Phase 58B — first controlled sql_resultset server-grade flip
META: 2026-06-07 · COMPLETED · 1-row live flip + no-leak test · commit 948e5b7

## 1. Task Received
Phase 58B: safely opt in EXACTLY ONE vetted `sql_resultset` step to live server grading (recommended candidate C2 step 2, SCD-2 invariants), using the dark→verify→flip discipline. Tasks: pre-flight state verify; candidate validation; spec reshape for one row; real browser-WASM byte verification; FE/server signal wiring; integration verification; independent reviews; gates; final invariants. Hard stops: exactly 1 sql_resultset opt-in, no additional csv opt-ins, no envelope enforcement, no Phase 52/env/canary/schema/production/cloud/wave/cert-marketing change, no force-push, no secrets, do not start Phase 59.

## 2. Completion Status
**COMPLETED.** One row flipped (C2 step 2). Browser-WASM byte-verified + end-to-end verified through the live grader. Reviews architect **PASS** + code **SHIP** (no P0/P1). All gates green. Phase 59 not started.

## 3. Files Changed
- `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts` — step 2 spec reshape (serverGrade:true, columns, positional expectedRows). The ONLY opt-in.
- `artifacts/api-server/src/routes/projects.ts` — `deriveServerGrade` widened to csv_set_equal | sql_resultset (narrow boolean only).
- `artifacts/atlas/src/pages/project-workspace.tsx` — 2 comment-only updates (routing already kind-agnostic).
- `artifacts/api-server/src/lib/grading.ts` — stale comment fix (code-review P2).
- `artifacts/api-server/src/routes/projects-server-grade.test.ts` — **NEW** no-leak route test (architect P2-1).
- `docs/phases/phase-58b-sql-resultset-flip.md`, `docs/validation-kind-matrix.md`, `.agentic/progress.md` — docs.
- Excluded (hook-managed): `.agentic/self-review.log`, `HANDOFF.md`.

## 4. Scope Control / Hard Stops Check
sql_resultset opt-ins added? **1** (target) · additional csv opt-ins? **no** · envelope enforcement? **no** (`PILOT_RUNTIME_KINDS={json_equal}`) · Phase 52? **no** · env/canary? **no** · schema/migration? **no** · OpenAPI/codegen? **no** (serverGrade existed since 57B) · production/cloud/waves/cert-marketing? **no** · force-push? **no** · secrets? **no** · Phase 59 started? **no** · unrelated content edit in C2 file? **no** (only step 2's validation block).

## 5. Implementation Details
The flip is a spec reshape + a server signal widen — no comparator change (the 58A shared `gradeRowsetSubmission` already grades it). Step 2's `expectedRows` went from array-of-objects to positional `[["one_current",0],["overlap",0]]` with `columns:["check","value"]` + `serverGrade:true`; landed in the DB via `author:project promote` (upsert "updated") + `audit --commit` (87.30 approved). `deriveServerGrade` now returns true for an opted-in csv_set_equal OR sql_resultset row — only the boolean; the serializer is a closed allow-list (no validationConfig/spec/expectedRows/query). FE Check/Submit routing was already `serverGrade && isSqlStep`, so the `code_sql` row routes its captured `{columns,rows}` JSON with no logic change.

## 6. Candidate Verification Result
C2 step 2 confirmed the safest first flip: visible+approved, WASM-runnable over committed `seeds/customers.csv`, deterministic 2-row invariant output (`0/0` by construction → robust to numeric-fidelity surprises), and already verified in Phase 0.zz. Pre-flight confirmed: branch main, csv_set_equal serverGrade=1 / sql_resultset=0 before this phase, C2 visible+approved, envelope/Phase-52 untouched. Step 2 was not silently swapped for another row.

## 7. Browser-WASM Byte Verification Result
Real `@duckdb/duckdb-wasm@1.33.1-dev45.0` in headless Chromium (playwright-cli), running step 2's exact shipped starterCode via the real `duckdbAdapter`: `columns=["check","value"]`, `normRows=[["one_current",0],["overlap",0]]`, `cellTypes=[string,number]` — **byte-identical to the committed expectedRows**. `count(*)` bigint coerced to JS number (0 fits). No mismatch → no expectedRows change needed.

## 8. Integration Verification Result
Fed the exact real-browser capture to the LIVE DB grader (`gradeSubmission`): positive → `passed:true "Correct!"`. All 7 negatives fail closed (raw SQL, malformed JSON, wrong columns, missing row, extra unmatched row, wrong value, empty). Non-opted sql_resultset step 1 → BC auto-pass "Step completed." Live csv_set_equal step 3 → regression pass "Correct!".

## 9. Independent Review Results
- **atlas-architect-reviewer: PASS** (no P0/P1). Confirmed no answer-key leak, exactly one opt-in, learner task preserved, envelope off, numeric fidelity, scope clean. P2-1 (no route test for the no-leak property) → **FIXED** this phase (new `projects-server-grade.test.ts`). P2-2 (authoring classifier label) → deferred R1.
- **code-reviewer: SHIP** (no P0/P1). P2 (stale grading.ts comment) → **FIXED**. P2 (OpenAPI description polish) → **DEFERRED** (reviewer confirms current text not misleading; avoids OpenAPI/codegen churn per hard-stop).

## 10. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck + check:no-heuristic-runtime PASS · api-server **502/502** (+5 no-leak test) · atlas 159/159 · curriculum-quality 143/144 (env-only COURSE_TAXONOMY ENOENT) · audit:sql-resultset-bc PASS (3 dark byte-identical across 21 bare-string + 9 envelope; 1 opted-in DB row + synthetic, correct capture passes / 6 negatives fail closed) · audit:csv-set-equal-bc PASS (live csv row regression-safe) · audit:contains-bc 3/3 · audit:authoring exit 0.

## 11. Failures, Fixes, and Surprises
No code failures. Harness friction (resolved): Start-Job doesn't persist across tool calls → booted Vite via run_in_background; `vite.config.ts` requires `PORT` env (not `--port`); playwright-cli escapes eval'd JSON → rendered result into the DOM + marker-wrapped for clean extraction. All temp harness files deleted (no residuals). Surprise: qualityScore recomputed 85.30 → 87.30 on re-promote (still approved; only authored delta is step 2's spec).

## 12. Current Git State
Branch `main`, HEAD `948e5b7` (this archive commit follows). Pushed after archive. Working tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md` (excluded from the commit).

## 13. Remaining Risks / Blockers
- Deferred P2s: OpenAPI `serverGrade` description polish; `audit:authoring` serverGrade-awareness (R1, labels sql_resultset/csv_set_equal "client-provisional").
- Observe the single live opted-in sql_resultset row in a real env before any 2nd opt-in.
- Pre-existing/low-risk: `.gitattributes` EOL normalization for `lib/*/src/generated/**`; Linux/CI lockfile regen; full app UI boot blocked by Phase 0.2 (integration done via verified adapter + live-grader harness).

## 14. Recommended Next Step
**Phase 59** (`/check`-vs-`/submit` evidence). Owner approval required to start. Before any 2nd opt-in, observe the live row in a real env.

## 15. Explicit Stop Statement
Stopped after Phase 58B. No post-58 expansion started. Ready for next instruction.
