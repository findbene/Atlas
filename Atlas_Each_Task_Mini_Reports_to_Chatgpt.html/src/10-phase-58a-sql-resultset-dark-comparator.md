# Phase 58A — sql_resultset DARK server-grading comparator foundation
META: 2026-06-07 · COMPLETED · dark comparator + audit + tests · commit 6ee7b65

## 1. Task Received
Phase 58A: begin hardening `sql_resultset` validation with a safe, audit-first, **build-DARK** server-side comparator + audits + readiness checks, so a later Phase 58B can flip exactly one vetted row. Hard stops: no `serverGrade:true` additions, no row opt-ins, no envelope enforcement, no Phase 52 / env / canary / schema / production / cloud / waves / cert-marketing changes, no force-push, no secrets, do NOT start 58B. Tasks: inventory usage; design the trust boundary (H3); implement a dark comparator (deterministic column/row/dup/numeric/null/date/boolean semantics, fail-closed, no answer-key leak); add `audit:sql-resultset-bc` (+ opt-in simulation, negative tests, collision-proof); add focused tests; identify one 58B candidate; run gates; produce this report.

## 2. Completion Status
**COMPLETED.** Dark comparator shipped, fully reviewed (architect **PASS** + code-reviewer **SHIP**, no P0/P1), all gates green. Zero rows opt in; zero learner-visible change. Phase 58B NOT started.

## 3. Files Changed
- `artifacts/api-server/src/lib/grading.ts` — extracted csv comparison body into shared `gradeRowsetSubmission`; `gradeCsvSetEqual` now a thin wrapper; added `gradeSqlResultset` + `sql_resultset` dispatch case + JSDoc.
- `artifacts/api-server/src/lib/envelopeGrade.ts` — DARK `sql_resultset` envelope branch (NOT in `PILOT_RUNTIME_KINDS`).
- `lib/curriculum-quality/src/authoring.ts` — DRY'd guard into shared `assertValidRowsetSpec`; added `assertValidSqlResultsetSpec`; wired into `validationConfig`.
- `artifacts/api-server/src/lib/grading.test.ts` (+208), `…/envelopeGrade.test.ts` (+90), `lib/curriculum-quality/src/authoring.test.ts` (+39) — new test blocks.
- `scripts/src/audit-sql-resultset-bc.ts` (NEW) + `scripts/package.json` (`audit:sql-resultset-bc`).
- `docs/validation-kind-matrix.md`, `docs/phases/phase-58a-sql-resultset-dark-comparator.md`, `.agentic/progress.md` — docs.
- **Deliberately UNCHANGED:** `routes/projects.ts deriveServerGrade` (csv-only; FE signal is a 58B concern).

## 4. Scope Control / Hard Stops Check
serverGrade:true added? **no** · row opted in? **no** · envelope enforcement? **no** (`PILOT_RUNTIME_KINDS` still `{json_equal}`) · Phase 52? **no** · env/canary? **no** · schema/migration? **no** · OpenAPI/codegen? **no** · production/FE behavior? **no** · cloud/waves/cert-marketing? **no** · force-push? **no** · secrets? **no** · 58B started? **no**.

## 5. Implementation Details
One comparator, two entry points: the Phase-57A comparison logic was lifted **verbatim** into `gradeRowsetSubmission`; `gradeCsvSetEqual` (LIVE) and new `gradeSqlResultset` both delegate after an identical opt-in gate (`spec.serverGrade === true`). Pre-58A `sql_resultset` had no dispatch case → generic `{passed:true,"Step completed."}`; the dark branch reproduces that exact tuple for every non-opted shape. Semantics when opted in (same `{columns,rows}` JSON contract as csv): positional columns; multiset rows (default) or `orderSensitive` positional; multiset dup cardinality / `dedupe`; numbers ≠ numeric-strings unless `coerceNumericStrings`; null ≠ "" unless `nullEqualsEmpty`; dates as strings; booleans ≠ "true"; fails CLOSED on raw SQL / non-JSON / empty / wrong-or-missing columns / wrong width / missing-or-extra rows / malformed spec. Answer keys stay server-side. H3: strongest future claim = "Atlas verified submitted result rows matched the enabled SQL result validation checks"; no authorship/tamper/cheat/job claims; provenance ≠ enforcement.

## 6. Current sql_resultset inventory
25 authored `sql_resultset` steps across 8 projects; **4 visible** (C2 semantic-layer steps 1,2,5,8) — the only WASM-runnable ones (self-contained inline DuckDB over committed seed CSVs). The other 21 target Snowflake / PostgreSQL-procedural / Iceberg / external constructs or carry no inline query (scalar-assertion specs). All 25 carry no `serverGrade` → all auto-pass under the dark comparator. **58B candidate (not flipped): C2 step 2** (SCD-2 invariants — already has `expectedRows`, deterministic 0/0 output; flip needs reshape to positional `{columns,expectedRows}` + real-browser WASM byte-verify).

## 7. Comparator semantics
See §5. Identical to csv_set_equal (shared core). Order-sensitive SQL (ORDER BY) → `orderSensitive: true`. Default = order-insensitive multiset.

## 8. Tests / Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck + check:no-heuristic-runtime **PASS** · api-server **497/497** (+31) · curriculum-quality 143/144 (1 env-only `COURSE_TAXONOMY` ENOENT, pre-existing) · `audit:sql-resultset-bc` **PASS** (4 dark rows byte-identical across 28 bare-string + 12 envelope checks; synthetic opt-in 7/7) · `audit:csv-set-equal-bc` **PASS** (live opted-in csv row regression-safe through the refactored core) · `audit:contains-bc` 3/3 · `audit:authoring` exit 0. Reviews: architect-reviewer **PASS**, code-reviewer **SHIP** (162-line extraction byte-verified; no P0/P1).

## 9. Failures / Fixes / Surprises
No code failures. One self-inflicted slip: first `git commit` used PowerShell here-string syntax in the Bash tool → stray `@` in the message; amended (pre-push) to a clean message. Pleasant surprise: the new audit is strictly more thorough than the csv original (adds `wrong-columns` + `missing-row` negatives + a synthetic opt-in simulation, since zero sql rows opt in).

## 10. Current Git State
Branch `main`, HEAD `6ee7b65` (this archive commit follows). **Not pushed yet** (awaiting the archive commit, then push). Working tree otherwise clean except hook-managed `.agentic/self-review.log` (excluded from the commit per CLAUDE.local.md).

## 11. Remaining Risks / Blockers
- P2 deferred (shared R1): `audit:authoring` still labels `sql_resultset` "client-provisional" (classifier not serverGrade-aware) — accurate while dark.
- P2 accept-with-note: audit negatives use synthetic sentinels — collision-proof, unreachable today.
- 58B prerequisites (not done): reshape one C2 step → real-browser WASM byte-verify → extend `deriveServerGrade` to sql_resultset → flip one row → post-flip review.
- Pre-existing/low-risk: `.gitattributes` EOL normalization; Linux/CI lockfile regen.

## 12. Recommended Next Step
Recommended next step: **Phase 58B** — reshape C2 step 2's spec to positional `{columns, expectedRows}`, byte-verify in real browser DuckDB-WASM, extend `deriveServerGrade` to `sql_resultset`, flip exactly ONE row, then post-flip review. **Owner approval required to start.** Do not begin 58B unprompted.

## Explicit Stop
Stopped after Phase 58A. Phase 58B NOT started. Ready for next instruction.
