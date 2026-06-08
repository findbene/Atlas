/**
 * Phase 60E — idempotent seed for the local full-stack portfolio-download E2E.
 *
 * Creates a single test learner (clerkId = ATLAS_E2E_AUTH_CLERK_ID) and gives
 * them a COMPLETED record for the live C2 project so the authenticated
 * `GET /api/user/projects/:slug/portfolio-artifact` route returns a real
 * DB-backed bundle. Seeds ONLY learner-side state (user + progress + step
 * completions) — it never touches authored content, validation config,
 * serverGrade rows, or any answer key. Re-runnable; existing rows are reused.
 *
 * Requires DATABASE_URL (Docker PG). The project + steps must already be seeded
 * (`pnpm --filter @workspace/scripts run seed`).
 */
import { db, users, projects, projectSteps, userProgress, userStepCompletions } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const CLERK_ID = process.env.ATLAS_E2E_AUTH_CLERK_ID ?? "e2e_test_user";
const SLUG =
  process.env.ATLAS_E2E_PROJECT_SLUG ??
  "analytics-engineer-semantic-layer-with-dbt-and-duckdb";

async function main(): Promise<void> {
  // 1) Test learner (idempotent on clerkId).
  let user = await db.query.users.findFirst({ where: eq(users.clerkId, CLERK_ID) });
  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        clerkId: CLERK_ID,
        email: `${CLERK_ID}@e2e.atlas.local`,
        name: "E2E Test Learner",
      })
      .returning();
    user = created!;
  }

  // 2) Live, visible project by slug.
  const project = await db.query.projects.findFirst({ where: eq(projects.slug, SLUG) });
  if (!project) {
    throw new Error(
      `[seed-e2e-user] project "${SLUG}" not found — run the main seed first.`,
    );
  }

  const steps = await db.query.projectSteps.findMany({
    where: eq(projectSteps.projectId, project.id),
    orderBy: [asc(projectSteps.stepNumber)],
    columns: { stepNumber: true },
  });

  const now = new Date();
  const startedAt = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago

  // 3) Completed enrollment (idempotent).
  const existingProgress = await db.query.userProgress.findFirst({
    where: and(
      eq(userProgress.userId, user.id),
      eq(userProgress.projectId, project.id),
    ),
  });
  if (!existingProgress) {
    await db.insert(userProgress).values({
      userId: user.id,
      projectId: project.id,
      status: "completed",
      currentStep: Math.max(1, steps.length),
      completionPercent: 100,
      startedAt,
      completedAt: now,
    });
  } else {
    await db
      .update(userProgress)
      .set({ status: "completed", completionPercent: 100, completedAt: now })
      .where(eq(userProgress.id, existingProgress.id));
  }

  // 4) Passed step completions with a deterministic evidence hash (idempotent).
  //    A non-null submission_sha256 makes the artifact's evidenceHashCount > 0
  //    WITHOUT writing any real submission content or spec.
  let inserted = 0;
  for (const s of steps) {
    const existing = await db.query.userStepCompletions.findFirst({
      where: and(
        eq(userStepCompletions.userId, user.id),
        eq(userStepCompletions.projectId, project.id),
        eq(userStepCompletions.stepNumber, s.stepNumber),
      ),
    });
    if (existing) continue;
    await db.insert(userStepCompletions).values({
      userId: user.id,
      projectId: project.id,
      stepNumber: s.stepNumber,
      passed: true,
      completedAt: now,
      submissionSha256: `e2e${String(s.stepNumber).padStart(2, "0")}`.padEnd(64, "0"),
    });
    inserted += 1;
  }

  console.log(
    `[seed-e2e-user] OK — user=${user.id} clerk=${CLERK_ID} project=${SLUG} steps=${steps.length} newCompletions=${inserted}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-e2e-user] FAIL", err);
  process.exit(1);
});
