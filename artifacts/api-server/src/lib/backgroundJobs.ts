import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// Hard cap on messages retained per (user, project) bucket. Older rows are
// pruned by a periodic background sweep instead of inline on the chat write
// path, so the user-facing latency of /api/ai/chat is unaffected by retention.
const RETENTION_CAP = 500;

// Per-step code-run history is kept much shorter — it's a debugging aid, not
// a transcript, and a single step can rack up dozens of attempts.
const CODE_RUNS_RETENTION_CAP = 50;

// Sweep interval. Short enough that storage stays bounded under heavy use,
// long enough that the sweep's read+delete cost is negligible amortized over
// many inserts.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Prune all (user_id, project_id) buckets in a single SQL statement.
 *
 * `IS NOT DISTINCT FROM` semantics for NULL projectId are preserved by the
 * `PARTITION BY user_id, project_id` window — Postgres treats NULLs as equal
 * inside `PARTITION BY`, so the general-chat bucket per user is grouped
 * correctly. Tie-breaker on `id DESC` ensures deterministic ordering when
 * timestamps collide.
 */
export async function pruneOvercapBuckets(): Promise<number> {
  const result = await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, project_id
          ORDER BY created_at DESC, id DESC
        ) AS rn
      FROM ai_tutor_messages
    )
    DELETE FROM ai_tutor_messages
    WHERE id IN (SELECT id FROM ranked WHERE rn > ${RETENTION_CAP})
  `);
  // pg's DELETE returns rowCount on the underlying result; drizzle's execute
  // returns the pg Result-shaped object, so rowCount may be present.
  const count = (result as { rowCount?: number | null }).rowCount ?? 0;
  return count;
}

/**
 * Same single-statement ROW_NUMBER pattern as `pruneOvercapBuckets`, but for
 * the per-(user, step) code-run history.
 */
export async function pruneOvercapCodeRuns(): Promise<number> {
  const result = await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, step_id
          ORDER BY created_at DESC, id DESC
        ) AS rn
      FROM user_code_runs
    )
    DELETE FROM user_code_runs
    WHERE id IN (SELECT id FROM ranked WHERE rn > ${CODE_RUNS_RETENTION_CAP})
  `);
  return (result as { rowCount?: number | null }).rowCount ?? 0;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startBackgroundJobs(): void {
  if (timer) return;
  // Run once at startup so a long-stopped instance catches up immediately.
  void runOnce("startup");
  timer = setInterval(() => void runOnce("interval"), SWEEP_INTERVAL_MS);
  // Don't keep the event loop alive solely for this timer — graceful shutdown
  // can exit even if a sweep is "scheduled" but not yet fired.
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "AI tutor background prune started");
}

export function stopBackgroundJobs(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function runOnce(trigger: "startup" | "interval"): Promise<void> {
  try {
    const deleted = await pruneOvercapBuckets();
    if (deleted > 0) {
      logger.info({ trigger, deleted }, "AI tutor history pruned");
    }
  } catch (err) {
    logger.warn({ err, trigger }, "AI tutor prune sweep failed");
  }
  try {
    const deletedRuns = await pruneOvercapCodeRuns();
    if (deletedRuns > 0) {
      logger.info({ trigger, deleted: deletedRuns }, "Code run history pruned");
    }
  } catch (err) {
    logger.warn({ err, trigger }, "Code run prune sweep failed");
  }
}
