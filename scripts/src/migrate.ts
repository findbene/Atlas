/**
 * Phase 31 — Production migration runner.
 *
 * Applies all pending Drizzle migrations in `lib/db/drizzle/` to the database
 * pointed at by `$DATABASE_URL`. Idempotent: re-running against an already
 * up-to-date DB is a no-op (Drizzle tracks applied migrations in
 * `drizzle.__drizzle_migrations`).
 *
 * Intended invocation (production):
 *   pnpm --filter @workspace/scripts run migrate
 *
 * Safety:
 *  - This script does NOT run automatically at api-server boot. It must be
 *    invoked explicitly, so a migration failure surfaces as a deploy step
 *    failure (allowing rollback) rather than a hard-down app.
 *  - Reads `DATABASE_URL` from the ambient environment. Whichever DB that
 *    points at is what gets migrated — operator's responsibility to point
 *    it at the right one.
 *  - The pool is closed on success and on failure so the process exits
 *    cleanly with a non-zero code on error.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "@workspace/db";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsFolder = path.resolve(
  __dirname,
  "../../lib/db/drizzle",
);

async function main(): Promise<void> {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) {
    console.error("[migrate] DATABASE_URL is not set; aborting.");
    process.exit(1);
  }
  const redacted = dbUrl.replace(/:[^:@/]+@/, ":***@");
  console.log(`[migrate] target: ${redacted}`);
  console.log(`[migrate] folder: ${migrationsFolder}`);
  const startedAt = Date.now();
  try {
    await migrate(db, { migrationsFolder });
    const ms = Date.now() - startedAt;
    console.log(`[migrate] OK (${ms}ms)`);
  } catch (err) {
    console.error("[migrate] FAILED", err);
    process.exit(1);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main();
