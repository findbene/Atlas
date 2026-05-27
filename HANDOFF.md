# HANDOFF

**Latest shipped phase:** Phase 43B-prime — `json_equal` Submission-Shape Audit Warning (Shape β).
**Working tree:** clean after `phase-43b-prime: json_equal submission-shape audit warning + spec-shape outlier advisory`.
**Parent commit:** `3e84ede` (Phase 43B read-only audit) → `78d9cc1` (Phase 43A compaction) → `84f733c` (Phase 42 close).

---

## Phase 43B-prime summary

Conservative, audit-warning-only response to the Phase 43B pre-implementation finding that the Phase-42 "Recommended Phase 43 / Shape A" estimate (a "~30 LOC `JSON.parse(submission) deepEquals expectedOutputs`" arm in `lib/grading.ts`) would in fact silently misclassify all 174 visible `json_equal` steps + all 36 `numeric_tolerance` steps, because the `submission` payload the server receives for every one of them is the learner's **Python source code**, not a JSON value.

**Architect-stop on Shape A.** User picked **Shape β** = ship the per-step audit advisory + documentation now, defer real enforcement to a properly scoped Phase 44 / Shape γ (signed RunResult round-trip) which is the only honest fix.

### What landed

1. **Helpers** in `lib/curriculum-quality/src/validationEnforcement.ts` — 4 new exports + 13 new assertions (curriculum-quality test count 80 → 93):
   - `NON_TEXT_SUBMISSION_STEP_TYPES` — readonly tuple `['code_python', 'code_sql', 'multi_file'] as const` (with companion `NonTextSubmissionStepType` derived via `(typeof …)[number]`), mirrors frontend `CODE_STEP_TYPES` + multi-file blob shape.
   - `jsonEqualHasSubmissionShapeMismatch(validationType, stepType) → boolean`.
   - `LEGACY_JSON_EQUAL_SPEC_KEYS: readonly ['stdoutMustEqualJson', 'stdoutMustContainShape']`.
   - `detectLegacyJsonEqualSpecKeys(validationConfig) → readonly LegacyJsonEqualSpecKey[]`.

2. **Audit advisories** in `scripts/src/audit-project-authoring.ts` — two new informational categories on `ProjectReport` (`jsonEqualSubmissionShapeAdvisories`, `validationSpecShapeAdvisories`), populated inside the existing per-step loop. New "Authoring advisories" summary section reports per-category step + project counts and lists the affected projects under the legacy-spec-key category. **NOT added to `ProjectFinding`. NOT part of `publishReady`.** `58/58` byte-identical.

3. **Documentation**:
   - `docs/validation-kind-matrix.md` — old "Future actions" section rewritten as "Submission-shape blocker (Phase 43B-prime correction to the Phase 42 matrix)" with the per-step-type submission body table, why the conditional-parse doesn't help, and Phase 44 / Shape γ as the real fix. The `json_equal` + `numeric_tolerance` matrix rows now point at this section instead of the wrong ~30-LOC claim. New section "Phase 43B-prime audit advisories (informational only)" documents the two advisory categories.
   - `docs/project-authoring-spec.md` — new §5.1.1 "Submission-shape limit (Phase 43B-prime)" codifying that `json_equal` / `numeric_tolerance` on `code_python` / `code_sql` / `multi_file` is acceptable and honest, NOT a publish-ready blocker.
   - `docs/phases/phase-43b-prime-json-equal-audit-warning.md` (new) — full phase close-out with the Phase 44 / Shape γ design sketch.

### Live numbers (`audit:authoring` after Phase 43B-prime)

Enforcement breakdown **unchanged from Phase 42** (kind matrix didn't move):

- 288 visible-project steps total across 58 visible projects.
- 43 (15%) enforced · 35 (12%) client-provisional · 210 (73%) contract-shaped · 0 unknown.
- **58 / 58 visible publish-ready (byte-identical).**

New "Authoring advisories" section:

- **`json_equal` submission-shape mismatch:** 174 steps across 49 projects.
- **Legacy `validation.spec` keys:** 3 steps in 1 project — `ai-engineer-rag-baseline-pgvector` (step 1 `stdoutMustEqualJson`, step 2 `stdoutMustEqualJson`, step 3 `stdoutMustContainShape`).

### Hard stops respected

| Surface | Touched? |
| ------- | -------- |
| `lib/grading.ts` | NO |
| `/check`, `/submit`, route handlers | NO |
| Frontend code | NO |
| OpenAPI spec / codegen | NO |
| DB schema | NO |
| Migrations | NO |
| Seed / content / project files | NO |
| Pedagogy / rubric / taxonomy | NO |
| `publishReady` count | UNCHANGED (58/58) |

### Gates

| Gate | Result |
| ---- | ------ |
| typecheck (full repo) | ✓ |
| check:no-heuristic-runtime | ✓ |
| curriculum-quality tests | ✓ 93 / 93 (+13 — was 80) |
| audit:authoring | ✓ 58 / 58 visible publish-ready (UNCHANGED) |
| audit:pedagogy | ✓ 58 / 58 (UNCHANGED) |

### Files changed

- `lib/curriculum-quality/src/validationEnforcement.ts` — +4 exports
- `lib/curriculum-quality/src/validationEnforcement.test.ts` — +5 describe blocks, +13 assertions
- `scripts/src/audit-project-authoring.ts` — +2 advisory types on `ProjectReport`, +per-step population in the loop, +"Authoring advisories" summary section (~60 LOC)
- `docs/validation-kind-matrix.md` — rewrote Future-actions section, updated 2 matrix rows, added advisory section
- `docs/project-authoring-spec.md` — new §5.1.1
- `docs/phases/phase-43b-prime-json-equal-audit-warning.md` (new)
- `docs/phases/INDEX.md` (+1 entry)
- `HANDOFF.md` (this file)
- `replit.md` (Phase History prepend)

### Remaining validation risks

1. **210 of 288 steps still auto-pass at commit time.** Phase 43B-prime makes the per-step gap mechanically visible via the new advisory; closing it requires Phase 44 / Shape γ (multi-phase).
2. **The advisory list (174 steps across 49 projects) is not a CI gate.** It's informational only — by design. A future operator must consciously decide to lift it into `publishReady` (don't do that lightly; today's behavior IS the contract for those steps).
3. **`numeric_tolerance` not separately advised today.** All 36 are `code_python`, so they'd land in the same submission-shape bucket; the advisory implementation deliberately filters on `json_equal` only because it's the larger + louder claim from Phase 42. If we want symmetric coverage, extend the predicate in a tiny follow-up.

### Recommended Phase 44 — Shape γ — Signed RunResult Round-Trip

**Plan separately with a decision brief + architect review BEFORE any code.** High-level shape:

1. Client captures the Pyodide / DuckDB-WASM RunResult on Run.
2. New `POST /api/run/sign` endpoint signs the envelope (HMAC keyed on `userId + stepId + nonce + timestamp`, short TTL).
3. Client ships the signed envelope inside `submission` on Submit.
4. Server verifies, parses captured output, runs real `json_equal` / `numeric_tolerance` / `sql_resultset` / `csv_set_equal` enforcement.
5. Failure-mode design: forged envelope, expired signature, replay, RunResult schema drift, network failure mid-flight.

**Critical trust-boundary caveat (architect review of Phase 43B-prime):** envelope signing alone does NOT prove the captured RunResult came from honestly executing the learner's source — a motivated client can request a signature on a forged passing payload. Shape γ MUST publish a threat-model addendum BEFORE any code (what is being attested, in-scope vs out-of-scope attacks, acceptable residual risk for a portfolio-grading product). Without it, Shape γ ships the *appearance* of enforcement while leaving the same trust gap Phase 43B-prime documented for Shape A. See the "Recommended Phase 44" section in `docs/phases/phase-43b-prime-json-equal-audit-warning.md` for the full caveat.

Touches: `lib/execution-core`, `artifacts/api-server`, `artifacts/atlas`, OpenAPI/codegen, authoring spec, validation-kind matrix, `audit:authoring`. **Estimated scope: 2-3 phases, each with its own architect review, gated by the threat-model addendum.**

### Commit

`phase-43b-prime: json_equal submission-shape audit warning + spec-shape outlier advisory`
