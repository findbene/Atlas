# Phase 44 — Runtime Validation Trust Model + Signed RunResult Plan

**Phase kind:** Planning-first. No runtime behavior changed.
**Companion docs:**
- [docs/runtime-validation-threat-model.md](../runtime-validation-threat-model.md)
- [docs/signed-run-result-design.md](../signed-run-result-design.md)
- [phase-43b-prime-json-equal-audit-warning.md](phase-43b-prime-json-equal-audit-warning.md)
- [phase-42-validation-kind-guardrail.md](phase-42-validation-kind-guardrail.md)
- [docs/validation-kind-matrix.md](../validation-kind-matrix.md)

**Date:** 2026-05-27.
**Architect posture going in:** Phase 43B-prime closed with PASS, advisories live, publish-ready unchanged. The next move is *not* code — it is to define the trust model before any signing surface ships.

---

## 1. Objective

Produce a publishable threat model + design + implementation plan for the only honest fix to the Phase 42/43B-prime grading gap, *before* any code:

- What the runtime validation trust boundary actually is.
- What Atlas can and cannot honestly claim about runtime output.
- The concrete signed-RunResult envelope shape, signing surface, verification rules, and rollout sequence.
- The implementation phases (Phase 45+) and their hard stops.

**Non-goal:** ship the envelope. Phase 44 is paperwork. Shape γ implementation is gated on this work and a follow-up architect review.

---

## 2. Read-only audit (current state)

Performed against `main` at the start of Phase 44. All findings cross-checked against source.

### 2.1 Where code execution happens

- **In the browser only.** `artifacts/atlas/src/lib/pyodideRunner.ts` loads Pyodide from jsdelivr CDN, runs Python in a single global VM, serializes runs through a `runChain` promise. `artifacts/atlas/src/lib/duckdb/` is the same pattern for SQL.
- **No server-side execution exists.** The legacy `POST /api/execute/python` route returns a deprecation no-op (Piston switched to whitelist-only Feb 2026).
- **`POST /api/runs` exists as a debug-aid logger only.** Stores `(code, stdout, stderr, ok)` per run for the learner's own history. **Never consumed by `/check` or `/submit`.** Size-capped (8KB code / 4KB stdout). This is a logging surface, not a grading surface — must not be confused with Shape γ.

### 2.2 RunResult shape today

Two parallel shapes:

- `ExecResult` in `artifacts/atlas/src/lib/pyodideRunner.ts`: `{ stdout, stderr, exitCode, timedOut }`. Browser-only, never serialized to the server.
- `RunResult` in `lib/execution-core/src/types.ts`: `{ ok, stdout?, stderr?, columns?, rows?, durationMs, timedOut?, error? }`. Used by the `ExecutionAdapter` contract + `validateExpected` helper. Currently consumed only by future-mode adapters (`replay`, `local_container`, `byo_cloud`, `managed_sandbox` — none of which are wired into the live submit flow today).

`validateExpected` already implements high-quality row/stdout/regex/metrics comparison — it's just never called from the live `/submit` path, because the live path runs `gradeSubmission` against a bare string.

### 2.3 What `/check` and `/submit` actually receive

- Body: `{ submission: string | null, submissionType?: string }`.
- For all `code_python` / `code_sql` / `multi_file` steps, `submission` is the learner's **source code**, not a captured RunResult.
- `submissionType` is informational only — `gradeSubmission` doesn't switch on it.
- Server then calls `gradeSubmission(step, submission)` in `artifacts/api-server/src/lib/grading.ts`. The switch covers `self_attest` / `exact` / `contains` / `regex`. Everything else (`json_equal` / `numeric_tolerance` / `sql_resultset` / `csv_set_equal` / `csv_ordered`) falls through to `{ passed: true, feedback: "Step completed." }`.

### 2.4 Can the server distinguish code from runtime output today?

**No.** Both arrive as the same `submission` string field with no shape discriminator. This is exactly the Phase 43B-prime finding: naive `JSON.parse(submission)` against `json_equal` steps would crash because `submission` is `import pandas as pd\n...`, not `{"answer": 42}`.

### 2.5 Fields needed for real `json_equal` validation

Sufficient set (from the design doc §2 `RunCapture` shape):

- `code` — the raw source the client claims to have executed. The server recomputes `sha256(code)` and compares to `binding.submissionSha256`; the client never sends a pre-computed digest, so a "lied about my own hash" attack class is impossible by construction.
- `stdout` — the surface `json_equal` and `numeric_tolerance` graders parse.
- `stderr` — surfaced in failure feedback ("your run errored before validation").
- `exitCode` — gate on `=== 0` before grading.
- `durationMs`, `timedOut` — informational, not graded.
- `columns + rows` — for SQL/DuckDB-shaped steps (`sql_resultset` / `csv_set_equal`).
- Binding context: `userId`, `projectId`, `stepId`, `validationType`, `issuedAt`, `expiresAt`, `nonce`, `submissionSha256` — verified server-side.

### 2.6 What signing can honestly prove

A valid Shape γ signature proves **"this RunCapture was issued by Atlas with this exact binding at this exact timestamp."** It proves the envelope hasn't been mutated since signing, that it's bound to the right user/project/step, that the source code hasn't changed since signing, and that this envelope hasn't been used before.

### 2.7 What signing cannot prove

The signature does NOT prove:

- That the learner ran their own code (vs. someone else's code returning the same output).
- That the learner wrote the code.
- That Pyodide was the runtime (a sufficiently motivated learner can spoof the entire capture-then-sign loop).
- That the output is "correct" — the signing endpoint must be neutral (no grading on `/sign`, no expected-output exfiltration vector).

Threat model §6 enumerates the concrete attacks (A1–A9); §7 fixes the honest claim ceiling at **H3 — "Atlas verified the runtime output matched the expected result."** Nothing stronger.

### 2.8 Threat-by-threat resolution

| Threat | Pre-Shape γ | Shape γ outcome |
|---|---|---|
| Learner fabricates RunResult (no exec) | passes silently on `json_equal`/`numeric_tolerance` | rejected (envelope must contain captured output that deepEquals expected) |
| Learner edits frontend payload | trivial | rejected (signature) |
| Replay attack from prior step | n/a | rejected (binding + nonce) |
| Wrong project/step binding | n/a | rejected (binding verified) |
| Stale result after code edit | n/a | rejected (`submissionSha256`) |
| Local browser compromise (DevTools) | full read/write of expected output, can spoof RunResult, can request signature on forged data | **unchanged — accepted residual** (A2 + A5) |
| Sandbox escape | n/a (no sandbox claim) | unchanged |
| Non-deterministic outputs | n/a | content-layer fix (authoring spec) |
| AI-assisted cheating | undetectable | unchanged — accepted residual |

---

## 3. Deliverables produced in Phase 44

| # | File | What it gives | Status |
|---|---|---|---|
| A | `docs/runtime-validation-threat-model.md` | Trust boundaries, actors, assets, attacker capabilities, attacks, mitigations, residual risks, honest product claims, unacceptable claims, required disclosure work. | ✅ new |
| B | `docs/signed-run-result-design.md` | Envelope shape, canonical serialization, signing/verification topology, replay protection, migration strategy, backward compatibility, test plan, open questions. | ✅ new |
| C | `docs/phases/phase-44-runtime-validation-plan.md` | This file — recommended implementation phases + hard stops + commit message. | ✅ new |
| D | Pure types in `execution-core` | Deferred. The design doc carries the proposed shapes inline. Promoting them to live exports without a consumer would just be dead code; better to land them in Phase 45 alongside the canonicalizer + tests. |

---

## 4. Recommended implementation sequence (Phase 45 onwards)

Each phase is a separate ticket, each ends with its own architect review.

### Phase 45 — Envelope types + canonicalizer + verifier (server-only, no behavior change)

- Add `RunCapture`, `RunEnvelope`, `signRunEnvelope`, `verifyRunEnvelope`, `canonicalizeRunCapture`, `canonicalizeBinding` to `lib/execution-core`.
- Add round-trip + property tests in `lib/execution-core/src/runCapture.test.ts`.
- Add new `SIGNING_SECRET` request to the env (Replit secret).
- **No route changes.** No `/sign` endpoint yet. No frontend change. No `/submit` behavior change.
- Gate: `pnpm run typecheck`, `pnpm --filter @workspace/execution-core run test`, no audit count changes, no grading.ts diff.

**Phase 45 security acceptance criteria (carry into Phase 46+):**

1. **Server is sole hash authority.** `binding.submissionSha256` is always derived server-side from `capture.code`; any client-supplied digest is ignored. Verifier MUST recompute and compare every time.
2. **Canonicalization determinism.** Property test: any object-key insertion order, any equivalent unicode normalization input, any equivalent number representation produces the same canonical bytes. Failure = build break.
3. **Signing-key isolation.** `SIGNING_SECRET` is read once at boot, kept in process memory, never logged, never echoed in any response (including error responses). Add a smoke test that greps the structured-log output of a failing `/sign` call for any leaked secret characters.
4. **Verify-before-trust ordering.** `verifyRunEnvelope` returns a discriminated `Ok | Err` — there is no API surface that exposes `RunCapture` *before* signature verification passes. Type system enforces this (caller cannot pattern-match into the capture branch without proving the verifier returned `Ok`).
5. **Replay semantics specified before Phase 46.** Nonce uniqueness window = signing-side TTL + a small clock-skew tolerance (proposed: TTL + 30s). Nonce store insert is the atomic transaction boundary — Postgres `INSERT ... ON CONFLICT DO NOTHING` returning row count, 0 rows = replay rejection.
6. **No grading code path in the Phase 45 surface.** Build break if `lib/execution-core/src/runCapture.ts` imports anything from `artifacts/api-server/src/lib/grading.ts` or `lib/curriculum-quality`. Keeps the trust-boundary surface auditable in isolation.
7. **Abuse / rate-limit requirements deferred to Phase 46** (where the signing route lands) but pre-committed here: `/api/runs/sign` will be per-user rate-limited (proposed: 10 req/sec burst, 60 req/min sustained) to make signing-side brute-force / oracle probing economically uninteresting. Phase 46 ticket must include the rate-limit design before architect review.
8. **Auditability.** Every `/sign` and `/submit` envelope event emits a structured log line with `evt:'envelope.sign'` / `evt:'envelope.verify'` carrying `{userId, projectId, stepId, validationType, signatureValid, failureReason?}` — never the secret, never the expected output, never the raw stdout (length only). Lets ops reconstruct any incident without a forensic replay.

### Phase 46 — `/api/runs/sign` endpoint (signing surface only, still no grading change)

- New route, requireAuth, enrollment-gated.
- Look up `step.validationType` server-side. Mint binding. Return signed envelope.
- Does NOT grade. Does NOT echo expected output.
- Add `run_envelope_nonces` table + Drizzle migration + janitor script.
- Frontend: nothing yet — endpoint exists but no one calls it.
- Gate: full typecheck, new route tests, no behavior change for any existing endpoint.

### Phase 47 — Grading arm for `json_equal` on captured output (server allow-list = empty by default)

- Extend `gradeSubmission` with the captured arm from design doc §5.
- Add `ENV.VALIDATION_KINDS_REQUIRING_ENVELOPE` parsing (default empty).
- `/submit` and `/check` accept the envelope shape when present; reject bare-string on allow-listed kinds.
- Phase 43B-prime advisory flip: when `json_equal` is in the allow-list, advisory promotes to finding.
- Audit script updated to recognize the new state.
- Gate: full test matrix from design doc §10, `publishReady` unchanged when allow-list empty.

### Phase 48 — Frontend envelope plumbing + product disclosure surface

- Wire Run button → `/api/runs/sign` → store envelope keyed by `stepId`.
- Submit handler posts envelope when step's `validationType` is in the SPA-side allow-list (read from a public bootstrap endpoint).
- All §9 failure-mode error codes mapped to learner-friendly copy.
- Publish "How Atlas Grades" page (threat model §10 deliverable). Certificate copy reviewed.
- Gate: e2e tests for happy path + each failure mode + the SPA cache-invalidation scenario.

### Phase 49 — Flip `json_equal` to envelope-required (controlled rollout)

- Add `json_equal` to `VALIDATION_KINDS_REQUIRING_ENVELOPE` for 1% of learners (Clerk org allow-list) for one week.
- Observe pass-rate, support volume, advisory promotion in audit.
- Roll to 100% on green.

### Phase 50+ — Repeat 49 for `numeric_tolerance`, then `sql_resultset` / `csv_set_equal` / `csv_ordered`

Each kind is its own phase with its own rollout window. Order chosen by population:

1. `numeric_tolerance` (36 visible steps).
2. `sql_resultset` (0 visible today, but design-ready for future SQL projects).
3. `csv_set_equal` / `csv_ordered` (0 visible today).

---

## 5. Files Phase 45+ will likely touch

Strictly informational — Phase 44 touches none of these:

- `lib/execution-core/src/types.ts` — new exports.
- `lib/execution-core/src/runCapture.ts` (new) — canonicalizer + signer + verifier.
- `lib/execution-core/src/runCapture.test.ts` (new) — round-trip + property tests.
- `lib/execution-core/src/index.ts` — re-exports.
- `lib/api-spec/openapi.yaml` — `/runs/sign` route, envelope schema, updated `/submit` request schema.
- `lib/api-zod`, `lib/api-client-react` — Orval codegen output (regenerated, not hand-edited).
- `lib/db/src/schema.ts` — `run_envelope_nonces` table.
- `lib/db/drizzle/NNNN_*.sql` (new) — migration.
- `artifacts/api-server/src/routes/runs.ts` (or a new `runs-sign.ts`) — `/sign` endpoint.
- `artifacts/api-server/src/lib/grading.ts` — captured-arm switch.
- `artifacts/api-server/src/routes/user.ts` — `/submit` + `/check` envelope handling.
- `artifacts/atlas/src/lib/pyodideRunner.ts` + `artifacts/atlas/src/lib/duckdb/` — capture-then-sign integration on Run.
- `artifacts/atlas/src/components/studio/StudioShell.tsx`, `EditorToolbar.tsx`, `ValidationFeedbackPanel.tsx` — envelope state, error-code handling.
- `scripts/src/audit-project-authoring.ts` — advisory-flip logic.
- `docs/project-authoring-spec.md` §5.1.1 — flip-flag wording.
- `docs/validation-kind-matrix.md` — enforcement-tier promotion rows.
- New: `docs/how-atlas-grades.md` (public disclosure page anchor for the SPA).

---

## 6. API / OpenAPI implications

- New endpoint: `POST /api/runs/sign` with request `{ projectId, stepId, capture: RunCapture }` and response `{ envelope: RunEnvelope }`.
- Updated endpoint: `POST /api/user/projects/:projectId/steps/:stepId/submit` request schema gains an optional `envelope: RunEnvelope` field. Backward-compatible — `submission: string | null` stays valid for unaffected kinds.
- Same for `/check` (subject to the open question in design doc §11).
- New error response shape: `{ error, reason: "envelope-required" | "envelope-bad-signature" | "envelope-expired" | "envelope-replay" | "envelope-binding-mismatch" | "envelope-tampered" }`. All map to 400.
- All codegen output regenerated via `pnpm --filter @workspace/api-spec run codegen`. Zero hand edits to generated files.

---

## 7. Frontend implications

- New TanStack Query hook `useSignRunEnvelope({ projectId, stepId })` produced by Orval.
- Per-step in-memory `envelopeRef` invalidated on any code edit.
- Submit handler switches on a SPA-side `validationKindsRequiringEnvelope` set fetched at app load.
- 400-error UI: a single component that maps `reason` codes to copy + a "Re-Run" CTA.

---

## 8. execution-core implications

- Today: types + validators are runtime-neutral. Phase 45+ adds concrete signing helpers — those need crypto. Use Node `crypto.subtle` on the server side; the lib can stay isomorphic if it uses Web Crypto. Worth verifying in the Phase 45 spike that `crypto.subtle.sign('HMAC', ...)` is available in the api-server's Node runtime (Node 24 — yes, stable).

---

## 9. `grading.ts` implications

- Today: pure, side-effect free, switch on 4 enums. Phase 47 adds a parallel switch arm for the captured-submission case. The legacy switch is preserved verbatim — it remains the source of truth for `self_attest` / `exact` / `contains` / `regex` and for backward compatibility on every step that hasn't migrated.
- New helpers: `parseExpected`, `parseStdoutJson`, `deepEquals`, `structuredDiff`, `perKeyEpsilon`. Each unit-tested independently in `artifacts/api-server/src/lib/grading.test.ts`.
- The "anything else / null → passes" fall-through stays in the legacy arm only. The captured arm uses an exhaustive switch; unknown `validationType` returns `{ passed: false, feedback: "Internal grader misconfiguration" }` (logged at warn level for ops).

---

## 10. Tests required (cross-cut)

Already enumerated by phase in §4. Aggregating:

- `lib/execution-core` — canonicalizer property tests, signer/verifier unit tests.
- `artifacts/api-server` — `/sign` route, `/submit` envelope happy/sad paths × every `validationType` in allow-list, replay/tamper/cross-user attacks, schema-migration smoke test.
- `artifacts/atlas` — submit-flow tests for each error code, Run-edit-Submit cycle, stale-envelope rejection UX.
- `lib/curriculum-quality` — advisory flip test gated on allow-list state.
- `scripts/src/audit-project-authoring.ts` — snapshot count assertions per allow-list state.

---

## 11. Rollout strategy

- Deploy gated by **server-side allow-list** (env var). Default empty → zero behavior change.
- Per-kind rollout: 1% (Clerk org allow-list) → 100% over 1-2 weeks per kind.
- Each rollout step is reversible by setting the env back. Postgres nonce table grows monotonically; janitor handles cleanup.
- Documentation surface (`docs/how-atlas-grades.md`, cert copy review) ships before the first 100% rollout — non-negotiable per threat model §10.

---

## 12. Hard stops for the implementation phases

Carried verbatim into Phase 45+ tickets:

- No `RUBRIC_VERSION` change.
- No weakening of any existing quality gate. `audit:authoring publishReady` only changes via documented advisory flips.
- No mass content edits. Per-step migration is a server-side allow-list flip, not a content rewrite.
- No row deletes from any `projects` / `project_candidates` / `user_*` table.
- No deployment of the signing endpoint without the disclosure surface (threat model §10) live.
- No certificate / portfolio copy change without product-review sign-off.
- No marketing language implying H1 or H2 (see threat model §7).
- No new third-party crypto dep — Web Crypto only.

---

## 13. What Phase 44 did NOT do (hard stops respected this phase)

- No `lib/grading.ts` edits.
- No `/check` or `/submit` route edits.
- No frontend submit-flow edits.
- No schema changes, no migrations.
- No OpenAPI / codegen runs.
- No seed / content edits.
- No project mass edits.
- No deployment, no production DB read/write.
- No billing / Stripe touch.
- No cert / portfolio code touch.
- No new dependencies installed.

---

## 14. Final status

| Gate | Result |
|---|---|
| Threat model published | ✓ `docs/runtime-validation-threat-model.md` |
| Signed RunResult design published | ✓ `docs/signed-run-result-design.md` |
| Implementation plan published | ✓ this file |
| Threat model explicitly states what Atlas can/cannot prove | ✓ §7, §11 of threat model |
| Honest claim ceiling defined | ✓ H3 — "verified output match" |
| Unacceptable claims enumerated | ✓ threat model §7 + §10 |
| Recommended implementation sequence | ✓ §4 above |
| Existing gates green (no code touched) | ✓ — see §15 |
| Architect review of Phase 44 docs | ⏳ next |

---

## 15. Gates run

Phase 44 is docs-only. No code or types changed. Reusing the green gates inherited from Phase 43B-prime:

| Gate | Result |
|---|---|
| typecheck (full repo) | ✓ (inherited — no source files changed) |
| check:no-heuristic-runtime | ✓ (inherited) |
| curriculum-quality tests | ✓ 93 / 93 (inherited from Phase 43B-prime) |
| audit:authoring | ✓ 58 / 58 visible publish-ready (inherited) |
| audit:pedagogy | ✓ 58 / 58 (inherited) |

---

## 16. Risks remaining after Phase 44

1. **Disclosure-surface drift.** If Shape γ ships without the "How Atlas Grades" page, certificate-copy review, and admin/hiring-partner brief, the technical work is sound but the *product* surface ends up dishonest. Phase 48 explicitly couples the two.
2. **Allow-list rollout coordination.** A mis-flipped env var on prod could either silently keep contract-shaped behavior (low harm) or 400 every active learner mid-step (high harm). Phase 49+ requires gradual rollout with a kill-switch test runbook.
3. **Open questions in design doc §11 are not yet decided.** TTL length, `/check` envelope policy, nonce-store janitor mechanism, schema-version bump policy. None block Phase 45 but all block Phase 47.
4. **Residual A2 / A5 risk is intentional.** The product team needs to internalize that "verified output match" is the ceiling. Future pressure to claim more (sales, marketing, partner asks) must be redirected to "build a server-side execution layer" rather than "tighten the envelope further."
5. **Pyodide / DuckDB-WASM version drift.** Capture shape is tied to what these runtimes emit. Pinning version + adding a smoke test on capture shape per release would prevent silent breakage. Phase 45 spike candidate.

---

## 17. Recommended Phase 45

**Phase 45 — `RunCapture` / `RunEnvelope` types + canonicalizer + signer + verifier in `lib/execution-core`, server-only, no behavior change.**

Scope: §4 Phase 45 block above. Single-package surface, isolated test matrix, zero route or frontend touch, zero migration. Reversible by deleting the lib exports. Architect review on completion.

---

## 18. Suggested commit message

```
phase-44: runtime validation threat model + signed RunResult design + implementation plan

- New docs/runtime-validation-threat-model.md (trust boundaries,
  attacker capabilities, attacks, honest claim ceiling H3)
- New docs/signed-run-result-design.md (envelope shape, canonical
  serialization, signing topology, replay protection, migration)
- New docs/phases/phase-44-runtime-validation-plan.md (read-only
  audit, deliverables, Phase 45-50 sequence, hard stops)
- HANDOFF.md + replit.md + docs/phases/INDEX.md updated

Planning-first. No code, no types, no routes, no schema, no
OpenAPI/codegen, no frontend, no content. All existing gates
green (inherited from Phase 43B-prime).
```
