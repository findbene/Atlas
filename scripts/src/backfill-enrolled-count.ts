/**
 * Phase 39 — Backfill projects.enrolled_count from user_progress.
 *
 * One-shot, idempotent. Recomputes `projects.enrolled_count` for every
 * project from the live `count(*) FROM user_progress GROUP BY project_id`,
 * setting `0` for projects with no progress rows.
 *
 * Companion to the Phase 39 durable writer added to the enrollment routes
 * (`POST /api/enrollments` + legacy `POST /api/user/projects/:id/enroll`),
 * which from now on increments the counter atomically on each newly-inserted
 * user_progress row. This backfill is what brings the historical rows
 * (everything that landed before the writer existed) into line with reality,
 * and what operators can re-run to reconcile after any counter-write failure
 * (the writer logs `warn` and continues on failure — see route comments).
 *
 * Safety:
 *   - Default mode refuses to run when REPLIT_DEPLOYMENT is set unless
 *     `--allow-prod` is passed. There is no other "are you sure" prompt
 *     because the operation is fully idempotent and only touches a single
 *     display column (no row deletes, no schema changes, no FK touches).
 *   - Prints a before/after summary including the per-project drift so the
 *     operator can sanity-check the diff before committing.
 *   - Dry-run mode (`--dry-run`) prints the computed values + drift without
 *     writing.
 *   - Reuses `getActualEnrollmentCounts` from `lib/enrollment-check.ts` for
 *     the read so the helper stays the single source of truth for "live
 *     enrollment count" — same shape Phase 38's archive scripts use.
 *
 * Hard stops respected: no schema change, no migration, no row deletes, no
 * touch to user_progress / user_step_completions / projects.{slug, learner_visible,
 * total_steps, course, ...}. Only the `enrolled_count` column on `projects` is
 * written.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run backfill:enrolled-count           # dev
 *   pnpm --filter @workspace/scripts run backfill:enrolled-count -- --dry-run
 *   pnpm --filter @workspace/scripts run backfill:enrolled-count -- --allow-prod  # prod
 */
import { db, projects } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getActualEnrollmentCounts } from "./lib/enrollment-check";

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const allowProd = args.has("--allow-prod");
  const isProd = Boolean(process.env.REPLIT_DEPLOYMENT);

  if (isProd && !allowProd) {
    console.error("[backfill-enrolled-count] REPLIT_DEPLOYMENT is set but --allow-prod was not. Refusing to touch production.");
    console.error("[backfill-enrolled-count] If this is intentional, re-run with: --allow-prod");
    process.exit(2);
  }

  console.log(`[backfill-enrolled-count] mode=${dryRun ? "DRY-RUN" : "WRITE"} env=${isProd ? "PROD" : "DEV"}`);

  const allProjects = await db.query.projects.findMany({
    columns: { id: true, slug: true, enrolledCount: true },
    orderBy: (p, { asc }) => [asc(p.slug)],
  });
  console.log(`[backfill-enrolled-count] scanning ${allProjects.length} projects`);

  const projectIds = allProjects.map((p) => p.id);
  const liveCounts = await getActualEnrollmentCounts(projectIds);

  type Drift = { id: string; slug: string; before: number; after: number };
  const drift: Drift[] = [];
  for (const p of allProjects) {
    const after = liveCounts.get(p.id) ?? 0;
    const before = p.enrolledCount ?? 0;
    if (before !== after) drift.push({ id: p.id, slug: p.slug, before, after });
  }

  // Print drift summary BEFORE any writes so a failed write still leaves a
  // forensic trail in the operator's terminal.
  console.log(`[backfill-enrolled-count] projects requiring update: ${drift.length} / ${allProjects.length}`);
  if (drift.length > 0) {
    console.log("[backfill-enrolled-count] per-project drift (slug: stored -> actual):");
    for (const d of drift) {
      const arrow = d.after > d.before ? "↑" : "↓";
      console.log(`  ${arrow} ${d.slug.padEnd(60, " ")}  ${String(d.before).padStart(5)} -> ${String(d.after).padStart(5)}`);
    }
  }

  if (dryRun) {
    console.log("[backfill-enrolled-count] DRY-RUN — no writes performed.");
    process.exit(0);
  }

  if (drift.length === 0) {
    console.log("[backfill-enrolled-count] already converged — nothing to write.");
    process.exit(0);
  }

  let updated = 0;
  let failed = 0;
  for (const d of drift) {
    try {
      await db.update(projects).set({ enrolledCount: d.after }).where(eq(projects.id, d.id));
      updated++;
    } catch (err) {
      failed++;
      console.error(`[backfill-enrolled-count] update failed for ${d.slug}:`, err);
    }
  }

  console.log(`[backfill-enrolled-count] updated=${updated} failed=${failed} skipped=${allProjects.length - drift.length}`);

  // Phase 40 — two-pass verification.
  //
  // Phase 39 verified post-write values against the script's INITIAL target
  // snapshot. That caught "did my UPDATE write the value I planned?" but it
  // could not catch the case where new enrollments landed in user_progress
  // DURING the backfill — the writer would have correctly bumped
  // enrolled_count, but the script's planned `after` was already stale, so a
  // post-write check against the stale plan would (incorrectly) flag drift.
  //
  // Phase 40 recomputes from user_progress AGAIN here and compares the
  // stored enrolled_count to that fresh live count. Two possible outcomes:
  //   - Match: full convergence, even under concurrent writes.
  //   - Mismatch: a concurrent enrollment slipped in AFTER we computed our
  //     plan AND the writer landed (which is fine — the column reflects
  //     reality), but our `after` plan didn't include it. We surface this
  //     as a clear "concurrent drift detected" log, not as an error, and
  //     suggest a re-run. A re-run is fully idempotent and will either be a
  //     no-op (truly converged) or fix the remaining offset.
  const verifyProjects = await db.query.projects.findMany({
    columns: { id: true, slug: true, enrolledCount: true },
  });
  const freshLive = await getActualEnrollmentCounts(verifyProjects.map((p) => p.id));
  const storedById = new Map(verifyProjects.map((p) => [p.id, p.enrolledCount ?? 0]));

  // Architect P40 fix: the first verification pass reads `stored` and
  // `live` in two separate roundtrips, so a concurrent enrollment landing
  // between them on a planned-mismatch row could be misclassified as a
  // real write failure. Mitigation: for every observed mismatch, do a
  // targeted single-project re-read of BOTH stored and live and only
  // escalate to exit 1 if the mismatch is STABLE across the re-check.
  // A stable mismatch means the writer truly failed (or someone clobbered
  // our value). An unstable one is just read-skew over a concurrent write
  // landing — exactly the case we already classify as "concurrent drift".
  type Mismatch = { id: string; slug: string; stored: number; live: number };
  const firstPass: Mismatch[] = [];
  for (const p of verifyProjects) {
    const stored = storedById.get(p.id) ?? 0;
    const live = freshLive.get(p.id) ?? 0;
    if (stored !== live) firstPass.push({ id: p.id, slug: p.slug, stored, live });
  }

  let stillDriftedById = 0;
  let concurrentDrift = 0;
  for (const m of firstPass) {
    // Re-read this single row's stored + live in tight succession. If the
    // mismatch resolved itself, the first read was racing a concurrent
    // commit and the column is actually fine.
    const reReadStoredRows = await db.query.projects.findMany({
      columns: { enrolledCount: true }, where: eq(projects.id, m.id),
    });
    const reReadLive = await getActualEnrollmentCounts([m.id]);
    const storedNow = reReadStoredRows[0]?.enrolledCount ?? 0;
    const liveNow = reReadLive.get(m.id) ?? 0;

    if (storedNow === liveNow) {
      // First-pass read-skew over a concurrent commit; column is correct now.
      concurrentDrift++;
      console.warn(`[backfill-enrolled-count] transient drift on ${m.slug}: first-pass stored=${m.stored} live=${m.live}, re-read stored=${storedNow} live=${liveNow} (concurrent enrollment race; resolved)`);
      continue;
    }

    const planned = drift.find((d) => d.id === m.id);
    if (planned) {
      stillDriftedById++;
      console.error(`[backfill-enrolled-count] post-write FAILURE on ${m.slug}: re-read stored=${storedNow} live=${liveNow} planned_after=${planned.after}`);
    } else {
      // Stable mismatch on a row that was NOT in our plan. Most commonly this
      // means a concurrent enrollment landed and continued moving between
      // re-reads, but it could also indicate an external writer failure on a
      // row we never touched. Either way the backfill itself did its job; a
      // re-run is the right next step.
      concurrentDrift++;
      console.warn(`[backfill-enrolled-count] external drift during run on ${m.slug}: stored=${storedNow} live=${liveNow} (row was not in plan; re-run to converge)`);
    }
  }

  if (stillDriftedById > 0) {
    console.error(`[backfill-enrolled-count] ${stillDriftedById} planned row(s) failed to converge — investigate.`);
    process.exit(1);
  }
  if (concurrentDrift > 0) {
    console.warn(`[backfill-enrolled-count] ${concurrentDrift} row(s) acquired enrollments mid-backfill (fully expected under live traffic). Re-run is idempotent and will converge.`);
    process.exit(0);
  }
  console.log("[backfill-enrolled-count] verified converged against live user_progress.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-enrolled-count] fatal:", err);
  process.exit(1);
});
