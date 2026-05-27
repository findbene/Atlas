/**
 * Phase 38 — Enrollment safety helper.
 *
 * Single source of truth for "does this project have active learner
 * enrollments?" used by the archive-by-hide safety gates.
 *
 * Background: `projects.enrolled_count` is a denormalized integer column
 * with a schema default of `0` and (as of Phase 38) NO writer anywhere in
 * the enrollment routes. Phase 37 caught this when its archive gate
 * silently passed for 13 legacy slugs whose counter was zero only by
 * coincidence. Phase 38 hardens the remaining archive scripts the same
 * way: they now query `user_progress` directly via this helper instead
 * of trusting the stale counter.
 *
 * The `projects.enrolled_count` column itself is intentionally NOT
 * removed in Phase 38 (would require a schema change + codegen reflow);
 * it is still read by the API/UI layer for display ONLY. Future work to
 * either backfill it from `user_progress` or drop it is a separate
 * hygiene phase.
 *
 * @see docs/phases/phase-37-batch-gap-project-remediation.md (post-fix correction)
 * @see docs/phases/phase-38-archive-safety-counter-hygiene.md
 */
import { db, userProgress } from "@workspace/db";
import { inArray, sql } from "drizzle-orm";

/**
 * Returns the live enrollment count for each `projectId` by counting
 * matching `user_progress` rows. Project IDs with zero progress rows
 * are included in the returned Map with a count of `0`.
 *
 * Empty input → empty Map (no DB roundtrip).
 */
export async function getActualEnrollmentCounts(
  projectIds: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (projectIds.length === 0) return out;
  for (const id of projectIds) out.set(id, 0);

  const rows = await db
    .select({
      projectId: userProgress.projectId,
      ct: sql<number>`count(*)::int`.as("ct"),
    })
    .from(userProgress)
    .where(inArray(userProgress.projectId, [...projectIds]))
    .groupBy(userProgress.projectId);

  for (const r of rows) out.set(r.projectId, r.ct);
  return out;
}

/**
 * Convenience single-id variant. Returns `0` if the project has no
 * `user_progress` rows.
 */
export async function getActualEnrollmentCount(projectId: string): Promise<number> {
  const m = await getActualEnrollmentCounts([projectId]);
  return m.get(projectId) ?? 0;
}
