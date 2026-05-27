/**
 * Phase 46 — Nonce store janitor.
 *
 * Deletes expired rows from `run_envelope_nonces`. Designed to run on a
 * cron schedule (nightly is plenty given the 10-minute envelope TTL).
 *
 * Idempotent: re-running deletes nothing if all expired rows are already gone.
 * Read-only on non-expired rows.
 *
 * Invocation:
 *   pnpm --filter @workspace/scripts run cleanup:run-envelope-nonces
 */
import { db, pool, runEnvelopeNonces } from "@workspace/db";
import { lt } from "drizzle-orm";

async function main(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    console.error("[cleanup-run-envelope-nonces] DATABASE_URL is not set; aborting.");
    process.exit(1);
  }
  const startedAt = Date.now();
  try {
    const result = await db
      .delete(runEnvelopeNonces)
      .where(lt(runEnvelopeNonces.expiresAt, new Date()));
    const rowCount = (result as { rowCount?: number | null }).rowCount ?? 0;
    const ms = Date.now() - startedAt;
    console.log(
      `[cleanup-run-envelope-nonces] deleted ${rowCount} expired nonce(s) in ${ms}ms`,
    );
  } catch (err) {
    console.error("[cleanup-run-envelope-nonces] FAILED", err);
    process.exit(1);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main();
