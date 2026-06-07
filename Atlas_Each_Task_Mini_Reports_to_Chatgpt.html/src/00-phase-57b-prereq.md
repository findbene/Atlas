# Phase 57B-prereq — csv_set_equal staged-hybrid foundation (DARK)
META: 2026-06-06 · SHIPPED (dark) · architect PASS + code-review SHIP-ready

> Compiled from the phase close-out (`docs/phases/phase-57b-prereq-csv-set-equal-foundation.md`). This task predates the 12-section mini-report standard, so it is rendered in its original 8-item close-out shape.

Built the FE submission-shape + server envelope plumbing for server-graded `csv_set_equal`, **without opting in any row and without enabling envelope enforcement**. Implements Option C (staged hybrid, provenance-biased) from the 57C trust decision. Commits `3e6dc8b` → `ff5f9d9` (lockfile restore) → `3cc3187` (review P2 fixes), pushed to `main`.

## 1. Files changed (8 source files)
| File | Change |
|---|---|
| `artifacts/api-server/src/routes/projects.ts` | `deriveServerGrade()` helper + `serverGrade` boolean on GET `/projects/:slug` step serialization. Narrow boolean only. |
| `artifacts/api-server/src/lib/envelopeGrade.ts` | DARK `csv_set_equal` branch: verified `{columns,rows}` → same `gradeSubmission`→`gradeCsvSetEqual` comparator; stdout-only captures fall through. NOT in `PILOT_RUNTIME_KINDS`. |
| `artifacts/api-server/src/lib/envelopeGrade.test.ts` | +6 tests (28 total). |
| `artifacts/atlas/src/lib/csvSetEqualSubmit.ts` | NEW pure helper: `raw` \| `csv_set_equal` \| `needs-run`. |
| `artifacts/atlas/src/lib/csvSetEqualSubmit.test.ts` | NEW 9 unit tests. |
| `artifacts/atlas/src/components/studio/types.ts` | `StepVM.serverGrade?: boolean`. |
| `artifacts/atlas/src/lib/envelopeClient.ts` | Extracted shared `normalizeSqlRows`. |
| `artifacts/atlas/src/pages/project-workspace.tsx` | Per-step `capturedSqlByStepId` (run-gen guarded, normalized); cleared at all 5 envelope-clear sites; Check+Submit routed through helper with `needs-run` + `isSqlStep` gate. |
| `scripts/src/audit-csv-set-equal-bc.ts` | Extended to prove BC on BOTH `gradeSubmission` and `gradeEnvelopeCapture` paths. |

## 2. Zero rows opted in
No authored project sets `spec.serverGrade: true`. No DB row mutated; no seed run.

## 3. Visible csv_set_equal behavior byte-identical
`serverGrade` false for every visible row → FE returns `{kind:"raw"}` verbatim; envelope branch returns the legacy `{passed:true,"Step completed."}` auto-pass for non-opted rows. Architect verified byte-identity vs `6c26cd2`.

## 4. serverGrade exposes only a boolean
`deriveServerGrade()` returns a `boolean`, type-gated to `csv_set_equal`. No spec / expectedRows / fixture paths / answer keys cross to the client.

## 5. Stale captures cannot be reused
`clearCapturedSqlForStep` at all 5 sites (run-start, edit, reset, history-restore, `goToStep`) + per-step run-generation guard + per-step keying.

## 6. OpenAPI / Orval — NOT required (deferred to flip)
Follows the route-only precedent (`hasPedagogy` etc. are returned but absent from the spec; FE reads via `StepVM`). Adding to the spec deferred to 57B-flip for type-honesty.

## 7. Gate results
typecheck **PASS** · check:no-heuristic-runtime **OK** · atlas **159/159** · api-server **440** (envelopeGrade 28/28) · execution-core **83/83** · csvSetEqualSubmit **9/9**. Ran on Node 22. DB-gated audits NOT RUN (no `DATABASE_URL`).

## 8. Remaining blocker before 57B-flip
Local DuckDB-WASM execution verification of the C2 step-3 expectedRows — requires Node 24 + `pnpm install` + DB. Flip correctly gated on Phase 0.x local-green.

**Deferred P2s (to flip):** popstate lifecycle gap (shared w/ Phase-49 envelope; safe via per-step keying + replaceState-only nav); `needs-run` uses red `*_FAIL` styling (owner UX call).
