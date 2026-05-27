# HANDOFF

**Latest shipped phase:** Phase 45 — Signed RunResult Envelope Library (`lib/execution-core` only; zero callers wired).
**Working tree:** clean after `phase-45: signed RunResult envelope library (execution-core)`.
**Parent commit:** `f2dbef9` (Phase 44 close — runtime-validation threat model + design + plan).

---

## Phase 45 summary

First implementation phase of the Phase 44 Shape γ plan. Lands the reusable, well-tested envelope primitives inside `lib/execution-core` and stops there. Nothing else in the repo was touched, no behavior changed, no migration, no route, no OpenAPI/codegen. Reversible by reverting this commit.

### What landed

One new module pair inside `lib/execution-core` exposed via a dedicated server-only subpath export (`@workspace/execution-core/run-envelope`). The root barrel is deliberately untouched so the atlas frontend bundle stays free of `node:crypto`:

| File | Role |
|---|---|
| `lib/execution-core/src/runEnvelope.ts` (new) | Types + canonicalizer + sha256 helper + HMAC signer + verifier. |
| `lib/execution-core/src/runEnvelope.test.ts` (new) | 45 vitest assertions across all 12 ticket scenarios plus tamper / replay / version-taxonomy / malformed coverage. |
| `lib/execution-core/package.json` (edited) | New `"./run-envelope"` subpath export. |
| `lib/execution-core/src/index.ts` (edited) | Documentation comment; the root barrel deliberately does NOT re-export the envelope module — server callers import from `@workspace/execution-core/run-envelope` so the atlas frontend bundle stays free of `node:crypto`. |

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

### Security invariants enforced (each asserted by at least one named test)

- **S1 Server is the sole hash authority.** `signRunEnvelope` ignores pre-supplied hash values and derives `submissionSha256 = sha256(capture.code)` and `outputSha256 = computeOutputSha256(capture)`. `verifyRunEnvelope` recomputes both and rejects on mismatch (`envelope-tampered`).
- **S2 Canonical serialization is deterministic.** Recursive sorted-key JSON; NFC string normalization; explicit rejection of `undefined` / `NaN` / `Infinity` / `Date` / `bigint` / function / symbol; arrays preserve order.
- **S3 Signature comparison is constant-time.** `crypto.timingSafeEqual` after equal-length check; plain `===` never used on the signature.
- **S4 Capture is reachable only on verified Ok.** `VerificationResult` is a discriminated union — `result.capture` and `result.binding` only exist on the `ok: true` arm.
- **S5 Caller input is not mutated.** `signRunEnvelope` deep-copies the capture (including `columns` / `rows`).
- **S6 No grading / curriculum-quality / route imports.** `runEnvelope.ts` imports only `node:crypto`.
- **S7 Nonce hook is not an oracle.** Replay hook runs only after signature + tamper + binding + expiry checks pass.
- **S8 Malformed inputs fail safely.** `looksLikeEnvelope` / `looksLikeCapture` / `looksLikeBinding` reject `null` / `undefined` / strings / numbers / partial shapes / bad timestamps without throwing.

### Failure-reason vocabulary (matches `docs/signed-run-result-design.md` §9)

`envelope-malformed` · `envelope-unsupported-version` · `envelope-bad-signature` · `envelope-tampered` · `envelope-binding-mismatch` · `envelope-expired` · `envelope-replay`.

Order is deliberate (cheap checks first; DB-backed nonce hook last so it isn't an oracle).

### What this still does NOT prove

Honest claim ceiling unchanged from Phase 44: **H3 only** — *"Atlas verified that the runtime output submitted for this step matched the expected result."*

- Does not prove the learner wrote the code (H1 — out of scope for any browser-runtime platform).
- Does not prove the learner executed *their* code vs. someone else's (H2 / attack A2 — accepted residual).
- Does not prevent forge-then-sign (attack A5 — accepted residual).

Unacceptable product claims (carried verbatim from threat model §10) must not ship: "learner wrote this", "solved independently", "tamper-proof", "cheat-proof".

### Recommended implementation sequence (unchanged from Phase 44, with Phase 45 done)

| Phase | Scope | Behavior change? |
|---|---|---|
| **45** ✅ | Envelope types + canonicalizer + signer + verifier in `lib/execution-core` + tests. | None |
| **46** ⏳ next | `POST /api/runs/sign` endpoint + `run_envelope_nonces` table/migration/janitor + OpenAPI/codegen + React Query mutation hook. | None (no caller yet) |
| **47** | Captured-submission arm in `gradeSubmission`; `VALIDATION_KINDS_REQUIRING_ENVELOPE` env-driven allow-list (default empty). | None until allow-list populated |
| **48** | Frontend Run→sign→Submit plumbing + "How Atlas Grades" public page + cert-copy review. | None until §49 |
| **49** | Flip `json_equal` to envelope-required for 1% then 100% over 1-2 weeks. | Real enforcement on `json_equal` |
| **50+** | Repeat §49 for `numeric_tolerance`, `sql_resultset`, `csv_set_equal`, `csv_ordered`. | Real enforcement, one kind per phase |

### Files changed in Phase 45

- `lib/execution-core/src/runEnvelope.ts` (new)
- `lib/execution-core/src/runEnvelope.test.ts` (new)
- `lib/execution-core/src/index.ts` (re-exports)
- `docs/phases/phase-45-signed-run-result-envelope-library.md` (new)
- `docs/phases/INDEX.md` (+1 entry)
- `replit.md` (Phase History prepend)
- `HANDOFF.md` (this file)

### Hard stops respected in Phase 45

| Surface | Touched? |
|---|---|
| `lib/grading.ts` | NO |
| `/check`, `/submit`, route handlers | NO |
| Frontend code | NO |
| OpenAPI spec / codegen | NO |
| Other `execution-core` modules | NO |
| DB schema / migrations | NO |
| Seed / content / project files | NO |
| Pedagogy / rubric / taxonomy | NO |
| Deployment / production DB | NO |
| Billing / Stripe / certs / portfolio | NO |
| `audit:authoring` enforcement counts | UNCHANGED |
| `audit:authoring` advisories | UNCHANGED |
| `publishReady` count | UNCHANGED (58/58) |
| `json_equal` classified as enforced | NO — still `contract-shaped` |

### Gates

| Gate | Result |
|---|---|
| `pnpm --filter @workspace/execution-core run test` | ✓ **83 / 83** (was 38; +45 new envelope assertions) |
| `pnpm run typecheck` (full repo: libs build + 4 leaf typechecks) | ✓ clean |
| `pnpm --filter @workspace/atlas run build` (BASE_PATH=/ PORT=4173) | ✓ — confirms subpath export keeps `node:crypto` out of the browser bundle |
| `check:no-heuristic-runtime` | ✓ |
| `pnpm --filter @workspace/curriculum-quality run test` | ✓ **93 / 93** (unchanged) |
| `pnpm --filter @workspace/scripts run audit:authoring` | ✓ **58 / 58** publish-ready (unchanged) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | ✓ **58 / 58** (unchanged) |

### Risks remaining after Phase 45

1. **Library exists but cannot strengthen any claim.** The signer is honest about what it proves (H3 at most). Pressure to ship Phase 46+ quickly must not collapse into shipping the route without the disclosure work Phase 48 owns.
2. **Allow-list rollout coordination (deferred to Phase 49+).** Mis-flipped env var on prod could 400 every active learner mid-step. Kill-switch runbook is still owed.
3. **Twelve open questions in `docs/signed-run-result-design.md` §11.** None block Phase 46; several block Phase 47 (TTL length, `/check` envelope policy, schema-version bump policy, secret-rotation runbook).
4. **Residual A2 / A5 risk is intentional** and inherited from Phase 44. Product team must internalize H3 as the ceiling.
5. **Pyodide / DuckDB-WASM capture-shape drift.** Capture shape is tied to what these runtimes emit. Pinning version + smoke test on capture shape per release would prevent silent breakage. Phase 46 candidate.

### Recommended Phase 46

**`POST /api/runs/sign` endpoint + `run_envelope_nonces` migration + nonce janitor + OpenAPI/codegen + React Query mutation hook.**

- New route handler in `artifacts/api-server/src/routes/runs.ts` calling `signRunEnvelope`, persisting `(nonce, userId, expiresAt)` for the future `/submit` arm.
- OpenAPI spec entry → codegen → React Query mutation hook in `artifacts/atlas`.
- Migration adding `run_envelope_nonces` (composite PK on nonce, TTL index on `expires_at`).
- Janitor script (or inline scheduled task) deleting expired nonces.
- Secret sourced from `process.env.RUN_ENVELOPE_SIGNING_SECRET` with hard-fail startup check.
- Still NO callers from `/submit` — Phase 47 wires that arm; Phase 46 keeps the surface inert end-to-end so a misconfigured rollout cannot break live learners.
- Architect review before merge.

### Commit

`phase-45: signed RunResult envelope library (execution-core)`
