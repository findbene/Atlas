# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run migrate` — apply Drizzle migrations from `lib/db/drizzle/` to `$DATABASE_URL` (idempotent; use for production. See `docs/deployment-checklist.md`)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/scripts run seed:stripe` — create the Pro Plan product + monthly/annual prices in Stripe (idempotent — only run once per Stripe account)
- `pnpm --filter @workspace/scripts run backfill:course` — Phase-8 one-shot backfill of `projects.course` + `tracks.is_primary` (idempotent)
- `pnpm --filter @workspace/scripts run grant:admin -- <email>` — promote a user to admin role

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Atlas Product

Atlas is a project-based learning platform for Data Engineering. Artifacts:

- `artifacts/atlas` — React + Vite frontend at `/`
- `artifacts/api-server` — Express API at `/api`
- `artifacts/mockup-sandbox` — Canvas/component preview at `/__mockup`

### Auth

Clerk (`@clerk/react` on the client + `@clerk/express` on the server). `getCurrentUser(req)` returns the local `users` row (looked up by `clerkId`).

**Auto-provisioning:** `requireAuth` (in `artifacts/api-server/src/lib/auth.ts`) is async. On the first authed request from a new Clerk user, it calls `clerkClient.users.getUser(userId)` to read email/name/avatar and inserts a row into the local `users` table. Subsequent requests hit a per-process Map cache (`userCache`) so there is no per-request Clerk roundtrip or DB SELECT. Email-uniqueness collisions on insert fall back to a clerk-scoped placeholder email (`<clerkId>@users.atlasprojects.dev`) so the app stays functional even if a previous local account used the same address.

**Admin gate (Phase 8):** `requireAdmin` chains off `requireAuth` and rejects anyone whose `users.role !== 'admin'` with 403. Use `pnpm --filter @workspace/scripts run grant:admin -- <email>` to promote the first admin.

Trade-off: cache is per-process and never refreshed once primed. For a single-instance deployment this is fine; for multi-instance or when Clerk profile data needs to propagate, add a TTL or invalidate on a Clerk webhook.

### Code Execution (Pyodide)

Python code in the project workspace runs **entirely in the browser** via [Pyodide](https://pyodide.org/) (loaded from jsdelivr CDN on first use, ~10MB). Implementation in `artifacts/atlas/src/lib/pyodideRunner.ts`:

- Detects imports in user code and pre-loads matching wheels (numpy, pandas, scipy, matplotlib, scikit-learn, etc.) before execution.
- Serializes runs through a single promise chain so the global `setStdout`/`setStderr` handlers never interleave between concurrent calls.
- Timeouts mark the run abandoned (Pyodide can't actually be cancelled from JS — late output is dropped, and the next queued run waits for the abandoned one to finish before starting).

The legacy `POST /api/execute/python` endpoint returns a deprecation no-op since the public Piston API switched to whitelist-only in Feb 2026.

### Billing (Stripe)

Uses the Replit Stripe connector with `stripe-replit-sync`, which mirrors Stripe data into a `stripe.*` schema in our Postgres DB and provides a managed webhook.

Startup sequence in `artifacts/api-server/src/index.ts`:

1. `runMigrations` creates the `stripe` schema and tables.
2. `findOrCreateManagedWebhook` registers `https://${REPLIT_DOMAINS[0]}/api/webhooks/stripe` with Stripe.
3. `syncBackfill` pulls existing Stripe data into the `stripe.*` tables.

If Stripe init fails, the rest of the API still serves traffic — only billing routes will fail until the connector is configured.

Routes:

- `GET /api/billing/plans` — Pro Plan price IDs are sourced live from `stripe.prices` (joined to `stripe.products` where `name = 'Pro Plan'` and `active = true`). Falls back to `STRIPE_PRO_*_PRICE_ID` env vars.
- `POST /api/billing/checkout` — Validates the submitted `priceId` against the active Pro price allowlist. `ensureStripeCustomer` creates the Stripe customer with an idempotency key keyed by `user.id` and writes back to `users.stripe_customer_id` only when the column is still NULL.
- `POST /api/billing/portal` — Stripe Billing Portal session.
- `POST /api/webhooks/stripe` — Registered with `express.raw` BEFORE `express.json`. Verifies signature via `stripe-replit-sync`, calls `reconcileCustomer` to mirror state into our `users.subscriptionTier` + `subscriptions` rows, and only marks the event in `processed_webhook_events` after both sync and reconcile succeed.

`subscription_status` enum collision note: our `public.subscription_status` enum collides with the unqualified `IF NOT EXISTS` check in `stripe-replit-sync`'s 0004 migration. The fix is to pre-create `stripe.subscription_status` before `runMigrations` runs. If you reset to a fresh DB, run:

```sql
CREATE SCHEMA IF NOT EXISTS stripe;
CREATE TYPE stripe.subscription_status AS ENUM ('trialing','active','canceled','incomplete','incomplete_expired','past_due','unpaid');
```

before starting the api-server.

Environment: secret/publishable/webhook keys come from the Replit Stripe connector. `REPLIT_DEPLOYMENT` selects between development/production environments.

### AI Tutor (Anthropic)

Streamed Claude responses at `POST /api/ai/chat` (SSE) in `artifacts/api-server/src/routes/ai.ts`. Uses the Replit AI Integrations Anthropic proxy via `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY`. Free tier → `claude-haiku-4-5`, Pro tier → `claude-sonnet-4-5`.

### Transactional Email (Resend)

`artifacts/api-server/src/lib/email.ts` fetches Resend credentials from the Replit Resend connector (`REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY`), caches them in-process, and exposes `sendEmail()` + `renderWaitlistConfirmationEmail()`. Wired fire-and-forget into `POST /api/waitlist`; failures are logged via `req.log.warn`.

Free-email domains (gmail / outlook / yahoo / icloud / etc.) cannot be used as the FROM address — Resend rejects them at the API layer. The lib auto-falls-back to `onboarding@resend.dev` (Resend's sandbox sender). For production, verify a custom domain (e.g. `mail.atlasprojects.dev`) in the Resend dashboard and update the connection's `from_email`.

### Curriculum Seed Data scope

Only `csv-to-postgres-pipeline` (4 steps) and `dbt-data-models` (2 steps) were fully enriched in the v1 hint ladder. Phase 7 added 18 more fully-authored modules. The remaining ~45 catalog projects fall back to the legacy `hints[]` column. Seed: `scripts/src/seed-pedagogy.ts` (idempotent, called from `seed.ts`). Audit: `pnpm --filter @workspace/scripts run audit:pedagogy`.

### Curriculum Seed Data

`scripts/src/seed.ts` is the authoritative seed entrypoint, idempotent. Companion modules:

- `scripts/src/seed-mastery-python.ts` — 12 Python Mastery modules (fundamentals → LangChain).
- `scripts/src/seed-mastery-sql.ts` — 6 SQL Mastery modules (foundations → DB design).
- `scripts/src/seed-projects-extra.ts` — full step content for projects 11-15 (Flink, Data Catalog, Real-Time Dashboard, Data Mesh, Column-Store).

The seed handles in-place upgrades for projects that previously existed only as stubs. Run with `pnpm --filter @workspace/scripts run seed`.

## Active Invariants / Gates (Phase 11+)

- `RUBRIC_VERSION='1.0.1'` — frozen. No weight edits, no quality-gate weakening.
- `AuthoredProject.candidateId: string` — REQUIRED (typed, not a comment). All promotes need a candidate row.
- Anchor drift ≤ ±1 (target 0.00) across every promote.
- All catalog / wave / admin / triage reports MUST read `projects.course` directly. No runtime `mapToCourse` calls outside the 4-file allowlist — `check:no-heuristic-runtime` chains into `pnpm run typecheck`.
- Learner-facing routes filter `learner_visible = TRUE`. Hidden slugs return **404 (not 403)** — no existence leak.
- Admin route (`GET /api/admin/quality`) does NOT filter; exposes `hiddenCount` + `hiddenSlugs` and `lineageIntegrity { promotedProjects, candidatesWithInverse, mismatches, inverseMismatches, duplicateCandidatePromotions }` — all four lineage failure modes must read zero.
- Bidirectional candidate ↔ project lineage: `promote()` writes both FK directions atomically and hard-fails if the inverse `UPDATE` doesn't match exactly 1 row.
- Archive = hide (`learner_visible=false`), not destroy. No row deletes from `projects` or `project_candidates`. Two archive-gate patterns exist: thin-stub archives assert `total_steps=0 AND enrolled_count=0` (`archive-thin-stubs.ts`); supersedence archives (Phase 11/12B/37) assert `enrolled_count=0` AND that the upgraded counterpart exists+visible.
- The 9 Atlas courses: `data-engineering` · `ai-engineer` · `mlops-engineer` · `data-scientist` · `analytics-engineer` · `applied-llm-engineer` · `cloud-data-engineer` · `python-libraries` · `sql`. Atlas is NEVER described as a 4-domain / 4-discipline platform.

## Current Phase

Live session state (latest shipped phase, working-tree status, gate summary, commit refs) lives in **`HANDOFF.md`** — single source of truth.
Per-phase close-out records live in `docs/phases/`. The Phase History below is the chronological index.

## Phase History

Latest 3 phases below. Full chronological phase index (every closed phase, oldest-first): [docs/phases/INDEX.md](docs/phases/INDEX.md).

- **Phase 45 — Signed RunResult Envelope Library (execution-core)** → [phase-45-signed-run-result-envelope-library.md](docs/phases/phase-45-signed-run-result-envelope-library.md). First implementation phase of the Phase 44 Shape γ plan. Single new module pair inside `lib/execution-core` — `runEnvelope.ts` (types + canonicalizer + sha256 helper + HMAC signer + verifier) + `runEnvelope.test.ts` (45 vitest assertions across all 12 ticket scenarios + tamper / replay / version-taxonomy / malformed coverage) — exposed via a dedicated server-only subpath `@workspace/execution-core/run-envelope` (root barrel deliberately NOT touched so the atlas frontend bundle stays free of `node:crypto` — architect-driven fix). Zero callers wired; `/check`/`/submit`/frontend/OpenAPI/content/schema unchanged. Primitives: `canonicalize` (recursive sorted-key JSON; NFC string normalization; explicit reject `undefined`/`NaN`/`Infinity`/`Date`/`bigint`/function/symbol; arrays preserve order), `sha256Hex` (lowercase hex), `computeOutputSha256` (digest of capture output subset only — independent of `code`), `signRunEnvelope` (server-derives both hashes, ISO timestamps, default `randomUUID()` nonce, `kid="v1"`, HMAC-SHA256 hex, deep-copies caller input), `verifyRunEnvelope` (async; discriminated `Ok | Err` return — capture only reachable on Ok arm; check order malformed → version → signature → tampered → binding-mismatch → expired → replay; `crypto.timingSafeEqual` after equal-length check; replay hook runs LAST so it cannot be a DB oracle). `EnvelopeBinding` carries Phase-44 fields `{version, kid, userId, projectId, stepId, validationKind, submissionSha256, outputSha256, issuedAt, expiresAt, nonce}` — preserves the architect-approved capture/binding split. Eight security invariants S1-S8 documented + each asserted by at least one named test. Failure-reason vocabulary matches design doc §9. Honest claim ceiling unchanged: H3 only; A2 + A5 still accepted residuals; library exists but cannot strengthen the claim — Phase 46+ wires it. Hard stops respected: no edits to `grading.ts` / `/check` / `/submit` / frontend / OpenAPI / codegen / other-execution-core-modules / schema / migrations / seed / content / deployment / billing / cert / `audit:authoring` enforcement counts / `publishReady` / `json_equal` classification. All gates green: `execution-core` tests **83/83** (+45 new) + atlas frontend build green (subpath export `@workspace/execution-core/run-envelope` keeps `node:crypto` out of the browser bundle — architect-driven fix) · full `pnpm run typecheck` clean · `check:no-heuristic-runtime` OK · `curriculum-quality` 93/93 (unchanged) · `audit:authoring` **58/58 (UNCHANGED)** · `audit:pedagogy` 58/58 (unchanged). Phase 46 candidate = `POST /api/runs/sign` route + `run_envelope_nonces` migration + nonce janitor + OpenAPI/codegen wiring, still NO `/submit` caller, secret sourced from `RUN_ENVELOPE_SIGNING_SECRET` with hard-fail startup check, architect review before merge.
- **Phase 44 — Runtime Validation Trust Model + Signed RunResult Plan** → [phase-44-runtime-validation-plan.md](docs/phases/phase-44-runtime-validation-plan.md). Planning-first phase establishing the trust boundary, threat model, and signed-envelope design that must precede any Shape γ implementation. Three new docs: `docs/runtime-validation-threat-model.md` (trust boundaries, actors C1-C8, nine concrete attacks A1-A9, residual risks, three candidate claim levels H1/H2/H3 with H3 — "Atlas verified the runtime output matched the expected result" — as the recommended ceiling, plus required disclosure work: public "How Atlas Grades" page + cert-copy review + admin/hiring-partner brief); `docs/signed-run-result-design.md` (full `RunCapture` + `RunEnvelope` shape, canonical serialization, separate `POST /api/runs/sign` endpoint that mints binding + signs but never grades or echoes expected output, postgres-backed nonce table with 10-min TTL, `gradeSubmission` polymorphic `Submission` union preserving the legacy bare-string arm verbatim, per-validation-kind allow-list rollout, ten failure modes with error codes, twelve open questions deferred to Phase 45+); `docs/phases/phase-44-runtime-validation-plan.md` (read-only audit, deliverables, Phase 45-50 implementation sequence: envelope types → `/sign` route → grading arm → frontend plumbing → 1%→100% rollout per kind, hard stops). Honest claim ceiling: H3 only. Unacceptable claims enumerated: "learner wrote this", "solved independently", "tamper-proof", "cheat-proof". Accepted residuals: A2 (ran someone else's code) + A5 (forge then sign) — same residual every browser-runtime platform carries. Optional pure types in `execution-core` deferred to Phase 45. All hard stops respected: no `grading.ts`/`/check`/`/submit`/frontend/OpenAPI/codegen/execution-core-runtime/schema/migrations/seed/content/deployment/billing/cert touched. Gates green (inherited): typecheck OK · curriculum-quality 93/93 · audit:authoring 58/58 · audit:pedagogy 58/58. Recommended Phase 45 = envelope types + canonicalizer + signer + verifier in `lib/execution-core`, server-only, no behavior change.
- **Phase 43B-prime — `json_equal` Submission-Shape Audit Warning (Shape β)** → [phase-43b-prime-json-equal-audit-warning.md](docs/phases/phase-43b-prime-json-equal-audit-warning.md). Architect-stop on naive `JSON.parse(submission)` grading after Phase 43B's pre-implementation audit found the Phase 42 "~30 LOC Shape A" estimate was wrong: server receives learner Python source code (not a JSON value) for all 174 visible `json_equal` steps + all 36 `numeric_tolerance` steps (every one is `code_python`). Shape β = conservative audit-warning path. New helpers `jsonEqualHasSubmissionShapeMismatch` + `detectLegacyJsonEqualSpecKeys` + `NON_TEXT_SUBMISSION_STEP_TYPES` + `LEGACY_JSON_EQUAL_SPEC_KEYS` on `lib/curriculum-quality/src/validationEnforcement.ts` (+13 assertions, 93/93). New `JsonEqualSubmissionShapeAdvisory` + `ValidationSpecShapeAdvisory` per-step categories on `audit:authoring`'s `ProjectReport` populated inside the per-step loop, with a new "Authoring advisories" summary section — explicitly NOT `ProjectFinding`, NOT in `publishReady`. Live: 174 submission-shape advisories across 49 projects + 3 legacy-spec-key advisories in 1 project (`ai-engineer-rag-baseline-pgvector`). `docs/validation-kind-matrix.md` Future-actions rewritten as "Submission-shape blocker" + 2 matrix rows corrected; `docs/project-authoring-spec.md` new §5.1.1 codifies that `json_equal` on `code_python` is acceptable and NOT a publish-ready blocker. Hard stops respected: no edits to `grading.ts`/`/check`/`/submit`/frontend/OpenAPI/codegen/schema/migrations/content/seed. Gates green: typecheck OK · curriculum-quality 93/93 (+13) · audit:authoring 58/58 (UNCHANGED) · audit:pedagogy 58/58 (UNCHANGED). Phase 44 candidate = Shape γ = Signed RunResult Round-Trip (client captures Pyodide/DuckDB output → server signs on Run → client ships signed envelope on Submit → server verifies + parses; 2-3 phases, separate architect review BEFORE any code).
