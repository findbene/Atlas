# Phase 49 — Frontend RunCapture Wiring + How Atlas Grades Disclosure

**Parent phase**: 48 (Pilot Envelope Grader)
**Design spec**: `docs/signed-run-result-design.md`, `docs/runtime-validation-threat-model.md`
**Honest claim ceiling**: H3 (UNCHANGED — Atlas verified runtime output matched expected)

---

## Goal

Close the user-visible half of the Phase 44 plan: wire the editor's Run → Sign → Stash → Submit flow to the real learner IDE, and ship the public-facing disclosure page that explains what the signed-envelope path does and does not prove (H3 ceiling, not H1/H2).

Hard requirements:

- Soft-fail everywhere — every sign failure (network, 400/403/404/413/422/503, unknown) falls through silently to the legacy bare-string submit.
- `ATLAS_ENVELOPE_REQUIRED_KINDS` stays empty in production — no canary flip in this phase.
- No `/check` change, no catalog change, no new validation kind, no certificate/portfolio language upgrade.
- No overclaim on the disclosure page. Banned phrases are enforced by a unit test.

## What shipped

### OpenAPI + codegen (`lib/api-spec/openapi.yaml`)

New schemas:

- `RunCapture` — version-pinned shape mirroring the Phase 45 library type. `columns` and `rows` are **not** nullable (server rejects null at parse time).
- `EnvelopeBinding`, `SignedRunEnvelope` — the on-wire envelope shape.
- `SignRunBody`, `SignRunResponse` — request/response for the new mint endpoint.

New endpoint:

- `POST /runs/sign` — `operationId: signRun`. All 7 error codes documented (`400 invalid_request` / `401 unauthorized` / `403 not_enrolled|pro_required` / `404 step_not_found|project_not_found` / `413 capture_too_large` / `422 validation_kind_not_signable` / `503 signing_unavailable`).

Edited:

- `SubmitStepBody` gains an optional `envelope?: SignedRunEnvelope` field.

Codegen regenerated `lib/api-client-react/src/generated/*` (`useSignRun` React Query mutation) and `lib/api-zod/src/generated/*`.

### Client (`artifacts/atlas`)

**`src/lib/envelopeClient.ts`** (new) — pure helpers, no React, no network:

- `buildPythonCapture(code, execResult)` / `buildSqlCapture(code, queryResult)` — convert local runtime output into the on-wire `RunCapture` shape. NaN/Infinity `durationMs` is sanitized to `0` (server rejects non-finite numbers).
- `preCheckCapture(capture)` — eligibility gate. Skips empty stdout, timeouts, non-zero exit codes, and oversized captures BEFORE we waste a server round-trip.
- `isCaptureLikelyOversize(capture)` — UTF-8 byte estimate against the 64KB / 32KB / 5000-row / 256-col caps from Phase 46.
- `classifySignError(err)` — maps HTTP status / network error to a stable `SignSkipReason` (`unsignable-kind | signing-unavailable | not-enrolled | not-found | invalid-request | sign-network-error | sign-unknown-error`) so the soft-fail logs are uniform.

**`src/lib/envelopeClient.test.ts`** (new) — 21 unit tests covering all helpers + every classifier branch.

**`src/lib/pyodideRunner.ts`** — `ExecResult` gains `durationMs` (delta of `performance.now()` around the actual `runPython` call; explicitly excludes Pyodide cold-start so first-run captures are not penalized).

**`src/pages/project-workspace.tsx`** — the actual wiring:

- New state: `envelopeByStepId: Record<string, SignedRunEnvelope>` keyed by step UUID, so navigating between steps does not cross-contaminate.
- New ref: `runGenByStep: Record<string, number>` — per-step monotonic generation counter. Every code mutation bumps it. `attemptSignAndStash` captures the gen at sign-start and refuses to stash if it has moved by the time the sign response arrives.
- `attemptSignAndStash(stepId, capture)` — pre-gates with `preCheckCapture`, calls `useSignRun`, on success stashes ONLY if the gen still matches; on failure logs a `console.debug({ evt: 'envelope.sign.skipped', reason })` and returns silently.
- `clearEnvelopeForStep(stepId)` + `bumpRunGen(stepId)` — chained into `onCodeChange`, `onReset`, `onSelectHistoryCode`, AND `goToStep`. The `goToStep` chain is essential: without it a slow sign that started before the learner navigated could stash an envelope keyed to a step the editor no longer shows.
- `submitStep` spreads `envelope` into the request body only when one is stashed for the active step. Wire payload is byte-identical to pre-Phase-49 when no envelope is present.

**`src/pages/project-workspace.test.tsx`** — added `useSignRun` mock so the existing resume-lifecycle tests still mount.

### Server (`artifacts/api-server`)

**`src/routes/user.ts`** — soft-fail contract: when an envelope is attached for a kind that is NOT in `ATLAS_ENVELOPE_REQUIRED_KINDS`, silently fall through to legacy bare-string grading instead of returning the Phase-47-original 400 `envelope_kind_not_enabled`. Logs `evt: 'envelope.submit.kind_not_enabled.fallback'` at info. The verifier is STILL only invoked when the kind IS allow-listed; no nonce row is written and no signature crypto runs for disabled kinds.

This is the critical soft-fail fix the architect caught in round 1: the FE has no way to know the server's current allow-list, so a 400 here would create a brand-new Submit failure mode the moment Phase 49 shipped to any learner whose project happens to have an envelope-eligible step type.

**`src/lib/envelopeSubmit.ts`** — docstring updated to describe the Phase 49 fallback contract.

**`src/routes/user-submit-envelope.test.ts` (E1)** + **`user-submit-envelope-pilot.test.ts` (P1)** — rewritten to assert the new fallback contract (200, no `envelope_kind_not_enabled` in body, zero `run_envelope_nonces` rows written, legacy grading reasons reported).

### Disclosure page (`artifacts/atlas`)

**`src/pages/how-atlas-grades.tsx`** (new) — public `/how-atlas-grades` route, no auth. Five sections: what we check, signed runtime captures (pilot), what this does not prove, the soft-fail fallback, why we're being this specific. Linked from the home-page footer ("How grading works").

**`src/pages/how-atlas-grades.test.tsx`** (new) — 6 vitest assertions including the H1/H2 banned-phrase guard. Banned phrases (case-insensitive substring match against the rendered DOM): `tamper-proof`, `tamperproof`, `cheat-proof`, `cheatproof`, `fraud-proof`, `verified authorship`, `proven authorship`, `proves you wrote`, `guarantees you wrote`, `guaranteed authentic`, `proven mastery`, `certifies mastery`, `anti-cheat`, `plagiarism-proof`, `100% verified`, `independently verified`. Edit the page copy if this test fails — do NOT weaken the guard.

**`src/App.tsx`** — new `<Route path="/how-atlas-grades" component={HowAtlasGrades} />` in the public block (before the `ProtectedRoute` block).

**`src/pages/home.tsx`** — new footer link.

## What did NOT change (hard stops)

| Surface | Touched? |
|---|---|
| `lib/execution-core/runEnvelope.ts` | NO |
| `lib/grading.ts` | NO |
| `/check` | NO |
| Schema / migration | NO |
| Seed / content / pedagogy / rubric | NO |
| Billing / cert / portfolio language | NO (`evidence-backed completion record` pin from Phase 28 still holds) |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| `json_equal` advisory classification | UNCHANGED |
| `ATLAS_ENVELOPE_REQUIRED_KINDS` default | EMPTY in production |
| `audit:authoring` / `audit:pedagogy` | UNCHANGED 58/58 |

## Gates (all green, post-change)

| Gate | Result |
|---|---|
| `pnpm run typecheck` (full repo) | ✓ clean |
| `check:no-heuristic-runtime` | ✓ |
| `@workspace/atlas` tests | ✓ **128 / 128** (+6 disclosure, +21 envelopeClient inside the +27 net) |
| `@workspace/api-server` tests | ✓ **347 / 347** (E1+P1 rewritten for fallback contract, count unchanged from Phase 48) |
| `@workspace/execution-core` tests | ✓ **83 / 83** UNCHANGED |
| `@workspace/curriculum-quality` tests | ✓ **93 / 93** UNCHANGED |
| `audit:authoring` | ✓ **58 / 58** (advisories 174 + 3 UNCHANGED) |
| `audit:pedagogy` | ✓ **58 / 58** UNCHANGED |

## Architect review

Two rounds. Round 1 caught: (a) server 400 broke soft-fail, (b) stale-envelope race after edit, (c) OpenAPI `nullable:true` drift on `RunCapture.columns/rows`, (d) NaN `durationMs`. Round 2 caught: step-navigation stale-race in `goToStep`. All fixed. Final verdict: PASS.

## Trust model (unchanged)

- H3 only — "Atlas saw your browser report a particular output for the code you ran, and that output matched what the step expected. The signature confirms the record came from your session and was not modified in flight."
- Does NOT prove independent authorship (H1).
- Does NOT prove the learner did not use outside help (H2, A2).
- Does NOT prevent forge-then-sign (A5).
- All of the above are stated plainly on `/how-atlas-grades`.

## Risks remaining after Phase 49

1. **No live end-to-end smoke against real Pyodide + real `/runs/sign`** in dev/staging yet. Unit-tested at the helper layer; integration coverage at the server-route layer. Manual smoke is a Phase-50 prerequisite.
2. **Signing path exercised by clients but no verified grading runs against real learners yet** — allow-list still empty.
3. **Disclosure page only linked from the home footer.** Workspace, onboarding, and certificate pages don't link it yet. Easy add-on, deferred so this phase stays scoped.
4. **`run_envelope_nonces` will start receiving rows the moment Phase 50 flips its first kind** — janitor (Phase 46) handles cleanup but cron registration in production is still owed.

## Phase 50 candidate (next)

Pre-flip control-plane work + the actual 1% canary:

1. Manual smoke in dev/staging with `RUN_ENVELOPE_SIGNING_SECRET` set + `ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal` — run a real Python `json_equal` step through the UI, verify logs (`envelope.verify.ok`, `envelope.submit.kind_not_enabled.fallback` for any non-allow-listed eligible step), confirm pass/fail correctness and nonce row inserts.
2. Add a feature-flag/user-bucket wrapper on `ATLAS_ENVELOPE_REQUIRED_KINDS` so the verified path is only active for 1% of users on `json_equal` steps.
3. Register the nonce janitor cron in production.
4. Monitor verifier-failure rate, p95 submit latency, fallback log volume, learner-facing confusion.
5. Ramp 1% → 10% → 50% → 100% over a week if metrics hold.

## Commits

- `844934e` — phase-47: envelope submit arm
- `54ef8fe` — phase-48: pilot envelope grader
- `24055ed` — phase-49a: frontend runtime wiring + soft-fail server fallback
- `b119bc7` — phase-49b: how-atlas-grades disclosure page
