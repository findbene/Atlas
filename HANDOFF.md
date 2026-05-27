# HANDOFF

**Latest shipped phase:** Phase 49 — Frontend RunCapture Wiring + How Atlas Grades Disclosure.
**Working tree:** clean after `phase-49: how-atlas-grades disclosure page` (commit `b119bc7`).
**Parent commit chain:** `b119bc7` ← `24055ed` (phase-49a runtime wiring) ← `54ef8fe` (phase-48 pilot grader) ← `844934e` (phase-47 envelope submit arm) ← `51df3ca` (phase-46 sign endpoint).

---

## Phase 49 summary

The user-visible half of the Phase 44 Shape γ plan. Closes the loop: editor Run → server signs the capture → envelope stashed per-step → Submit attaches envelope → server verifies + grades when kind is allow-listed, otherwise silently falls through to legacy bare-string grading. Plus the public `/how-atlas-grades` H3 disclosure page.

**Production behavior unchanged.** `ATLAS_ENVELOPE_REQUIRED_KINDS` is still empty in prod, so every live submission still takes the legacy path. The envelope code is reachable but inert until Phase 50's canary flip.

### What landed (Phase 49a — runtime wiring, commit `24055ed`)

| File | Role |
|---|---|
| `lib/api-spec/openapi.yaml` (edited) | New schemas: `RunCapture` (columns/rows non-nullable — server rejects null), `EnvelopeBinding`, `SignedRunEnvelope`, `SignRunBody`, `SignRunResponse`. New `POST /runs/sign` (operationId `signRun`). `SubmitStepBody` gains optional `envelope`. |
| `lib/api-client-react/src/generated/*` (regen) | `useSignRun` mutation + types. |
| `lib/api-zod/src/generated/*` (regen) | Zod request/response schemas. |
| `artifacts/atlas/src/lib/envelopeClient.ts` (new) | Pure helpers: `buildPythonCapture` / `buildSqlCapture` (NaN-safe `durationMs`), `preCheckCapture`, `isCaptureLikelyOversize`, `classifySignError` (every status/network error → stable `SignSkipReason`). |
| `artifacts/atlas/src/lib/envelopeClient.test.ts` (new) | 21 unit tests. |
| `artifacts/atlas/src/lib/pyodideRunner.ts` (edited) | `ExecResult.durationMs` (perf.now delta around `runPython`, excludes cold-start). |
| `artifacts/atlas/src/pages/project-workspace.tsx` (edited) | `envelopeByStepId` state + per-step `runGenByStep` ref. `attemptSignAndStash` pre-gates → signs → stashes ONLY if gen still matches. `bumpRunGen` + `clearEnvelopeForStep` chained into `onCodeChange`, `onReset`, `onSelectHistoryCode`, `goToStep`. `submitStep` attaches envelope when present. |
| `artifacts/atlas/src/pages/project-workspace.test.tsx` (edited) | Added `useSignRun` mock so resume-lifecycle tests still mount. |
| `artifacts/api-server/src/routes/user.ts` (edited) | Envelope-for-non-allow-listed-kind silently falls through (logs `envelope.submit.kind_not_enabled.fallback`) instead of returning Phase-47's 400 `envelope_kind_not_enabled`. Verifier still only invoked when kind IS allow-listed. |
| `artifacts/api-server/src/lib/envelopeSubmit.ts` (edited) | Docstring updated for Phase 49 fallback contract. |
| `artifacts/api-server/src/routes/user-submit-envelope.test.ts` (rewritten) | E1 — asserts soft-fail (200, no error body, zero nonce rows). |
| `artifacts/api-server/src/routes/user-submit-envelope-pilot.test.ts` (rewritten) | P1 — asserts pilot fall-through path. |

### What landed (Phase 49b — disclosure page, commit `b119bc7`)

| File | Role |
|---|---|
| `artifacts/atlas/src/pages/how-atlas-grades.tsx` (new) | Public 5-section H3 disclosure page. |
| `artifacts/atlas/src/pages/how-atlas-grades.test.tsx` (new) | 6 tests including H1/H2 banned-phrase guard. |
| `artifacts/atlas/src/App.tsx` (edited) | New public `/how-atlas-grades` route (no auth). |
| `artifacts/atlas/src/pages/home.tsx` (edited) | New footer link "How grading works". |

### Soft-fail contract (the architect-driven invariant of Phase 49)

Every failure mode on the FE sign path is mapped to a `SignSkipReason` and logged at `console.debug({ evt: 'envelope.sign.skipped', reason })`. The learner never sees a sign error. Submit always works.

On the server, an envelope attached for a kind NOT in `ATLAS_ENVELOPE_REQUIRED_KINDS` logs `envelope.submit.kind_not_enabled.fallback` at info and grades via the legacy bare-string path. No 400, no nonce row written, no crypto. The legacy wire payload is byte-identical whether or not an envelope is attached when the kind is disabled.

### Honest claim ceiling (H3 — UNCHANGED)

- "Atlas saw your browser report a particular output for the code you ran, and that output matched what the step expected. The signature confirms the record came from your session and was not modified in flight."
- Does NOT prove independent authorship (H1).
- Does NOT prove the absence of outside help (H2 / A2 accepted residual).
- Does NOT prevent forge-then-sign (A5 accepted residual).

`/how-atlas-grades` states all of the above plainly. Disclosure copy is unit-tested against a list of banned overclaim phrases — edit the page rather than weakening the guard.

### Gates (all green, post-change)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | ✓ clean |
| `check:no-heuristic-runtime` | ✓ |
| `@workspace/atlas` | ✓ **128 / 128** (+27 over Phase 48 baseline of 101) |
| `@workspace/api-server` | ✓ **347 / 347** (E1+P1 rewritten for fallback contract, count unchanged from Phase 48) |
| `@workspace/execution-core` | ✓ **83 / 83** UNCHANGED |
| `@workspace/curriculum-quality` | ✓ **93 / 93** UNCHANGED |
| `audit:authoring` | ✓ **58 / 58** publish-ready (advisories 174 + 3 UNCHANGED) |
| `audit:pedagogy` | ✓ **58 / 58** UNCHANGED |

### Hard stops respected

| Surface | Touched? |
|---|---|
| `lib/grading.ts` | NO |
| `/check` route handler | NO |
| `lib/execution-core/runEnvelope.ts` | NO (Phase 45 library frozen) |
| Schema / migration | NO |
| Seed / content / pedagogy / rubric | NO |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| `json_equal` advisory classification | UNCHANGED |
| Billing / Stripe | NO |
| Cert / portfolio language | NO (`evidence-backed completion record` pin from Phase 28 still holds) |
| Production DB | NO |
| `ATLAS_ENVELOPE_REQUIRED_KINDS` default | EMPTY in production |

### Architect review

Two rounds. **Round 1** caught: (a) server 400 broke soft-fail, (b) stale-envelope race after edit, (c) OpenAPI `nullable:true` drift on `RunCapture.columns/rows`, (d) NaN `durationMs`. **Round 2** caught: step-navigation stale-race in `goToStep`. All fixed. Final verdict: PASS.

### Risks remaining after Phase 49

1. **No live end-to-end smoke yet** against real Pyodide + real `/runs/sign` round-trip. Unit tests at the helper layer, integration tests at the server-route layer, but a manual UI smoke in dev/staging is a Phase 50 prerequisite.
2. **Signing path is exercised but no verified grading runs against real learners** — allow-list still empty.
3. **Disclosure page only linked from the home-page footer.** Workspace, onboarding, and certificate pages don't link it yet. Easy add-on, deferred.
4. **`run_envelope_nonces` will start receiving rows the moment Phase 50 flips its first kind** — janitor (Phase 46) handles cleanup but production cron registration is still owed.
5. **`HANDOFF.md` / `replit.md` Phase History** caught up this turn; Phase 50 will need its own catch-up.

### Recommended Phase 50

Pre-flip control-plane work + the actual 1% canary, IN THIS ORDER:

1. **Manual smoke in dev/staging** with `RUN_ENVELOPE_SIGNING_SECRET` set + `ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal`. Run a real Python `json_equal` step through the UI; verify logs (`envelope.verify.ok`, `envelope.submit.kind_not_enabled.fallback` for any non-allow-listed eligible step); confirm pass/fail correctness and nonce row inserts.
2. **Register the nonce janitor cron in production** before any kind goes live.
3. **Add a feature-flag / user-bucket wrapper** on `ATLAS_ENVELOPE_REQUIRED_KINDS` so the verified path is only active for 1% of users on `json_equal` steps.
4. **Monitor** verifier-failure rate, p95 submit latency, fallback log volume, learner-facing confusion.
5. **Ramp** 1% → 10% → 50% → 100% over a week if metrics hold.
6. **Architect review BEFORE** ramping past 1% on the first kind.

### Commits

- `844934e` — phase-47: envelope submit arm
- `54ef8fe` — phase-48: pilot envelope grader
- `24055ed` — phase-49a: frontend runtime wiring + soft-fail server fallback
- `b119bc7` — phase-49b: how-atlas-grades disclosure page
