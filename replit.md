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
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/scripts run seed:stripe` — create the Pro Plan product + monthly/annual prices in Stripe (idempotent — only run once per Stripe account)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Atlas Product

Atlas is a project-based learning platform for Data Engineering. Artifacts:

- `artifacts/atlas` — React + Vite frontend at `/`
- `artifacts/api-server` — Express API at `/api`
- `artifacts/mockup-sandbox` — Canvas/component preview at `/__mockup`

### Auth

Clerk (`@clerk/react` on the client + `@clerk/express` on the server). `getCurrentUser(req)` returns the local `users` row (looked up by `clerkId`).

**Auto-provisioning:** `requireAuth` (in `artifacts/api-server/src/lib/auth.ts`) is async. On the first authed request from a new Clerk user, it calls `clerkClient.users.getUser(userId)` to read email/name/avatar and inserts a row into the local `users` table. Subsequent requests hit a per-process Map cache (`userCache`) so there is no per-request Clerk roundtrip or DB SELECT. Email-uniqueness collisions on insert fall back to a clerk-scoped placeholder email (`<clerkId>@users.atlasprojects.dev`) so the app stays functional even if a previous local account used the same address.

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
- `POST /api/billing/checkout` — Validates the submitted `priceId` against the active Pro price allowlist (prevents users smuggling arbitrary prices). `ensureStripeCustomer` creates the Stripe customer with an idempotency key keyed by `user.id` and writes back to `users.stripe_customer_id` only when the column is still NULL (concurrency-safe).
- `POST /api/billing/portal` — Stripe Billing Portal session.
- `POST /api/webhooks/stripe` — Registered with `express.raw` BEFORE `express.json`. Verifies signature via `stripe-replit-sync`, calls `reconcileCustomer` to mirror state into our `users.subscriptionTier` + `subscriptions` rows, and only marks the event in `processed_webhook_events` after both sync and reconcile succeed (so transient failures get retried by Stripe).

`subscription_status` enum collision note: our `public.subscription_status` enum collides with the unqualified `IF NOT EXISTS` check in `stripe-replit-sync`'s 0004 migration. The fix is to pre-create `stripe.subscription_status` before `runMigrations` runs. This is already handled in the DB; if you reset to a fresh DB, run:

```sql
CREATE SCHEMA IF NOT EXISTS stripe;
CREATE TYPE stripe.subscription_status AS ENUM ('trialing','active','canceled','incomplete','incomplete_expired','past_due','unpaid');
```

before starting the api-server.

Environment: secret/publishable/webhook keys come from the Replit Stripe connector. `REPLIT_DEPLOYMENT` selects between development/production environments.

### AI Tutor (Anthropic)

Streamed Claude responses at `POST /api/ai/chat` (SSE) in `artifacts/api-server/src/routes/ai.ts`. Uses the Replit AI Integrations Anthropic proxy via `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY`. Free tier → `claude-haiku-4-5`, Pro tier → `claude-sonnet-4-5`.

### Transactional Email (Resend)

`artifacts/api-server/src/lib/email.ts` fetches Resend credentials from the Replit Resend connector (`REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY`), caches them in-process, and exposes `sendEmail()` + `renderWaitlistConfirmationEmail()`. Wired fire-and-forget into `POST /api/waitlist` so route always returns 200; failures are logged via `req.log.warn`.

Free-email domains (gmail / outlook / yahoo / icloud / etc.) cannot be used as the FROM address — Resend rejects them at the API layer. The lib auto-falls-back to `onboarding@resend.dev` (Resend's sandbox sender) so dev works out of the box. **For production**, verify a custom domain (e.g. `mail.atlasprojects.dev`) in the Resend dashboard and update the connection's `from_email`.

Resend test API keys can only deliver to the account owner's verified email until a domain is verified or the account is upgraded.

### Progressive Hints + Socratic Tutor

Hint ladder (L0–L5) lives in `pedagogy_config` jsonb on `project_steps` (plus nullable `learning_objective`, `required_skill` columns). Per-user hint state in `user_project_step_hints` (unique on `user_id, step_id`). Mappers + `evaluateHintPolicy` + `hintsUpTo` + `MAX_HINT_LEVEL=5` in `lib/execution-core/src/pedagogy.ts`.

Routes in `artifacts/api-server/src/routes/hints.ts`:
- `GET /api/projects/:slug/steps/:stepId/hint` — current level, unlocked hint texts, feedback fields, policy-suggested next level.
- `POST /api/projects/:slug/steps/:stepId/hint/next` — atomic upsert via `ON CONFLICT (user_id, step_id) DO UPDATE` with `LEAST(cap, GREATEST(hint_level + 1, desired))`, so concurrent requests can't double-increment past the cap or regress. `desired` honors the per-mode policy (e.g. `adaptive_inquiry` jumps to L3 after 2 fails).

Disclosure boundary is server-side: tutor route (`ai.ts`) injects only `hintsUpTo(pedagogy, currentLevel)` into `<step_pedagogy>`; `finalExplanation` is only returned/streamed when `currentLevel >= MAX_HINT_LEVEL` or the step is passed. Frontend hiding is UX, not security. `currentCode` is sanitized before being placed inside `<user_data>` — any literal `</user_data>` / `<project_context>` etc. has a zero-width space inserted after the `<` so a learner's input can't close the untrusted envelope and resume "trusted" instructions.

DB enum `learning_mode` is still `('guided','hint','independent')`. We map at the app layer to the 4 Atlas mode names; `dynamic_ai_adaptive` aliases to `guided` until the enum is extended (TODO — requires a Drizzle migration to add the new variant; user-facing toggle blocked on this).

**Per-process hint state cache** — same caveat as `userCache` in `requireAuth`: the hint API and tutor route read `user_project_step_hints` per request without an in-memory cache today, but any future caching layer (e.g. to avoid the SELECT on every tutor message) MUST be invalidated on every `POST /hint/next`. For multi-instance deployments this either needs Redis or a TTL strategy. Single-instance deployments are fine without it.

Phase 4 also added a FK on `user_project_step_hints.step_id → project_steps(id) ON DELETE CASCADE` so deleting a step automatically cleans up learner hint state (Phase 5 §0 cleanup).

### Project Quality System (Phase 5)

Quality-gate that scores every project + every proposed candidate against a versioned rubric before we scale toward 1,080 projects. Pure-function scoring lib lives at `lib/curriculum-quality/`; orchestration + DB writes in `scripts/`.

**Rubric** (`RUBRIC_VERSION='1.0.1'`, `lib/curriculum-quality/src/rubric.ts`) — weights: jobReadiness 25, productionRealism 20, pythonSqlDepth 15, pedagogy 20, portfolio 15, uniqueness 5. Bands: 0-49 `needs_revision`, 50-69 `candidate`, 70-100 `approved`. Duplicates above `DUPLICATE_WARNING_THRESHOLD=0.6` Jaccard set `scorecard.duplicateWarning`.

**Schema** (`lib/db/src/schema/quality.ts` + quality fields on `projects`):
- `projects.{quality_status, quality_score, quality_breakdown, last_quality_audit_at}` — existing rows backfilled to `unreviewed` (not `approved`).
- `project_candidates` — separate table for AI-research proposals (never pollutes the production catalog).
- `project_status_history` — append-only audit log of every transition (`scope: 'project'|'candidate'`).
- New enums: `qualityStatusEnum` and `candidateStatusEnum`.

**Candidate scoring stage carve-out** — `composeScorecard(input, { steps, neighbors, stage })`. When `stage='candidate'`, the `pedagogy` dimension is excluded and the remaining 5 weights renormalize to 100, because pedagogy ladders/feedback only exist on authored projects. Without this, even strong proposals could never clear the 70 band. `scripts/src/quality-adapter.ts candidateRowToContext` synthesizes pseudo-steps from `proposal.proposedSteps` and infers language from `proposedStack` so `type: 'code_python'|'code_sql'` matches the depth scorer.

**Commands:**
- `pnpm --filter @workspace/scripts run audit:quality` — score every project + candidate, write back `quality_score` / `quality_breakdown` / `last_quality_audit_at`, print weakest-10 + summary.
- `pnpm --filter @workspace/scripts run catalog:report` — emit course×{difficulty, role, stack} matrices, depth + quality funnel, gap detection. Writes `.local/catalog-quality-report.{md,json}`. Role matrix uses per-role anchor overlap (`ROLE_PRIMARY_STACK`), not blanket tier-1 presence.
- `pnpm --filter @workspace/scripts run candidates -- {list|show|score|approve|reject|revise} ...` — single dispatcher; approve below 70 requires `--force`; `reject`/`revise` require `--reason`. **Atomic transitions:** `cmdTransition` wraps the status UPDATE (with compare-and-swap `WHERE id=? AND status=?` predicate) and the `project_status_history` INSERT in `db.transaction()`. Concurrent reviewers throw `CONCURRENT_UPDATE` instead of clobbering each other.

**Admin endpoint:** `GET /api/admin/quality` (`artifacts/api-server/src/routes/admin.ts`) returns the catalog-report JSON on demand. Auth-gated via `requireAuth` + role check. No UI yet.

**Calibration pins** (`audit:quality` output): csv-to-postgres-pipeline=70.5, dbt-data-models=72.7, 38/47 stubs in `needs_revision`. Lib test suite: 33/33 (includes a regression that proves a strong candidate proposal reaches ≥70 without `--force`).

**Job-demand source-of-truth:** `.local/job-demand-map.md` is the human-reviewable canonical map for the 9 Atlas mastery courses + role-to-stack anchors. `lib/curriculum-quality/src/jobMap.ts` derives from it.

**Known gaps before mass project generation:** (1) `dynamic_ai_adaptive` still aliases to `guided` at the DB enum layer — needs a Drizzle migration to extend `learning_mode`; (2) most catalog projects fall back to the legacy `hints[]` column and will score in the `needs_revision` band until pedagogy is authored; (3) admin role check on `/api/admin/quality` currently relies on the same `requireAuth` shape used elsewhere — promote to a dedicated `requireAdmin` middleware once more admin routes land.

### Curriculum Seed Data scope

Only `csv-to-postgres-pipeline` (4 steps) and `dbt-data-models` (2 steps) are fully enriched in v1. The other ~38 projects fall back to the legacy `hints[]` column transparently. Seed: `scripts/src/seed-pedagogy.ts` (idempotent, called from `seed.ts`). Audit: `pnpm --filter @workspace/scripts run audit:pedagogy` reports per-step coverage.

### Curriculum Seed Data

`scripts/src/seed.ts` is the authoritative seed entrypoint, idempotent. Companion modules:

- `scripts/src/seed-mastery-python.ts` — 12 Python Mastery modules (fundamentals → LangChain).
- `scripts/src/seed-mastery-sql.ts` — 6 SQL Mastery modules (foundations → DB design).
- `scripts/src/seed-projects-extra.ts` — full step content for projects 11-15 (Flink, Data Catalog, Real-Time Dashboard, Data Mesh, Column-Store).

The seed handles in-place upgrades for projects that previously existed only as stubs (refreshes metadata + backfills steps).

Run with `pnpm --filter @workspace/scripts run seed`.
