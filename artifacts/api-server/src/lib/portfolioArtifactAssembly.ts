/**
 * Phase 60B — safe assembly of `PortfolioArtifactInput` from the database.
 *
 * This is the no-leak chokepoint between the durable records and the pure
 * Phase-60A generator. It reads ONLY safe columns; `validationConfig` is read
 * solely to derive the narrow `serverGradeFlag` boolean (via the canonical
 * `isServerGradeOptedIn`) and is NEVER returned — so no spec, expectedRows,
 * expectedRowsHash, reference query, comparator internal, or answer key can
 * reach the artifact. Privacy posture mirrors `routes/user-portfolio.ts` and
 * `routes/cert-verify.ts`:
 *   - userId comes from the authenticated session (the caller), never params.
 *   - the project must be learner-visible AND not soft-deleted, else `null`
 *     (the route turns `null` into 404 — no hidden-project existence leak).
 *   - the user must be enrolled in / have completed the project, else `null`.
 *   - only THIS user's completion/evidence is read; aggregates are scoped to
 *     (userId, projectId).
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  projects,
  projectSteps,
  userProgress,
  userStepCompletions,
  portfolioSubmissionSnapshots,
  xpTransactions,
} from "@workspace/db";
import { isServerGradeOptedIn } from "./grading";
import type {
  PortfolioArtifactInput,
  PortfolioStepEvidence,
} from "./portfolioArtifact";

function toLearnerDifficulty(
  d: string,
): "beginner" | "intermediate" | "advanced" {
  if (d === "beginner" || d === "intermediate" || d === "advanced") return d;
  return "advanced";
}

function pickTopRole(jobOutcomes: unknown): string | null {
  if (!jobOutcomes || typeof jobOutcomes !== "object") return null;
  const roles = (jobOutcomes as { roles?: unknown }).roles;
  if (!Array.isArray(roles) || roles.length === 0) return null;
  const first = roles[0];
  return typeof first === "string" ? first : null;
}

/**
 * Assemble the safe artifact input for (userId, projectSlug), or `null` if the
 * project is not visible/accessible to this user. `generatedAtIso` is passed
 * in by the route (the pure generator stays deterministic).
 */
export async function assemblePortfolioArtifactInput(
  userId: string,
  projectSlug: string,
  generatedAtIso: string,
): Promise<PortfolioArtifactInput | null> {
  // 1) Visible, non-deleted project by slug. A hidden/deleted/unknown slug
  //    returns null → 404 (no existence leak).
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.slug, projectSlug),
      eq(projects.learnerVisible, true),
      isNull(projects.deletedAt),
    ),
  });
  if (!project) return null;

  // 2) The caller must be enrolled in / have completed THIS project.
  const progress = await db.query.userProgress.findFirst({
    where: and(
      eq(userProgress.userId, userId),
      eq(userProgress.projectId, project.id),
    ),
  });
  if (!progress) return null;

  // 3-6) These four reads are independent once project.id is known — run them
  //      concurrently. (3) steps carry safe metadata + validationConfig used
  //      ONLY to derive the narrow serverGrade boolean (never returned); (4)
  //      this user's completions; (5) snapshot availability (presence only —
  //      never the excerpt/hash content); (6) project-scoped XP rollup.
  const [steps, completions, snapshots, xpAgg] = await Promise.all([
    db.query.projectSteps.findMany({
      where: eq(projectSteps.projectId, project.id),
      orderBy: [asc(projectSteps.stepNumber)],
      columns: {
        id: true,
        stepNumber: true,
        title: true,
        validationType: true,
        validationConfig: true,
        requiredSkill: true,
      },
    }),
    db.query.userStepCompletions.findMany({
      where: and(
        eq(userStepCompletions.userId, userId),
        eq(userStepCompletions.projectId, project.id),
      ),
    }),
    db.query.portfolioSubmissionSnapshots.findMany({
      where: and(
        eq(portfolioSubmissionSnapshots.userId, userId),
        eq(portfolioSubmissionSnapshots.projectId, project.id),
      ),
      columns: { submissionSha256: true, runtimeOutputSha256: true },
    }),
    db
      .select({
        total: sql<number>`coalesce(sum(${xpTransactions.amount}), 0)::int`,
      })
      .from(xpTransactions)
      .where(
        and(
          eq(xpTransactions.userId, userId),
          sql`${xpTransactions.metadata}->>'projectId' = ${project.id}`,
        ),
      ),
  ]);

  const completionByStep = new Map(completions.map((c) => [c.stepNumber, c]));
  // `submitted*Available` come from the Phase-60B snapshot store (presence of a
  // durable code/output snapshot). `evidenceHashCount` below is a SEPARATE,
  // older signal derived from user_step_completions.submission_sha256 (same as
  // cert-verify.ts) — two distinct durable stores feeding two adjacent numbers.
  const submittedCodeAvailable = snapshots.some(
    (s) => s.submissionSha256 != null,
  );
  const submittedOutputAvailable = snapshots.some(
    (s) => s.runtimeOutputSha256 != null,
  );
  const totalXpEarned = xpAgg[0]?.total ?? 0;

  const totalSteps = Math.max(0, project.totalSteps ?? 0);

  // Only steps the user has actually attempted are evidence-bearing. Each is
  // classified by the canonical predicate; the generator renders a non-passed
  // attempt as "unavailable".
  const stepEvidence: PortfolioStepEvidence[] = steps
    .filter((s) => completionByStep.has(s.stepNumber))
    .map((s) => {
      const c = completionByStep.get(s.stepNumber)!;
      return {
        stepNumber: s.stepNumber,
        title: s.title,
        validationKind: s.validationType ?? "self_attest",
        serverGradeFlag: isServerGradeOptedIn(s.validationType, s.validationConfig),
        passed: c.passed === true,
        completedAt: c.completedAt ? c.completedAt.toISOString() : null,
        requiredSkill: s.requiredSkill ?? null,
      };
    });

  const passedCompletions = completions.filter((c) => c.passed === true);
  // Defensive clamps (same invariants as cert-verify.ts / user-portfolio.ts):
  // stepsCompleted <= totalSteps; evidenceHashCount <= stepsCompleted.
  const stepsCompleted = Math.max(
    0,
    Math.min(passedCompletions.length, totalSteps),
  );
  const evidenceHashCount = Math.max(
    0,
    Math.min(
      passedCompletions.filter((c) => c.submissionSha256 != null).length,
      stepsCompleted,
    ),
  );

  const completedAt =
    progress.status === "completed" ? progress.completedAt : null;

  const firstPassedAt = passedCompletions.reduce<Date | null>((min, c) => {
    if (!c.completedAt) return min;
    return !min || c.completedAt < min ? c.completedAt : min;
  }, null);
  let durationSeconds: number | null = null;
  if (firstPassedAt && completedAt) {
    const seconds = Math.floor(
      (completedAt.getTime() - firstPassedAt.getTime()) / 1000,
    );
    durationSeconds = seconds >= 0 ? seconds : 0;
  }

  return {
    project: {
      title: project.title,
      slug: project.slug,
      course: project.course,
      role: pickTopRole(project.jobOutcomes),
      difficulty: toLearnerDifficulty(project.difficultyLevel),
      summary: project.shortDescription,
      skills: project.learningObjectives ?? [],
      tools: project.techStack ?? [],
      totalSteps,
    },
    completion: {
      completedAt: completedAt ? completedAt.toISOString() : null,
      durationSeconds,
      stepsCompleted,
      totalSteps,
      evidenceHashCount,
      totalXpEarned,
      certId: progress.id,
      verifyUrl: `/verify/${progress.id}`,
    },
    steps: stepEvidence,
    submittedCodeAvailable,
    submittedOutputAvailable,
    generatedAtIso,
  };
}
