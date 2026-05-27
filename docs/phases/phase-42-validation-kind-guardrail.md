# Phase 42 — Validation Kind Reality Check + Authoring Guardrail

**Type:** schema-free, audit + docs hardening pass. No DB writes, no schema changes, no runtime grader edits.
**Ship date:** May 27, 2026.
**Goal:** make Atlas's validation-kind story explicit, honest, and mechanically guarded before scaling new project production.

## Why

Phase 41's architect review flagged that several validation kinds (`json_equal`, `numeric_tolerance`, `sql_resultset`, `csv_set_equal`, `csv_ordered`) don't actually have a server-side grading branch in `artifacts/api-server/src/lib/grading.ts` (`gradeSubmission`) — anything outside `self_attest` / `exact` / `contains` / `regex` falls through to a generic auto-pass. The Phase 41 ship verified this was a platform-wide Phase 7+ convention (53 of ~58 visible publish-ready authored projects already do it), not a regression, and held the position. The natural next-phase question was: formalize the convention so authors and reviewers cannot misunderstand it, OR close the runner gap. Phase 42 picks the first half (formalization) because it's the schema-free move and a prerequisite to either path.

## Read-only audit (live numbers)

Run `pnpm --filter @workspace/scripts run audit:authoring`. The new "Validation enforcement breakdown" section reports:

- **288 total steps** across 58 visible projects.
- **43 (15%) enforced** — server commit-grader evaluates submission.
  - 21 × `contains` · 16 × `exact` · 6 × `self_attest` · 0 × `regex` (no authored project uses `regex` today).
- **35 (12%) client-provisional** — client `validateExpected` gives accurate Run feedback for SQL steps with structured `expectedOutputs.rows`; server commit-grader auto-passes.
  - 21 × `sql_resultset` · 14 × `csv_set_equal` · 0 × `csv_ordered`.
- **210 (73%) contract-shaped** — no runtime grader anywhere; `expectedOutputs` exists as a contract for human reviewers + local reproduction (`docker-compose up`).
  - 174 × `json_equal` · 36 × `numeric_tolerance`.
- **0 (0%) unknown** — no typo'd kinds in the catalog.
- 21 / 58 visible projects have ≥1 server-enforced step (informational; the spec's actual floor is "not all self_attest", which the pre-existing `all-steps-self-attest` finding still catches).

## What shipped

### A. Pure classifier helper + tests

**New:** `lib/curriculum-quality/src/validationEnforcement.ts` (~80 LOC, 4 exports):

- `ENFORCEMENT_VALIDATION_KINDS` — frozen 9-string list mirroring the DB enum (`lib/db/src/schema/enums.ts` → `validationTypeEnum`: `exact`, `regex`, `contains`, `numeric_tolerance`, `csv_set_equal`, `csv_ordered`, `json_equal`, `sql_resultset`, `self_attest`). Named `ENFORCEMENT_*` (not `VALIDATION_*`) to avoid colliding with the existing `ValidationKind` union exported from `./authoring.ts` — that union is the authoring-side surface and is deliberately decoupled from this enforcement-focused surface. (Architect-flagged Phase 42 correction round: the initial helper omitted `csv_ordered` and was incorrectly described as 8-string; the DB enum has always been 9.)
- `type EnforcementStatus = 'enforced' | 'client-provisional' | 'contract-shaped' | 'unknown'`.
- `classifyValidationKind(kind: string|null|undefined): EnforcementStatus` — tolerant of nullish, returns `'unknown'` for unrecognized strings, never throws.
- `describeEnforcement(status)` — human one-liner for the audit summary lines.
- `tallyValidationKinds(kinds[])` — count + status per kind, preserves unknown values verbatim so operators can grep typos.

**Tests:** `lib/curriculum-quality/src/validationEnforcement.test.ts` (15 cases, 4 describes). Asserts the 4 enforced kinds, the 3 client-provisional kinds (including `csv_ordered`), the 2 contract-shaped kinds, nullish/unknown handling (case-sensitive), every kind in `ENFORCEMENT_VALIDATION_KINDS` is covered, tally semantics, `(null)` bucket, unknown-verbatim, empty-input.

Exported via `lib/curriculum-quality/src/index.ts` barrel.

Design choice: the classifier encodes the rules but does NOT duplicate the grader's switch — it references `lib/grading.ts` + `lib/execution-core/src/validate.ts` in module-level docstrings as the source of truth. If `gradeSubmission` ever adds a real arm for `json_equal`, this helper's table needs a one-line flip and a test update; the comment chain calls that out.

### B. Audit guardrail (informational only — preserves 58/58)

**Modified:** `scripts/src/audit-project-authoring.ts`. New imports from `@workspace/curriculum-quality`; `ProjectReport.validationTypes: Array<string|null>` collected during `auditProject`; new "Validation enforcement breakdown" section appended to the `main()` summary print. **No new `ProjectFinding` variant** — this is informational, deliberately does NOT toggle `publishReady`, and 58/58 stays intact.

The breakdown prints:

1. Total visible-project steps.
2. Per-status totals + percentages for `enforced` / `client-provisional` / `contract-shaped` / `unknown`.
3. Visible-project count with ≥1 server-enforced step (informational, not a gate — labeled inline so a future operator doesn't misread it as a §5.1 invariant).
4. Per-kind histogram with `[status]` tag, sorted by count.
5. WARNING line listing any `unknown` kinds with counts (silent when count = 0, which it is today).

Footer note now points at both the authoring spec AND the new `docs/validation-kind-matrix.md`.

### C. Validation Kind Matrix doc

**New:** `docs/validation-kind-matrix.md`. The authoritative cross-reference: per-kind row covering enforcement status, server behavior, client behavior, learner-facing risk, allowed authoring use, and recommended future action. Includes:

- TL;DR explaining why ~85% of authored steps are not server-enforced today (Pyodide runner cannot stand up Postgres/Kafka/Spark).
- Why "client-provisional" deserves its own row (learner gets accurate Run UI feedback but Submit auto-passes; matrix MUST distinguish from genuinely enforced).
- When the convention IS a problem (missing `expectedOutputs` on a contract-shaped step; typo'd kind).
- Honesty rules mirrored from spec §5.1.
- Two Phase 43+ shapes: implement `json_equal` + `numeric_tolerance` in the server grader (would migrate 210 of 288 steps from contract-shaped → enforced in one commit); implement `sql_resultset` + `csv_set_equal` on the server via a signed RunResult round-trip.

### D. Spec update

**Modified:** `docs/project-authoring-spec.md` §5.1. Added "Enforcement reality (Phase 42)" subsection with the three-tier table + "Choosing a kind" guidance (single-string → `contains`, SQL tabular → `sql_resultset`/`csv_set_equal`/`csv_ordered`-with-orderSensitive, Python structured → `json_equal`/`numeric_tolerance`, reflection → `self_attest`) + "Honesty rules" (no silent overclaiming; deterministic `expectedOutputs` holds for every tier; DB enum rejects unknowns at insert; the classifier's `'unknown'` bucket is defense-in-depth).

### E. Phase 41 follow-up note

**Modified:** `docs/phases/phase-41-seed-factory-pilot.md`. Appended a "Phase 42 follow-up (added retroactively)" pointer explaining the architect's flagged risk is now formalized in the matrix + audit + spec.

## Gates run

| Gate | Result |
| ---- | ------ |
| typecheck (full repo)              | ✓ |
| check:no-heuristic-runtime         | ✓ |
| curriculum-quality tests           | ✓ 80/80 (+15 new — was 65) |
| execution-core tests               | ✓ 34/34 |
| api-server tests                   | ✓ 280/280 |
| atlas tests                        | ✓ 102/102 |
| audit:authoring                    | ✓ 58/58 visible publish-ready (UNCHANGED — guardrail is informational) |
| audit:pedagogy                     | ✓ 58/58 visible fully enriched (UNCHANGED) |

## Files changed

- `lib/curriculum-quality/src/validationEnforcement.ts` (new)
- `lib/curriculum-quality/src/validationEnforcement.test.ts` (new)
- `lib/curriculum-quality/src/index.ts` (barrel +1)
- `scripts/src/audit-project-authoring.ts` (+~50 LOC summary section; no behavior change to publishReady)
- `docs/validation-kind-matrix.md` (new)
- `docs/project-authoring-spec.md` (§5.1 expanded)
- `docs/phases/phase-41-seed-factory-pilot.md` (retroactive pointer note)
- `docs/phases/phase-42-validation-kind-guardrail.md` (new — this doc)
- `docs/phases/INDEX.md` (+1 entry)
- `HANDOFF.md` (rewritten for Phase 42 close)
- `replit.md` (Phase History prepend)

## Hard stops respected

No schema changes. No migrations. No production DB touch. No deployment. No `/check` or `/submit` rewrite. No `lib/grading.ts` rewrite. No frontend redesign. No project mass edits. No project seeding. No cert-verify changes. No portfolio changes. No billing/Stripe changes. No OpenAPI/codegen changes. No existing project failed (publishReady stays 58/58). No claim that contract-shaped validation is fully machine-enforced.

## Remaining validation risks

1. **210 of 288 visible steps still auto-pass at commit time.** The matrix + audit make this transparent but don't fix it. Closing the gap is a Phase 43+ candidate (Shape A in `docs/validation-kind-matrix.md`).
2. **`csv_ordered` is in the DB enum + authoring union + classifier, but no authored project uses it today** (Phase 42 audit confirmed: 0 occurrences across 288 visible steps). Available for SQL ORDER BY-style tests.
3. **No CI gate fails on unknown kinds.** The audit prints a WARNING, but `audit:authoring` exits 0 always (by Phase 35 design). The DB enum is the actual hard gate; the audit's WARNING is operator-facing only. Acceptable today because count = 0; reconsider if we ever see > 0.
4. **Helper is per-process pure logic only.** No persistence; if grading.ts adds a real arm for `json_equal`, the helper's table must be hand-flipped + a test updated. Comment chain calls this out at the helper, the matrix, and the spec.
5. **Phase 42 did not unit-test the audit's new summary block** (the classifier is unit-tested, the audit consumes it). Mirrors Phase 35 precedent — `@workspace/scripts` doesn't run vitest, the pure logic lives in `@workspace/curriculum-quality`.

## Recommended Phase 43

Three cleanly-separable shapes; pick one (not all):

- **Shape A — Real server graders for `json_equal` + `numeric_tolerance`.** ~30 lines in `lib/grading.ts`: `JSON.parse(submission)` + `deepEquals(expected, parsed)` for `json_equal`; per-key tolerance for `numeric_tolerance`. Migrates ~210 of 288 steps from contract-shaped → enforced. Needs new `user-submit.test.ts` cases for both kinds. **Highest leverage.**
- **Shape B — Server-side `sql_resultset` / `csv_set_equal` via signed RunResult round-trip.** Client ships the RunResult (rows + columns), server signs it on Run, verifies signature on Submit, re-runs `validateExpected`. ~50 lines + a payload signature. Closes the forge-a-passing-payload gap.
- **Shape C — `replit.md` trim.** Move Phase History from `replit.md` into `INDEX.md` (already mirrored), keep latest 3 inline. Cheap; meaningfully reduces per-turn context cost (system has been flagging it for several phases).

## Commit

`phase-42: validation kind matrix + audit enforcement breakdown`
