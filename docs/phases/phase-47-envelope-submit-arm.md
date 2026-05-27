# Phase 47 — Captured-Submission Arm in `/submit` (allow-list empty)

**Parent phase**: 46 (Run Signing API + Nonce Store)
**Design spec**: `docs/signed-run-result-design.md`, `docs/phases/phase-44-runtime-validation-plan.md`
**Honest claim ceiling**: H3 (UNCHANGED — Atlas verified runtime output matched expected)

---

## Goal

Wire `verifyRunEnvelope` (Phase 45 library) into `POST /api/user/projects/:projectId/steps/:stepId/submit` behind a server-side allow-list that is **empty by default**. The envelope grading path becomes reachable but inert in production until an operator opts a `validationType` in via `ATLAS_ENVELOPE_REQUIRED_KINDS`.

This is the second `/submit` change in Atlas history (Phase 27 was the first). Hard requirement: legacy bare-string submissions remain byte-identical when no envelope is attached, and when an envelope IS attached but the kind is not allow-listed.

## What shipped

### `artifacts/api-server/src/lib/envelopeSubmit.ts` (new, 183 lines)

The single helper that all envelope-aware code in `routes/user.ts` calls into. Three public exports:

- `parseRequiredKindsAllowList(raw)` — pure parser for `ATLAS_ENVELOPE_REQUIRED_KINDS`. Comma-separated, whitespace-tolerant, dedupes, filters to known `validationType` values. Empty/missing → empty set (the production default).
- `looksLikeEnvelopeShape(value)` — narrow gate. Only callers that pass this gate go anywhere near `verifyRunEnvelope`. Keeps malformed bodies out of the crypto path entirely.
- `verifyEnvelopeForGrading(envelope, ctx)` — the actual integration. Constructs the binding context from the route (`userId`, `projectId`, `stepId`, expected `submissionSha256`, expected `outputSha256`), invokes the Phase 45 verifier, and on first-successful-verify INSERTs the nonce into `run_envelope_nonces` via:

  ```sql
  INSERT INTO run_envelope_nonces (nonce, expires_at)
  VALUES ($1, $2)
  ON CONFLICT (nonce) DO NOTHING
  RETURNING nonce
  ```

  Successful INSERT → first use (verify OK). Zero-row return → replay (verify fails with `replay`). This is the atomic single-statement contract the Phase 45 verifier expects from `isNonceSeen` — no SELECT-then-INSERT race window.

The nonce INSERT is intentionally outside the per-learner `pg_advisory_xact_lock('atlas-submit:'||userId)` (Phase 27) — nonces are global and not per-learner, and the advisory lock would not protect against the cross-user replay case anyway. The ON CONFLICT is the only safety primitive needed.

### `artifacts/api-server/src/routes/user.ts` (edited)

`/submit` route gains an envelope-aware branch BEFORE the legacy grading path:

```
SubmitStepBody = { code, submission, envelope? }

if (envelope is attached) {
  if (validationType is NOT in ATLAS_ENVELOPE_REQUIRED_KINDS) {
    // Phase 49 added this fallback (see Phase 49 close-out). Phase 47
    // originally returned 400 envelope_kind_not_enabled, but the FE
    // has no way to know the server's allow-list, so 400 would create
    // a brand-new Submit failure mode the moment Phase 49 shipped.
    log info envelope.submit.kind_not_enabled.fallback
    fall through to legacy grading
  } else {
    verifyEnvelopeForGrading(...)
    if verify fails → 400 with structured reason (replay/expired/tampered/binding/...)
    if verify succeeds → log envelope.verify.ok, continue into shared grading
  }
}
// legacy bare-string grading runs from here, unchanged
```

The verifier is **only** invoked when the kind IS allow-listed. Disabled kinds never run crypto, never write a nonce row, never touch `run_envelope_nonces`. This keeps the production blast radius zero while the allow-list is empty.

### Telemetry

Structured per-failure-reason logs so Phase 50's canary has the dashboards it needs:

- `evt: 'envelope.verify.ok'` — successful verify; binding fields included
- `evt: 'envelope.verify.failed'` — failed verify; `reason` from the verifier (`malformed | version | signature | tampered | binding | expired | replay`)
- `evt: 'envelope.submit.kind_not_enabled.fallback'` — envelope attached but kind not allow-listed (info level)

No PII beyond what surrounding `/submit` logs already include.

## What did NOT change (hard stops)

| Surface | Touched? |
|---|---|
| `lib/execution-core/runEnvelope.ts` | NO (library frozen at Phase 45) |
| `routes/runs-sign.ts` | NO (Phase 46 untouched) |
| `lib/grading.ts` | NO — shared grading path runs after verify, byte-identical for all callers |
| `/check` | NO |
| OpenAPI / codegen | NO — deferred to Phase 49 FE wiring |
| `artifacts/atlas/**` | NO |
| Schema / migration | NO (`run_envelope_nonces` already exists from Phase 46) |
| Seed / content / pedagogy / rubric | NO |
| Billing / cert / portfolio | NO |
| `ATLAS_ENVELOPE_REQUIRED_KINDS` default | EMPTY in production |

## Gates (all green, post-change)

- `pnpm run typecheck` — OK
- `api-server` tests — 305 → 322/322 (+17 from `user-submit-envelope.test.ts`)
- `execution-core` — 83/83 UNCHANGED
- `curriculum-quality` — 93/93 UNCHANGED
- `audit:authoring` — 58/58 UNCHANGED (advisories 174+3 UNCHANGED)
- `audit:pedagogy` — 58/58 UNCHANGED

## Risks remaining after Phase 47

1. **No frontend caller yet** — the FE cannot attach an envelope until Phase 49 wires `attemptSignAndStash`. Everything in production still hits the legacy bare-string arm.
2. **No OpenAPI surface yet** — typed client + Zod request validation come with the Phase 49 codegen regen.
3. **Allow-list default empty** — no learner-visible behavior change. Operator must opt in.
4. **Pilot grader not yet split out** — Phase 48 extracts a dedicated `envelopeGrade.ts` so the verify-then-grade path is independently unit-tested.

## Phase 48 candidate (next)

Split the post-verify grading decision out of `routes/user.ts` into a pure `envelopeGrade.ts` helper so the path is independently testable + the route stays small. No behavior change.
