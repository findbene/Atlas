# Atlas — Deployment Checklist (Phase 31)

Single source of truth for taking Atlas from "deploy-ready" (current state, end of Phase 31) to "live in production." This document does **not** trigger a deployment — it describes the steps a human operator runs to take Atlas live safely.

> **Scope note:** Phase 31 made Atlas deploy-ready. It did not deploy Atlas. Flipping the Replit Autoscale deploy switch is an explicit human action, separate from any agent work.

---

## 0. Pre-flight (one-time, before first deploy)

- [ ] Confirm working tree is clean and on the intended commit.
- [ ] `pnpm run typecheck` clean.
- [ ] `pnpm --filter @workspace/api-server test` green (246 tests).
- [ ] `pnpm --filter @workspace/atlas test` green (74 tests).
- [ ] `INTEGRATION_TEST_DB_ALLOW=1 pnpm --filter @workspace/api-server run test:integration` — 3/3 (real-PG concurrency proof).
- [ ] `pnpm --filter @workspace/scripts run audit:pedagogy` — visible 56/56.
- [ ] `pnpm run check:no-heuristic-runtime` — OK (root script; delegates to `@workspace/scripts`).
- [ ] Baseline migration present at `lib/db/drizzle/0000_phase31_baseline.sql` (+ `meta/_journal.json`, `meta/0000_snapshot.json`).
- [ ] Confirmed: production Neon DB has been freshly provisioned (i.e., empty — no prior `db:push` or manual DDL applied). See §2 warning.

---

## 1. Production secrets matrix

All secrets below must be set in the Replit **Deployment** environment (NOT the dev workspace) before the first deploy. Use the Replit deployment secrets UI — never paste into source.

| Secret | Source | Required at boot? | Notes |
|---|---|---|---|
| `DATABASE_URL` | Replit-provisioned Neon (production) | **Yes** | Distinct from dev DB. Set automatically when a production Neon DB is provisioned to the deployment. |
| `SESSION_SECRET` | Generated, rotated for prod | **Yes** | Must be ≥ 32 random bytes. Do **not** reuse the dev value. |
| `CLERK_SECRET_KEY` | Clerk production instance | **Yes** | Must start with `sk_live_`. Dev `sk_test_*` keys will reject prod traffic. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk production instance | **Yes (build-time)** | Baked into the Atlas frontend bundle during `pnpm --filter @workspace/atlas run build`. Must start with `pk_live_`. |
| `CLERK_PUBLISHABLE_KEY` | Clerk production instance | **Yes (runtime)** | Read by `artifacts/api-server/src/app.ts` (`publishableKeyFromHost(..., process.env.CLERK_PUBLISHABLE_KEY)`) as fallback when host-based key inference doesn't resolve. Same `pk_live_…` value as `VITE_CLERK_PUBLISHABLE_KEY`. Distinct from the build-time copy because the api-server reads it from runtime env, not the bundle. |
| `REPLIT_CONNECTORS_HOSTNAME`, `REPL_IDENTITY` | Auto-provided by Replit deployment | **Yes** | Required for Stripe + Resend connectors to fetch credentials. |
| Stripe (via Replit Stripe connector) | Replit connector | **Yes** | Connector must be in **live** mode in the deployment. Webhook URL is auto-registered at boot to `https://${REPLIT_DOMAINS[0]}/api/webhooks/stripe`. See §3. |
| Resend (via Replit Resend connector) | Replit connector | **No** (degrades gracefully) | Waitlist confirmation emails fail with `req.log.warn` if connector missing. See §5. |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Replit AI Integrations | **No** (AI tutor degrades) | `/api/ai/chat` will 500 without these. Streaming tutor requires both. |
| `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID` | Optional fallback | **No** | Only consulted if the `stripe.prices` mirror is empty. Live-mode price IDs once Pro Plan is seeded. |
| `REPLIT_DEPLOYMENT` | Auto-set by Replit deployment runtime to `1` | **Read at runtime** | Used in `lib/stripeClient.ts` + `routes/billing.ts` to switch dev/prod behavior. Do not set manually. |
| `REPLIT_DOMAINS` | Auto-set by Replit deployment | **Yes** | Comma-separated. First entry is used to register the Stripe managed webhook. |
| `PORT` | Auto-set by Replit | **Yes** | api-server binds to this. |

---

## 2. First-deploy procedure

### Step 1 — Provision the production database

In the Replit deployment UI, attach a production Postgres database. Capture the resulting `DATABASE_URL` (it appears as a deployment secret automatically).

### Step 2 — Apply the Drizzle baseline migration

The production Neon DB will boot **empty**. Apply migrations explicitly **before** the first deploy starts taking traffic:

```bash
# From a local shell with DATABASE_URL pointed at the PROD Neon DB
DATABASE_URL='<prod url here>' pnpm --filter @workspace/scripts run migrate
```

Expected output:

```
[migrate] target: postgresql://...:***@.../...
[migrate] folder: /…/lib/db/drizzle
[migrate] OK (NNNms)
```

The migrate script is idempotent **once at least one migration has been recorded** — re-running against an already-migrated DB is a no-op (Drizzle tracks applied migrations in `drizzle.__drizzle_migrations`).

> **⚠ Do not run `migrate` against a `db:push`-built database.** The dev workspace was built with `pnpm --filter @workspace/db run push`, which creates schema objects without writing rows into `drizzle.__drizzle_migrations`. Running `migrate` against such a DB will fail with `42710 type "atlas_course" already exists` (or similar) because the migrator believes the baseline has not been applied and tries to recreate everything from scratch.
>
> This is **only** safe for genuinely empty databases — which production Neon is, by definition, on first provision.
>
> **Recovery (not needed for the production first-deploy path):** if you ever need to flip a push-built environment over to migrate-based, manually stamp the baseline as applied:
> ```sql
> CREATE SCHEMA IF NOT EXISTS drizzle;
> CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
>   id SERIAL PRIMARY KEY,
>   hash text NOT NULL,
>   created_at bigint
> );
> -- hash value: read from lib/db/drizzle/meta/_journal.json (the "tag" → "hash" mapping)
> INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('<baseline-hash-from-journal>', extract(epoch from now())*1000);
> ```
> Then re-run `migrate`; it will see the baseline as applied and skip it.

> **Why explicit, not boot-time?** Boot-time migration would couple migration health to api-server liveness — a bad migration would hard-down the app. An explicit script lets the operator see the failure, roll back the deploy, and re-run when ready. The Stripe `runMigrations` call at boot remains unchanged; it's scoped to the `stripe.*` schema (a separate package) and pre-creates the `stripe.subscription_status` ENUM to avoid collision with our `public.subscription_status`.

### Step 3 — Seed the catalog (one-time)

```bash
DATABASE_URL='<prod url here>' pnpm --filter @workspace/scripts run seed
```

Verify after:

```bash
DATABASE_URL='<prod url here>' pnpm --filter @workspace/scripts run audit:pedagogy
```

Expect: `visible 56/56`.

### Step 4 — Seed Stripe Pro Plan (one-time per Stripe live account)

> **⚠ Live-vs-test selection.** `scripts/src/stripeClient.ts:22` selects the Stripe connector environment via `REPLIT_DEPLOYMENT === "1"`. A plain local shell evaluates to **development** → seed lands in **test** Stripe, not live. To force live-mode seeding, you must either:
> 1. **Preferred:** run the seed from inside the **deployment runtime** (Replit deployment shell — `REPLIT_DEPLOYMENT=1` is set automatically), OR
> 2. Explicitly export `REPLIT_DEPLOYMENT=1` in the local shell AND confirm the Replit Stripe connector is switched to **live** mode for this workspace.
>
> Verify before proceeding: `curl https://$DOMAIN/api/billing/plans` should return price IDs starting with `price_` from your **live** Stripe account, not test.

```bash
# Option 1 (preferred): from the deployment shell, REPLIT_DEPLOYMENT is already 1
DATABASE_URL='<prod url>' pnpm --filter @workspace/scripts run seed:stripe

# Option 2: local shell — must explicitly force live mode
REPLIT_DEPLOYMENT=1 DATABASE_URL='<prod url>' pnpm --filter @workspace/scripts run seed:stripe
```

This creates the Pro Plan product + monthly/annual prices in **live** Stripe. Idempotent — re-running won't duplicate, but a wrong-mode first run does require manual Stripe-dashboard cleanup of the stray test-mode product.

> **Cross-check (recommended for first deploys before `$DOMAIN` is live):** open the Stripe dashboard in **live** mode and confirm a product named "Pro Plan" with monthly + annual prices was created. Then immediately after Step 6 deploys, confirm `curl https://$DOMAIN/api/billing/plans` returns those same live `price_…` IDs.

### Step 5 — Promote first admin

```bash
DATABASE_URL='<prod url here>' pnpm --filter @workspace/scripts run grant:admin -- <your-email>
```

### Step 6 — Deploy

Trigger the Replit Autoscale deploy. The api-server will:

1. Boot, read `DATABASE_URL`.
2. Run `stripe-replit-sync`'s `runMigrations` (creates the `stripe.*` schema if missing — separate from our migration; never touches `public.*`).
3. Register the Stripe managed webhook at `https://${REPLIT_DOMAINS[0]}/api/webhooks/stripe`.
4. Backfill Stripe data into `stripe.*` tables.
5. `app.listen(PORT)`.

If Stripe init fails, only billing routes are degraded — the rest of the API still serves traffic. This is intentional.

---

## 3. Stripe-specific notes

- The Replit Stripe connector must be switched to **live** mode for the deployment. The connector exposes both test and live credentials; `lib/stripeClient.ts` selects between them based on `REPLIT_DEPLOYMENT`.
- The webhook is created automatically at boot — no manual Stripe dashboard configuration needed.
- The `subscription_status` ENUM collision (between `public.subscription_status` and `stripe.subscription_status`) is pre-empted in `artifacts/api-server/src/index.ts` initialization. If you reset the DB, run the snippet in `replit.md` § "Billing (Stripe)" before starting api-server.

---

## 4. Clerk-specific notes

- Production Clerk instance must be configured with the production domain (`https://${REPLIT_DOMAINS[0]}`) in **Allowed origins**.
- `VITE_CLERK_PUBLISHABLE_KEY` is baked into the Atlas bundle at build time — changing it requires a fresh frontend build. Set it as a **build-time** secret in the deployment.
- `CLERK_SECRET_KEY` is read at runtime by `@clerk/express` middleware.

---

## 5. Resend / transactional email

- Free-email FROM domains (gmail / outlook / yahoo / etc.) are rejected by Resend. The Resend connector should be configured with a verified custom domain (e.g. `mail.atlasprojects.dev`) before production traffic begins arriving.
- Without a verified domain, `lib/email.ts` auto-falls-back to `onboarding@resend.dev` (Resend's sandbox sender, deliverability not guaranteed).
- If Resend is not configured at all, `sendEmail()` no-ops with `req.log.warn` — the API does **not** fail.

---

## 6. Post-deploy verification (run in order)

Replace `$DOMAIN` with the first entry in `REPLIT_DOMAINS` (e.g. `atlasprojects.replit.app` or a custom domain).

- [ ] **Health.** `curl https://$DOMAIN/api/healthz` → 200.
- [ ] **Auth.** Open `https://$DOMAIN`, sign in via Clerk, confirm dashboard loads.
- [ ] **Sign-out** clears session; refresh redirects to landing.
- [ ] **Enrollment.** Pick a free project; enroll; confirm redirect to workspace.
- [ ] **`/check` is write-free.** Open workspace, type partial answer, click Check. Confirm provisional feedback returned and **no** completion row written (verify in dev tools / DB if needed).
- [ ] **`/submit` awards XP.** Submit a passing answer; confirm XP increases on profile; idempotently re-submit same step and confirm XP does **not** double-count (P26/P27 guarantee).
- [ ] **Cert verify.** Complete a short project to earn a cert; hit `https://$DOMAIN/api/verify/<certId>` and confirm `evidenceHashCount`, `stepsCompleted/totalSteps`, `totalXpEarned`, `firstStepCompletedAt`, `durationSeconds` are all present (P28 surface).
- [ ] **Portfolio.** Authenticated `GET /api/user/portfolio` returns per-cert evidence chips; `/certificates` and `/profile` render the evidence summary (P29 surface).
- [ ] **Billing — plans.** `curl https://$DOMAIN/api/billing/plans` returns the live Pro Plan price IDs (not the env fallback).
- [ ] **Billing — checkout.** Authenticated POST to `/api/billing/checkout` with a valid live price ID returns a Stripe checkout session URL.
- [ ] **Billing — webhook.** Trigger a test subscription (or use Stripe CLI against the live webhook); confirm `stripe.*` tables update and `users.subscription_tier` flips.
- [ ] **AI tutor.** Authenticated `POST /api/ai/chat` streams a Claude response (free tier → haiku, pro tier → sonnet).
- [ ] **Email.** Submit a new waitlist entry; verify `req.log` shows the Resend send attempt and (if domain verified) the email arrives.
- [ ] **Admin guard.** Non-admin user hitting `GET /api/admin/quality` returns **403**. Admin user gets `hiddenCount`/`hiddenSlugs` + `lineageIntegrity` with all four counters at 0.
- [ ] **Privacy gate.** Public `/api/verify/:certId` and `/u/:username` return **404** (not 403) for missing/private records — no existence leak.

---

## 7. Post-launch monitoring (first 24h)

- Watch `req.log` output for `[migrate]` re-runs or Stripe reconcile errors.
- Tail `xp_transactions` count growth vs `user_step_completions(passed=true)` count — should grow together.
- Spot-check `audit:bad-completions` (read-only, see `scripts/src/audit-bad-completions.ts`) once real `/submit` traffic exists.

> **Phase 30 was parked** specifically pending real production `/submit` traffic. Once the first production submissions exist, run `audit:bad-completions` against the prod DB as a read-only audit. **Do not mutate.**

---

## 8. Rollback procedure

If the deploy goes bad:

1. **Code rollback.** Revert via Replit deployment UI to the previous good build.
2. **Schema rollback.** Phase 31 ships only a baseline migration — there is nothing to "down-migrate" for the first deploy. Subsequent migrations should ship reversible DDL or a documented manual rollback in their phase close-out.
3. **Stripe rollback.** Stripe data lives in Stripe; the `stripe.*` mirror is rebuildable via `syncBackfill()` at next boot.

---

## 9. Known caveats

- **No automatic CI hook for `audit:bad-completions`.** Operator must run manually post-launch.
- **No structured-log dashboard for `/submit` lock-wait durations.** Phase 27's `pg_advisory_xact_lock` is proven correct (Phase 30B integration test) but un-instrumented in production.
- **No alerting** on advisory-lock contention, migration failures, or Stripe webhook errors. Operator monitors via Replit deployment logs.
- These three are deferred — they require real production traffic to be useful.
