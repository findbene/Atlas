/**
 * Phase 26 — Audit-only script. READ-ONLY.
 *
 * Identifies legacy `user_progress` rows where `status='completed'` but
 * the learner has NOT actually passed every required step. This is the
 * exact integrity hole Phase 26 closes going forward (H2 in the plan):
 * the pre-P26 /submit route flipped status→completed whenever the LAST
 * step passed, regardless of prior steps. This script reports any rows
 * created under that broken contract.
 *
 * NO MUTATIONS. NO REPAIR. NO BACKFILL. Output only.
 *
 * Run: `pnpm --filter @workspace/scripts run audit:bad-completions`
 */
import {
  db,
  userProgress,
  userStepCompletions,
  projects,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

async function main() {
  const completed = await db
    .select({
      userId: userProgress.userId,
      projectId: userProgress.projectId,
      completedAt: userProgress.completedAt,
      totalSteps: projects.totalSteps,
      projectSlug: projects.slug,
    })
    .from(userProgress)
    .innerJoin(projects, eq(userProgress.projectId, projects.id))
    .where(eq(userProgress.status, "completed"));

  const rows: Array<{
    userId: string;
    projectId: string;
    projectSlug: string;
    passedCount: number;
    totalSteps: number;
    completedAt: string | null;
  }> = [];

  for (const c of completed) {
    const [{ passedCount }] = await db
      .select({ passedCount: sql<number>`count(*)::int` })
      .from(userStepCompletions)
      .where(
        and(
          eq(userStepCompletions.userId, c.userId),
          eq(userStepCompletions.projectId, c.projectId),
          eq(userStepCompletions.passed, true),
        ),
      );

    if (passedCount < c.totalSteps) {
      rows.push({
        userId: c.userId,
        projectId: c.projectId,
        projectSlug: c.projectSlug,
        passedCount,
        totalSteps: c.totalSteps,
        completedAt: c.completedAt?.toISOString() ?? null,
      });
    }
  }

  console.log("=".repeat(60));
  console.log("Phase 26 — Bad-completion audit (READ-ONLY)");
  console.log("=".repeat(60));
  console.log(`Total completed user_progress rows:   ${completed.length}`);
  console.log(`Rows with passedCount < totalSteps:   ${rows.length}`);
  console.log("");

  if (rows.length === 0) {
    console.log("✓ No legacy bad completions detected.");
    return;
  }

  console.log(
    "userId                                | projectSlug                              | passed/total | completedAt",
  );
  console.log("-".repeat(120));
  for (const r of rows) {
    console.log(
      `${r.userId} | ${r.projectSlug.padEnd(40)} | ${String(
        r.passedCount,
      ).padStart(2)}/${String(r.totalSteps).padEnd(2)}       | ${r.completedAt ?? "(null)"}`,
    );
  }
  console.log("");
  console.log(
    "NOTE: This script does NOT mutate. Repair, if desired, is a separate decision.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
