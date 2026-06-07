# Atlas Validation Kind Matrix

**Owner:** Phase 42 (Validation Kind Reality Check + Authoring Guardrail).
**Authoritative classifier:** [`lib/curriculum-quality/src/validationEnforcement.ts`](../lib/curriculum-quality/src/validationEnforcement.ts) (`classifyValidationKind`).
**Source of usage numbers:** read-only DB audit run via `audit:authoring` (`scripts/src/audit-project-authoring.ts`) over visible (`learner_visible=TRUE`) project + step rows. Re-run anytime with:
```
pnpm --filter @workspace/scripts run audit:authoring
```
The "Validation enforcement breakdown" section in the audit summary prints the live numbers.

---

## TL;DR

Of **288 authored steps** across the 58 visible publish-ready projects, **only ~15 % (43 steps) are evaluated by the server commit-grader**. The other ~85 % are either *client-provisional* (~12 % / 35 steps — SQL kinds with structured `expectedOutputs.rows`, validated client-side on Run for instant UI feedback but server-side auto-pass at Submit) or *contract-shaped* (~73 % / 210 steps — Python-structured kinds, server auto-pass, no client grader, `expectedOutputs` exists as metadata for local reproduction + human review).

This is not a regression — every Phase 7+ intermediate/advanced project uses this convention because the in-browser Pyodide runner cannot stand up Postgres / Kafka / Spark to actually run the grader. Phase 42 makes the convention explicit so authors and reviewers cannot misunderstand it.

---

## Matrix

| validation kind     | enforcement status      | server `/check` + `/submit` behavior                                 | client Run behavior                                       | learner-facing risk                                                                              | allowed authoring use                                                                | recommended future action                                                                                      |
| ------------------- | ----------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `self_attest`       | enforced                | always pass (intentional; learner self-declares)                      | none                                                      | low — contract is explicit ("mark as complete")                                                  | reflection / explanation / file-upload steps only                                    | none; covered by the `all-steps-self-attest` audit finding                                                     |
| `exact`             | enforced                | trimmed string equality against `expectedOutput`                      | none                                                      | low — server actually checks                                                                     | small, single-line deterministic outputs (single number, single string)              | keep                                                                                                           |
| `contains`          | enforced                | Phase 56 structured literal matcher. Legacy `{needle}` and `{}`+`expectedOutput` fallback are byte-identical to pre-Phase-56. New optional fields: `needles[]` (≤16, non-empty strings), `match: "all"\|"any"` (default `"all"`), `caseInsensitive` (boolean only — non-booleans coerce to `false`). `needles[]` WINS over legacy `needle`. `match` without `needles` is silently ignored. Malformed shapes (`needles:[]`, non-string entry, invalid `match`, >16 entries) fail CLOSED with `"Grading config is malformed — please report this step."` See `matchContains` JSDoc + Phase 56 close-out for the full matrix. | none                                                      | low — server actually checks                                                                     | "did you use this clause/method/keyword?" checks; multi-keyword AND/OR gates; case-insensitive variants | keep                                                                                                           |
| `regex`             | enforced                | `new RegExp(config.pattern, config.flags).test(submission)`           | none                                                      | low — server actually checks; invalid regex returns config-error (not throw)                     | structured single-output checks (date format, slug shape, etc.)                      | keep                                                                                                           |
| `sql_resultset`     | **server-enforced for 1 opted-in row (Phase 58B); client-provisional otherwise** | Phase 58A added `gradeSqlResultset()` + dispatch case, sharing ONE rowset comparator (`gradeRowsetSubmission`) with `csv_set_equal`. Opt-in via `spec.serverGrade: true`. **Phase 58B opted in exactly 1 row** — C2 `analytics-engineer-semantic-layer-with-dbt-and-duckdb` step 2 (SCD-2 invariants), browser-WASM byte-verified + end-to-end verified through the live grader. The other 3 visible sql_resultset steps remain byte-identical to the pre-58A auto-pass `"Step completed."` per `audit:sql-resultset-bc`. When opted in: submission MUST be JSON `{columns: string[], rows: (string\|number\|boolean\|null)[][]}`; same knobs as `csv_set_equal` (`orderSensitive` for ORDER BY contracts, `trimStrings`, `nullEqualsEmpty`, `coerceNumericStrings`, `caseInsensitive`, `dedupe`, `expectedRows` or `expectedRowsHash`). Malformed specs/submissions (raw SQL, non-JSON, empty, wrong/missing columns, missing/extra row, bad hex, orderSensitive+hash-only) fail CLOSED. Authoring guard `assertValidSqlResultsetSpec` (shared `assertValidRowsetSpec`) symmetric with runtime; the 25 legacy free-form specs (`{query, expectedRow(s)}`, scalar `expected*`) pass through. See `docs/phases/phase-58a-sql-resultset-dark-comparator.md`. | `validateExpected` checks rows/columns/order against `expectedOutputs.rows` (DuckDB-WASM adapter) | **medium** — same caveat until the first opt-in (58B) | SQL steps that produce structured tabular output; ALWAYS pair with `expectedOutputs.rows`. New WASM-runnable steps MAY opt in to server grading via `spec.serverGrade: true` + `{columns, expectedRows}` — but Phase 58A ships zero opt-ins. | 58B — flip ONE WASM-verifiable pilot step `spec.serverGrade: true` (best candidate: C2 semantic-layer step 2, SCD-2 invariants). Requires spec reshape to positional `{columns, expectedRows}` + real-browser WASM byte-verification (the 0.zz process) + extend `deriveServerGrade` to sql_resultset. |
| `csv_set_equal`     | client-provisional **(Phase 57A — DARK server foundation shipped)** | Phase 57A added `gradeCsvSetEqual()` + dispatch case. Opt-in via `spec.serverGrade: true`. **No live row opts in** (15 / 15 visible byte-identical to pre-57A auto-pass `"Step completed."` per `audit:csv-set-equal-bc`). When opted in: submission MUST be JSON of shape `{columns: string[], rows: (string\|number\|boolean\|null)[][]}`; comparator supports `expectedRows` (inline) OR `expectedRowsHash` (64-char lowercase hex SHA-256 multiset fingerprint) + knobs `orderSensitive`, `trimStrings`, `nullEqualsEmpty`, `coerceNumericStrings`, `caseInsensitive`, `dedupe: "expected"\|"both"\|false`. Malformed specs (missing columns/expected, non-boolean flags, bad hex, width mismatch, orderSensitive+hash-only) and malformed submissions (empty / non-JSON / wrong shape / wrong cell types) fail CLOSED. Authoring guard `assertValidCsvSetEqualSpec` in `lib/curriculum-quality/src/authoring.ts` rejects the same shapes at construction time. See `docs/phases/phase-57a-csv-set-equal-comparator.md`. | same as `sql_resultset` (treats CSV as rows; multiset compare) | **medium** — same caveat until first opt-in (57B) | SQL steps where row order doesn't matter; ALWAYS pair with `expectedOutputs.rows`. New projects MAY opt in to server grading via `spec.serverGrade: true` + `expectedRows` (or `expectedRowsHash`) — but Phase 57A ships zero opt-ins. | 57B — flip ONE pilot project's step `spec.serverGrade: true`. Requires submission-shape decision (raw `{columns,rows}` JSON vs. signed `RunCapture` envelope) + threat-model addendum per Phase 44 / Shape γ caveat. |
| `csv_ordered`       | client-provisional      | same as `sql_resultset`                                              | same as `csv_set_equal` but `validateExpected` enforces row order WHEN `expected.orderSensitive = true`; otherwise falls back to set-equal semantics — author MUST set the flag or the kind is silently downgraded | **medium** — same caveat as `csv_set_equal`, plus the orderSensitive footgun | SQL steps where row order is part of the contract (e.g. ORDER BY tests); REQUIRES `expectedOutputs.orderSensitive = true` | same as `sql_resultset` |
| `json_equal`        | contract-shaped         | falls through → auto-pass                                            | none — Python Run path does not call `validateExpected`   | **medium** — `expectedOutputs` exists in DB but neither server nor client checks it             | Python steps emitting structured JSON; the matrix the learner sees in instructions/remediation is honest; reviewer/local repro relies on `docker-compose up` | **NOT a 30-LOC `grading.ts` change** — see "Submission-shape blocker" below. Real fix requires Phase 44 / Shape γ signed RunResult round-trip. |
| `numeric_tolerance` | contract-shaped         | falls through → auto-pass                                            | none                                                      | **medium** — same as `json_equal`                                                                | Python steps emitting one or more numeric values where ±epsilon matters             | same submission-shape blocker as `json_equal` (36 of 36 authored numeric_tolerance steps are `code_python`); same Phase 44 / Shape γ fix       |
| _(any unknown)_     | unknown                 | falls through → auto-pass                                            | none                                                      | **high** — silent misclassification; author thinks they specified a real grader                  | none; the audit surfaces "unknown" so the typo can be fixed                          | the classifier returns `'unknown'` and the audit prints the offending kind verbatim                            |

---

## Why "client-provisional" is a distinct row, not a synonym for "enforced"

A SQL step with `validationType: 'sql_resultset'` and `expectedOutputs.rows: [...]` produces this learner experience:

1. **Learner clicks Run.** `runPython`/`runViaRegistry` executes the SQL through DuckDB-WASM, returns a `RunResult`, and the workspace calls `validateExpected` against the declared `expectedOutputs.rows`. The reducer dispatches `CHECK_PASS` / `CHECK_FAIL` based on the real row comparison. The learner sees **accurate** provisional feedback in the UI.
2. **Learner clicks Submit.** The submission text is sent to `POST /user/projects/:projectId/steps/:stepId/submit`. The server calls `gradeSubmission` (`lib/grading.ts`). Because the validation kind isn't one of the 4 enforced strings, the switch falls through to `{ passed: true, feedback: "Step completed." }`. The step is committed as `passed` **regardless of what the learner submitted**.

So the platform IS honest about which output is the right answer (UI tells the truth on Run), but the *commit grade* is unconditional. In practice this is fine for the Pyodide-runner constraint, but the matrix MUST distinguish it from genuinely server-enforced kinds — otherwise the author's mental model of "Submit checks my work" is wrong.

## Why "contract-shaped" is acceptable today

The two anchors of the catalog (`csv-to-postgres-pipeline`, `dbt-data-models`) and every intermediate/advanced project in the catalog declare structured `expectedOutputs` that are inspectable by:

- The instructions panel + remediation panel (which surface the contract to the learner).
- The human reviewer reading the README + the `expectedOutputs` JSON.
- A learner running locally with `docker-compose up` (which is the realistic execution environment for a Postgres+Kafka+Spark pipeline).

The platform's commitment is **"this is what the right answer looks like"**, not **"the cloud judge has scored your laptop's psycopg2 run."** Phase 42 makes that boundary visible in `audit:authoring`. The Phase 42 close-out originally suggested option (a) would be a "one-commit `grading.ts` arm migrating ~210 steps from contract-shaped → enforced"; **Phase 43B's audit retired that claim** — see "Submission-shape blocker" below. The honest path forward is the multi-phase Phase 44 / Shape γ signed RunResult round-trip, not a `grading.ts` patch.

## When the convention IS a problem

- Author labels a Python step `validationType: 'json_equal'` but does **not** populate `expectedOutputs`. → Submit auto-passes, learner sees no contract anywhere. The Phase 35 `step-missing-expected-outputs` finding already catches this for non-`self_attest` steps with empty or null `expectedOutputs`, and the audit's enforcement breakdown surfaces the volume of contract-shaped steps so the reviewer can spot-check the highest-risk ones.
- Author labels a step with a typo (`'json_eq'`). → The classifier returns `'unknown'` and the audit's breakdown prints the offending value verbatim under "unknown kinds" — operator can grep & fix.
- Author writes a `contains` rule with a high-leak needle (e.g. the entire expected JSON). → Caught by the pre-existing `hintLeakSuspected` heuristic on L4/L5 hints if the needle appears in a hint; not caught if it appears only in the rule. Out of scope here.

## Honest authoring rules (mirrored from `docs/project-authoring-spec.md` §5)

When choosing a validation kind:

1. If the step's output is a single string / clause / keyword the server can substring-match → **`contains`** or **`exact`** (enforced).
2. If the step is a SQL step producing tabular output that DuckDB-WASM can run locally → **`sql_resultset`** or **`csv_set_equal`** (order-insensitive) or **`csv_ordered`** (order-sensitive, e.g. ORDER BY tests) + `expectedOutputs.rows` (client-provisional). The learner gets real Run feedback; the commit grade is auto-pass but the contract is honest. When you pick `csv_ordered`, MUST also set `expectedOutputs.orderSensitive = true` — otherwise `validateExpected` silently downgrades to set-equal semantics.
3. If the step is a Python step emitting structured JSON / numerics that requires Postgres / Kafka / etc. to run for real → **`json_equal`** or **`numeric_tolerance`** + populated `expectedOutputs` (contract-shaped). Always include `meta.scenario` + `portfolioArtifact.repoUrl` + a `docker-compose.yml` outline in the README so the contract is reproducible by reviewers.
4. If the step is reflection / explanation / file-upload → **`self_attest`** (intentional auto-pass).
5. Never use `validationType` outside the enum. The classifier flags unknowns; the DB enum rejects inserts.

---

## Submission-shape blocker (Phase 43B-prime correction to the Phase 42 matrix)

The Phase 42 "future action" column originally suggested a "~30-line `JSON.parse(submission) deepEquals expectedOutputs`" arm in `lib/grading.ts` would migrate 210 of 288 steps from contract-shaped → enforced. **Phase 43B's pre-implementation audit found this estimate wrong.** Recording the correction here so no future operator burns the same cycle.

### What the server actually receives as `submission`

`artifacts/api-server/src/routes/user.ts` extracts `submission` straight from `req.body` and passes it to `gradeSubmission(step, submission)`. The Atlas frontend (`artifacts/atlas/src/pages/project-workspace.tsx` → `submissionTypeForStep`) routes by step `type`:

| step `type`      | `submissionType` | `submission` body                                              |
| ---------------- | ---------------- | -------------------------------------------------------------- |
| `code_python`    | `"code"`         | the learner's **Python source code** as a string               |
| `code_sql`       | `"code"`         | the learner's **SQL source** as a string                       |
| `multi_file`     | `"text"`         | a per-file blob serialization (not a single JSON value either) |
| `writeup`        | `"text"`         | freeform text (could be a JSON value if the learner pastes one)|

**All 174 visible `json_equal` steps are `code_python`.** A naive `JSON.parse(submission)` would throw on every single one — the source code is not a JSON value, and the actual program output never reaches the server. The 36 `numeric_tolerance` steps are in the same shape (all 36 are `code_python`).

### Why a "conditional parse" doesn't help

`if (submissionType === 'text') JSON.parse(submission) else fallthrough` is structurally safe but functionally inert: **zero authored steps currently use `text` as the submission shape for `json_equal`**. The classifier would still report all 210 steps as contract-shaped, because the per-step matrix can't encode "depends on the per-submission shape." The audit advisories added in Phase 43B-prime (see `docs/phases/phase-43b-prime-json-equal-audit-warning.md`) surface this gap at the per-step level so the operator can target Phase 44 candidates.

### The real fix

**Phase 44 — Shape γ — Signed RunResult Round-Trip.** Client captures the Pyodide / DuckDB-WASM run output, signs it server-side on Run, and ships the signed envelope as part of `submission` on Submit. Server verifies the signature, parses the captured output JSON, and runs `deepEquals(expected, runResult)` for `json_equal` / per-key epsilon for `numeric_tolerance`. Touches `lib/execution-core` (RunResult signing), `/submit` route signature, OpenAPI/codegen, frontend submit handlers, and the authoring spec. Multi-phase initiative — plan separately with a pre-build decision brief and architect review BEFORE any code.

**Critical trust-boundary caveat:** envelope signing alone does NOT prove the captured RunResult came from honestly executing the learner's source — a motivated client can request a signature on a forged payload after running anything (or nothing) in the local browser. Shape γ MUST publish a threat-model addendum BEFORE any code, defining what is being attested, in-scope vs out-of-scope attacks (browser-side Pyodide tampering, signature replay, expected-output exfiltration via the signing surface), and acceptable residual risk for a portfolio-grading product. Without it, Shape γ ships the appearance of enforcement while leaving the same trust gap Shape A had.

Shape γ also unlocks the original Phase-42 Shape B (server-side `sql_resultset` / `csv_set_equal` verification) as a free side-effect, since the same envelope can carry SQL RunResults.

---

## Phase 43B-prime audit advisories (informational only)

The `audit:authoring` "Authoring advisories" section reports two per-step categories that **do not** affect `publishReady`:

- **`json_equal` submission-shape mismatch** — every visible step where `validation_type='json_equal'` AND step `type ∈ {code_python, code_sql, multi_file}`. Today: **174 steps across 49 projects.** These are precisely the steps that would silently misclassify if a future operator shipped a naive `grading.ts` arm without solving the submission shape first.
- **Legacy `validation.spec` keys** — Phase 7-era `stdoutMustEqualJson` / `stdoutMustContainShape` keys instead of Phase 41 canonical `{ expected: {...} }`. Today: **3 steps in `ai-engineer-rag-baseline-pgvector`.** No runner consumes either shape; the advisory makes the divergence visible so a future normalization pass can converge them without breaking content.

Authoritative helpers: `lib/curriculum-quality/src/validationEnforcement.ts` → `jsonEqualHasSubmissionShapeMismatch` + `detectLegacyJsonEqualSpecKeys` (each with full unit-test coverage).
