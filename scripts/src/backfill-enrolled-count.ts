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

  // Verification re-read — confirm post-state matches the planned target.
  const verify = await db.query.projects.findMany({
    columns: { id: true, slug: true, enrolledCount: true },
  });
  const verifyById = new Map(verify.map((p) => [p.id, p.enrolledCount ?? 0]));
  let mismatches = 0;
  for (const d of drift) {
    if (verifyById.get(d.id) !== d.after) {
      mismatches++;
      console.error(`[backfill-enrolled-count] post-write mismatch on ${d.slug}: expected=${d.after} actual=${verifyById.get(d.id)}`);
    }
  }
  if (mismatches > 0) {
    console.error(`[backfill-enrolled-count] ${mismatches} post-write mismatch(es) — investigate.`);
    process.exit(1);
  }
  console.log("[backfill-enrolled-count] verified converged.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-enrolled-count] fatal:", err);
  process.exit(1);
});
