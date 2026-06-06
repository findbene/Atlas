# Phase 57B-prereq — `csv_set_equal` staged-hybrid foundation (DARK)

**Status:** SHIPPED (dark). Architect-reviewer: **PASS**. Code-reviewer: **SHIP-ready**. No P0/P1.
**Commits:** `3e6dc8b` (code) → `ff5f9d9` (lockfile restore) → `3cc3187` (review P2 fixes). Pushed to `main`.
**Decision implemented:** Option C (staged hybrid, provenance-biased) from `phase-57c-csv-set-equal-trust-decision.md`.

This phase builds the FE submission-shape + server envelope plumbing for server-graded
`csv_set_equal`, **without opting in any row and without enabling envelope enforcement**. It is
the prerequisite the earlier ChatGPT handoff wrongly assumed already existed.

---

## 1. Files changed (8 source files)

| File | Change |
|---|---|
| `artifacts/api-server/src/routes/projects.ts` | `deriveServerGrade()` helper + `serverGrade` boolean on GET `/projects/:slug` step serialization. Narrow boolean only. |
| `artifacts/api-server/src/lib/envelopeGrade.ts` | DARK `csv_set_equal` branch: serialize verified `{columns,rows}` → same `gradeSubmission`→`gradeCsvSetEqual` comparator; stdout-only captures fall through to pre-57B path. NOT added to `PILOT_RUNTIME_KINDS`. |
| `artifacts/api-server/src/lib/envelopeGrade.test.ts` | +6 tests: dark BC (structured/mismatching/stdout/null-config) + future opted-in pass/fail/stdout-fail-closed. (28 total in file.) |
| `artifacts/atlas/src/lib/csvSetEqualSubmit.ts` | NEW pure helper: `raw` (legacy) \| `csv_set_equal` (JSON `{columns,rows}`) \| `needs-run`. |
| `artifacts/atlas/src/lib/csvSetEqualSubmit.test.ts` | NEW 9 unit tests (dark/raw verbatim, JSON contract, needs-run, zero-row, cell types). |
| `artifacts/atlas/src/components/studio/types.ts` | `StepVM.serverGrade?: boolean`. |
| `artifacts/atlas/src/lib/envelopeClient.ts` | Extracted shared `normalizeSqlRows` (used by `buildSqlCapture` AND the capture stash). |
| `artifacts/atlas/src/pages/project-workspace.tsx` | Per-step `capturedSqlByStepId` (run-gen guarded, normalized); cleared at all 5 envelope-clear sites; Check+Submit routed through helper with `needs-run` handling + `isSqlStep` gate. |
| `scripts/src/audit-csv-set-equal-bc.ts` | Extended to prove BC on BOTH `gradeSubmission` and `gradeEnvelopeCapture` paths (structured + stdout + deliberately-mismatching captures). |

Lockfile note: an interim `pnpm install` (run on Node 22 to obtain `node_modules` for gate
execution) clobbered `pnpm-lock.yaml`'s `overrides:` block; reverted in `ff5f9d9`. Proper
lockfile reconciliation is Phase 0.x on Node 24.

## 2. Zero rows opted in ✅
No authored project sets `spec.serverGrade: true`. The audit's defensive `serverGrade === true`
warning was not triggered. No DB row mutated; no seed run.

## 3. Visible `csv_set_equal` behavior byte-identical ✅
`serverGrade` is false for every visible row, so the FE helper returns `{kind:"raw"}` with the
submission verbatim (`isCodeStep ? code : textAnswer`) and the pre-57B empty-input messages are
preserved. The envelope branch returns the legacy `{passed:true,"Step completed."}` auto-pass for
non-opted rows on both structured and stdout captures (`gradeCsvSetEqual` short-circuits on
`serverGrade !== true` before any parse/compare). Architect verified byte-identity vs `6c26cd2`.

## 4. `serverGrade` exposes only a boolean ✅
`deriveServerGrade(validationType, validationConfig)` returns a `boolean`. No `validationConfig`,
`spec`, `expectedRows`, `expectedRowsHash`, fixture paths, or answer keys cross to the client.
Type-gated to `csv_set_equal` so no unrelated kind can surface a signal. (`expectedOutput` was
already shipped pre-57B and is not the csv answer key.)

## 5. Stale captures cannot be used after edit / nav / reset / history restore ✅
`clearCapturedSqlForStep` is called at all 5 sites `clearEnvelopeForStep` is (run-start, edit,
reset, history-restore, `goToStep`), and the stash is guarded by the per-step run-generation
counter (`currentRunGen === runGenAtStart`) so an in-flight run that was superseded cannot
re-stash old rows. Per-step keying prevents cross-step leakage.

## 6. OpenAPI / Orval regeneration — NOT required ✅ (documented)
The OpenAPI `ProjectStep` schema already omits the route-only sibling fields (`hasPedagogy`,
`requiredSkill`, `learningObjective` are returned by the route but absent from the spec), and the
FE consumes steps via the hand-maintained `StepVM` (`project.steps as any`). `serverGrade` follows
that exact precedent. Orval client deserializes via `response.json()` (no Zod stripping), so the
field flows through untyped. Adding it to the spec + regen is deferred to the 57B-flip for
type-honesty (harmless to defer; avoids unrelated codegen churn now).

## 7. Final gate results
| Gate | Result |
|---|---|
| `pnpm run typecheck` (4 projects) | **PASS** |
| `check:no-heuristic-runtime` | **OK** |
| atlas vitest | **159/159 PASS** |
| api-server vitest | **440 PASS** (incl. `envelopeGrade` 28/28) |
| execution-core vitest | **83/83 PASS** |
| curriculum-quality vitest | 132 PASS / **1 env-fail** (`COURSE_TAXONOMY` reads gitignored `.local/course-skill-maps.md` — not touched by this phase) |
| `csvSetEqualSubmit.test.ts` (isolated) | **9/9 PASS** |
| `audit:authoring`, `audit:csv-set-equal-bc`, `audit:contains-bc` | **NOT RUN** — DB-gated (`DATABASE_URL` unset locally). Code extended + structurally verified by reviewers; must run green on Node 24 + Neon before the flip. |
| `envelopeSubmit.test.ts` suite | **NOT RUN** — imports `@workspace/db` which throws without `DATABASE_URL` (env, not this phase). |

Toolchain caveat: gates ran on **Node 22** (`node_modules` installed locally; Node 24 not available
on this machine). Sufficient for typecheck/vitest; the **flip** still requires a true Node-24
local-green baseline.

## 8. Remaining blocker before 57B-flip
**Local DuckDB-WASM execution verification of the C2 step-3 expected rows**
(`analytics-engineer__semantic-layer-with-dbt-and-duckdb`): the authored `expectedRows` must be
byte-verified against real DuckDB-WASM output (numeric-type fidelity + fixture row-set, 57C §7).
Requires Node 24 + `pnpm install` + a DB, plus the DB-gated audits run green. The flip is correctly
gated on Phase 0.x local-green.

---

## Deferred review findings (P2 — not blocking, fix at/before flip)
- **popstate lifecycle gap** (`project-workspace.tsx` onPopState): browser back/forward bypasses
  `goToStep`, so capture/run-gen aren't cleared. **Shared with the pre-existing Phase-49 envelope
  gap**; safe today (dark + per-step keying; Atlas uses `replaceState` only, so within-workspace
  popstate step-changes are practically unreachable). Fix before flip by routing onPopState through
  the same clear+bump as `goToStep` (touches Phase-49 envelope code — deferred deliberately).
- **`needs-run` uses the `*_FAIL` (red) transition**: client-only, no server mutation, unreachable
  today. Owner UX decision before flip: keep failed-state styling vs a neutral "run first" hint
  (would add a reducer state — out of prereq scope).
