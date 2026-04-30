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

Clerk (`@clerk/clerk-react` + `@clerk/express`). `getCurrentUser(req)` returns the local `users` row (looked up by `clerkId`).

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
