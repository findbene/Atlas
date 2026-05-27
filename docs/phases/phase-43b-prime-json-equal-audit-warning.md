# Phase 43B-prime — `json_equal` Submission-Shape Audit Warning (Shape β)

**Parent:** `3e84ede` (Phase 43B read-only audit) → `78d9cc1` (Phase 43A compaction) → `84f733c` (Phase 42 close).

**Shape:** β — conservative audit-warning path. **Hard-rejected Shape A** (naive `JSON.parse(submission)` arm in `lib/grading.ts`) before any code landed; deferred real enforcement to Phase 44 / Shape γ.

---

## Context — what the Phase 43B audit found

Phase 42 shipped the validation-kind enforcement matrix and flagged 210 of 288 visible steps as "contract-shaped" (174 × `json_equal` + 36 × `numeric_tolerance`). The Phase 42 close-out's "Recommended Phase 43" pointer suggested **Shape A** would close the bulk of that gap in ~30 LOC: add a `json_equal` arm to `lib/grading.ts` that does `JSON.parse(submission) deepEquals expectedOutputs`.

Phase 43B is the pre-implementation read-only audit of that claim. It found two reasons the ~30-LOC estimate is wrong:

### 1. Submission-shape mismatch (the showstopper)

`artifacts/api-server/src/routes/user.ts` extracts `submission` from `req.body` and passes it untouched to `gradeSubmission(step, submission)`. The frontend (`artifacts/atlas/src/pages/project-workspace.tsx` → `submissionTypeForStep`, `CODE_STEP_TYPES = new Set(['code_python', 'code_sql'])`) sends:

- `code_python` / `code_sql` → `submissionType: 'code'`, body = the learner's **source code** string
- `multi_file` → `submissionType: 'text'`, body = a per-file blob serialization (not a single JSON value)
- `writeup` → `submissionType: 'text'`, body = freeform text

**All 174 visible `json_equal` steps are `code_python`. All 36 `numeric_tolerance` steps are `code_python`.** A naive `JSON.parse(submission)` on those would throw `SyntaxError: Unexpected token i in JSON at position 0` on the literal string `import pandas as pd ...`. The actual program output never reaches the server.

A "guarded" version (`if (submissionType === 'text') JSON.parse else fallthrough`) is structurally safe but **functionally inert** — zero authored steps use `text` for a `json_equal`/`numeric_tolerance` step today. It would change 0 of 210 steps from contract-shaped → enforced while shipping new code paths that are never exercised. Net negative.

### 2. Spec-shape outlier in `ai-engineer__rag-baseline-pgvector`

3 steps in that one project still use the Phase 7-era keys `stdoutMustEqualJson` / `stdoutMustContainShape` inside `validation_config.spec` instead of the Phase 41 canonical `{ expected: {...} }` shape. No runner consumes either key today — but the divergence would silently widen the gap if Shape A ever landed without first normalizing.

---

## Decision

**Architect-stop on Shape A.** The user picked **Shape β**: ship the audit advisory + documentation now, defer real enforcement to a properly scoped Phase 44 / Shape γ (signed RunResult round-trip) which is the only honest fix.

Phase 43B-prime is **content/audit/docs only**. Explicit hard stops:

- NO edits to `lib/grading.ts`
- NO edits to `/check` or `/submit` route handlers
- NO frontend changes
- NO OpenAPI spec / codegen changes
- NO schema or migration changes
- NO content / seed / project edits
- `publishReady` count must stay byte-identical (58/58)

---

## What landed

### 1. Pure helpers — `lib/curriculum-quality/src/validationEnforcement.ts`

Four new exports + 13 new unit assertions across 5 describe blocks:

- `NON_TEXT_SUBMISSION_STEP_TYPES` — readonly tuple `['code_python', 'code_sql', 'multi_file'] as const` (with companion `NonTextSubmissionStepType = (typeof NON_TEXT_SUBMISSION_STEP_TYPES)[number]`) mirroring the frontend `CODE_STEP_TYPES` + the multi-file blob case. Authoritative for "submission body is not a single JSON value".
- `jsonEqualHasSubmissionShapeMismatch(validationType, stepType) → boolean` — true iff `validationType === 'json_equal'` AND `stepType ∈ NON_TEXT_SUBMISSION_STEP_TYPES`. Null/undefined-safe on both arguments.
- `LEGACY_JSON_EQUAL_SPEC_KEYS: readonly ['stdoutMustEqualJson', 'stdoutMustContainShape']` — frozen list of Phase 7-era keys.
- `detectLegacyJsonEqualSpecKeys(validationConfig) → readonly LegacyJsonEqualSpecKey[]` — inspects `validationConfig.spec` (if object) and returns which legacy keys are present, deterministic order. Safe on null / non-object / missing `spec`.

All prior Phase 42 tests stay green; the new helpers add 13 assertions covering null/undefined, empty input, both legacy keys present, both absent, mixed with canonical `expected`, and the cross-product of validation-kind × step-type for the submission-shape predicate.

### 2. Audit advisories — `scripts/src/audit-project-authoring.ts`

Two new informational categories on `ProjectReport`:

```ts
type JsonEqualSubmissionShapeAdvisory = { stepNumber: number; stepType: string | null };
type ValidationSpecShapeAdvisory = { stepNumber: number; legacyKeys: readonly LegacyJsonEqualSpecKey[] };
```

Populated inside the existing per-step loop. **Not added to the `ProjectFinding` union. Not part of `publishReady`.** A new "Authoring advisories" section in the summary output reports per-category step + project counts and lists the affected projects under the legacy-spec-key category (the submission-shape list is too long to enumerate inline; per-step detail is available by reading the JSON report if a future operator wants it).

### 3. Documentation

- `docs/validation-kind-matrix.md` — "Future actions" section rewritten as "Submission-shape blocker (Phase 43B-prime correction to the Phase 42 matrix)" with the per-step-type submission table, why the conditional-parse doesn't help, and Shape γ as the real fix. Two `json_equal` / `numeric_tolerance` rows updated to point at this section instead of the wrong ~30-LOC claim.
- `docs/project-authoring-spec.md` — new §5.1.1 "Submission-shape limit (Phase 43B-prime)" subsection codifying that `json_equal` / `numeric_tolerance` on `code_python` / `code_sql` / `multi_file` is acceptable and honest (NOT a publish-ready blocker), and pointing at the audit advisories + this phase doc.

---

## Live numbers (`audit:authoring` after Phase 43B-prime)

Enforcement breakdown — **unchanged from Phase 42** (the kind matrix didn't move):

- 288 visible-project steps total
- 43 (15%) enforced · 35 (12%) client-provisional · 210 (73%) contract-shaped · 0 unknown
- 58 / 58 visible publish-ready (byte-identical)

New "Authoring advisories" section:

- **`json_equal` submission-shape mismatch:** 174 steps across 49 projects.
- **Legacy `validation.spec` keys:** 3 steps in 1 project — `ai-engineer-rag-baseline-pgvector` (step 1 `stdoutMustEqualJson`, step 2 `stdoutMustEqualJson`, step 3 `stdoutMustContainShape`).

---

## Hard stops respected

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

---

## Gates

| Gate | Result |
| ---- | ------ |
| typecheck (full repo) | ✓ |
| check:no-heuristic-runtime | ✓ |
| curriculum-quality tests | ✓ 93 / 93 (+13 new — was 80) |
| execution-core tests | ✓ 34 / 34 |
| api-server tests | ✓ 280 / 280 |
| atlas tests | ✓ 102 / 102 |
| audit:authoring | ✓ 58 / 58 visible publish-ready (UNCHANGED) |
| audit:pedagogy | ✓ 58 / 58 (UNCHANGED) |

---

## Files changed

- `lib/curriculum-quality/src/validationEnforcement.ts` — +4 exports
- `lib/curriculum-quality/src/validationEnforcement.test.ts` — +5 describe blocks, +13 assertions
- `scripts/src/audit-project-authoring.ts` — +2 advisory types on `ProjectReport`, +per-step population in the loop, +"Authoring advisories" summary section
- `docs/validation-kind-matrix.md` — rewrote Future-actions section, updated 2 matrix rows
- `docs/project-authoring-spec.md` — new §5.1.1
- `docs/phases/phase-43b-prime-json-equal-audit-warning.md` — this file
- `docs/phases/INDEX.md` — +1 entry
- `HANDOFF.md` — full rewrite for Phase 43B-prime
- `replit.md` — Phase History prepend

---

## Recommended Phase 44 — Shape γ — Signed RunResult Round-Trip

The only honest path to actually enforcing `json_equal` / `numeric_tolerance` (and as a free side-effect, `sql_resultset` / `csv_set_equal`) at commit time. High-level shape — **plan separately with a decision brief + architect review BEFORE any code:**

1. **Client** captures the Pyodide / DuckDB-WASM RunResult (stdout, structured outputs, exit code) on Run.
2. **Server** signs the RunResult on a new `POST /api/run/sign` endpoint (HMAC keyed on `userId + stepId + nonce + timestamp`, short TTL).
3. **Client** ships the signed envelope alongside (or as) `submission` on Submit.
4. **Server** verifies the signature, parses the captured output JSON, runs `deepEquals(expected, captured)` for `json_equal` / per-key epsilon for `numeric_tolerance` / `validateExpected` for `sql_resultset` / `csv_set_equal`.
5. **Failure modes** to design for: forged envelope, expired signature, replay attack, RunResult schema drift, network failure mid-flight (graceful degrade to today's contract-shaped behavior?).

**Critical trust-boundary caveat (architect review of Phase 43B-prime):** envelope signing alone does NOT prove the captured RunResult actually came from honestly executing the learner's source code. A motivated client can request a signature on a forged passing payload after running anything — or nothing — in the local browser. Shape γ MUST publish a threat-model addendum BEFORE any code that defines (a) what is being attested (provenance: "the server actually executed this code in a known runtime" vs "the client claims this was the output"), (b) which attacks remain in scope (browser-side tampering with Pyodide between Run and signature request; signature replay across users/steps; expected-output exfiltration via the signing surface) and which are explicitly out of scope, and (c) acceptable residual risk for a portfolio-grading product (cheating one's own portfolio is a different threat profile than cheating an exam — both still matter, but the tradeoffs differ). Without this addendum, Shape γ ships the *appearance* of enforcement while leaving the same trust gap Phase 43B-prime documented for Shape A.

Touches: `lib/execution-core` (RunResult schema + serialization), `artifacts/api-server` (`/run/sign` route, signature verifier, `gradeSubmission` arms), `artifacts/atlas` (capture + ship), OpenAPI spec, codegen, the authoring spec, the validation-kind matrix, and `audit:authoring` (the submission-shape advisory becomes per-step enforcement coverage).

**Estimated scope:** 2-3 phases (foundation → `json_equal`/`numeric_tolerance` arms → `sql_resultset`/`csv_set_equal` arms). Do not collapse into one phase; each layer needs its own architect review.

---

## Commit

`phase-43b-prime: json_equal submission-shape audit warning + spec-shape outlier advisory`
