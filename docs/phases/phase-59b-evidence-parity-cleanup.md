# Phase 59B — evidence-parity cleanup + deferred-P2 closure (close-out)

**Status:** SHIPPED. A cleanup phase: closed the deferred Phase 58A/58B/59A evidence-related P2s,
strengthened evidence/parity tests, re-verified the two live server-graded rows. **No grading / route /
schema behavior change** — the only runtime-adjacent change is reporting (audit) + tests + comments.
No new opt-ins/flips, envelope enforcement OFF, Phase 52 untouched.

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer` → SHIP**, no P0/P1. Both
verified the new classifier cannot produce a false `enforced` upgrade (it reads the SAME persisted
`spec.serverGrade === true` field the runtime grader gates on) and that the new tests are non-vacuous.

---

## 1. Deferred-P2 review result

| Deferred item | Decision | Detail |
| --- | --- | --- |
| `/submit` completed-transition not in the 59A parity file | **FIXED** | Added completed-transition + idempotent-re-submit tests for a server-graded row to `user-check-submit-parity.test.ts`. |
| `audit:authoring` mislabels server-graded rowset kinds `client-provisional` (R1 from 58A/58B) | **FIXED** | New serverGrade-aware classifier; the 2 opted-in rows now report `enforced`. |
| OpenAPI `serverGrade` description polish | **DEFERRED (rationale)** | Embedded in openapi.yaml + 3 generated files. Updating needs an orval regen (known ~95-file CRLF churn) or hand-editing 3 generated files (norm violation + drift). Current text ("an opted-in SQL step…") is accurate/not-misleading. Ride the next legitimate orval regen. |
| Stale evidence-contract wording (57B–59A) | **FIXED** | Comment-only fixes in `audit-csv-set-equal-bc.ts`, `audit-sql-resultset-bc.ts`, `authored-lineage.ts`; cross-reference comment added to `deriveServerGrade`. |
| `.gitattributes` EOL-normalize for test/script files (code-review P2-b) | **DEFERRED** | Pre-existing cross-cutting follow-up (already tracked); out of this cleanup phase's scope. |

## 2. Files changed

- `lib/curriculum-quality/src/validationEnforcement.ts` — **NEW pure helpers** (reporting only): `isServerGradedRowset(kind, validationConfig)`, `classifyValidationKindWithSpec(kind, validationConfig)` (upgrades an opted-in `csv_set_equal`/`sql_resultset` row to `enforced`; identical to `classifyValidationKind` for everything else), `tallyValidationKindsWithSpec(entries)` (buckets opted-in rowset rows under `"<kind> (server-graded)"` with status `enforced`). Static `STATUS_BY_KIND` / `classifyValidationKind` UNCHANGED.
- `scripts/src/audit-project-authoring.ts` — wired the spec-aware tally into the enforcement breakdown + per-kind histogram + `projectsWithAnyEnforced`; added `validationKindSpecs` (kind + validationConfig per step) to the report; dropped the now-unused `classifyValidationKind` import.
- `lib/curriculum-quality/src/validationEnforcement.test.ts` — tests for the 3 new helpers (true/false matrix incl. non-boolean serverGrade, non-rowset kinds, malformed config; split-bucket tally).
- `artifacts/api-server/src/routes/user-check-submit-parity.test.ts` — added `/submit` completed-transition (project complete + email once) + idempotent re-submit (no double XP/ledger; monotonic passed; evidence not overwritten) for a server-graded row.
- `artifacts/api-server/src/routes/projects.ts` — **comment-only** cross-reference in `deriveServerGrade` → `isServerGradedRowset` (drift-prevention; the two packages are decoupled).
- `scripts/src/audit-csv-set-equal-bc.ts`, `scripts/src/audit-sql-resultset-bc.ts`, `scripts/src/authored-lineage.ts` — **comment-only** stale-wording fixes.
- `docs/phases/phase-59b-evidence-parity-cleanup.md` (this), `.agentic/progress.md`. Excluded (hook-managed): `.agentic/self-review.log`, `HANDOFF.md`.

**Confirmed NOT in the diff:** `grading.ts`, `envelopeGrade.ts`, `user.ts`, `lib/db`, `lib/api-spec`, generated codegen, schema/migrations.

## 3. Implementation details

The classifier change is the substance. `isServerGradedRowset` is logically identical to the authoritative
`deriveServerGrade` (routes/projects.ts): same kind gate (`csv_set_equal | sql_resultset`), same null/object
guards, same strict `serverGrade === true`. So the audit's `enforced` label corresponds exactly to the rows
the server actually commit-grades — no drift, no false-enforced upgrade. The audit histogram now splits a
mixed kind into `<kind>` (dark, client-provisional) + `<kind> (server-graded)` (enforced); totals still sum
to the step count.

## 4. Live-row re-verification result

`audit:sql-resultset-bc` (C2 step 2) and `audit:csv-set-equal-bc` (C2 step 3) re-run PASS: correct
`{columns,rows}` passes; raw SQL / malformed JSON / wrong columns / missing row / extra unmatched row / wrong
row value all fail closed; non-opted rows BC. (The route-level parity behavior is additionally pinned by the
expanded `user-check-submit-parity.test.ts`.)

## 5. Evidence / parity test result

- `validationEnforcement.test.ts`: +3 describe blocks (isServerGradedRowset, classifyValidationKindWithSpec,
  tallyValidationKindsWithSpec) — green.
- `user-check-submit-parity.test.ts`: now also pins `/submit` completed-transition + idempotency for a
  server-graded row (closing the 59A-deferred gap). The db.transaction mock drives the real completion/XP
  path (reviewer mutation-confirmed non-vacuous).

## 6. No-leak verification result

Unchanged from 59A and re-confirmed: neither `/check` nor `/submit` exposes `validationConfig`/`spec`/
`expectedRows`/`expectedRowsHash`/the reference query, on PASS or FAIL. No route response shaping changed
this phase.

## 7. Integration limitation statement

Full app UI boot remains **blocked by Phase 0.2** (Replit connector coupling). Best verified integration
paths: (a) browser DuckDB-WASM adapter capture → live route grader (Phase 58B), (b) route-level supertest
parity tests against the real `/check` + `/submit` handlers (Phases 59A/59B). No full-app E2E.

## 8. Independent reviews

- **architect: PASS** — classifier correctness (no false-enforced), no behavior change, audit totals
  conserved, tests non-vacuous, invariants intact. P2s: DB-gate reproducibility (env — ran green on Docker
  PG); OpenAPI deferral concurred.
- **code-reviewer: SHIP** — `isServerGradedRowset` logically byte-identical to `deriveServerGrade`; both new
  `/submit` tests traced through real route code; audit totals conserved; scope clean. P2-a (4-copy opt-in
  predicate drift) → **FIXED** (cross-reference comment). P2-b (`.gitattributes` for test/script files) →
  **DEFERRED** (separate tracked follow-up).

## 9. Tests & gates (Node 24 + Docker PG :5434)

typecheck + check:no-heuristic-runtime **PASS** · api-server **526/526** (+2) · curriculum-quality
**152/153** (+9; only failure = env-only `COURSE_TAXONOMY` ENOENT) · `audit:authoring` exit 0
(**97% enforced / 3% client-provisional**; histogram: `sql_resultset (server-graded) [enforced]` +
`csv_set_equal (server-graded) [enforced]`) · `audit:sql-resultset-bc` PASS (3 dark + 1 opted-in) ·
`audit:csv-set-equal-bc` PASS · `audit:contains-bc` 3/3. serverGrade counts csv:1 / sql:1.

## 10. Final invariants (confirmed)

Exactly 1 `csv_set_equal` + 1 `sql_resultset` opted in (unchanged); no new validation rows flipped; no new
validation kinds enabled; no envelope enforcement; Phase 52 untouched; C2 visible+approved; no schema/env/
canary/production/cloud/portfolio/GitHub/cert-marketing change. `RUBRIC_VERSION` frozen. Phase 60 not started.

## 11. Remaining risks / next

- Deferred: OpenAPI `serverGrade` description (ride next orval regen); `.gitattributes` EOL normalization for
  generated + test + script files.
- Observe the live opted-in rows in a real env before any new opt-in.
- **Phase 60** (portfolio / GitHub artifact, E2) is next — **owner approval required; not started.**
