# HANDOFF

**Latest shipped phase:** Phase 42 — Validation Kind Reality Check + Authoring Guardrail.
**Working tree:** clean after `phase-42: validation kind matrix + audit enforcement breakdown`.
**Parent commit:** `96ac321` (Phase 41 close).

---

## Phase 42 summary

Schema-free, audit + docs hardening pass that closes the architect's Phase 41 validation-kind finding by making the platform's enforcement story explicit and mechanically guarded, instead of silently relying on a fall-through auto-pass in the server commit-grader.

**The problem (carried over from Phase 41 architect review).** Of the 9 strings in the `validation_type` DB enum, only 4 (`self_attest`, `exact`, `contains`, `regex`) have a real switch arm in `artifacts/api-server/src/lib/grading.ts` → `gradeSubmission`. The other 5 (`json_equal`, `numeric_tolerance`, `sql_resultset`, `csv_set_equal`, `csv_ordered`) fall through to a generic `{ passed: true, feedback: "Step completed." }` at commit time. Phase 41 verified this was a platform-wide Phase 7+ convention, not a regression, but the architect's recommendation stood: either close the runner gap, or formalize the convention so authors and reviewers can't misunderstand it.

**The shape that shipped.** Formalization (schema-free) — runner gap closure is reserved for a future Phase 43 (Shape A in `docs/validation-kind-matrix.md`).

### What landed

1. **New pure classifier helper** `lib/curriculum-quality/src/validationEnforcement.ts` + 15 unit tests. Four exports: `ENFORCEMENT_VALIDATION_KINDS` (frozen 9-string list mirroring the DB enum), `classifyValidationKind(kind) → 'enforced' | 'client-provisional' | 'contract-shaped' | 'unknown'`, `describeEnforcement(status)`, `tallyValidationKinds(kinds[])`. Named `ENFORCEMENT_*` (not `VALIDATION_*`) to avoid colliding with the pre-existing `ValidationKind` union exported from `./authoring.ts` — the two are deliberately decoupled (enforcement surface vs authoring surface). The `Record<EnforcementValidationKind, EnforcementStatus>` type guarantees the array + `STATUS_BY_KIND` table change together (typecheck error, not silent drift).

2. **Audit guardrail (informational only)** in `scripts/src/audit-project-authoring.ts`. New `ProjectReport.validationTypes` field, new "Validation enforcement breakdown" summary section after the existing per-finding histogram. **No new `ProjectFinding` variant — `publishReady` is unchanged.** Section reports total visible-project steps, per-status totals + percentages, ≥1-server-enforced-step project count (labeled inline as informational so a future operator doesn't misread it as the spec's §5.1 floor — which is actually "not all self_attest", still caught by `all-steps-self-attest`), per-kind histogram with `[status]` tag, and a WARNING line for any `'unknown'` kinds (silent when count = 0, which it is today).

3. **Validation Kind Matrix** `docs/validation-kind-matrix.md` — authoritative per-kind reference (enforcement status / server behavior / client behavior / learner-facing risk / allowed authoring use / recommended future action) + TL;DR explaining why ~85% of steps are not server-enforced today (Pyodide can't stand up Postgres/Kafka/Spark) + why "client-provisional" deserves its own row (UI tells the truth, Submit auto-passes) + honesty rules + two Phase 43+ shapes.

4. **Spec update** `docs/project-authoring-spec.md` §5.1 — new "Enforcement reality (Phase 42)" subsection with three-tier table + "Choosing a kind" decision guide + "Honesty rules" (no silent overclaiming; deterministic `expectedOutputs` holds for every tier; classifier's `'unknown'` bucket is defense-in-depth).

5. **Phase 41 retroactive pointer** in `docs/phases/phase-41-seed-factory-pilot.md` so the next operator can trace the architect-flagged risk to its Phase 42 resolution.

### Live numbers (`audit:authoring` after Phase 42)

- **288 visible-project steps total** across 58 visible projects.
- **43 (15%) enforced** — 21 × contains · 16 × exact · 6 × self_attest · 0 × regex.
- **35 (12%) client-provisional** — 21 × sql_resultset · 14 × csv_set_equal · 0 × csv_ordered.
- **210 (73%) contract-shaped** — 174 × json_equal · 36 × numeric_tolerance.
- **0 (0%) unknown.**
- 21 of 58 visible projects have ≥1 server-enforced step (informational).

### Hard stops respected

No schema changes. No migrations. No production DB touch. No deployment. No `/check`/`/submit`/`grading.ts` rewrite. No frontend redesign. No project mass edits. No project seeding. No cert-verify changes. No portfolio changes. No billing/Stripe changes. No OpenAPI/codegen changes. No rubric/taxonomy/anchor/pedagogy edits. No existing project failed; `publishReady` count is byte-identical to Phase 41.

### Gates

| Gate | Result |
| ---- | ------ |
| typecheck (full repo)    | ✓ |
| check:no-heuristic-runtime | ✓ |
| curriculum-quality tests | ✓ 80 / 80 (+15 new — was 65) |
| execution-core tests     | ✓ 34 / 34 |
| api-server tests         | ✓ 280 / 280 |
| atlas tests              | ✓ 102 / 102 |
| audit:authoring          | ✓ 58 / 58 visible publish-ready (UNCHANGED) |
| audit:pedagogy           | ✓ 58 / 58 visible fully enriched (UNCHANGED) |

### Files changed

- `lib/curriculum-quality/src/validationEnforcement.ts` (new)
- `lib/curriculum-quality/src/validationEnforcement.test.ts` (new)
- `lib/curriculum-quality/src/index.ts` (+1 barrel re-export)
- `scripts/src/audit-project-authoring.ts` (+1 import group, +1 field on `ProjectReport`, +~50 LOC summary section)
- `docs/validation-kind-matrix.md` (new)
- `docs/project-authoring-spec.md` (§5.1 expanded)
- `docs/phases/phase-41-seed-factory-pilot.md` (retroactive pointer)
- `docs/phases/phase-42-validation-kind-guardrail.md` (new — phase close-out)
- `docs/phases/INDEX.md` (+1 entry)
- `HANDOFF.md` (this file)
- `replit.md` (Phase History prepend)

### Remaining validation risks

1. **210 of 288 steps still auto-pass at commit time.** Matrix + audit make this transparent; closing the gap is Phase 43+ (Shape A below).
2. **`csv_ordered` is fully supported (DB enum + classifier + matrix + spec) but 0 authored projects use it today.** Available for SQL ORDER BY-style tests when an author needs strict row-order semantics. (Architect-flagged Phase 42 correction: initial helper omitted it; fixed in this same phase.)
3. **Audit exits 0 on unknown kinds.** Phase 35 design (reporting tool, not CI gate). DB enum is the actual hard gate at insert. Acceptable today because count = 0.
4. **If `gradeSubmission` ever adds an arm for `json_equal` / `sql_resultset`,** the classifier's `STATUS_BY_KIND` table must be hand-flipped + a test updated. Comment chains in the helper + matrix + spec call this out.

### Recommended Phase 43 (pick one)

- **Shape A — Real server graders for `json_equal` + `numeric_tolerance`** in `lib/grading.ts` (~30 LOC). Migrates ~210 of 288 steps from contract-shaped → enforced in one commit. Needs new `user-submit.test.ts` cases. **Highest leverage.**
- **Shape B — Server-side `sql_resultset` / `csv_set_equal` via signed RunResult round-trip.** Client ships RunResult, server signs on Run, verifies + re-runs `validateExpected` on Submit. ~50 LOC + signature. Closes forge-a-passing-payload gap.
- **Shape C — Trim `replit.md` Phase History to INDEX-only** (system has flagged the file as oversized for several phases; cheap; meaningfully reduces per-turn context cost).

### Commit

`phase-42: validation kind matrix + audit enforcement breakdown`
