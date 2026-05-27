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
| `contains`          | enforced                | substring match (`config.needle` or `expectedOutput`)                 | none                                                      | low — server actually checks                                                                     | "did you use this clause/method/keyword?" checks                                     | keep                                                                                                           |
| `regex`             | enforced                | `new RegExp(config.pattern, config.flags).test(submission)`           | none                                                      | low — server actually checks; invalid regex returns config-error (not throw)                     | structured single-output checks (date format, slug shape, etc.)                      | keep                                                                                                           |
| `sql_resultset`     | client-provisional      | falls through → auto-pass with generic "Step completed."             | `validateExpected` checks rows/columns/order against `expectedOutputs.rows` (DuckDB-WASM adapter) | **medium** — learner gets accurate Run feedback in the UI but Submit always passes regardless | SQL steps that produce structured tabular output; ALWAYS pair with `expectedOutputs.rows` | server grader for SQL (Phase 43+ candidate) — could re-use `validateExpected` over a serialized RunResult     |
| `csv_set_equal`     | client-provisional      | same as `sql_resultset`                                              | same as `sql_resultset` (treats CSV as rows; multiset compare) | **medium** — same caveat                                                                     | SQL steps where row order doesn't matter; ALWAYS pair with `expectedOutputs.rows`   | same as `sql_resultset`                                                                                       |
| `csv_ordered`       | client-provisional      | same as `sql_resultset`                                              | same as `csv_set_equal` but `validateExpected` enforces row order WHEN `expected.orderSensitive = true`; otherwise falls back to set-equal semantics — author MUST set the flag or the kind is silently downgraded | **medium** — same caveat as `csv_set_equal`, plus the orderSensitive footgun | SQL steps where row order is part of the contract (e.g. ORDER BY tests); REQUIRES `expectedOutputs.orderSensitive = true` | same as `sql_resultset` |
| `json_equal`        | contract-shaped         | falls through → auto-pass                                            | none — Python Run path does not call `validateExpected`   | **medium** — `expectedOutputs` exists in DB but neither server nor client checks it             | Python steps emitting structured JSON; the matrix the learner sees in instructions/remediation is honest; reviewer/local repro relies on `docker-compose up` | server grader for `json_equal` (Phase 43+ candidate) — a single 30-line `JSON.parse(submission) deepEquals expectedOutputs` would cover 174 of 288 steps |
| `numeric_tolerance` | contract-shaped         | falls through → auto-pass                                            | none                                                      | **medium** — same as `json_equal`                                                                | Python steps emitting one or more numeric values where ±epsilon matters             | server grader for `numeric_tolerance` (Phase 43+ candidate) — small JSON parse + per-key tolerance check        |
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

The platform's commitment is **"this is what the right answer looks like"**, not **"the cloud judge has scored your laptop's psycopg2 run."** Phase 42 makes that boundary visible in `audit:authoring` so the next operator can choose whether to (a) implement real graders for `json_equal` / `numeric_tolerance` in `grading.ts` (which would migrate ~210 steps from contract-shaped → enforced in one commit), or (b) keep the convention and rely on the matrix + the audit summary to keep authors honest.

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

## Future actions (Phase 43+)

Two cleanly-separable shapes, either can ship without the other:

- **Shape A — Implement `json_equal` + `numeric_tolerance` in the server commit-grader.** ~30 lines in `lib/grading.ts`: `JSON.parse(submission)` + `deepEquals(expected, parsed)` for `json_equal`; per-key tolerance + epsilon check for `numeric_tolerance`. Would migrate **210 of 288 steps** from contract-shaped → enforced. Requires a `test:integration`-style spot check across the 5 most-leaky steps (no silent regressions).
- **Shape B — Implement `sql_resultset` + `csv_set_equal` on the server.** Re-use `validateExpected` on a serialized RunResult shipped from the client — server still doesn't run SQL itself, but it can verify the client-side RunResult matches `expectedOutputs.rows` and reject if the learner forged a passing payload. ~50 lines + a payload signature.

Both shapes preserve the current `self_attest` / `exact` / `contains` / `regex` semantics byte-for-byte.
