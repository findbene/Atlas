# Phase 48 — Pilot Envelope Grader (envelopeGrade.ts)

**Parent phase**: 47 (Captured-Submission Arm in `/submit`)
**Design spec**: `docs/signed-run-result-design.md`
**Honest claim ceiling**: H3 (UNCHANGED)

---

## Goal

Extract the post-verify grading decision from `routes/user.ts` into a pure `envelopeGrade.ts` helper. After Phase 47, the route had two concerns interleaved: (1) verify the envelope and (2) decide pass/fail from the verified capture. Phase 48 separates them so the verify path stays in `envelopeSubmit.ts` and the grading path lives in its own file with its own unit tests, independent of Express, Drizzle, and Clerk.

No behavior change vs. Phase 47. The route just calls a smaller surface.

## What shipped

### `artifacts/api-server/src/lib/envelopeGrade.ts` (new, 145 lines)

Pure function:

```ts
gradeEnvelopeCapture(
  capture: RunCapture,
  expected: ExpectedOutput,
  validationType: ValidationType,
): EnvelopeGradeResult
```

Switches on `validationType` and runs the appropriate comparator against the verified `capture.stdout` (or `capture.rows` for SQL kinds). The five pilot-enabled kinds are wired:

- `json_equal` — JSON-canonicalize both sides, deep-equal.
- `numeric_tolerance` — numeric scalar comparison with authored tolerance.
- `sql_resultset` — set-equal on rows + column-name match.
- `csv_set_equal` — set-equal on parsed rows.
- `csv_ordered` — sequence-equal on parsed rows.

All four unsignable kinds (`self_attest / exact / regex / contains`) are explicitly absent from the dispatch — the route never calls into this helper for them because the Phase 47 allow-list gate rejects them upstream. Defense-in-depth: an unknown `validationType` returns a failure result rather than throwing, so an enum drift cannot 500 the route.

### `artifacts/api-server/src/lib/envelopeGrade.test.ts` (new, 205 lines)

24 vitest assertions covering each pilot kind's pass and fail branches + edge cases:

- numeric_tolerance: exact, within-tolerance, out-of-tolerance, NaN handling
- json_equal: structurally-equal-but-key-order-different, type mismatch
- csv_set_equal: row-permutation passes, missing row fails
- csv_ordered: same rows in different order fails
- sql_resultset: column-name mismatch fails even if rows match

The Phase 45 verifier is NOT exercised here — those tests live in `runs-sign.test.ts` and `user-submit-envelope.test.ts`. This file is the comparator-only unit suite.

### `artifacts/api-server/src/routes/user-submit-envelope-pilot.test.ts` (new, 468 lines)

Route-level integration tests for the verified pilot grading path. Mounts the real `/submit` route, real Postgres test schema, real `verifyRunEnvelope`, real nonce INSERT, with `ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal` set per-test. Asserts:

- happy path: signed envelope with matching capture → 200 pass, nonce row inserted exactly once
- replay: same envelope submitted twice → second 400 with `reason: 'replay'`, nonce row count unchanged
- tampered capture: post-sign mutation → 400 `tampered`
- expired envelope: TTL elapsed → 400 `expired`
- binding mismatch: wrong stepId in envelope vs. URL → 400 `binding`
- fall-through: envelope for a kind NOT in the allow-list → silently grades via legacy path, no nonce inserted (rewritten in Phase 49 to assert the soft-fail contract — originally a 400)

### `artifacts/api-server/src/routes/user.ts` (edited)

Route shrinks: the inline `if (envelope) { verify; switch(validationType) { ... } }` block becomes:

```ts
if (envelopeVerified) {
  const result = gradeEnvelopeCapture(verifiedCapture, expected, step.validationType);
  if (!result.passed) return 200 fail; // same shape as legacy grade
  // pass → continue into the shared XP/streak/email flow (Phase 26/27 path)
}
```

No new branches in the route's reward/ledger/streak/email logic. The envelope path joins the legacy path at exactly the moment a "verified pass" is decided, so all downstream invariants (idempotency, transactional XP, advisory lock) apply identically.

## What did NOT change (hard stops)

| Surface | Touched? |
|---|---|
| `lib/execution-core/runEnvelope.ts` | NO |
| `routes/runs-sign.ts` | NO |
| `lib/grading.ts` | NO |
| `/check` | NO |
| OpenAPI / codegen | NO |
| `artifacts/atlas/**` | NO |
| Schema / migration | NO |
| Seed / content / pedagogy / rubric | NO |
| Billing / cert / portfolio | NO |
| `ATLAS_ENVELOPE_REQUIRED_KINDS` default | EMPTY in production |

## Gates (all green, post-change)

- `pnpm run typecheck` — OK
- `api-server` tests — 322 → 347/347 (+25 from `envelopeGrade.test.ts` + `user-submit-envelope-pilot.test.ts`)
- `execution-core` — 83/83 UNCHANGED
- `curriculum-quality` — 93/93 UNCHANGED
- `audit:authoring` / `audit:pedagogy` — 58/58 UNCHANGED

## Risks remaining after Phase 48

1. **Still no FE caller** — production hits the legacy arm always. Phase 49 closes this.
2. **`envelopeGrade.ts` has no coverage from production traffic yet** — only synthetic envelopes from the test suite. First real-world coverage is gated on Phase 50's 1% canary.
3. **No OpenAPI surface yet** — Phase 49 owns the codegen regen.

## Phase 49 candidate (next)

Frontend Run → sign → stash → Submit-attaches plumbing + OpenAPI schemas + `useSignRun` codegen + soft-fail mapping for every failure mode + the public `/how-atlas-grades` H3 disclosure page.
