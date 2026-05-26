# Atlas — Session Handoff

**HEAD:** Phase 30B ship (pending commit by platform). Last shipped: Phase 29 (commit `f22d7cd9`).
**Status:** Phase 30B **READY TO COMMIT**. Working tree changes:
- `lib/db/src/test-helpers.ts` (new — `createTestSchema`, `cleanupStaleTestSchemas`, strict schema-name allowlist before every DROP).
- `lib/db/package.json` (+ `"./test-helpers"` subpath export).
- `artifacts/api-server/vitest.integration.config.ts` (new — single-forked, scoped to `*.integration.test.ts`).
- `artifacts/api-server/src/routes/user-submit.integration.test.ts` (new — 3 real-PG concurrency scenarios).
- `artifacts/api-server/package.json` (`test` excludes `*.integration.test.ts`; new `test:integration` script).
- `docs/phases/phase-30b-real-pg-concurrency-test.md` (new).
- `HANDOFF.md`, `replit.md`.

---

## Final gate summary (Phase 30B)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `check:no-heuristic-runtime` | OK |
| OpenAPI codegen | unchanged (no spec edits) |
| api-server unit tests | **246/246** (unchanged — integration suite excluded) |
| **NEW** `test:integration` | **3/3** green (~5s end-to-end incl. schema setup + drop) |
| Architect | PASS (pending review this turn) |
| `audit:pedagogy` (visible) | **56/56** (no content/visibility changes) |
| Anchor drift | n/a (no anchor-relevant changes) |

---

## What Phase 30B shipped

**Real-Postgres integration test proving Phase 27's `pg_advisory_xact_lock` actually serializes concurrent `/submit`.**

Phase 27 introduced the per-user advisory lock
(`pg_advisory_xact_lock(hashtextextended('atlas-submit:'||userId, 0))`)
as the first statement inside the `/submit` transaction. The existing
unit suite proves the lock SQL is emitted, but a unit mock cannot prove
real-Postgres collapses concurrent transactions on the lock key. Phase
30B closes that gap with an opt-in real-PG integration suite.

### Fixture (per-run namespaced schema)

`lib/db/src/test-helpers.ts:createTestSchema()`:

- Generates a random schema name `p30b_test_<Date.now()>_<6chr-base36>`.
- `CREATE SCHEMA "p30b_test_..."`.
- Clones the narrow table set the `/submit` path touches via
  `CREATE TABLE x.<t> (LIKE public.<t> INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`.
  Tables cloned: `users`, `domains`, `tracks`, `projects`,
  `project_steps`, `user_progress`, `user_step_completions`, `user_xp`,
  `xp_transactions`, `user_streaks`. FK constraints are NOT copied
  (LIKE never copies FKs); the test owns all seed data so FK enforcement
  is unnecessary.
- Returns a `drizzle(testPool, { schema })` instance whose pool is bound
  to `options=-c search_path=<schema>,public` so unqualified table names
  resolve to the test schema; enum types (in public) and
  `pg_advisory_xact_lock` (in `pg_catalog`) still resolve.
- `cleanup()` runs `DROP SCHEMA ... CASCADE` after strict name
  validation (`/^p30b_test_\d+_[a-z0-9]+$/`).
- `cleanupStaleTestSchemas(24)` is a best-effort janitor that drops only
  schemas whose embedded timestamp is older than the cutoff and whose
  name matches the strict allowlist.

### Test runner

`vitest.integration.config.ts` — single-forked, `*.integration.test.ts`
only. The default `test` script EXCLUDES integration tests so unit
runtime stays unchanged.

- Opt-in: `pnpm --filter @workspace/api-server run test:integration`.
- Default unit suite: `pnpm --filter @workspace/api-server run test`
  (excludes `*.integration.test.ts`).
- `pnpm run typecheck` does NOT trigger the integration suite.

### Scenarios (3/3 green)

1. **Same-step storm** — N=20 concurrent submits for same
   (user, project, step). Asserts: 20× HTTP 200, 20× passed, exactly
   one `isFirstPass=true` carrying `xpEarned=50`, others `xpEarned=0`,
   exactly one `xp_transactions` row, `user_xp.totalXp=50`, exactly one
   `user_step_completions` row.
2. **Cross-step same-user storm** — 2 concurrent submits × 3 steps = 6
   calls all racing the same lock key. Asserts: 6× passed, 3 first-passes
   (one per step), exactly one `projectComplete=true`, 3 ledger rows,
   `totalXp=150`, 3 completion rows, `user_progress.status="completed"`.
3. **Cross-user negative control** — two users submit in parallel.
   Asserts each user gets their own valid first-pass + ledger row + 50
   XP; lock is per-user, not global.

### What the test mocks

ONLY the route's auth + post-commit side-effect modules:

- `../lib/auth` — `requireAuth` becomes `next()`; `getCurrentUser`
  returns the test fixture user.
- `../lib/email`, `../lib/streak` — spied no-ops.
- `@workspace/db` — `db` swapped for the test-schema-bound drizzle
  instance; all schema exports preserved by spreading the real module.
  Mock installed via `vi.doMock` BEFORE the route is dynamically
  imported (the route captures `db` at module-load time).

Everything else — the entire `/submit` handler, the transaction, the
advisory lock SQL, the read-modify-write of `user_xp`, the ledger
insert, the `allStepsPassed` count, the conditional progress update —
runs verbatim against real Postgres.

## Hard stops respected

- Zero `/submit` behavior changes.
- Zero `/check` behavior changes.
- Zero schema / migration / OpenAPI / codegen changes.
- Zero frontend / content / rubric / anchor / wave / archive changes.
- Zero PWA / Stripe / AI tutor / dashboard / cert-verify / portfolio /
  public-profile changes.
- Zero production access. The test runs only against the dev DB and
  drops its private schema on teardown.

## Active invariants (unchanged post-30B)

- Visible projects: **56**, hidden: 32, beginner: 10
- Zero-beginner courses: **0**
- Wave coverage: **56/56**
- Pedagogy (visible): **56/56**
- Lineage failures: **0 / 0 / 0 / 0**
- 9-course taxonomy intact; `RUBRIC_VERSION='1.0.1'` frozen
- Anchor drift: **0.00 / 0.00**

## Operating note

`test:integration` is an **opt-in pre-deploy gate**, NOT a default
pre-commit / typecheck gate. Run it before shipping any change that
touches the `/submit` handler, the per-user advisory lock convention,
the reward tables (`user_xp`, `xp_transactions`,
`user_step_completions`), or `user_progress` completion semantics.

Future writers to reward tables MUST use the same per-user lock
namespace (`atlas-submit:${userId}`) — that convention is what Phase
30B verifies actually works.
