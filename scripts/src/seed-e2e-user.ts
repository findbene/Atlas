/**
 * Phase 60E/60F — idempotent seed for the local full-stack portfolio-download E2E.
 *
 * Creates a single test learner (clerkId = ATLAS_E2E_AUTH_CLERK_ID) for the live
 * C2 project so the authenticated `GET /api/user/projects/:slug/portfolio-artifact`
 * route returns a real DB-backed bundle. Seeds ONLY learner-side state (user +
 * progress + step completions) — it never touches authored content, validation
 * config, serverGrade rows, or any answer key. Re-runnable.
 *
 * Two modes:
 *   - default: a COMPLETED record for every step (the 60E download demo — the
 *     artifact has no submission snapshot, so it honestly degrades to
 *     "code not included").
 *   - ATLAS_E2E_FRESH_SUBMIT=1 (Phase 60F): enroll IN-PROGRESS and clear this
 *     learner's completions + portfolio snapshots for the project, leaving every
 *     step UN-passed so a subsequent real `/submit` is a genuine FRESH pass that
 *     writes a durable snapshot — the precondition for the browser
 *     fresh-submit → snapshot → download verification. Only this synthetic
 *     learner's own transient rows are cleared; authored content is untouched.
 *
 * Requires DATABASE_URL (Docker PG). The project + steps must already be seeded
 * (`pnpm --filter @workspace/scripts run seed`).
 */
import { db, users, projects, projectSteps, userProgress, userStepCompletions, portfolioSubmissionSnapshots } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const CLERK_ID = process.env.ATLAS_E2E_AUTH_CLERK_ID ?? "e2e_test_user";
const SLUG =
  process.env.ATLAS_E2E_PROJECT_SLUG ??
  "analytics-engineer-semantic-layer-with-dbt-and-duckdb";
const FRESH_SUBMIT = process.env.ATLAS_E2E_FRESH_SUBMIT === "1";

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

  const existingProgress = await db.query.userProgress.findFirst({
    where: and(
      eq(userProgress.userId, user.id),
      eq(userProgress.projectId, project.id),
    ),
  });

  if (FRESH_SUBMIT) {
    // Phase 60F — clean-slate enrollment for the browser fresh-submit run.
    // Enroll IN-PROGRESS and clear THIS learner's own transient evidence for
    // the project, so the target server-graded step is un-passed and a real
    // `/submit` is a genuine FRESH pass that writes a durable snapshot. Only
    // this synthetic learner's rows are removed; authored content is untouched.
    await db
      .delete(portfolioSubmissionSnapshots)
      .where(
        and(
          eq(portfolioSubmissionSnapshots.userId, user.id),
          eq(portfolioSubmissionSnapshots.projectId, project.id),
        ),
      );
    await db
      .delete(userStepCompletions)
      .where(
        and(
          eq(userStepCompletions.userId, user.id),
          eq(userStepCompletions.projectId, project.id),
        ),
      );
    if (!existingProgress) {
      await db.insert(userProgress).values({
        userId: user.id,
        projectId: project.id,
        status: "in_progress",
        currentStep: 1,
        completionPercent: 0,
        startedAt,
      });
    } else {
      await db
        .update(userProgress)
        .set({ status: "in_progress", completionPercent: 0, completedAt: null })
        .where(eq(userProgress.id, existingProgress.id));
    }
    console.log(
      `[seed-e2e-user] OK (FRESH_SUBMIT) — user=${user.id} clerk=${CLERK_ID} project=${SLUG} enrolled in_progress, completions+snapshots cleared (${steps.length} steps un-passed)`,
    );
    process.exit(0);
  }

  // ── Default mode: COMPLETED record for every step (60E download demo) ──
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

  // Passed step completions with a deterministic evidence hash (idempotent).
  // A non-null submission_sha256 makes the artifact's evidenceHashCount > 0
  // WITHOUT writing any real submission content or spec.
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
