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

## Phase History

Closed phase notes have been moved into `docs/phases/` to keep this file scannable:

- **Phase 4 — Progressive Hints + Socratic Tutor** → [docs/phases/phase-4-pedagogy.md](docs/phases/phase-4-pedagogy.md). Hint ladder (L0–L5) in `pedagogy_config`, server-side disclosure boundary, `evaluateHintPolicy`, atomic `/hint/next`.
- **Phase 5 — Project Quality System** → [docs/phases/phase-5-quality-system.md](docs/phases/phase-5-quality-system.md). Frozen `RUBRIC_VERSION='1.0.1'`, `audit:quality`, `catalog:report`, candidate CLI, calibration anchors.
- **Phase 6 — Nine-Course Curriculum + Candidate Pipeline** → [docs/phases/phase-6-candidate-pipeline.md](docs/phases/phase-6-candidate-pipeline.md). 9-course taxonomy, deterministic candidate generator, batch import/score.
- **Phase 7 — Promoted Candidates → Authored Projects** → [docs/phases/phase-7-authored-promotions.md](docs/phases/phase-7-authored-promotions.md). 18 authored projects all ≥70, anchor drift 0.0, 100% validation/pedagogy/portfolio coverage.

### Phase 8 — Native Taxonomy + Governance Hardening

Phase 8 closed the structural gaps Phase 7 surfaced. **No rubric edits, no mass authoring, no quality-gate relaxation.** All 18 Phase-7 projects re-audited at unchanged scores; anchor drift 0.00.

**Native 9-course taxonomy on `projects`:**
- New pg enum `atlas_course` (9 values) + `projects.course` column (NOT NULL).
- New pg enum `course_source` (`authored` | `heuristic_legacy`) + `projects.course_source` column (NOT NULL).
- One-shot backfill (`scripts/src/backfill-course.ts`): 18 authored rows stamped from `COURSE_FOR_AUTHORED_SLUG` as `authored`; 47 legacy rows backfilled via the (now `@deprecated` for runtime catalog reads) `mapToCourse` heuristic and labeled `heuristic_legacy` so the provenance stays visible until Phase 9 re-authors them.
- All catalog/wave/admin reports now read `projects.course` directly. `mapToCourse` is kept for the one-shot backfill and as a defensive fallback only.

**Candidate lineage on `projects`:**
- New nullable FK `projects.source_candidate_id` → `project_candidates.id` `ON DELETE SET NULL`.
- `AuthoredProject.candidateId: string` is now a required typed field (not a comment) — all 18 Phase-7 modules updated; new promotes refuse to compile without it.
- `GET /api/admin/quality` exposes `{ slug, course, courseSource, sourceCandidateId, sourceCandidateTitle }` per project.

**Canonical track resolution:**
- New `tracks.is_primary BOOLEAN NOT NULL DEFAULT FALSE` + partial unique index `(domain_id) WHERE is_primary` — at most one primary per domain.
- `COURSE_TO_TRACK_SLUG` map in `scripts/src/authored-lineage.ts` replaces the legacy `tracks.limit(1)` lookup. Today all 9 courses point at the single existing track per domain; Phase 9 can split without changing the lookup contract.

**Admin route hardening:**
- `requireAdmin` middleware in `artifacts/api-server/src/lib/auth.ts` chains off `requireAuth`, gates on existing `users.role === 'admin'`.
- `GET /api/admin/quality` upgraded from `requireAuth` to `requireAdmin`.
- `scripts/src/grant-admin.ts` is the bootstrap CLI (`pnpm --filter @workspace/scripts run grant:admin -- <email>`) — no UI yet.

**`learning_mode` enum natively supports `dynamic_ai_adaptive`:**
- `learningModeEnum` extended in `lib/db/src/schema/enums.ts`.
- `toAtlasLearnerMode`/`fromAtlasLearnerMode` in `lib/execution-core/src/pedagogy.ts` are now bijective for `dynamic_ai_adaptive` (no more `→ guided` alias collapse). `LEGACY_MODE_ALIAS` is empty by default.

**Phase 8 single source of truth:** `scripts/src/authored-lineage.ts` exports `COURSE_FOR_AUTHORED_SLUG`, `CANDIDATE_FOR_AUTHORED_SLUG`, `COURSE_TO_DOMAIN_SLUG`, `COURSE_TO_TRACK_SLUG`. Both `backfill-course.ts` and `author-project.ts` read from this one file.

**Final gate:** `pnpm run typecheck` PASS · 54/54 curriculum-quality tests · 45/45 api-server tests · `anchor-check` drift 0.00 · `wave-report` 18/18 ≥70 · backfill verified 65/65 rows have non-null `course`.

**Known carry-overs into Phase 9:**
- Promote stamps the FK; the inverse (`project_candidates.promoted_project_id`) is not yet written — readers can join via `sourceCandidateId` for now.
- 45/65 catalog projects still on `hints[]` fallback — Phase 9 mass-author pass.
- Splitting the `de-core` track per course (`analytics-engineer-core`, `cloud-data-engineer-core`, etc.) is deferred — only the lookup map needs updating when it happens.
- The deprecation marker on `mapToCourse` is JSDoc-only; consider a lint/grep CI guard when more callers exist.

### Phase 9 — Legacy Remediation (batch 1)

Phase 9 closed the Phase-8 carry-overs WITHOUT touching the rubric, weakening gates, or mass-authoring. **No rubric edits. Anchor drift 0.00 throughout.**

**Bidirectional candidate ↔ project lineage:**
- New nullable FK `project_candidates.promoted_project_id → projects.id ON DELETE SET NULL`.
- `promote()` in `scripts/src/author-project.ts` now writes both directions atomically in a single transaction AND hard-fails the transaction if the inverse-lineage `UPDATE` doesn't match exactly 1 candidate row (prevents silent zero/multi-row drift).
- `backfill-inverse-lineage.ts` stamped the 18 Phase-7 promotes + the 6 Phase-9 upgrade candidates (20 total).
- `GET /api/admin/quality` exposes `lineageIntegrity: { promotedProjects, candidatesWithInverse, mismatches, inverseMismatches, duplicateCandidatePromotions }` — all four failure modes (project→candidate broken, candidate→project broken, duplicate claims, zero-fan-out) are detectable from the response, and 5 api-server tests pin the invariant directly.

**Synthetic candidates preserve `AuthoredProject.candidateId` REQUIRED:**
- New `project_candidates.source` column (nullable). NULL = legacy candidate-pipeline row; `'grandfathered_phase4'` marks the 2 Phase-4-original synthetics; `'phase9_upgrade'` marks the 6 batch-1-upgrade synthetics. Lineage stays uniform without weakening the typed contract.
- `scripts/src/backfill-grandfather-candidates.ts` + `backfill-upgrade-candidates.ts` are idempotent; both stamp the inverse FK.

**Batch-1 upgrade cohort (6 projects, all ≥70):**
- `data-engineering-real-time-dashboard`, `data-engineering-debezium-cdc`, `data-engineering-vector-database-search`, `data-engineering-stream-processing-flink`, `cloud-data-engineer-iceberg-table-format`, `cloud-data-engineer-dbt-macros-mastery`.
- Each authored module: 5 steps · full pedagogyConfig (L0–L5 + success/failure/portfolio/finalExplanation/misconception) · real validation kinds (json_equal / numeric_tolerance / contains / exact — no `self_attest`) · `candidateId` field populated with the pinned synthetic UUID from `UPGRADE_CANDIDATE_FOR_SLUG`.
- Anchor-checked between every promote — drift stayed at 0.00 across all 6.

**Grandfather cohort (2 projects):**
- `csv-to-postgres-pipeline` (70.5) and `dbt-data-models` (72.7) flipped from `heuristic_legacy` → `authored` with synthetic candidates stamped. No quality regression.

**Heuristic runtime guard:**
- `scripts/src/check-no-runtime-mapToCourse.ts` greps `artifacts/**` and `lib/**` for `mapToCourse` across `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs`/`.cjs` (explicit glob list, not the `--type ts` shortcut, so JS callers and any rg version-skew can't slip through). Allowlist is exactly the 4 historical/library files. Chained into root `pnpm run typecheck` so a regression fails the canonical gate, not just an opt-in script.
- `admin.ts` dropped its `mapToCourse` fallback — reads `projects.course` directly (post-backfill it's NOT NULL).

**Legacy 47 triage manifest:** `docs/phase9/legacy-triage.md` classifies every remaining `heuristic_legacy` row deterministically: 6 upgrade (done), 2 grandfather (done), ~15 revise, ~24 archive. Revise/archive cohorts are explicitly Phase-10 work — Phase 9 only commits the classification.

**Track-split decision (`docs/phase9/track-split-decision.md`):** Deferred to Phase 10. The 8 Phase-9 projects span 2 courses; splitting `COURSE_TO_TRACK_SLUG` now would force re-wiring all 9 courses to preserve the `is_primary` invariant for no immediate benefit.

**Final gate:** `pnpm run typecheck` PASS (now chains `check:no-heuristic-runtime`) · 54/54 curriculum-quality · 53/53 api-server (8 new lineage tests: 3 backfill-invariant + 5 bidirectional `lineageIntegrity` mode coverage) · 4/4 execution-core · `anchor-check` drift 0.00 · `wave-report` 24/24 ≥70 (18 Phase-7 + 6 Phase-9) · `audit:pedagogy` 26/65 fully enriched (was 20).

**Phase 9 explicitly did NOT:** upgrade the revise/archive cohorts (Phase 10+); split the `de-core` track; touch the rubric / Stripe / cloud creds.
