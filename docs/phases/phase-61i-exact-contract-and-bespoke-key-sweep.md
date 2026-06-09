# Phase 61I — Exact authoring→runtime contract + catalog-wide bespoke-key sweep (close-out)

**Status:** SHIPPED (pending the two independent-review verdicts recorded in §16).
Closes the authoring/promotion trust gap discovered in Phase 61H: authored
validation steps could carry spec keys the grading runtime never reads
(`contains`/`exact`/`regex`), which ship as dead gates (auto-pass, or
fail-closed-on-null for exact). 61I (1) gives `exact` a real
authoring→runtime contract, (2) tightens the authoring guards to strict
allowlists, (3) fixes the latent `regex` wrapper dead-gate, (4) sweeps every
bespoke key out of the authored catalog into canonical `needles` / `expected`
or honest `self_attest`, and (5) adds a catalog-wide audit so a bespoke dead
gate can never silently ship again.

**No `serverGrade` flip (live count stays 10), no `sql_resultset` /
`csv_set_equal` comparator change, no envelope, no Phase 52, no
schema/migration, no GitHub/export/publish work.**

---

## 1. Baseline preflight (§ "Required Preflight")
Branch `main`; pre-sweep HEAD `9a4dcb1` (one session wip past the brief's
expected `b094894` — normal session-end auto-commit, not drift). `check:db-baseline`
OK; serverGrade `sql_resultset` 8 + `csv_set_equal` 2 = **10**; C2 + SaaS-mart +
FinOps visible+approved; `audit:contains-bc` 6/6 and `audit:exact-bc` 0-visible
green → **every bespoke-key file is un-promoted/latent** (no live dead gate). So
61I is a latent-hardening phase: it changes no visible learner behavior and the
serverGrade count is trivially unaffected.

## 2. Exact defect root cause (§ Required Diagnosis)
`gradeSubmission`'s `exact` branch grades the FULL submission against the DB
`expected_output` TEXT column. `promote` (`author-project.ts`) mapped
`validationConfig`/`expectedOutputs` but **never `expected_output`**, so every
authored `exact` step shipped with `expected_output = NULL` → auto-pass pre-61H,
fail-closed (fail-everyone) post-61H. Authored `exact` steps additionally used
bespoke `expected*` keys the runtime never reads. The same wrapper-shaped defect
exists latently in the `regex` branch (read top-level `pattern` instead of the
`validationConfig()`-wrapped `spec.pattern`).

## 3. Exact contract decision (§ "Exact Authoring Contract Decision")
**Implemented the clean contract** (owner-approved over the "ban exact" option):
canonical authored shape `validationConfig("exact", …, { expected: "<string>" })`;
`promote` maps `spec.expected` → the `expected_output` column
(`exactExpected(s)` helper — returns the string only for an `exact` step, `null`
for every other kind so the write is byte-identical BC for all non-exact steps);
the authoring guard requires a non-empty string `expected`. Runtime `exact`
branch is unchanged (61H fail-closed + full-string compare). Result: a future
`exact` step is authorable + enforceable; today **0 authored exact steps remain**
(all 6 were free-form YAML/CLI, not true full-document-exact → converted), so the
contract ships ready-but-unexercised by live rows — proven by tests + audit.

## 4. Inventories (§ "Exact / Contains Shape Inventory")
- **Exact (6 files, all un-promoted):** `mlops__kserve-multi-model`,
  `mlops__terraform-ml-platform`, `cloud-data-engineer__hudi-mor-cdc-merge`,
  `cloud-data-engineer__iceberg-compaction-rewrite`,
  `cloud-data-engineer__dbt-macros-mastery`,
  `analytics-engineer__dbt-ci-state-modified`. Bespoke keys: `expected*`
  (expectedKind/Formats/Replicas/Trigger/Threshold/Alerts/Actions/Flags/…).
- **Contains-bespoke (14 + 1 straggler the allowlist audit caught):** feature-pipeline-monitoring,
  pydantic-config-and-cli, dbt-macros-mastery, delta-lake-lakehouse,
  snowflake-data-warehouse, airflow-etl-dag, data-mesh-design,
  rest-api-elt-with-staging-marts, spark-batch-processing,
  stream-processing-flink, beginner-spreadsheet-to-sql-models,
  data-catalog-implementation, structured-prompting-with-json-schema,
  rag-evaluation-harness, **+ guardrails-and-structured-output-safety** (missed by
  the initial denylist grep, caught by `audit:validation-keys`). Bespoke keys:
  `required`, `mustContain`, `expected[]`/`expected{}`, `requiredSubstrings`,
  `anyOfSubstrings`, `scenarios`, `cases`, `forbidden`, `*MustContain`,
  `returnDictMustHave`, `stdoutContains`, numeric thresholds, exit codes.
- **Regex:** 0 authored steps (latent only).

## 5. Bespoke exact-key sweep (§ "Bespoke Exact-Key Sweep Result")
None of the 6 exact projects were true full-document-exact (free-form
YAML/Terraform/CLI). Per the owner rule each step → `contains`/`needles` where
the literal config markers (e.g. `kind: ServingRuntime`, `type: prometheus`,
`threshold: "10"`, IAM action strings, dbt flags) capture the essence, or →
`self_attest` where the intent is structural/behavioral with no clean literal
(e.g. iceberg step 3 — terraform-validate + DagBag parse + retries). Markers
byte-preserved; honest copy.

## 6. Bespoke contains-key sweep (§ "Bespoke Contains-Key Sweep Result")
Per the owner rule: positive-literal-marker steps → `needles` (byte-preserved;
`needle`+`secondaryNeedle` merged into one `needles`); steps whose CORE intent is
must-NOT-contain (`forbidden` — e.g. secret masking), exit codes, numeric
counts/thresholds, or multi-scenario CLI behavior → `self_attest` with a non-empty
`attestationCriteria`. Honest copy on every converted step (no "Atlas
runs/grades/enforces" claim). The straggler `guardrails-and-structured-output-safety`
(7 contains steps) converted the same way: steps 1,2,4,5,7 → needles; steps 3,8
(parse-outcome scenarios / safety-eval exit-code gate) → self_attest; step 6
left `numeric_tolerance` (out of scope, §10).

## 7. Promotion / runtime mapping fix (§ "Promotion/Runtime Mapping Fix")
`promote` now writes `expectedOutput: exactExpected(s)`. `exactExpected` returns
`spec.expected` (non-empty string) only for `validationType === "exact"`, else
`null` — so the 10 server-graded rowset rows and every contains/self_attest/json
step write the same null they did before (verified: `check:db-baseline`
serverGrade=10, `audit:sql-resultset-bc`/`csv-set-equal-bc` no drift).

## 8. Strict authoring guards (§ "Authoring Guard Proof")
`lib/curriculum-quality/src/authoring.ts`:
- `assertValidContainsSpec` — strict allowlist {needle, needles, match,
  caseInsensitive}; any other key throws at construction.
- `assertValidExactSpec` — requires a non-empty string `expected`; rejects every
  other key.
- `assertValidRegexSpec` (new, wired into `validationConfig`) — allows only
  {pattern, flags}; requires a compiling non-empty `pattern`.
These run at `validationConfig()` construction (i.e. on import of the authored
index), so a bespoke key is now a hard authoring failure. Safe to tighten only
because the §5/§6 sweep first removed every bespoke key catalog-wide (proven by
`audit:validation-keys`); a broad reject before the sweep would have broken the
authored-index import (the narrow-guard constraint from 61G/61H).

## 9. Regex wrapper fix
`grading.ts` regex branch now extracts the inner `spec` (`cfg.spec ?? config`),
mirroring the 61G contains fix, so an authored
`validationConfig("regex", …, {pattern})` is read correctly instead of matching
everything. 0 live regex rows → latent fix; the new guard keeps it that way.

## 10. dbt-macros step-2 revert + Phase 61J deferral
A sweep worker converted `dbt-macros-mastery` step 2 — which was originally
`json_equal` — to `self_attest`. `json_equal` is OUTSIDE 61I's exact+contains
scope, so it was **reverted byte-for-byte to the original json_equal** for scope
discipline + consistency. The catalog still has dead-gate `json_equal` and
`numeric_tolerance` steps (no runtime branch → generic auto-pass); `json_equal`
also overlaps the Phase-52 operator-pending canary kind. These are deferred to
**Phase 61J** as one consistent sweep. `audit:validation-keys` intentionally does
NOT police them (scope). **Open risk resolved (DB census):** the visible catalog
contains ONLY `contains` (6), `csv_set_equal` (3), `sql_resultset` (14), and
`self_attest` (91) steps — **zero visible `json_equal`, `numeric_tolerance`,
`exact`, or `regex` steps**. So every deferred dead-gate kind is entirely
un-promoted/latent; Phase 61J touches no live behavior and there is no live
auto-pass dead gate today.

## 11. Known-bad proof + new audit (§ "Known-Bad Exact Proof")
- `audit:validation-keys` (new) loads all 60 authored projects and asserts every
  `contains`/`exact`/`regex` spec uses only canonical, runtime-read keys (+ exact
  requires string `expected`, regex requires string `pattern`). PASS, 0
  violations, 38 steps checked.
- `audit:exact-bc` (61H) green (0 visible exact dead gates + synthetic
  fail-closed). `audit:contains-bc` (61G) green (6/6 enforcing).
- Tests: `authoring.test.ts` +13 (exact contract require-`expected` + reject
  bespoke; contains allowlist rejects required/mustContain/scenarios/expected/
  forbidden; regex require-pattern/allowlist/compile). `grading.test.ts` +3
  (regex wrapped-spec reads inner spec; non-match fails; legacy top-level BC).

## 12. ServerGrade count before/after
Unchanged: `sql_resultset` 8 + `csv_set_equal` 2 = **10** (DB-confirmed). exact /
contains / regex / self_attest are not serverGrade kinds; no flip; C2 server-graded
set `[1,2,3,5]` intact; no rowset/comparator drift.

## 13. Honesty (H3)
Every converted step's `instructionMd`/description was rewritten to claim only
what is true: contains = "Atlas checks the required evidence markers are present
… not that the program otherwise runs correctly, and not your authorship or
competence"; self_attest = "a learner attestation — Atlas does not grade this;
verify it yourself." No "server-enforced / exact-match / tamper-proof /
cheat-proof / verified-authorship / job-guaranteed / certified-competence" claim
was introduced. `check:authored-c2`/`-saas-mart`/`-finops-mart` green.

## 14. Gates (Node 24 + Docker PG :5434)
typecheck(4)+check:no-heuristic-runtime · **api-server 662/662** (+3) ·
**atlas 170/170** · **integration 4/4** · curriculum-quality 177/178 (the 1
failure is a pre-existing env-only test reading missing `.local/course-skill-maps.md`,
untouched by 61I) · **audit:validation-keys 0 violations** · audit:contains-bc 6/6 ·
audit:exact-bc PASS · audit:sql-resultset-bc (8 opted+6 dark, no drift) ·
audit:csv-set-equal-bc (2+1 dark, no drift) · audit:authoring exit 0 (C2/SaaS/FinOps
publish-ready) · audit:pedagogy exit 0 · check:authored-{c2 [1,2,3,5],saas-mart,finops} ·
check:db-baseline serverGrade=10. (`check:boot` is not a script in this workspace —
brief gate list carried it but it does not exist here.)

## 15. Commits
Sweep bulk (17 files + the promote map) in pushed session wips `0d08b2b` /
`8cad9df`; the contract + guards + guardrails + dbt-revert + tests + audit in
`e9515d8` (clean conventional). This close-out + the mini-report archive follow.

## 16. Independent reviews
- **atlas-architect-reviewer → _pending_** (verdict + P0/P1/P2 to be recorded).
- **code-reviewer → _pending_** (SHIP/NO-SHIP to be recorded).

## 17. Tracked follow-ups (NOT in 61I)
- **Phase 61J:** catalog-wide `json_equal` + `numeric_tolerance` dead-gate sweep
  (no runtime branch → auto-pass). `json_equal` overlaps the Phase-52 canary kind —
  coordinate. Confirm/triage any VISIBLE json_equal/numeric_tolerance dead gate.
- `.gitattributes` EOL-normalize for generated/authored churn (recurring P2).

## 18. Invariants
serverGrade **= 10**; exact now enforceable (contract) + fails closed; contains /
exact / regex authoring is strict-allowlisted; `matchContains` + rowset comparators
byte-unchanged; envelope OFF; Phase 52 untouched; no schema/migration; RUBRIC
frozen; C2 + SaaS + FinOps visible+approved; no rowset drift; no leak; 61G + 61H
regressions green. **Phase 61J not started.**
