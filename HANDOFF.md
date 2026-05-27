# HANDOFF

**Latest shipped phase:** Phase 46 — Run Signing API + Nonce Store (no `/submit` wiring).
**Working tree:** clean after `phase-46: run signing api + nonce store`.
**Parent commit:** `6818cc5` (Phase 45 close — signed RunResult envelope library).

---

## Phase 46 summary

Second implementation phase of the Phase 44 Shape γ plan. Lands the first server-side caller of the Phase 45 envelope library: authenticated `POST /api/runs/sign` that mints a `SignedRunEnvelope` for a learner's runtime capture, plus the empty `run_envelope_nonces` Postgres table + janitor that Phase 47's verifier will INSERT into. Zero grading change, zero `/submit` wiring, zero frontend wiring, zero OpenAPI surface — the route is reachable but inert because nothing else verifies envelopes yet.

### What landed

| File | Role |
|---|---|
| `artifacts/api-server/src/routes/runs-sign.ts` (new) | `POST /api/runs/sign` route handler. Separate file from legacy debug-aid `runs.ts` to keep concerns isolated. |
| `artifacts/api-server/src/routes/runs-sign.test.ts` (new) | 25 vitest assertions: secret-missing → 503; **explicit 401 when `getCurrentUser` returns null** (architect-driven fix); body validation; size caps; ownership gates (foreign step / hidden / premium / not enrolled); allow-list (4 unsignable kinds → 422, 5 signable → 200); real round-trip with `verifyRunEnvelope`; TTL exact; server-is-sole-hash-authority. |
| `artifacts/api-server/src/routes/index.ts` (edited) | Registered `runsSignRouter`. |
| `artifacts/api-server/src/index.ts` (edited) | `assertRunEnvelopeSigningSecret()` — boot-time hard-fail when `REPLIT_DEPLOYMENT === '1'` and the secret is unset; warn in dev. |
| `lib/db/src/schema/progress.ts` (edited) | New `runEnvelopeNonces` table: `(nonce text PK, expires_at timestamptz, created_at timestamptz default now())` + `expires_at` index. |
| `lib/db/drizzle/0001_phase46_run_envelope_nonces.sql` (new) | Hand-written DDL migration (matches drizzle-kit output shape; applied via `pnpm --filter @workspace/scripts run migrate`). |
| `lib/db/drizzle/meta/_journal.json` (edited) | +1 entry for idx 1. |
| `scripts/src/cleanup-run-envelope-nonces.ts` (new) | Nightly janitor: `DELETE WHERE expires_at < NOW()`. Idempotent. |
| `scripts/package.json` (edited) | `cleanup:run-envelope-nonces` npm alias. |
| `docs/phases/phase-46-run-signing-api-and-nonce-store.md` (new) | Close-out. |

### Route contract

```
POST /api/runs/sign
Auth: required (Clerk)
Body: { projectId: uuid, stepId: uuid, capture: RunCapture }
TTL:  600_000 ms (10 minutes)

200 → { envelope: SignedRunEnvelope }
400 → invalid_projectId | invalid_stepId | invalid_capture | sign_failed
401 → Unauthorized
403 → pro_required | not_enrolled
404 → step_not_found | project_not_found  (hidden = 404, no existence leak)
413 → capture_too_large  (code ≤ 32KB, stdout/stderr ≤ 64KB UTF-8 bytes via Buffer.byteLength; rows ≤ 5000, cols ≤ 256)
422 → validation_kind_not_signable  (self_attest / exact / regex / contains)
503 → signing_unavailable  (RUN_ENVELOPE_SIGNING_SECRET unset)
```

Signable validation kinds (allow-list): `json_equal`, `numeric_tolerance`, `sql_resultset`, `csv_set_equal`, `csv_ordered`. Unsignable kinds have no runtime output to hash; 422 by design.

### Nonce table (minimal per design doc §"Nonce store")

```sql
CREATE TABLE run_envelope_nonces (
  nonce      text PRIMARY KEY NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX run_envelope_nonces_expires_at_idx ON run_envelope_nonces USING btree (expires_at);
```

No FK to `users` / `projects` — the nonce is opaque and self-contained inside the signed envelope binding. INSERT happens at verify time (Phase 47), not at sign time. Table is empty after Phase 46; janitor is a no-op until Phase 47 begins writing rows.

### Boot-time secret check

`assertRunEnvelopeSigningSecret()` runs after `initStripe`:

- `RUN_ENVELOPE_SIGNING_SECRET` set → silent.
- Unset + `REPLIT_DEPLOYMENT === '1'` → **throw** at boot. Deploys fail fast.
- Unset + dev/test → `logger.warn(...)`; route degrades to 503 until set.

Operator action: set `RUN_ENVELOPE_SIGNING_SECRET` (≥32 random bytes, e.g. `openssl rand -hex 32`) in the deployed environment before any deploy ships. Rotate via `kid` — library already supports `SignBindingInput.kid`.

### What this still does NOT prove

Honest claim ceiling unchanged from Phase 44: **H3 only** — *"Atlas verified that the runtime output submitted for this step matched the expected result."*

- Does not prove the learner wrote the code (H1 — out of scope for any browser-runtime platform).
- Does not prove the learner executed *their* code vs. someone else's (H2 / A2 — accepted residual).
- Does not prevent forge-then-sign (A5 — accepted residual; the route can mint a signature for any well-formed capture the learner submits).

The route + table exist so Phase 47 can wire `verifyRunEnvelope` into grading without simultaneously inventing the mint path. Shipping in this order keeps the verifier change small and reviewable.

### Recommended implementation sequence (unchanged from Phase 44/45)

| Phase | Scope | Behavior change? |
|---|---|---|
| **45** ✅ | Envelope types + canonicalizer + signer + verifier in `lib/execution-core` + tests. | None |
| **46** ✅ | `POST /api/runs/sign` + `run_envelope_nonces` migration + janitor + boot-time secret check + tests. | None (no `/submit` caller, no FE wiring) |
| **47** ⏳ next | Captured-submission arm in `gradeSubmission`; `VALIDATION_KINDS_REQUIRING_ENVELOPE` env-driven allow-list (default empty); nonce INSERT-on-first-verify wiring. | None until allow-list populated |
| **48** | Frontend Run→sign→Submit plumbing + OpenAPI entry + "How Atlas Grades" public page + cert-copy review. | None until §49 |
| **49** | Flip `json_equal` to envelope-required for 1% then 100% over 1-2 weeks. | Real enforcement on `json_equal` |
| **50+** | Repeat §49 for `numeric_tolerance`, `sql_resultset`, `csv_set_equal`, `csv_ordered`. | Real enforcement, one kind per phase |

### Hard stops respected in Phase 46

| Surface | Touched? |
|---|---|
| `lib/grading.ts` | NO |
| `/check`, `/submit` route handlers | NO |
| Frontend code (`artifacts/atlas`) | NO |
| OpenAPI spec / codegen | NO — deferred to Phase 48 |
| `lib/execution-core/src/runEnvelope.ts` (Phase 45 library) | NO |
| Atlas frontend bundle (`node:crypto`) | NO — subpath import is server-only |
| Seed / content / project files | NO |
| Pedagogy / rubric / taxonomy | NO |
| Production DB | NO (migration added; operator applies via `pnpm run migrate`) |
| Billing / Stripe / certs / portfolio | NO |
| `audit:authoring` enforcement counts | UNCHANGED (58/58) |
| `audit:authoring` advisories | UNCHANGED (174 submission-shape + 3 legacy spec keys) |
| `audit:pedagogy` | UNCHANGED (58/58) |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| `json_equal` classification | UNCHANGED (still contract-shaped) |

### Gates (all green)

| Gate | Result |
|---|---|
| `pnpm run typecheck` (full repo: libs build + 4 leaf typechecks + `check:no-heuristic-runtime`) | ✓ clean |
| `pnpm --filter @workspace/api-server run test` | ✓ **305 / 305** (was 280 in Phase 45; +25 from `runs-sign.test.ts`, including explicit 401 when `getCurrentUser` returns null — architect-driven fix) |
| `pnpm --filter @workspace/execution-core run test` | ✓ **83 / 83** (unchanged from Phase 45) |
| `pnpm --filter @workspace/curriculum-quality run test` | ✓ **93 / 93** (unchanged) |
| `pnpm --filter @workspace/scripts run audit:authoring` | ✓ **58 / 58** publish-ready (unchanged) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | ✓ **58 / 58** (unchanged) |
| API server boots clean | ✓ — secret-warn fires; server listens; Stripe initializes |
| `curl -X POST localhost:80/api/runs/sign` (unauthed) | ✓ → 401 |

### Risks remaining after Phase 46

1. **Operator must set `RUN_ENVELOPE_SIGNING_SECRET` before first deploy.** Boot-time hard-fail makes this a deploy-step failure rather than a silent runtime degradation, but the deploy-checklist should call it out explicitly. `docs/deployment-checklist.md` update is a Phase 46.x candidate.
2. **Route is mintable but inert.** Until Phase 47 wires `/submit`, a learner calling `/runs/sign` gets back a valid envelope nothing verifies. Acceptable: no behavior change, no false claim made.
3. **Nonce table is empty.** Janitor is a no-op until Phase 47 starts inserting on first verify. Cron registration is therefore optional this phase — register before Phase 47 ships.
4. **Residual A2 / A5 risk unchanged from Phase 44.** Honest claim ceiling stays H3.
5. **Schema-version bump policy + secret-rotation runbook still owed** (open questions §11 of design doc; block Phase 47).

### Recommended Phase 47

Captured-submission arm in `gradeSubmission`:

- New `Submission` discriminated union: legacy bare-string arm (preserved verbatim — initial allow-list is empty so every live caller takes this arm) + new `{ kind: 'envelope', envelope: SignedRunEnvelope }` arm.
- New `lib/grading.ts` helper `verifyEnvelopeForGrading(envelope, ctx)` calling `verifyRunEnvelope` with binding context from the route + `isNonceSeen` hook that does `INSERT INTO run_envelope_nonces VALUES (...) ON CONFLICT DO NOTHING RETURNING nonce` — INSERT success ⇒ first use; INSERT no-op ⇒ replay.
- `VALIDATION_KINDS_REQUIRING_ENVELOPE` env-driven allow-list (default empty).
- Per-failure-reason structured telemetry (`evt: 'envelope.verify.failed', reason: ...`) so Phase 49's 1% canary has the dashboards it needs.
- Architect review BEFORE Phase 49 flips the first kind.

### Commit

`phase-46: run signing api + nonce store`
