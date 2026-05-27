# Phase 45 — Signed RunResult Envelope Library (execution-core)

**Status:** CLOSED · architect PASS
**Parent:** Phase 44 — Runtime Validation Trust Model + Signed RunResult Plan
**Surface:** `lib/execution-core` only. Zero callers wired. Zero behavior change.
**Reversibility:** revert this commit; nothing else depends on the new exports yet.

---

## Goal

Implement the reusable, well-tested primitives the Phase 44 design specified, without wiring them into any product surface. After this phase, `/check`, `/submit`, the frontend, OpenAPI, content, and the audit grid are all bit-for-bit unchanged. Phase 46 is the first phase that *uses* anything Phase 45 ships.

## What landed

A single new module pair inside `lib/execution-core`, exported via a dedicated server-only subpath (`@workspace/execution-core/run-envelope`) — see "Browser-bundle isolation" below for why the root barrel intentionally does not re-export the envelope module:

| File | Role |
|---|---|
| `lib/execution-core/src/runEnvelope.ts` (new) | Types + canonicalizer + sha256 helper + HMAC signer + verifier. |
| `lib/execution-core/src/runEnvelope.test.ts` (new) | 45 vitest assertions across the 12 scenarios the Phase 45 ticket required, plus tamper-detection, replay-protection, version-taxonomy, and malformed-input coverage. |
| `lib/execution-core/package.json` (edited) | New `"./run-envelope"` subpath export. |
| `lib/execution-core/src/index.ts` (edited) | Documentation comment explaining the subpath; the root barrel deliberately does NOT re-export the envelope module (see "Browser-bundle isolation" below). |

No other files in the repo were touched.

### Browser-bundle isolation (architect-driven fix)

The architect's pre-merge review caught a critical coupling: re-exporting
`runEnvelope.ts` (which imports `node:crypto`) from the root `index.ts`
would bundle-break `@workspace/atlas`, because the atlas frontend imports
from `@workspace/execution-core` root and vite would try to resolve
`node:crypto` for the browser.

The fix: a dedicated server-only subpath export. The root barrel is
unchanged in surface area. Server callers import explicitly:

```ts
import {
  signRunEnvelope,
  verifyRunEnvelope,
  type RunCapture,
  type SignedRunEnvelope,
} from "@workspace/execution-core/run-envelope";
```

Verified: `PORT=4173 BASE_PATH=/ pnpm --filter @workspace/atlas run build` is
green; the atlas dist bundle does NOT contain `node:crypto` references.

### Primitives implemented

```text
canonicalize(value: unknown): string
sha256Hex(input: string): string
computeOutputSha256(capture: RunCapture): string
signRunEnvelope(capture, bindingInput, secret): SignedRunEnvelope
verifyRunEnvelope(envelope, options): Promise<VerificationResult>
```

Types: `RunCapture`, `EnvelopeBinding`, `SignedRunEnvelope`, `SignBindingInput`,
`VerifyOptions`, `VerificationResult` (discriminated `Ok | Err`),
`VerificationFailureReason`, `RunEnvelopeVersion`, `RunCaptureLanguage`,
`ValidationKindString`.

### Shape (matches Phase 44 design `docs/signed-run-result-design.md`)

```ts
interface RunCapture {
  version: 1;
  language: "python" | "sql";
  code: string;            // raw source the client claims to have executed
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  columns?: ReadonlyArray<string>;
  rows?: ReadonlyArray<ReadonlyArray<string | number | boolean | null>>;
}

interface EnvelopeBinding {
  version: 1;
  kid: string;             // signing-key id, default "v1"
  userId: string;
  projectId: string;
  stepId: string;
  validationKind: string;
  submissionSha256: string; // SERVER-DERIVED from capture.code
  outputSha256: string;     // SERVER-DERIVED from canonicalized capture output
  issuedAt: string;         // ISO-8601 UTC
  expiresAt: string;        // issuedAt + ttlMs
  nonce: string;            // single-use replay token
}

interface SignedRunEnvelope {
  capture: RunCapture;
  binding: EnvelopeBinding;
  signature: string;       // HMAC-SHA256, hex lowercase
}
```

The user-facing Phase 45 ticket listed `userId / projectId / stepId / ...`
*inside* `RunCapture`. Phase 44's architect-approved design splits them into
`EnvelopeBinding` — that separation is preserved here because (a) the binding
is server-issued and must not be confused with browser-supplied capture
content, and (b) every binding field is still present in the signed envelope.

## Security properties achieved

| Invariant | How it's enforced |
|---|---|
| **S1** Server is the sole hash authority. | `signRunEnvelope` ignores any pre-supplied hash values and always derives `submissionSha256 = sha256(capture.code)` and `outputSha256 = computeOutputSha256(capture)` itself. `verifyRunEnvelope` recomputes both and rejects on mismatch (`envelope-tampered`). Test: "rejects when submissionSha256 disagrees with code" + "rejects when outputSha256 disagrees with capture output". |
| **S2** Canonical serialization is deterministic. | Recursive sorted-key JSON; NFC string normalization; explicit rejection of `undefined`/`NaN`/`Infinity`/`Date`/`bigint`/function/symbol; arrays preserve order. Tests: insertion-order stability, nested-object stability, array order preservation, NFC equivalence, undefined-drop, throw-on-undefined-value, throw-on-NaN/Infinity, throw-on-Date, throw-on-bigint/function/symbol. |
| **S3** Signature comparison is constant-time. | `crypto.timingSafeEqual` after equal-length check; plain `===` never used on the signature. Test: wrong-secret rejection + length-mismatch rejection. |
| **S4** Capture is reachable only on verified `Ok`. | `VerificationResult` is a discriminated union — `result.capture` and `result.binding` only exist on the `ok: true` arm; TypeScript prevents callers from reading them without the discriminator check. Test: round-trip asserts capture is accessible only inside `if (result.ok)`. |
| **S5** Caller input is not mutated. | `signRunEnvelope` deep-copies the capture (including `columns`/`rows`); the returned envelope is the only mutation surface. Test: "does NOT mutate the caller's capture object" snapshots the original and asserts equality post-sign. |
| **S6** No grading / curriculum-quality / route imports. | `runEnvelope.ts` imports only `node:crypto`. Verified by inspection; future drift would surface in `pnpm run typecheck` via project references (lib has no dep on `grading.ts`). |
| **S7** Nonce hook is not an oracle. | The replay hook runs only after signature + tamper + binding + expiry checks pass, so an attacker probing with garbage envelopes cannot use the hook as a DB-side channel. Test: "does NOT invoke the nonce hook on bad-signature envelopes". |
| **S8** Malformed inputs fail safely. | `looksLikeEnvelope` / `looksLikeCapture` / `looksLikeBinding` reject `null`, `undefined`, strings, numbers, partial shapes, and bad timestamps without throwing — verifier returns `envelope-malformed`. Test: `it.each` over seven malformed inputs. |

### Failure-reason vocabulary (matches `docs/signed-run-result-design.md` §9)

```ts
type VerificationFailureReason =
  | "envelope-malformed"            // shape/secret-empty
  | "envelope-unsupported-version"  // capture.version or binding.version ≠ 1
  | "envelope-bad-signature"        // HMAC mismatch
  | "envelope-tampered"             // submissionSha256/outputSha256 mismatch
  | "envelope-binding-mismatch"     // expected.userId/projectId/stepId/... mismatch
  | "envelope-expired"              // now > binding.expiresAt
  | "envelope-replay";              // isNonceSeen returned true
```

The verifier returns the first failure it encounters in this order:
malformed → version → signature → tampered → binding-mismatch → expired →
replay. The order is deliberate (cheap checks first; DB-backed nonce hook
last so it isn't an oracle).

## What this still does NOT prove

Carried verbatim from `docs/runtime-validation-threat-model.md` §7 and the
threat-model claim ceiling:

1. **Does not prove the learner wrote the code.** (H1 — out of scope for any browser-runtime platform.)
2. **Does not prove the learner executed *their* code vs. somebody else's.** (H2 / attack A2 — accepted residual.)
3. **Does not prevent forge-then-sign.** (Attack A5 — a motivated client can post a hand-crafted `RunCapture` to `/sign` and get a valid signature. The signature proves "Atlas issued this envelope with this binding"; it does NOT prove execution provenance. Accepted residual.)

Honest claim ceiling remains **H3** — *"Atlas verified that the runtime output submitted for this step matched the expected result."*

Unacceptable product claims (must not ship with Shape γ):

- "Atlas verified the learner wrote this code."
- "Atlas proved the learner solved this independently."
- "Tamper-proof completion record."
- "Cheat-proof certificate."

## Hard stops respected

| Surface | Touched? |
|---|---|
| `lib/grading.ts` | NO |
| `/check`, `/submit`, route handlers | NO |
| Frontend code | NO |
| OpenAPI spec / codegen | NO |
| DB schema / migrations | NO |
| Seed / content / project files | NO |
| Pedagogy / rubric / taxonomy | NO |
| Deployment / production DB | NO |
| Billing / Stripe / certs / portfolio | NO |
| `audit:authoring` enforcement counts | UNCHANGED |
| `audit:authoring` advisories | UNCHANGED |
| `publishReady` count | UNCHANGED (58/58) |
| `json_equal` classified as enforced | NO — still `contract-shaped` |

## Files changed

- `lib/execution-core/src/runEnvelope.ts` (new)
- `lib/execution-core/src/runEnvelope.test.ts` (new)
- `lib/execution-core/src/index.ts` (re-exports added)
- `docs/phases/phase-45-signed-run-result-envelope-library.md` (this file)
- `docs/phases/INDEX.md` (+1 entry)
- `replit.md` (Phase History prepend)
- `HANDOFF.md` (full rewrite)

## Gates

| Gate | Result |
|---|---|
| `pnpm --filter @workspace/execution-core run test` | ✓ **83 / 83** (was 38 / 38; +45 new envelope assertions across all 12 ticket scenarios + bonus version-taxonomy / replay / tamper coverage) |
| `pnpm run typecheck` (full repo: libs build + 4 leaf typechecks) | ✓ clean |
| `check:no-heuristic-runtime` | ✓ |
| `pnpm --filter @workspace/atlas run build` (BASE_PATH=/ PORT=4173) | ✓ — confirms the new subpath export keeps `node:crypto` out of the atlas browser bundle |
| `pnpm --filter @workspace/curriculum-quality run test` | ✓ **93 / 93** (unchanged) |
| `pnpm --filter @workspace/scripts run audit:authoring` | ✓ **58 / 58** publish-ready (unchanged) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | ✓ **58 / 58** (unchanged) |

## Ticket-scenario → test mapping

The Phase 45 ticket required ≥12 scenarios. Each line below maps the
ticket's bullet to the concrete test name(s) in `runEnvelope.test.ts`:

| Ticket scenario | Covered by |
|---|---|
| 1. canonicalization stable across object key order | `canonicalize > is stable across object key insertion order` + `recurses into nested objects with stable order` |
| 2. arrays preserve order | `canonicalize > preserves array order (no sorting)` + `computeOutputSha256 > changes when row order changes` |
| 3. signer/verifier round trip passes | `sign + verify round trip > round-trips and exposes capture only on the Ok arm` + `accepts when all expected fields match` + `accepts envelopes exactly at expiresAt` |
| 4. tampered stdout fails | `tamper detection > rejects when stdout is mutated post-sign` |
| 5. tampered code fails | `tamper detection > rejects when code is mutated post-sign` |
| 6. tampered projectId/stepId/userId fails | `tamper detection > rejects when projectId / stepId / userId in binding is mutated` (iterates all three) |
| 7. expired envelope fails | `expiry + binding + replay > rejects expired envelopes` |
| 8. wrong secret fails | `tamper detection > rejects when signature is wrong secret (constant-time path)` |
| 9. malformed envelope fails safely | `safety against malformed inputs > rejects %s without throwing` (it.each over 7 inputs) + `rejects an envelope whose capture.version is not 1` |
| 10. caller input is not mutated | `sign + verify round trip > does NOT mutate the caller's capture object` |
| 11. signature comparison does not use plain equality | `tamper detection > rejects when signature length differs (no plain-equality fallback)` (asserts the equal-length check fires before any compare) |
| 12. output hash and submission hash are deterministic | `sha256Hex > is deterministic` + `computeOutputSha256 > is deterministic for the same output content` + `does NOT depend on code (only output fields)` + `changes when stdout changes` |
| (bonus) binding-mismatch on validationKind / kid | `expiry + binding + replay > rejects mismatched expected.projectId / stepId / validationKind / kid` |
| (bonus) nonce hook returning replay | `rejects when nonce hook reports replay` + `supports an async nonce hook` |
| (bonus) nonce hook is not an oracle | `does NOT invoke the nonce hook on bad-signature envelopes` |

## Notes & deferred decisions

These were deliberately left for Phase 46+ (per `docs/signed-run-result-design.md` §11 open-questions list):

1. **Persisted nonce store.** Phase 45 exposes a `isNonceSeen` callback hook with sync/async semantics. The actual `run_envelope_nonces` table + janitor lands in Phase 46 alongside `POST /api/runs/sign`.
2. **Secret rotation policy.** `kid` is signed into the envelope, but there is no rotation runbook yet. Phase 47 candidate.
3. **`numeric_tolerance` capture shape.** Today `RunCapture` is generic stdout/rows. A future `numeric_tolerance` step may need a stricter "scalar result" capture variant; deferred until Phase 50.
4. **Optional Zod runtime schemas.** Skipped to keep `runEnvelope.ts` server-only and zero-dependency outside `node:crypto`. The barrel exports types only; routes that accept envelopes from the wire will add Zod parsers at the OpenAPI layer in Phase 46.

None of these block Phase 46. They are listed here so the next phase has a single referenceable checklist.

## Recommended Phase 46

**`POST /api/runs/sign` endpoint + `run_envelope_nonces` migration + nonce-janitor cron.**

- New route handler in `artifacts/api-server/src/routes/runs.ts` that accepts a `RunCapture` + binding intent, calls `signRunEnvelope`, persists `(nonce, userId, expiresAt)` so the future `/submit` arm can call `isNonceSeen`, and returns the signed envelope.
- OpenAPI spec entry → codegen → React Query mutation hook in `artifacts/atlas`.
- Migration adding `run_envelope_nonces` table (composite PK on nonce, TTL index on `expires_at`).
- Janitor script (or inline scheduled task) that deletes expired nonces.
- Secret sourced from `process.env.RUN_ENVELOPE_SIGNING_SECRET` with a hard-fail startup check.
- Still NO callers from `/submit` — Phase 47 wires that arm; Phase 46 keeps the surface inert end-to-end so a misconfigured rollout cannot break live learners.
- Architect review before merge.

## Commit

`phase-45: signed RunResult envelope library (execution-core)`
