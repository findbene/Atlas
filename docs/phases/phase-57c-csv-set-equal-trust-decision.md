# Phase 57C — `csv_set_equal` Signed-Capture Trust Decision & First Opt-In Plan

> **Type:** read-only decision / proposal. No code changed. Stop for owner approval before any implementation.
> **Author:** Claude Code. **Date:** 2026-06-06. **Status:** PROPOSAL — awaiting approval.
> **Inherited hard stops honored:** no code change, no DB opt-in, no schema/migration, no env/canary change,
> no OpenAPI/codegen, no frontend/backend behavior change, no cert copy change, Phase 52 untouched.

---

## 0. Premise correction (verified against `main`)

The inbound brief stated "Phase 57B-prereq frontend submission-shape wiring is complete." **It is not in the repo.**
Verified absent: `artifacts/atlas/src/lib/csvSetEqualSubmit.ts` (does not exist), no `serverGrade` field on any
`artifacts/api-server/src/routes/*` response, no `capturedSqlByStepId` in `project-workspace.tsx`, no
`phase-57b*` doc, no matching commit. **True state: Phase 57A (dark comparator) is the last shipped csv work.**
The frontend submission-shape wiring is therefore a *deliverable of the next implementation phase*, not a
prerequisite already in place. This proposal is written to that reality.

---

## 1. Findings — how the flow actually works today

### 1.1 `csv_set_equal` runtime grading (`artifacts/api-server/src/lib/grading.ts`)
- Dispatch (`gradeSubmission`): `validationType === "csv_set_equal" && step.validationConfig` →
  `gradeCsvSetEqual(cfg.spec, submission)` where `cfg = validationConfig as { spec }`.
- **Opt-in gate:** `gradeCsvSetEqual` returns `BC_AUTO_PASS {passed:true,"Step completed."}` unless
  `spec.serverGrade === true`. Non-boolean → opt-out (defense in depth).
- When opted in, it **requires `submission` to be a JSON string** `{"columns": string[], "rows": cell[][]}`
  (cell = string|number|boolean|null). Anything else **fails CLOSED** with learner-readable feedback.
- Comparator is complete: column-set check, per-row width check, multiset (default) or positional
  (`orderSensitive`) compare, inline `expectedRows` or `expectedRowsHash`, normalization knobs
  (`trimStrings`/`nullEqualsEmpty`/`coerceNumericStrings`/`caseInsensitive`/`dedupe`).

### 1.2 Authoring shape (`lib/curriculum-quality/src/authoring.ts`)
- `validationConfig(kind, description, spec)` → `{ kind, description, spec }`. Runtime reads `cfg.spec` — **shapes match.**
- `assertValidCsvSetEqualSpec`: when `serverGrade:true`, REQUIRES `columns` + (`expectedRows` | `expectedRowsHash`),
  strict boolean/dedupe/hex type checks. When `serverGrade` absent → legacy fixture shapes pass through (dark).

### 1.3 Frontend captured-SQL flow (`project-workspace.tsx`, `lib/envelopeClient.ts`, `lib/duckdb/duckdbRunner.ts`)
- DuckDB-WASM adapter returns `{ ok, columns, rows[][], durationMs }`. `rows` cells are normalized:
  `bigint` → `Number` when within safe-int range, **else a string**; `null`/non-finite → `null`.
- On **Run**, `buildSqlCapture(code, sqlRunResult)` builds a `RunCapture` that **already carries
  `columns` + `rows`**, then fire-and-forget signs it via `POST /api/runs/sign` and stashes
  `envelopeByStepId[stepId]` (run-generation-guarded against the stale-capture race). Soft-fail: any sign
  failure is swallowed; the learner falls back to bare-string submit.
- On **Submit / Check**, the wire `submission` for a code step is **`code` (the raw SQL)** —
  `const submission = isCodeStep ? code : textAnswer`. The signed envelope (when present) rides along.
- **There is no path today that sends `{columns, rows}` JSON as the submission.** This is the gap.

### 1.4 Signed RunEnvelope (`lib/execution-core/src/runEnvelope.ts`, `routes/runs-sign.ts`)
- `RunCapture` **already has optional `columns`/`rows`** (DuckDB-style). The signer derives both hashes
  server-side (S1), canonicalizes deterministically, HMAC-signs, single-use nonce, 10-min TTL.
- `/api/runs/sign` `SIGNABLE_KINDS` **already includes `csv_set_equal`** (+ auth, ownership, visibility→404,
  premium, enrollment gates; size caps `MAX_ROWS=5000`, `MAX_COLUMNS=256`).
- Library header is explicit (threat model §7): the signature proves **"Atlas issued this envelope with this
  binding"** — it does **not** prove the learner wrote or honestly executed the code (residual A2/A5).
  **Honest-claim ceiling = H3.**

### 1.5 Submit verification & envelope grading (`lib/envelopeSubmit.ts`, `lib/envelopeGrade.ts`, `routes/user.ts`)
- `/submit` envelope branch is entered **only** when `isEnvelopeEnforcedFor(kind, userId)` is true, which
  requires `kind ∈ ATLAS_ENVELOPE_REQUIRED_KINDS` (**empty by default**) + the Phase 50/52 canary machinery.
- When the envelope branch is taken, grading runs `gradeEnvelopeCapture(step, capture)`. **That function
  special-cases only `json_equal`; every other kind (incl. `csv_set_equal`) falls through to
  `gradeSubmission(step, capture.stdout)`.** For SQL, `capture.stdout` is the `"N row(s) in Tms"` summary —
  **not** `{columns,rows}` JSON — so the comparator would fail CLOSED. The envelope path does **not** yet feed
  tabular fields to the comparator.
- Per-user serialization via `pg_advisory_xact_lock(hashtextextended('atlas-submit:'||user.id,0))` confirmed
  at `routes/user.ts:583`. Pure grading runs outside the tx.

### 1.6 The candidate step (`scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts`, step 3)
- `validationType:"csv_set_equal"`, `stepType:"code_sql"`. Spec (Shape D — eligible): `{ query, columns,
  expectedRows }`, **no `serverGrade`**, no hash. Columns: `month_start, mrr_amount, is_new_customer,
  is_expansion_this_month, is_contraction_this_month, is_churned_this_month`. Four inline expected rows for
  customer `C-100` (2025-04..07): `["2025-04-01",99,true,false,false,false]` … `["2025-07-01",0,false,false,false,true]`.
- Mechanically, the only spec change to opt in is adding `serverGrade:true`. **But that alone breaks the step**
  (see §3): with `serverGrade:true`, the bare-string raw-SQL submission fails CLOSED.

---

## 2. The core tension

`serverGrade:true` flips **both** grading paths simultaneously:
- **Legacy/commit path** (`gradeSubmission(step, submission)`) — `submission` is raw SQL today → JSON.parse
  fails → **fail closed for every learner.**
- **Envelope path** — even when enforced, `gradeEnvelopeCapture` routes `stdout` (a summary) → fail closed,
  because there is no `csv_set_equal` branch.

So a first opt-in needs the submitted *value* to be the canonical `{columns,rows}` JSON on whichever path
actually grades — **and** the signing soft-fail fallback must not leave a learner submitting raw SQL into a
`serverGrade:true` step. This is the real blocker the earlier audit identified; it is confirmed in code.

---

## 3. Options

| | **A. Raw `{columns,rows}` JSON** | **B. Signed-envelope `{columns,rows}`** | **C. Staged hybrid (recommended)** |
|---|---|---|---|
| **What it proves** | Learner submitted rows matching the expected set. | Same — plus Atlas issued an envelope binding (user/project/step/kind, single-use nonce, server-derived hashes, TTL). | Same as A on the commit path; upgrades to B's binding whenever an envelope is present. |
| **What it does NOT prove** | That the learner's SQL produced the rows; authorship. (Fully tamperable client-side.) | That the learner wrote/honestly executed the SQL (residual A2/A5). | Same — H3 ceiling either way. |
| **Impl changes** | FE: send canonical JSON as `submission` for opted-in csv steps (NEW `csvSetEqualSubmit.ts` + capture wiring + per-step `serverGrade` exposure). | FE capture/sign **already exists**; add `csv_set_equal` branch to `gradeEnvelopeCapture`; enable enforcement for the kind via `ATLAS_ENVELOPE_REQUIRED_KINDS`+canary. | Both of the above: FE JSON submit (fixes commit path + soft-fail) **and** the `gradeEnvelopeCapture` branch (provenance when enforced). |
| **Learner UX** | Transparent. Soft-fail safe (commit path grades JSON). | If sign soft-fails → bare-string fallback → **fail closed** unless commit path also handles JSON. Fragile alone. | Transparent + soft-fail safe; envelope is a silent provenance upgrade. |
| **Tests** | grader (exists) + FE submit unit + submit-integration + BC audit. | + envelopeGrade csv cases + canary/enforcement tests + BC audit. | Union of A and B. |
| **Rollback** | `serverGrade:false` re-seed → instant dark auto-pass. | Same + env canary→0. | Same: spec flag is the master switch; env reverts enforcement. |
| **Overclaim risk** | Low if copy says "submitted rows matched." High if copy implies "your query produced." | Medium — the word "verified/signed" tempts authorship claims; must stay H3. | Managed: H3 copy, envelope framed as provenance evidence, never proof of authorship. |

---

## 4. Recommendation — **Option C (staged hybrid), provenance-biased**

Rationale: Option B alone is unsafe because the signing soft-fall-back path can't grade raw SQL under
`serverGrade:true` (fail-closed). Option A is safe but throws away the existing envelope spine that already
carries `{columns,rows}` and already signs SQL captures. C makes the **commit path grade the canonical JSON
capture** (safe, deterministic, soft-fail-proof) while letting the **signed envelope ride along as provenance**
and become an *optional, separately-canaried* enforcement later — exactly mirroring how `json_equal` was
staged (Phase 48 grader dark → Phase 50/52 canary). It aligns with the H3 trust spine without overclaiming.

**Honest claim to ship:** *"Atlas verified that the result rows you submitted for this step matched the
expected set."* Forbidden: "verified your query produced these rows", "tamper-proof", "verified authorship".

---

## 5. Exact next implementation phase if approved

**Phase 57B-prereq (build, dark) — FE submission-shape wiring + envelope grader branch. No row opts in.**
1. Expose a **narrow derived `step.serverGrade: boolean`** on `GET /projects/:slug` — derived from
   `validationConfig.spec.serverGrade === true`. Do **not** expose `validationConfig`/`expectedRows` (answer-key leak).
2. NEW `artifacts/atlas/src/lib/csvSetEqualSubmit.ts` — given (stepType, serverGrade, last successful DuckDB
   capture), return `raw` (legacy) | `json` (`{columns,rows}`) | `needs-run` (fail-safe: no fresh capture).
3. `project-workspace.tsx` — stash last successful DuckDB `{columns,rows}` per step (reuse the existing
   run-generation guard so edits/nav/reset invalidate it), and route Check+Submit through the helper.
4. `lib/envelopeGrade.ts` — add a `csv_set_equal` branch that serializes the verified `capture.{columns,rows}`
   into the comparator's JSON contract and calls `gradeCsvSetEqual(spec, json)`. Dark until the kind is enforced.
5. Symmetry: extend `audit:csv-set-equal-bc` to prove the **14 non-opted** visible rows stay byte-identical via
   both the new FE path and the envelope path; add envelopeGrade + submit-integration tests.

**Phase 57B-flip (single-row opt-in) — only after 57B-prereq AND local execution verification (§7):**
6. Add `serverGrade:true` to step 3's spec in the authored file; re-seed. **Exactly one** row (0 enrollments).
   Architect PASS + `/code-review` + close-out.

**Phase (later, separate, operator-gated):** add `csv_set_equal` to `ATLAS_ENVELOPE_REQUIRED_KINDS` and ramp via
the existing canary knobs to make the signed-envelope provenance an enforced gate. **Do not touch the parked
`json_equal` Phase 52 canary** — `csv_set_equal` gets its own independent bucket/ramp.

### Files likely to change next phase
- `artifacts/api-server/src/routes/projects.ts` (derive+expose `serverGrade`)
- `artifacts/atlas/src/lib/csvSetEqualSubmit.ts` (NEW) + `*.test.ts`
- `artifacts/atlas/src/pages/project-workspace.tsx` (capture + wire Check/Submit)
- `artifacts/api-server/src/lib/envelopeGrade.ts` (+`csv_set_equal` branch) + `envelopeGrade.test.ts`
- `artifacts/api-server/src/routes/user-submit*.test.ts` (csv path)
- `scripts/src/audit-csv-set-equal-bc.ts` (extend BC coverage)
- **Likely required:** `lib/api-spec` (OpenAPI) + Orval regen → `lib/api-client-react` + `lib/api-zod`, because
  the `/projects/:slug` response shape gains `serverGrade`. (Proposal does NOT run codegen; flagged for the build phase.)
- 57B-flip only: `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts` (+re-seed).
- **Not touched:** DB schema/migrations, `RUBRIC_VERSION`, learner_visible, cert/portfolio copy, Phase 52, env/canary (until the later enforcement phase).

### Gates / tests required
typecheck + `check:no-heuristic-runtime`; vitest `api-server` / `atlas` / `curriculum-quality` / `execution-core`;
`audit:authoring` 60/60; `audit:csv-set-equal-bc` byte-identical for the 14 non-opted rows **and** correct
pass/fail for the 1 opted row; `audit:contains-bc` unchanged; `atlas-architect-reviewer` PASS; `/code-review`.

### Rollback plan
`serverGrade:true → false` (re-seed) reverts the step to dark auto-pass instantly — the comparator's opt-in gate
is the master switch. The FE JSON-submit and `gradeEnvelopeCapture` branch are no-ops for non-opted rows, so they
remain safely. If envelope enforcement is later enabled, it reverts via `ATLAS_ENVELOPE_REQUIRED_KINDS` /
canary-percent → 0 (Phase 52 pattern).

---

## 6. Risks
- **R1 — `serverGrade:true` fails closed on the commit path** if FE still sends raw SQL. *Mitigation:* 57B-prereq
  (FE JSON submit) ships and is verified BEFORE the flip; never flip the spec first.
- **R2 — Numeric type fidelity.** `mrr_amount` expected as JS numbers `99/199/0`. DuckDB-WASM coerces `bigint`→`Number`
  only within safe-int range, **else string**; DECIMAL/DOUBLE may surface as a string like `"99.0"` → mismatch vs
  number `99` under default (non-coercing) comparison. *Mitigation:* §7 verification; if drift, fix `expectedRows`
  types or set `coerceNumericStrings:true` — decided against a real run, not guessed.
- **R3 — Fixture dependency.** The 4 expected rows assume the seed CSVs yield C-100's exact trajectory; unverifiable
  without the seeds + a run. *Mitigation:* §7.
- **R4 — Answer-key leak.** Exposing the full `validationConfig`/`expectedRows` to the client would leak the answer.
  *Mitigation:* expose only the derived `serverGrade` boolean.
- **R5 — Overclaiming.** *Mitigation:* H3 copy (§4); audit copy at phase close.

## 7. Expected-rows verification (task 7) — **NOT yet verifiable here; gates the flip, not this proposal**
Confirming step 3's `expectedRows` match real DuckDB-WASM output requires executing the reference solution against
the seed fixtures — which needs the local baseline (**Node 24 + `pnpm install` + DuckDB-WASM**, currently not
established; see HANDOFF). Static review confirms **shape/column/string/boolean alignment**; it **cannot** confirm
numeric-type fidelity (R2) or fixture row-set (R3). **Therefore: run step 3's solution locally, capture actual
`{columns,rows}`, and byte-compare to `expectedRows` under default normalization before 57B-flip.** This makes the
flip dependent on Phase 0.x local-green — the proposal and 57B-prereq build do not need it.

---

## 8. Decision requested
Approve **Option C**. Then proceed to **Phase 57B-prereq (build, dark)** — no row opts in, no enforcement enabled.
**The first opt-in (57B-flip) stays blocked** on (a) 57B-prereq landing green and (b) §7 local execution
verification. **Stop here for approval. Do not implement.**
