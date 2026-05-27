/**
 * Phase 32 — Learner-mode selector + adaptive recommender.
 *
 * Two endpoints, both auth-required and scoped to the caller via
 * getCurrentUser(req):
 *
 *   PATCH /api/user/projects/:slug/learning-mode
 *     - Body: { mode: DbLearningMode }
 *     - Updates user_progress.learning_mode for (caller, project-by-slug).
 *     - 400 on invalid mode value; 404 when caller is not enrolled.
 *
 *   GET /api/user/projects/:slug/learning-mode/recommendation
 *     - Reads signals already persisted by Atlas (no schema changes):
 *       prior completed projects, current project attempts + steps passed,
 *       max hint level used.
 *     - Returns the pure recommendation from
 *       @workspace/execution-core's recommendLearnerMode().
 *     - 404 when caller is not enrolled.
 *
 * Hard stops:
 *   - No /check, /submit, hint-policy, or AI-tutor behavior changed —
 *     this route only mutates user_progress.learning_mode. The existing
 *     hints + ai routes already read learning_mode at request time, so
 *     mode changes take effect on the next hint fetch / tutor message
 *     with no other plumbing.
 *   - userId NEVER comes from path/body — always getCurrentUser(req).
 *   - No schema changes.
 */
import { Router } from "express";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { db } from "@workspace/db";
import {
  projects,
  userProgress,
  userStepCompletions,
  userProjectStepHints,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  recommendLearnerMode,
  type DbLearningMode,
} from "@workspace/execution-core";

const router = Router();

const VALID_MODES: ReadonlyArray<DbLearningMode> = [
  "guided",
  "hint",
  "independent",
  "dynamic_ai_adaptive",
];

function isValidMode(v: unknown): v is DbLearningMode {
  return typeof v === "string" && (VALID_MODES as readonly string[]).includes(v);
}

async function loadEnrollment(userId: string, slugParam: unknown) {
  const slug = typeof slugParam === "string" ? slugParam : "";
  if (!slug) return null;
  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
    columns: { id: true, slug: true },
  });
  if (!project) return null;
  const progress = await db.query.userProgress.findFirst({
    where: and(eq(userProgress.userId, userId), eq(userProgress.projectId, project.id)),
    columns: { learningMode: true },
  });
  if (!progress) return null;
  return { project, progress };
}

router.patch("/user/projects/:slug/learning-mode", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const body = (req.body ?? {}) as { mode?: unknown };
    if (!isValidMode(body.mode)) {
      res.status(400).json({ error: "Invalid mode", validModes: VALID_MODES });
      return;
    }

    const ctx = await loadEnrollment(user.id, req.params.slug);
    if (!ctx) { res.status(404).json({ error: "Not enrolled" }); return; }

    await db.update(userProgress)
      .set({ learningMode: body.mode, lastUpdatedAt: new Date() })
      .where(and(
        eq(userProgress.userId, user.id),
        eq(userProgress.projectId, ctx.project.id),
      ));

    res.json({ slug: ctx.project.slug, learningMode: body.mode });
  } catch (err) {
    req.log.error({ err }, "Failed to update learning mode");
    res.status(500).json({ error: "Failed to update learning mode" });
  }
});

router.get("/user/projects/:slug/learning-mode/recommendation", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const ctx = await loadEnrollment(user.id, req.params.slug);
    if (!ctx) { res.status(404).json({ error: "Not enrolled" }); return; }

    const [priorRow, stepRows, hintRow] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` })
        .from(userProgress)
        .where(and(
          eq(userProgress.userId, user.id),
          eq(userProgress.status, "completed"),
        )),
      db.select({
        passedCount: sql<number>`count(*) filter (where ${userStepCompletions.passed})::int`,
        attemptsSum: sql<number>`coalesce(sum(${userStepCompletions.attemptCount}), 0)::int`,
      })
        .from(userStepCompletions)
        .where(and(
          eq(userStepCompletions.userId, user.id),
          eq(userStepCompletions.projectId, ctx.project.id),
        )),
      db.select({ maxLevel: sql<number>`coalesce(max(${userProjectStepHints.hintLevel}), 0)::int` })
        .from(userProjectStepHints)
        .where(and(
          eq(userProjectStepHints.userId, user.id),
          eq(userProjectStepHints.projectId, ctx.project.id),
        )),
    ]);

    const priorCompletedProjects = Math.max(0, Number(priorRow[0]?.n ?? 0));
    const stepsCompleted = Math.max(0, Number(stepRows[0]?.passedCount ?? 0));
    const totalAttempts = Math.max(0, Number(stepRows[0]?.attemptsSum ?? 0));
    // Failed-only attempts: each step row tracks total attempts incl. the
    // final passing attempt. Subtract one per passed step to approximate
    // "failed before pass". Floor at zero.
    const failedAttempts = Math.max(0, totalAttempts - stepsCompleted);
    const hintLevelMax = Math.max(0, Number(hintRow[0]?.maxLevel ?? 0));

    const recommendation = recommendLearnerMode({
      priorCompletedProjects,
      currentProjectAttempts: failedAttempts,
      currentProjectStepsCompleted: stepsCompleted,
      currentProjectHintLevelMax: hintLevelMax,
      currentMode: ctx.progress.learningMode,
    });
    res.json(recommendation);
  } catch (err) {
    req.log.error({ err }, "Failed to compute mode recommendation");
    res.status(500).json({ error: "Failed to compute mode recommendation" });
  }
});

export default router;
