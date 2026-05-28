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

Latest 3 phases below (2–3 line summaries). Full per-phase close-outs live in `docs/phases/*.md`; chronological index (oldest-first, every closed phase): [docs/phases/INDEX.md](docs/phases/INDEX.md).

- **Phase 53 — Launch-Readiness H3 Honest-Claim Audit** → [phase-53-launch-readiness-h3-audit.md](docs/phases/phase-53-launch-readiness-h3-audit.md). Audit + minimal copy/link/guard expansion taken as a separate safe lane while Phase 52 remains "operator kit prepared, flip not executed" (NOT the 10% ramp evaluation). Extracted Phase 49's 16-phrase H1/H2 banned list to a shared module `lib/banned-h1h2-phrases.ts`; new source-level grep guard `lib/banned-h1h2-phrases.test.ts` extends coverage from the single disclosure page to 7 user-facing surfaces (certificate-print, verify, certificates listing, marketing home, workspace ValidationFeedbackPanel, onboarding, api-server email templates) with helpful failure messages (phrase + 40-char context + remediation pointer) and a refactor-drift sanity check. Tightened 4 AMBIGUOUS copy fragments: `Skills demonstrated`→`Skills practiced in this project` (cert-print), `Verified certificate`→`Verified completion record` (verify), `Earn proof`→`Earn the record` + `evidence-backed completion certificate` (home), `roles you're now ready for`→`roles this project prepares you for` (certificates). Added 4 new `/how-atlas-grades` entry points (cert-print header, verify evidence-band tail, certificates subtitle, workspace completion celebration top-right — last one uses `target=_blank rel=noopener` to preserve workspace state). Hard stops: zero canary path / env vars / `/check` / grading / schema / migrations / OpenAPI / project content / cert-portfolio semantics / production-deploy changes; wording + links only. Architect PASS — no P0 issues. Gates: typecheck OK · atlas 136/136 (+8) · api-server 395/395 unchanged · execution-core 83/83 unchanged · curriculum-quality 93/93 unchanged · audits 58/58 unchanged. Phase 52 status unchanged.
- **Phase 52 — First 1% Production Canary Flip (Operator Kit)** → [phase-52-canary-1pct-flip-kit.md](docs/phases/phase-52-canary-1pct-flip-kit.md). **OPERATOR EXECUTION PHASE — KIT PREPARED, FLIP NOT EXECUTED BY AGENT.** Single linear runbook (sections 0-10) the operator runs top-to-bottom: pre-requisite table → 6-scenario staging smoke evidence template → nonce-janitor cron registration + first-run evidence → production metrics pre-flip check (with rule-1 short-circuit caveat — zero `canary_bucket_skip` doesn't prove canary vars unset; inspect env directly) → log-aggregator filter validation → the literal flip with on-call/reviewer/deploy-SHA fields → first-hour monitoring table with 8 health bands → 24h + 48h checkpoint tables → immediate-rollback trigger list + soft/hard/nuclear commands → H3 honest-claim boundary restated for release notes → final operator sign-off block with Phase 53 recommendation. **Zero source code changes**, production env vars unchanged by agent. All Phase 51 gates remain green (api-server 395/395). Decision on 10% ramp deliberately out of scope — separate phase after the 48h 1% hold completes per operator sign-off.
- **Phase 51 — Canary Operational Readiness** → [phase-51-canary-operational-readiness.md](docs/phases/phase-51-canary-operational-readiness.md). Closes the operational-readiness gap from Phase 50 without flipping production. New in-process counter module `artifacts/api-server/src/lib/envelopeMetrics.ts` (verify ok/failed-by-reason, fallback-by-reason, bounded 1000-sample reservoir for `verifyDurationMs` p50/p95/p99, open failure-reason bucketing, snapshot deep-copy). New admin-gated `GET /api/admin/envelope/metrics` (no PII, no DB query, process-local — multi-instance shows per-instance slices, durable history belongs in log aggregator). Runbook gains §6 (metrics endpoint + curl/watch + log-aggregator queries) and §7 (explicit pre-flight checklist + DO-NOT-flip list + literal flip command). +17 envelopeMetrics unit tests + 5 admin route tests + 1 module banned-phrase guard. **Recommendation: NO-GO on the first 1% flip until 6 operator-side prerequisites are satisfied** (smoke evidence, cron run, metrics endpoint validated, log filter validated, architect review, on-call coverage). Gates: typecheck OK · api-server 395/395 (+22) · atlas 128/128 · execution-core 83/83 · curriculum-quality 93/93 · audits 58/58 unchanged.
