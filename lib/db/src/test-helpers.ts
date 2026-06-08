/**
 * Phase 30B — Real-Postgres integration test helpers. TEST-ONLY.
 *
 * Creates a per-run, randomly-named schema inside the EXISTING dev database
 * (e.g. `p30b_test_<timestamp>_<rand>`) and clones the narrow set of tables
 * the `/submit` code path touches into that schema via
 * `CREATE TABLE x.<t> (LIKE public.<t> INCLUDING DEFAULTS INCLUDING CONSTRAINTS
 * INCLUDING INDEXES)`. Foreign-key constraints are intentionally NOT cloned
 * (LIKE never copies FKs); the integration tests control all seed data, so
 * FK enforcement is unnecessary, and dropping the schema with CASCADE is the
 * only teardown path.
 *
 * Search-path strategy: the returned `pool` is bound to a libpq `options`
 * connection parameter that sets `search_path = <test_schema>, public` on
 * every backend session. Drizzle's unqualified table names resolve to the
 * test schema; enum types (declared in public) and `pg_advisory_xact_lock`
 * (in pg_catalog, always implicitly first in search_path) still resolve.
 *
 * Hard guarantees:
 *   - Never touches production. Reads `DATABASE_URL` and runs only against
 *     the dev DB. The integration test runner is opt-in (`test:integration`)
 *     and is never chained into `pnpm run typecheck` or the default unit
 *     suite.
 *   - All writes live inside the randomly-named schema. `cleanup()` runs
 *     `DROP SCHEMA ... CASCADE` so no test data ever persists in public.
 *   - `cleanupStaleTestSchemas()` is a safety net for prior runs whose
 *     `cleanup()` may have been interrupted; it ONLY drops schemas matching
 *     the `p30b_test_<ts>_` naming + an embedded timestamp older than the
 *     configured cutoff.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const TEST_SCHEMA_PREFIX = "p30b_test_";

const CLONED_TABLES = [
  "users",
  "domains",
  "tracks",
  "projects",
  "project_steps",
  "user_progress",
  "user_step_completions",
  // Phase 60B added an append-only snapshot write to the /submit fresh-pass
  // path. Without cloning this table into the test schema, the unqualified
  // INSERT falls through `search_path` to public's FK-bearing table and a
  // fresh pass 500s (FK violation against public.users/projects). Cloning it
  // (LIKE copies the unique index but NOT FKs) keeps the /submit path testable
  // in isolation. Required by the Phase-60F evidence-loop test AND the
  // pre-existing Phase-30B concurrency test (which also exercises fresh-pass
  // /submit and silently broke when 60B shipped).
  "portfolio_submission_snapshots",
  "user_xp",
  "xp_transactions",
  "user_streaks",
] as const;

export type TestDbContext = {
  schemaName: string;
  pool: pg.Pool;
  db: ReturnType<typeof drizzle<typeof schema>>;
  cleanup: () => Promise<void>;
};

function assertSchemaName(name: string): void {
  if (!/^p30b_test_\d+_[a-z0-9]+$/.test(name)) {
    throw new Error(`refusing to operate on non-test schema: ${name}`);
  }
}

/**
 * Defense-in-depth: refuse to operate against anything that smells like a
 * production database. The integration runner is opt-in, but a misconfigured
 * `DATABASE_URL` (e.g. pointing at a prod Neon branch) would otherwise let
 * a developer create + DROP `p30b_test_*` schemas in production. The strict
 * `assertSchemaName` allowlist still guards the DROP statement itself; this
 * guard is the earlier gate that refuses to even open a connection.
 *
 * Opt-in requires `INTEGRATION_TEST_DB_ALLOW=1`. Always refuses when
 * `NODE_ENV=production` or `REPLIT_DEPLOYMENT` is set (latter is present
 * in Replit's published/deployed envs).
 */
function assertNonProductionEnv(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "test-helpers: refusing to run with NODE_ENV=production. " +
        "Integration tests must NEVER touch production.",
    );
  }
  if (process.env.REPLIT_DEPLOYMENT) {
    throw new Error(
      "test-helpers: refusing to run inside REPLIT_DEPLOYMENT. " +
        "Integration tests must NEVER touch production.",
    );
  }
  if (process.env.INTEGRATION_TEST_DB_ALLOW !== "1") {
    throw new Error(
      "test-helpers: opt-in required. Set INTEGRATION_TEST_DB_ALLOW=1 " +
        "to acknowledge that DATABASE_URL points at a NON-production " +
        "database. The `test:integration` script wires this in.",
    );
  }
}

export async function createTestSchema(): Promise<TestDbContext> {
  assertNonProductionEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for integration tests");
  }
  const rand = Math.random().toString(36).slice(2, 8);
  const schemaName = `${TEST_SCHEMA_PREFIX}${Date.now()}_${rand}`;
  assertSchemaName(schemaName);

  const adminPool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    for (const t of CLONED_TABLES) {
      await adminPool.query(
        `CREATE TABLE "${schemaName}"."${t}" (LIKE public."${t}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`,
      );
    }
  } finally {
    await adminPool.end();
  }

  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("options", `-c search_path=${schemaName},public`);
  const pool = new Pool({ connectionString: url.toString(), max: 50 });
  const db = drizzle(pool, { schema });

  const cleanup = async () => {
    try {
      await pool.end();
    } catch {
      // pool may already be ending; the schema drop below is what matters.
    }
    const dropPool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      assertSchemaName(schemaName);
      await dropPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await dropPool.end();
    }
  };

  return { schemaName, pool, db, cleanup };
}

/**
 * Best-effort sweep of test schemas left behind by interrupted runs. The
 * timestamp embedded in the schema name is the create-time `Date.now()`; we
 * use it (NOT a pg_catalog timestamp) to decide age. Only drops schemas that
 * match the strict `p30b_test_<digits>_<lowercase>` pattern. Returns the
 * number of schemas dropped.
 */
export async function cleanupStaleTestSchemas(maxAgeHours = 24): Promise<number> {
  assertNonProductionEnv();
  if (!process.env.DATABASE_URL) return 0;
  const cutoff = Date.now() - maxAgeHours * 3_600_000;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let dropped = 0;
  try {
    const res = await pool.query<{ schema_name: string }>(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE $1",
      [`${TEST_SCHEMA_PREFIX}%`],
    );
    for (const row of res.rows) {
      const m = row.schema_name.match(/^p30b_test_(\d+)_[a-z0-9]+$/);
      if (!m) continue;
      const ts = parseInt(m[1]!, 10);
      if (!Number.isFinite(ts) || ts >= cutoff) continue;
      assertSchemaName(row.schema_name);
      await pool.query(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`);
      dropped++;
    }
  } finally {
    await pool.end();
  }
  return dropped;
}
