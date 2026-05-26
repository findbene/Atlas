# Phase 30B — Real-Postgres /submit concurrency test

**Goal.** Prove the Phase 27 `pg_advisory_xact_lock` (key
`atlas-submit:${userId}`) actually serializes concurrent `/submit` traffic
against a real Postgres backend, instead of only against a mock that
pretends the lock works.

**Hard constraints (per the approved scope).**
- No `/submit` behavior change.
- No `/check` behavior change.
- No schema / migration / OpenAPI / codegen change.
- No frontend / content / rubric / anchor / wave / archive change.
- No PWA / Stripe / AI tutor / dashboard / cert-verify / portfolio /
  public-profile change.
- No production access. The integration test runs **only** against the
  existing dev DB.

## Fixture strategy

Per-run namespaced schema inside the existing dev database:

```
p30b_test_<Date.now()>_<6-char-base36>
```

Boot sequence (`lib/db/src/test-helpers.ts:createTestSchema`):

1. `CREATE SCHEMA "p30b_test_..."`.
2. For each table the `/submit` code path touches —
   `users`, `domains`, `tracks`, `projects`, `project_steps`,
   `user_progress`, `user_step_completions`, `user_xp`, `xp_transactions`,
   `user_streaks` — run
   `CREATE TABLE x.<t> (LIKE public.<t> INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`.
   Foreign-key constraints are intentionally NOT copied (LIKE never
   copies FKs); tests own all seed data, so FK enforcement is
   unnecessary and dropping the schema with CASCADE is the only
   teardown path.
3. Build a test `pg.Pool` with libpq `options=-c search_path=<schema>,public`.
   Drizzle's unqualified table names resolve to the test schema; enum
   types (declared in public) and `pg_advisory_xact_lock`
   (in `pg_catalog`) still resolve.
4. `vi.doMock("@workspace/db", ...)` swaps the singleton `db` for the
   test-schema-bound drizzle instance BEFORE the route module is
   dynamically imported (the route captures `db` at module-load time).

Teardown: `DROP SCHEMA "p30b_test_..." CASCADE`. A best-effort
`cleanupStaleTestSchemas(24)` sweep runs at `beforeAll` to drop any
schemas left behind by interrupted prior runs. Schema-name format is
strictly validated before every drop (`/^p30b_test_\d+_[a-z0-9]+$/`).

## Test runner

Opt-in only:

```bash
pnpm --filter @workspace/api-server run test:integration
```

- `vitest.integration.config.ts` is a SEPARATE config — single-forked
  (`pool: "forks", forks: { singleFork: true }`) so the fixture schema
  is not raced across files.
- The default unit suite (`pnpm --filter @workspace/api-server run test`)
  EXCLUDES `*.integration.test.ts`. Unit runtime is unchanged.
- `pnpm run typecheck` does NOT trigger the integration suite.

## Scope (3 scenarios)

`artifacts/api-server/src/routes/user-submit.integration.test.ts`:

1. **Same-step storm** — N=20 concurrent submits for the same
   `(user, project, step)`. Assertions:
   - All 20 responses are HTTP 200.
   - All 20 report `status="passed"`.
   - Exactly ONE response carries `isFirstPass=true` with `xpEarned=50`.
   - All other 19 report `xpEarned=0`.
   - Exactly ONE `xp_transactions` row for the learner.
   - `user_xp.totalXp = 50` (no lost updates).
   - Exactly ONE `user_step_completions` row.

2. **Cross-step same-user storm** — 2 concurrent submits per step ×
   3 steps = 6 concurrent calls, all racing the same lock key
   `atlas-submit:${userId}`. Assertions:
   - All 6 HTTP 200, `status="passed"`.
   - Exactly 3 first-passes (one per step).
   - Exactly ONE response carries `projectComplete=true`.
   - 3 `xp_transactions` rows; `user_xp.totalXp = 150`.
   - 3 `user_step_completions` rows.
   - `user_progress.status = "completed"`.

3. **Cross-user negative control** — two users submit in parallel for
   the same step. Assertions:
   - Each user gets exactly ONE first-pass + ONE ledger row + 50 XP.
   - User isolation holds; the lock is per-user, not global.

## Results

- Unit suite (api-server): **246/246** green — unchanged.
- Integration suite: **3/3** green; ~5s runtime end-to-end including
  schema setup, seed, run, drop.
- `pnpm run typecheck`: clean.
- `check:no-heuristic-runtime`: OK.
- `audit:pedagogy` (visible): **56/56** — unchanged.

## Files touched

- `lib/db/src/test-helpers.ts` (new) — `createTestSchema`,
  `cleanupStaleTestSchemas`, `TestDbContext` type.
- `lib/db/package.json` — `+ "./test-helpers"` subpath export.
- `artifacts/api-server/vitest.integration.config.ts` (new) —
  single-forked vitest config scoped to `*.integration.test.ts`.
- `artifacts/api-server/src/routes/user-submit.integration.test.ts`
  (new) — 3 scenarios above.
- `artifacts/api-server/package.json` — `test` script excludes
  `*.integration.test.ts`; new `test:integration` script.
- `docs/phases/phase-30b-real-pg-concurrency-test.md` (this file).
- `HANDOFF.md`, `replit.md` (one-line phase entry).

## Confirmation of hard stops

- Zero production touch. `cleanup()` drops only the per-run schema, and
  `cleanupStaleTestSchemas` drops only schemas whose name strictly
  matches `p30b_test_<digits>_<lowercase>` (validated by
  `assertSchemaName` before every `DROP`).
- Zero `/submit` behavior changes. The handler is invoked verbatim
  through the production router.
- Zero schema / migration changes. The cloned tables exist only inside
  the disposable test schema.
- Per-run schema cleanup confirmed: the test's `afterAll` runs `DROP
  SCHEMA ... CASCADE`; the janitor sweep handles any historical
  interrupted runs.
