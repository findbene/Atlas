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

## Current Phase Status

- **Phase 16 — Learner-Facing Difficulty Badges + Filters** — UI/filter implementation: **SHIP** (commit `671af63`). Catalog-quality gate: **NOT GREEN** — pre-existing wave-report drift discovered, now **47/50** (vs documented 50/50 at Phase 14/15 close). Phase 16 touched **zero authoring / scoring / rubric files** (diff: OpenAPI spec, generated client, API route validation, tests, frontend UI only — verified via `git diff --stat`), so the drift was introduced before Phase 16 and is **not a Phase 16 regression** — but the gate is still failing and must be closed before more UX/product work. The 3 below-threshold projects (all Phase-14 beginner-tier): `sql-beginner-select-where-join-essentials` (65.3), `data-engineering-beginner-csv-cleanup-pipeline` (69.1), `data-scientist-beginner-eda-and-summary-stats` (67.1). What shipped on the UI side: optional `?difficulty=beginner|intermediate|advanced` query param on `GET /api/courses/:slug` (allowlist excludes legacy `expert`; invalid → 400; `learner_visible=true` always preserved), `DifficultyBadge` + `DifficultyFilter` components wired into `course-detail.tsx` with URL-state persistence (`?difficulty=...`, popstate-synced) and zero-beginner empty-state for `ai-engineer` / `cloud-data-engineer` / `applied-llm-engineer` / `mlops-engineer`. Zero DB writes / authoring / archive. Other invariants preserved: visible 52, hidden 32, distribution 6/1/45, pedagogy 52/52, anchorCount=2, anchor drift 0.00, lineage 0/0/0/0, 9-course taxonomy. **186/186 tests** pass (api-server 128 [+8 new] + curriculum-quality 54 + execution-core 4); typecheck + `check:no-heuristic-runtime` green; architect PASS. See `docs/phases/phase-16-difficulty-badges-and-filters.md`.
- **Phase 17 — Beginner-Tier Scoring Uplift (catalog-quality repair)** — NOT STARTED. **Must run before more UX/product work** to close the wave-report 47/50 → 50/50 gap discovered during Phase 16. Decision brief: `.local/phase17-decision-brief.md`. Hard scope: improve the 3 below-threshold beginner projects only — no new projects, no rubric changes, no difficulty relabeling, no archives, no UI.

## Phase History (recent additions)

- **Phase 15 — Difficulty Taxonomy Audit + Targeted Backfill** — CLOSED · SHIP. Read-only `audit:difficulty-labels` heuristic + dormant `backfill:phase15-difficulty` (empty-by-default allowlist, anchor-forbidden) shipped in 15A; 5 approved intermediate→advanced flips applied in 15B. Distribution 6/6/40 → 6/1/45 (remaining intermediate is the `dbt-data-models` anchor by design). Admin route additively extended (`visibleByCourse`, `beginnerCoverageByCourse`, `mismatchCount`, `mismatchSlugs`). Visible 52, hidden 32, anchorCount=2, anchor drift 0.00, lineage 0/0/0/0, 178/178 tests. See `docs/phases/phase-15-difficulty-taxonomy-audit.md`.

## Phase History

Closed phase notes are archived in `docs/phases/`:

- **Phase 4 — Progressive Hints + Socratic Tutor** → [docs/phases/phase-4-pedagogy.md](docs/phases/phase-4-pedagogy.md). Hint ladder (L0–L5) in `pedagogy_config`, server-side disclosure boundary, `evaluateHintPolicy`, atomic `/hint/next`.
- **Phase 5 — Project Quality System** → [docs/phases/phase-5-quality-system.md](docs/phases/phase-5-quality-system.md). Frozen `RUBRIC_VERSION='1.0.1'`, `audit:quality`, `catalog:report`, candidate CLI, calibration anchors.
- **Phase 6 — Nine-Course Curriculum + Candidate Pipeline** → [docs/phases/phase-6-candidate-pipeline.md](docs/phases/phase-6-candidate-pipeline.md). 9-course taxonomy, deterministic candidate generator, batch import/score.
- **Phase 7 — Promoted Candidates → Authored Projects** → [docs/phases/phase-7-authored-promotions.md](docs/phases/phase-7-authored-promotions.md). 18 authored projects all ≥70, anchor drift 0.0, 100% validation/pedagogy/portfolio coverage.
- **Phase 8 — Native Taxonomy + Governance Hardening** → [docs/phases/phase-8-native-taxonomy.md](docs/phases/phase-8-native-taxonomy.md). Native `projects.course` + `course_source` enums, bidirectional lineage FK, `requireAdmin` middleware, primary-track invariant.
- **Phase 9 — Legacy Remediation (batch 1)** → [docs/phases/phase-9-legacy-remediation.md](docs/phases/phase-9-legacy-remediation.md). Bidirectional candidate FK, synthetic candidate sources, 6 DE/Cloud-DE upgrades + 2 grandfather flips, heuristic-runtime guard.
- **Phase 10 — Course Taxonomy + Revise Batch 2 + Visibility Controls** → [docs/phases/phase-10-visibility-controls.md](docs/phases/phase-10-visibility-controls.md). 9-course learner-facing taxonomy, 7 revise upgrades, `projects.learner_visible` + 22 thin stubs hidden, `qualityBreakdown.portfolioArtifact` adapter fix.
- **Phase 11 — Course Coverage Repair + Remaining Legacy Remediation** → [docs/phases/phase-11-course-coverage-repair.md](docs/phases/phase-11-course-coverage-repair.md). 7 batch-3 promotes (2 ai-eng carry-overs + 2 cloud-DE skeleton rebuilds + 3 DE skeleton rebuilds), `projects.replace_candidate_slug` + CHECK + idempotent backfill, pedagogy 40/72, anchor drift 0.00, 0 lineage orphans.
- **Phase 12A — Archive Replaced Phase 11 Legacy Twins** → [docs/phases/phase-12a-archive-replaced-legacy-twins.md](docs/phases/phase-12a-archive-replaced-legacy-twins.md). 7 legacy twins archived (`learner_visible=false`, hiddenCount 22 → 29), dual-denominator pedagogy reporting (40/72 all · 40/43 visible), admin `legacyReplacements` surface, 17 new visibility tests, lineage clean.
- **Phase 12B — DE Skeleton-Rebuild Completion (Phase-11 Deferral Closure)** → [docs/phases/phase-12b-de-skeleton-rebuild-completion.md](docs/phases/phase-12b-de-skeleton-rebuild-completion.md). 3 deferred DE skeleton rebuilds promoted (Kafka EOS pipeline, ML feature store with point-in-time joins, PySpark skew+AQE), 3 legacy twins archived (hiddenCount 29→32, legacyReplacements 7→10), pedagogy KPI 100% on visible surface (43/43), anchor drift 0.00, wave-report 41/41.
- **Phase 13 — Underserved Course Seeding + Anchor Reporting Hygiene** → [docs/phases/phase-13-underserved-course-seeding.md](docs/phases/phase-13-underserved-course-seeding.md). 4 net-new authored projects (sql window/CTE mastery, Pydantic+Typer CLI, RAG eval harness, feature-pipeline monitoring), `projects.is_anchor` flag + 2 anchors flagged, admin route adds `anchorCount`/`anchorSlugs`/`visibleThinStubs` (anchor-excluding). Visible 43→47, wave-report 45/45, pedagogy 47/47 visible, anchor drift 0.00, 102/102 tests.
- **Phase 14 — Beginner-Tier Seeding** → [docs/phases/phase-14-beginner-tier-seeding.md](docs/phases/phase-14-beginner-tier-seeding.md). 5 net-new beginner-tier authored projects (sql SELECT/WHERE/JOIN essentials, pandas essentials, CSV cleanup pipeline, spreadsheet→SQL models, EDA + summary stats), beginner-tier 1→6 visible. `audit:difficulty` script + admin `difficultyDistribution.visible{beg,int,adv}+visibleBeginnerSlugs`. Visible 47→52, wave-report 50/50, pedagogy 52/52 visible, anchorCount=2 unchanged, anchor drift 0.00, 114/114 tests.
- **Phase 15 — Difficulty Taxonomy Audit + Targeted Backfill** → [docs/phases/phase-15-difficulty-taxonomy-audit.md](docs/phases/phase-15-difficulty-taxonomy-audit.md). Read-only `audit:difficulty-labels` heuristic + dormant `backfill:phase15-difficulty` (empty-by-default allowlist, anchor-forbidden) shipped in 15A; 5 approved intermediate→advanced flips applied in 15B (analytics-eng dbt-ci-state-modified, sql window/CTE mastery, 2× pydantic, ds A/B test). Distribution 6/6/40→6/1/45 (remaining intermediate is the `dbt-data-models` anchor by design). Admin route additively extended (`visibleByCourse`, `beginnerCoverageByCourse`, `mismatchCount`, `mismatchSlugs`). No content/steps/authoring/archive changes; only 5 `UPDATE`s on `projects.difficulty_level`. Visible 52, hidden 32, wave 50/50, pedagogy 52/52, anchorCount=2, anchor drift 0.00, lineage 0/0/0/0, 178/178 tests.
- **Phase 16 — Learner-Facing Difficulty Badges + Filters** → [docs/phases/phase-16-difficulty-badges-and-filters.md](docs/phases/phase-16-difficulty-badges-and-filters.md). Optional `?difficulty=` filter on `GET /api/courses/:slug` (validated allowlist, expert rejected, invalid→400, `learner_visible=true` always preserved), `DifficultyBadge` + `DifficultyFilter` components, URL-state persistence + popstate sync on course-detail.tsx, zero-beginner empty-state for 4 courses. Zero DB writes / authoring / archive. 186/186 tests (api-server 128 [+8] + curriculum-quality 54 + execution-core 4). Invariants unchanged. Architect PASS.

