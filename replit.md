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
- Archive = hide (`learner_visible=false`), not destroy. No row deletes from `projects` or `project_candidates`. Archive script asserts `total_steps=0 AND enrolled_count=0` per slug before flipping.
- The 9 Atlas courses: `data-engineering` · `ai-engineer` · `mlops-engineer` · `data-scientist` · `analytics-engineer` · `applied-llm-engineer` · `cloud-data-engineer` · `python-libraries` · `sql`. Atlas is NEVER described as a 4-domain / 4-discipline platform.

## Current Phase

Live session state (latest shipped phase, working-tree status, gate summary, commit refs) lives in **`HANDOFF.md`** — single source of truth.
Per-phase close-out records live in `docs/phases/`. The Phase History below is the chronological index.

## Phase History

Latest 5 phases below. Full phase index (oldest-first, every closed phase): [docs/phases/INDEX.md](docs/phases/INDEX.md).

- **Phase 34 — Ada Tutor Step Contract + Mode Telemetry** → [phase-34-ada-tutor-step-contract.md](docs/phases/phase-34-ada-tutor-step-contract.md). Frontend+backend overlay on P32/P33. Pure `lib/execution-core/src/tutorContract.ts` (`buildTutorContract` / `renderTutorContractForPrompt` / `resolveAdaptiveMode`) replaces the inline "mode-aware tone" bullets in `ai.ts` with a structured contract (helpBoundary, allowedBehaviors[], forbiddenBehaviors[], validationGuidance, responseStyle). Independent + not-passed pinned to `diagnostic-only` with explicit "Do NOT reveal the full solution" + "portfolio credibility" clauses; independent + passed flips to `review-permissive`. `dynamic_ai_adaptive` resolves deterministically at the contract layer (stepPassed→independent; lastFailed+≥2 attempts OR hintLevel≥3 OR ≥3 attempts→guided rescue; else hint — adaptive defaults to hint, not guided) so the model never sees the bare adaptive label. Contract rendered OUTSIDE untrusted `<…>` envelopes (treated as system policy, not learner data); existing hint-discipline + safety floor in `SYSTEM_PROMPT_BASE` is preserved verbatim and never weakened. Schema-free structured telemetry: `req.log.info({evt:'ai.tutor.request', …, contract:{…}})` BEFORE the stream so failures still emit; `req.log.info({evt:'hint.escalate', …})` AFTER the upsert so the log reflects what was persisted. New admin-gated `GET /api/admin/mode-usage` returns flat `{totalEnrollments, byMode, percentByMode}` (no per-user/per-project detail, defensive on unknown enum values, divide-by-zero guarded). +17 execution-core tests, +6 ai.ts route tests (system prompt captured via `streamSpy`), +5 admin tests; 34/34 + 273/273 + 102/102 + 3/3 integration green; typecheck + no-heuristic + pedagogy 56/56 OK. Architect: PASS after a single Medium consolidation (redundant adaptive resolver branch). Zero schema/migration/`/check`/`/submit`/cert-verify/portfolio/billing/Stripe/deployment/OpenAPI/codegen/rubric/taxonomy/anchor/content changes.
- **Phase 30B — Real-Postgres /submit concurrency integration test** → [phase-30b-real-pg-concurrency-test.md](docs/phases/phase-30b-real-pg-concurrency-test.md). Opt-in `pnpm --filter @workspace/api-server run test:integration` proves the Phase-27 `pg_advisory_xact_lock(hashtextextended('atlas-submit:'||userId,0))` actually serializes concurrent `/submit` against real Postgres. Per-run namespaced schema (`p30b_test_<ts>_<rand>`) cloned via `CREATE TABLE x.<t> (LIKE public.<t> INCLUDING ALL)`, dropped on teardown. New `lib/db/src/test-helpers.ts` (`createTestSchema` + `cleanupStaleTestSchemas` janitor; strict schema-name allowlist before every DROP). Separate `vitest.integration.config.ts` (single-forked); `test` script excludes `*.integration.test.ts`. 3 scenarios (same-step storm, cross-step same-user storm, cross-user negative control); 3/3 green. Zero `/submit`/`/check`/schema/migration/OpenAPI/FE/content/rubric/PWA/production changes.
- **Phase 31 — Deployment Readiness / Production Launch Checklist** → [phase-31-deployment-readiness.md](docs/phases/phase-31-deployment-readiness.md). Makes Atlas deploy-ready without deploying. New Drizzle baseline migration `lib/db/drizzle/0000_phase31_baseline.sql` (30 tables, 14 enums, 494 lines, DDL-faithful to current dev schema — round-trip parity verified by re-running `drizzle-kit generate` → "No schema changes"). New `scripts/src/migrate.ts` (`pnpm --filter @workspace/scripts run migrate`) — explicit production migration runner using `drizzle-orm/node-postgres/migrator`; idempotent. Chosen over boot-time migration so a failed migration surfaces as a deploy step failure (rollback-able) rather than hard-downing the api-server. The existing `stripe-replit-sync.runMigrations` boot call is unchanged. New `docs/deployment-checklist.md` — secrets matrix (Clerk live, Stripe live via connector, Resend custom domain, `SESSION_SECRET` rotation, Anthropic, `REPLIT_DOMAINS`), first-deploy procedure, 15-check post-deploy verification (healthz, auth, enrollment, `/check` write-free, `/submit` XP idempotency, cert-verify evidence, portfolio, billing live mode, AI tutor, admin guard, 404-not-403 privacy), rollback, known caveats. `lib/db/drizzle.config.ts` gained `out: "./drizzle"`. HANDOFF.md staleness refresh (P30B + P30B+ already committed). Zero `/submit`/`/check`/cert-verify/portfolio/FE/PWA/content/rubric/taxonomy/schema-meaning changes. Atlas remains in dev preview — deploy switch is operator's explicit action.
- **Phase 32 — Learner Mode Selector + Adaptive Recommender** → [phase-32-learner-mode-selector.md](docs/phases/phase-32-learner-mode-selector.md). Activates the dormant learner-mode system. Schema-free V1 (the `learning_mode` enum + `user_progress.learning_mode` column have existed since P8; AI tutor and hint policy already read mode at request time). New pure `lib/execution-core/src/learnerMode.ts` `recommendLearnerMode(signals)` — deterministic, 6 first-match-wins rules (`struggling-step-back` / `fresh-start` / `demonstrated-mastery` / `ready-to-level-up` / `ready-for-challenge` / `stay-the-course`), signals echoed back, divide-by-zero guarded. Two new auth-required slug-based endpoints (`PATCH /api/user/projects/:slug/learning-mode` enum-allowlisted + 404-not-403 on non-enrolled; `GET /api/user/projects/:slug/learning-mode/recommendation` aggregates caller-scoped signals from `user_progress` / `user_step_completions` / `user_project_step_hints` then delegates to the pure helper). New self-contained `ModeSelector.tsx` in `StudioTopBar` (fetches own state, self-hides on 404, 4-button picker + "Choose for me" CTA gated to avoid oscillation). Plain-fetch precedent (no OpenAPI/codegen changes) per `useHintState.ts`. **Mode-aware Instructions/Remediation panel rendering deferred to Phase 33** — server-side hint cadence + tutor tone change immediately via existing machinery, so the selector unlocks real product behavior without panel rewrites. 33 new tests (10 helper + 15 route + 8 component); 261/261 + 82/82 + 14/14 + 3/3 integration green; no-heuristic OK; pedagogy 56/56. Zero schema/migration/`/check`/`/submit`/cert-verify/portfolio/billing/AI-tutor-prompt/hint-route/rubric/anchor/taxonomy/content/deployment changes.
- **Phase 33 — Mode-Aware Project Workspace UX** → [phase-33-mode-aware-project-workspace-ux.md](docs/phases/phase-33-mode-aware-project-workspace-ux.md). Frontend-only overlay on Phase 32 activating the per-panel half of the learner-mode system. New `useLearningMode` hook + window `CustomEvent` bridge (`atlas:learning-mode-changed`) — request-versioning via `fetchSeqRef`, preserve-on-transient-error via `hadAnySuccessRef`, functional `setState` everywhere so an optimistic update can never be clobbered by a stale refetch. `InstructionsPanel` gains guided "Ask Ada" CTA + independent long-instruction disclosure + **dual suppression predicates** (`suppressPedagogyEscalation` and `suppressLegacyReveal` reading `showLegacyHint`) so already-revealed hints survive a mid-step flip to independent — architect-flagged regression. `ValidationFeedbackPanel`: independent + handler swaps `hint-offer` for `independent-ada-nudge`; default / missing handler keeps legacy behavior. `RemediationPanel`: independent + exact-diff dampened to lengths + first-divergence index (expected string never echoed). `StudioShell` wires the hook + `hasFailedCheck` latch (`useState` + two `useEffect`s — committed after render, never in render) + `onRequestTutorNudge` → existing `onAskTutor` bridge. +20 atlas tests (82 → 102); api-server 261/261, execution-core 14/14 unchanged; no-heuristic OK; pedagogy 56/56. Zero schema/migration/`/check`/`/submit`/cert-verify/portfolio/billing/AI-tutor-prompt/hint-route/rubric/anchor/taxonomy/content/deployment changes. Architect: PASS after 3-finding fix-up round.
