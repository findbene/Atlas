# Phase 30 — Production Bad-Completions Audit (PARKED)

**Status.** PARKED. Not shipped. Phase 30B was executed in its place as the integrity follow-up.

## Goal (as scoped)

Run the Phase 26 read-only `audit:bad-completions` script against the **production** database to verify that the trustworthy-completion model (P26 evidence columns + P27 per-user advisory lock) holds against real learner traffic — i.e. no completion rows without evidence, no duplicate ledger entries, no orphaned XP, no `user_progress.status='completed'` rows with `allStepsPassed=false`.

## Why parked

There is no production Neon database to audit yet.

- Atlas has not been deployed.
- `REPLIT_DEPLOYMENT` is unset in this workspace.
- No production `/submit` traffic exists.
- The Stripe connector, Resend connector, and Clerk tenant are configured but the app itself has never served a real learner.

A "bad-completions audit" against an empty (or non-existent) production DB would be vacuously green and would not give us any signal we don't already have from the development DB.

## What was actually attempted

- Read-only confirmation that no production DB connection exists in this environment.
- Verified `audit:bad-completions` runs cleanly against the dev DB (already confirmed in Phase 26 close-out).

## What was NOT done

- Zero mutations attempted on any database, dev or prod.
- Zero private learner data fetched or returned.
- Zero files changed (no commits, no script edits, no schema/migration/OpenAPI/FE/BE changes).
- Zero production access.

## Unblock condition

Phase 30 should be unparked and run when ALL of the following hold:

1. Atlas has been deployed at least once (Replit Deployments → `REPLIT_DEPLOYMENT=1` in the deployed env).
2. A production Neon database has been provisioned and migrated.
3. Real production `/submit` traffic has been recorded — at minimum a dozen learner submits across multiple users, ideally including at least one completed project.

At that point: connect to the production DB read-only via the `database` skill's `environment: "production"` mode, run `pnpm --filter @workspace/scripts run audit:bad-completions` against it, and document the result (expected: zero anomalies).

## Follow-up taken instead

Phase 30B — [phase-30b-real-pg-concurrency-test.md](phase-30b-real-pg-concurrency-test.md). Rather than audit production data that doesn't exist, we built an opt-in real-Postgres integration test that proves the Phase 27 `pg_advisory_xact_lock(hashtextextended('atlas-submit:'||userId, 0))` actually serializes concurrent `/submit` against a real Postgres backend (3 scenarios, 3/3 green). This gives us stronger pre-deploy confidence in the integrity model than a production audit of an empty DB ever could.

## Constraint compliance

- Read-only. No writes attempted, dev or prod.
- No code, test, schema, OpenAPI, frontend, backend, or behavior changes.
- No private data returned.
