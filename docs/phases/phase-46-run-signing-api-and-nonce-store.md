# Phase 46 — Run Signing API + Nonce Store (no /submit wiring)

**Parent phase**: 45 (Signed RunResult Envelope Library)
**Design spec**: `docs/signed-run-result-design.md`, `docs/phases/phase-44-runtime-validation-plan.md`
**Honest claim ceiling**: H3 (UNCHANGED — Atlas verified runtime output matched expected)

---

## Goal

Land the first server-side caller of the Phase 45 envelope library: an
authenticated `POST /api/runs/sign` route that mints a `SignedRunEnvelope`
for a learner's runtime capture, plus the empty `run_envelope_nonces`
Postgres table + cron janitor that the Phase 47 verifier will INSERT into.

This phase is deliberately scoped to "scaffolding only": no `/submit` or
`/check` caller, no grading change, no frontend wiring, no OpenAPI surface.
The envelope can be minted but is unused — the route exists so Phase 47 can
wire `verifyRunEnvelope` into grading without simultaneously inventing a
mint path.

## What shipped

### Schema (`lib/db/src/schema/progress.ts`)

New `runEnvelopeNonces` table, minimal shape per design doc §"Nonce store":

```ts
pgTable("run_envelope_nonces", {
  nonce: text("nonce").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('run_envelope_nonces_expires_at_idx').on(t.expiresAt),
]);
```

No FK to `users` / `projects` — the nonce is opaque and self-contained
inside the signed envelope binding. INSERT-only contract (Phase 47) lets
the table be truncated safely without losing learner data.

### Migration (`lib/db/drizzle/0001_phase46_run_envelope_nonces.sql`)

Hand-written DDL + `_journal.json` entry. Applied via
`pnpm --filter @workspace/scripts run migrate` in production (idempotent;
no-op on already-migrated DBs).

### Route (`artifacts/api-server/src/routes/runs-sign.ts`)

`POST /api/runs/sign` — separate file from the legacy debug-aid `runs.ts`
to keep concerns isolated. Behavior:

1. `requireAuth` — Clerk session.
2. Secret check — `process.env.RUN_ENVELOPE_SIGNING_SECRET` read lazily
   per request; missing → 503 `signing_unavailable` (no crash).
3. Body validation — `projectId` + `stepId` UUID-shape; `capture` shape
   mirrors `looksLikeCapture` from the library; non-finite numeric cells
   rejected at parse time (defense in depth — `JSON.stringify` already
   coerces Infinity/NaN to null on the wire, but a hand-crafted body
   could still smuggle them in).
4. Size caps — `code ≤ 32KB`, `stdout/stderr ≤ 64KB` (measured in UTF-8
   bytes via `Buffer.byteLength`, not JS string code-units), `rows ≤ 5000`,
   `columns ≤ 256` → 413 `capture_too_large` on overflow. Server-side
   guard so a runaway client cannot make us hash 100MB of stdout.
5. Step + project ownership — `projectSteps` lookup with `(id, projectId)`
   predicate rejects cross-project step forgery.
6. Project visibility + premium gate — hidden / archived → 404
   (no existence leak, matches the rest of the API). Premium project +
   free user → 403 `pro_required`.
7. Enrollment check — `user_progress` row for `(user, project)` required;
   missing → 403 `not_enrolled`.
8. Allow-list — `validation_type` must be one of
   `json_equal | numeric_tolerance | sql_resultset | csv_set_equal | csv_ordered`.
   `self_attest / exact / regex / contains` → 422
   `validation_kind_not_signable` (no runtime output to hash).
9. `signRunEnvelope(capture, binding, secret)` — TTL 10 minutes per design.
   On throw → 400 `sign_failed`. On success → 200 `{ envelope }`.

### Boot-time hard-fail (`artifacts/api-server/src/index.ts`)

`assertRunEnvelopeSigningSecret()` — if `RUN_ENVELOPE_SIGNING_SECRET` is
unset AND `REPLIT_DEPLOYMENT === '1'`, throw at boot so deploys fail fast
instead of serving a 503-only signing route. In dev / test the route
degrades to 503 and a warning is logged.

### Janitor (`scripts/src/cleanup-run-envelope-nonces.ts`)

`DELETE FROM run_envelope_nonces WHERE expires_at < NOW()`. Idempotent;
designed for a nightly cron (10-minute envelope TTL keeps the working set
tiny). Wired as `pnpm --filter @workspace/scripts run cleanup:run-envelope-nonces`.

### Tests (`artifacts/api-server/src/routes/runs-sign.test.ts`)

25 vitest assertions across:

- secret missing → 503
- `getCurrentUser` returns null → 401 (explicit branch coverage —
  architect-driven fix, closes the "no user → 401" gap)
- body validation: bad projectId / stepId / missing capture / wrong version
  / unknown language / unsupported cell type
- size cap: oversize stdout → 413
- ownership gates: foreign step / hidden project / premium gate /
  not enrolled
- allow-list: 4 unsignable kinds → 422; 5 signable kinds → 200
- happy path returns a verifiable envelope (real `verifyRunEnvelope` round-trip
  with binding context)
- TTL = 600_000ms exact
- server is sole hash authority — client-supplied `submissionSha256` /
  `outputSha256` on the body are ignored; binding hashes derive from
  the capture every time

The execution-core library is NOT mocked — letting the real signer +
verifier run is the only way to assert the signature is actually valid.

## What did NOT change (hard stops)

- `lib/execution-core/src/runEnvelope.ts` — Phase 45 library untouched.
- `artifacts/atlas/**` — no frontend caller, no `node:crypto` in the
  browser bundle (subpath import `@workspace/execution-core/run-envelope`
  is server-only).
- `routes/user.ts` (`/check`, `/submit`) — no envelope verification, no
  grading change.
- `lib/api-spec/openapi.yaml` — no OpenAPI entry. Phase 48 (frontend
  wiring) is the right place to add it; doing so now would force a codegen
  regen with no caller.
- `lib/curriculum-quality`, `audit:authoring`, `audit:pedagogy`,
  `audit:quality` — no enforcement counts changed.
- `json_equal` classification — Phase 43B-prime advisory contract intact.
- `RUBRIC_VERSION = '1.0.1'` — frozen.
- Seed / content / billing / cert routes — untouched.

## Trust model (unchanged from Phase 44)

The route can mint a signature for any well-formed capture the learner
sends. The signature proves "Atlas issued this envelope with this binding";
it does NOT prove the learner actually executed THIS code — residual A5
from the threat model (forge then sign). Honest claim ceiling stays at H3.

## Gates (all green, post-change)

- `pnpm run typecheck` — OK (libs + 4 leaf workspace packages)
- `check:no-heuristic-runtime` — OK
- `lib/curriculum-quality` tests — 93 / 93 (UNCHANGED)
- `lib/execution-core` tests — 83 / 83 (UNCHANGED, Phase 45)
- `artifacts/api-server` tests — 305 / 305 (Phase 45 baseline was 280;
  +25 from `runs-sign.test.ts`)
- `audit:authoring` — 58 / 58 (UNCHANGED; advisories: 174 submission-shape
  + 3 legacy spec key — both UNCHANGED from Phase 43B-prime baseline)
- `audit:pedagogy` — 58 / 58 (UNCHANGED)
- `artifacts/api-server` boots clean — secret-warn fires in dev as expected;
  hard-fail path covered by code, gated on `REPLIT_DEPLOYMENT === '1'`.
- `curl -X POST localhost:80/api/runs/sign` (unauthed) → 401, as expected.

## Operational notes

- Before any production deploy, set `RUN_ENVELOPE_SIGNING_SECRET` in the
  deployment environment. Boot will throw otherwise. Use a strong random
  value (e.g. `openssl rand -hex 32`).
- Rotate via `kid` — Phase 47+ can mint with a new `kid` while the verifier
  accepts both old + new for the rotation window. Library already supports
  it (`SignBindingInput.kid`).
- Apply the migration in prod as part of the deploy:
  `pnpm --filter @workspace/scripts run migrate`.

## Phase 47 candidate (next)

Wire `verifyRunEnvelope` into `/submit` behind a server-side allow-list
keyed on `validationType`. Initial enforcement set: EMPTY (kinds accept
envelopes opportunistically but do not require them). First flip: 1%
canary on a single `json_equal` step, monitor `envelope-replay` /
`envelope-expired` / `envelope-tampered` rates. Architect review BEFORE
flipping the first kind to required.
