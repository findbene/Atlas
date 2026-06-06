# Phase 57B-flip — promote C2 + opt in one csv_set_equal step (close-out)

**Status:** SHIPPED (pending focused commit — see §commit note). The first LIVE `csv_set_equal`
server-grade opt-in. Exactly ONE row opted in (C2 step 3). Candidate promoted to visible + rubric-approved.
Envelope enforcement remains OFF. Phase 52 untouched.

Self-review note: the independent `atlas-architect-reviewer` + `code-reviewer` subagents returned
`API Error: 529 Overloaded` (Anthropic server-side outage) on two attempts and produced no findings. Per
the model-routing/self-review protocol the orchestrator (Opus) is the T0 reviewer; a full adversarial
cognitive self-review was performed instead (§self-review), backed by the live audit's execution evidence.
Recommend re-running `/code-review` + the architect review when the API recovers.

---

## 1. Files changed
- `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts` — `serverGrade: true`
  on step-3 csv_set_equal spec (+ explanatory comment). The ONLY opt-in.
- `artifacts/atlas/src/pages/project-workspace.tsx` — P2b: both needs-run branches (Check + Submit) now
  `toast({description: CSV_SET_EQUAL_NEEDS_RUN})` + early `return` instead of red CHECK_FAIL/SUBMIT_FAIL;
  added `import { toast } from "@/hooks/use-toast"`.
- `scripts/src/audit-csv-set-equal-bc.ts` — `main()` partitions DARK vs OPTED-IN rows (see §audit).
- `lib/api-spec/openapi.yaml` — optional `ProjectStep.serverGrade: boolean`.
- `lib/api-client-react/src/generated/api.schemas.ts`, `lib/api-zod/src/generated/api.ts`,
  `lib/api-zod/src/generated/types/projectStep.ts` — Orval regen, `serverGrade?: boolean` (the only
  content addition). (See §commit note re: CRLF churn on other generated files.)

## 2. Exact promotion change
Promotion is the `author:project promote` CLI (not a flag edit). DB ops on local Docker PG:
1. `backfill:phase55-candidates` (idempotent) → created C2 candidate row `c2dbc2db-d4e5-4f6a-9051-2b3c4d5e6f70`.
2. `author:project promote analytics-engineer-semantic-layer-with-dbt-and-duckdb` → inserted the visible
   `projects` row (`learnerVisible` defaults TRUE; learner routes gate on `learnerVisible` only, NOT
   `qualityStatus`) + 8 `project_steps` + atomically stamped inverse lineage (`promote()` hard-fails
   unless exactly 1 candidate row matches `candidateId`). Course=analytics-engineer, domain=data-engineering.
3. `author:project audit --commit <slug>` → rubric **85.3 → qualityStatus=approved**.

## 3. Exact serverGrade:true change
`scripts/src/authored/...semantic-layer...ts:379` — added `serverGrade: true,` as the first key of the
step-3 `validationConfig("csv_set_equal", …, { serverGrade:true, query, columns, expectedRows })` spec.
The authoring guard (`assertValidCsvSetEqualSpec`) accepts it (columns=6 non-empty strings + expectedRows
present, every row width=6). No other field changed.

## 4. Confirmation only one row is opted in
- `grep serverGrade scripts/src/authored/` → **single hit** (C2 step 3).
- `audit:csv-set-equal-bc` → **"Visible csv_set_equal steps: 1 (dark: 0, opted-in: 1)"**.

## 5. Confirmation C2 is visible / publish-ready
`learnerVisible=true` (promote default) + `qualityStatus=approved` (rubric 85.3). `audit:authoring` exit 0
shows it in the visible catalog (48 visible projects, 100 steps). Minor informational gaps only
(8 unrecognized stack tokens; no execution profile → simulated runner, which is correct for this lab).

## 6. OpenAPI / Orval files changed
- `lib/api-spec/openapi.yaml` — `ProjectStep.serverGrade?: boolean` (optional; NOT in `required[]` → BC).
- Regen (`pnpm --filter @workspace/api-spec run codegen`, orval 8.5.3): `serverGrade?: boolean` added to
  `api-client-react/.../api.schemas.ts`, `api-zod/.../types/projectStep.ts`, and the zod response schema
  in `api-zod/.../api.ts` (2 endpoints). `typecheck:libs` passed.

## 7. Results of all gates (Node 24.16.0; Docker PG :5434)
- typecheck + `check:no-heuristic-runtime` — **PASS**.
- execution-core **83/83** · atlas **159/159** · api-server **466/466**.
- curriculum-quality **132 pass / 1 fail** (pre-existing env-only `COURSE_TAXONOMY` ENOENT).
- `audit:authoring` — **exit 0**. `audit:contains-bc` — **PASS** 3/3 steps, 21 subs, 0 mismatch.
- `audit:csv-set-equal-bc` — **PASS** (see §8).
- architect + code review — **subagents 529'd**; Opus self-review performed (§self-review).

## 8. audit:csv-set-equal-bc result (expected visible count)
```
Visible csv_set_equal steps: 1  (dark: 0, opted-in: 1)
Dark steps checked: 0  (bare-string mismatches: 0, envelope mismatches: 0)
Opted-in steps checked: 1  (opt-in grading checks: 5, failures: 0)
PASS — … 1 opted-in row(s) grade correctly (correct capture passes; raw SQL / malformed / wrong-rows / empty fail closed).
```

## 9. Step 3 pass/fail validation evidence
The extended audit runs the live DB row through the real `gradeSubmission`→`gradeCsvSetEqual` commit path:
- **PASS** — submission `JSON.stringify({columns, rows: expectedRows})` (== the Phase-0.zz browser-WASM
  byte-verified capture) → `passed:true`.
- **FAIL CLOSED** — `""` (empty), raw SQL (`select * from mart_subscription_monthly …`), malformed JSON
  (`not json {`), and wrong-rows (mrr_amount 199→200 on the April row) → all `passed:false`.
Chain to the real learner runtime: Phase 0.zz proved the browser `duckdbAdapter` output for step 3 equals
`expectedRows` byte-for-byte (after `normalizeSqlRows`); the FE submits exactly that on the commit path;
the server comparator passes it. The flip is safe end-to-end.

## 10. Phase 52 + envelope enforcement untouched
- `envelopeGrade.ts` / `envelopeSubmit.ts` / `user.ts` — **zero diff** (verified).
- `PILOT_RUNTIME_KINDS = {json_equal}` — `csv_set_equal` deliberately NOT added.
- `ATLAS_ENVELOPE_REQUIRED_KINDS` empty (Phase 47 default) — unchanged. The opted-in row is graded by the
  COMMIT path only; the signed envelope rides along as provenance but is not enforced.
- Phase 52 `json_equal` canary — no env/canary change.

## self-review (Opus, in lieu of 529'd subagents)
- **Fail-closed (security-critical):** traced `gradeCsvSetEqual` (grading.ts:377-556) — serverGrade gate →
  malformed/empty/non-JSON/shape-mismatch/row-mismatch all return `passed:false`; only an exact multiset
  match returns `PASS_OK`. Confirmed by the audit's 5/5 live checks (not just by reading).
- **Exactly one opt-in:** grep-confirmed single `serverGrade:true` in authored/.
- **Audit guard not weakened:** dark rows still get the full legacy-auto-pass BC check (bare + envelope);
  only the filter changed. typecheck + live run green.
- **Toast P2:** no dispatch on needs-run → step stays `editing` (no red, no stuck spinner); the mutation
  is never invoked; `CSV_SET_EQUAL_NEEDS_RUN` still referenced (no unused-const). atlas 159/159 unaffected.
- **Codegen:** `serverGrade` optional → old responses valid; diff content = serverGrade only.
- **No scope creep / secrets / H3 overclaim.** Envelope/Phase-52/schema/migration untouched.

## commit note (CRLF churn)
Orval 8.5.3 (vs the 8.5.2 that last generated the committed files) rewrote all generated files with LF;
the repo stores CRLF, so `git status` flags ~95 `api-zod/.../types/*.ts` as modified with **no content
change** (the post-codegen `git diff --stat` restricted to the codegen dirs showed only the 4 real files).
The focused commit stages ONLY: the 2 source files, the audit, openapi.yaml, and the 3 generated files
that actually gain `serverGrade` — the EOL-only churn files are restored to HEAD. Durable fix (out of
scope): add a `.gitattributes` `eol=lf` rule for `lib/*/src/generated/**` + renormalize.

## 11. Remaining risks
- **R1 (advisory):** `audit:authoring`'s static kind→class map still labels `csv_set_equal` as
  "client-provisional" — it doesn't read `serverGrade`, so the opted-in row is mis-labeled in that report
  (informational only, exit 0). Follow-up: teach the classifier that `serverGrade:true` csv_set_equal is
  server-enforced.
- **R2:** enterprise-NRR filter dead-branches (carried from 0.z) — fixture-author caution only.
- **R3 (generated CRLF churn):** see §commit note; needs a `.gitattributes` normalization pass.
- **R4:** broader app boot still needs Node-24 `pnpm install` + Phase 0.2 decouple; the grading path
  itself is verified.
- Envelope ENFORCEMENT for csv_set_equal remains a separate future operator decision (independent of this
  commit-path opt-in and of the parked Phase-52 json_equal canary).

## 12. Recommended next step
Re-run the architect + `/code-review` when the API recovers (the only gate not completed by a subagent
this phase). Then **monitor the single opted-in row** in a real environment (private beta / staging) before
opting in additional csv_set_equal rows or considering envelope enforcement. Next hardening: Phase 58
(`sql_resultset` server grading) — but do NOT start it until 57B-flip is reviewed + observed.
