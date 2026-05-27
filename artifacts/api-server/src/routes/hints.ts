import { Router } from "express";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { db } from "@workspace/db";
import {
  projects,
  projectSteps,
  userProjectStepHints,
  userProgress,
  userStepCompletions,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  hintsUpTo,
  availableHintLevels,
  evaluateHintPolicy,
  toAtlasLearnerMode,
  MAX_HINT_LEVEL,
  type PedagogyConfig,
} from "@workspace/execution-core";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type HintResponse = {
  level: number;
  maxLevel: number;
  availableLevels: number;
  contents: string[];
  finalExplanation: string | null;
  successFeedback: string | null;
  failureFeedback: string | null;
  portfolioRelevance: string | null;
  canEscalate: boolean;
  shouldOffer: boolean;
  mode: ReturnType<typeof toAtlasLearnerMode>;
  attemptCount: number;
  stepPassed: boolean;
};

async function loadContext(slugParam: unknown, stepIdParam: unknown) {
  const slug = typeof slugParam === "string" ? slugParam : "";
  const stepId = typeof stepIdParam === "string" ? stepIdParam : "";
  if (!slug || !UUID_RE.test(stepId)) return null;
  const project = await db.query.projects.findFirst({ where: eq(projects.slug, slug) });
  if (!project) return null;
  const step = await db.query.projectSteps.findFirst({
    where: and(eq(projectSteps.id, stepId), eq(projectSteps.projectId, project.id)),
  });
  if (!step) return null;
  return { project, step };
}

async function buildHintResponse(opts: {
  userId: string;
  projectId: string;
  stepId: string;
  stepNumber: number;
  pedagogy: PedagogyConfig | null | undefined;
}): Promise<HintResponse> {
  const { userId, projectId, stepId, stepNumber, pedagogy } = opts;

  // Persisted hint level (may not exist yet)
  const existing = await db.query.userProjectStepHints.findFirst({
    where: and(
      eq(userProjectStepHints.userId, userId),
      eq(userProjectStepHints.stepId, stepId),
    ),
  });
  const currentLevel = existing?.hintLevel ?? 0;

  // Mode (DB enum -> Atlas label)
  const progressRow = await db.query.userProgress.findFirst({
    where: and(eq(userProgress.userId, userId), eq(userProgress.projectId, projectId)),
    columns: { learningMode: true },
  });
  const mode = toAtlasLearnerMode(progressRow?.learningMode ?? "guided");

  // Attempt count for this step (failed only) + whether passed
  const completions = await db.query.userStepCompletions.findMany({
    where: and(
      eq(userStepCompletions.userId, userId),
      eq(userStepCompletions.projectId, projectId),
      eq(userStepCompletions.stepNumber, stepNumber),
    ),
    columns: { passed: true, attemptCount: true },
  });
  const stepPassed = completions.some(c => c.passed);
  const attemptCount = completions.reduce((sum, c) => sum + (c.attemptCount ?? 0), 0);
  const lastValidationFailed = completions.length > 0 && !completions[completions.length - 1]!.passed;

  const policy = evaluateHintPolicy({
    mode, attemptCount, currentLevel, lastValidationFailed, stepPassed,
  });

  const availableLevels = availableHintLevels(pedagogy ?? null);
  const contents = hintsUpTo(pedagogy ?? null, currentLevel);

  // Final explanation gated to L5 OR step passed (review).
  const finalExplanation = policy.allowFullExplanation
    ? (pedagogy?.finalExplanation ?? null)
    : null;

  return {
    level: currentLevel,
    maxLevel: MAX_HINT_LEVEL,
    availableLevels,
    contents,
    finalExplanation,
    successFeedback: pedagogy?.successFeedback ?? null,
    failureFeedback: pedagogy?.failureFeedback ?? null,
    portfolioRelevance: pedagogy?.portfolioRelevance ?? null,
    canEscalate: currentLevel < Math.min(MAX_HINT_LEVEL, availableLevels),
    shouldOffer: policy.shouldOffer,
    mode,
    attemptCount,
    stepPassed,
  };
}

// GET current hint state for (user, step)
router.get("/projects/:slug/steps/:stepId/hint", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const ctx = await loadContext(req.params.slug, req.params.stepId);
    if (!ctx) { res.status(404).json({ error: "Not found" }); return; }
    const out = await buildHintResponse({
      userId: user.id,
      projectId: ctx.project.id,
      stepId: ctx.step.id,
      stepNumber: ctx.step.stepNumber,
      pedagogy: (ctx.step.pedagogyConfig ?? null) as PedagogyConfig | null,
    });
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "Failed to get hint state");
    res.status(500).json({ error: "Failed to get hint state" });
  }
});

// POST escalate hint level. Atomic upsert via ON CONFLICT, capped at the
// number of populated hint levels for this step. Honors the per-mode policy
// — e.g. adaptive_inquiry_ai_assisted may jump straight to L3 after two
// failed attempts instead of plain +1 — so the server, not the UI, is the
// source of truth for the next level.
router.post("/projects/:slug/steps/:stepId/hint/next", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const ctx = await loadContext(req.params.slug, req.params.stepId);
    if (!ctx) { res.status(404).json({ error: "Not found" }); return; }

    const pedagogy = (ctx.step.pedagogyConfig ?? null) as PedagogyConfig | null;
    const cap = Math.min(MAX_HINT_LEVEL, availableHintLevels(pedagogy));

    // Read current state needed to compute the policy-suggested target.
    const [existing, progressRow, completions] = await Promise.all([
      db.query.userProjectStepHints.findFirst({
        where: and(
          eq(userProjectStepHints.userId, user.id),
          eq(userProjectStepHints.stepId, ctx.step.id),
        ),
        columns: { hintLevel: true },
      }),
      db.query.userProgress.findFirst({
        where: and(
          eq(userProgress.userId, user.id),
          eq(userProgress.projectId, ctx.project.id),
        ),
        columns: { learningMode: true },
      }),
      db.query.userStepCompletions.findMany({
        where: and(
          eq(userStepCompletions.userId, user.id),
          eq(userStepCompletions.projectId, ctx.project.id),
          eq(userStepCompletions.stepNumber, ctx.step.stepNumber),
        ),
        columns: { passed: true, attemptCount: true },
      }),
    ]);

    const currentLevel = existing?.hintLevel ?? 0;
    const stepPassed = completions.some(c => c.passed);
    const attemptCount = completions.reduce((s, c) => s + (c.attemptCount ?? 0), 0);
    const lastValidationFailed = completions.length > 0 && !completions[completions.length - 1]!.passed;
    const policy = evaluateHintPolicy({
      mode: toAtlasLearnerMode(progressRow?.learningMode ?? "guided"),
      attemptCount, currentLevel, lastValidationFailed, stepPassed,
    });
    const desired = Math.min(cap, Math.max(currentLevel + 1, policy.suggestedLevel));

    // Atomic upsert. ON CONFLICT clamps to LEAST(cap, max(existing+1, desired))
    // so two concurrent requests can't double-increment past the cap or drop
    // updates, and we never go backwards.
    await db.insert(userProjectStepHints)
      .values({
        userId: user.id,
        projectId: ctx.project.id,
        stepId: ctx.step.id,
        hintLevel: desired,
      })
      .onConflictDoUpdate({
        target: [userProjectStepHints.userId, userProjectStepHints.stepId],
        set: {
          hintLevel: sql`LEAST(${cap}::int, GREATEST(${userProjectStepHints.hintLevel} + 1, ${desired}::int))`,
          updatedAt: new Date(),
        },
      });

    // Phase 34 — structured telemetry. Schema-free (no DB writes).
    // Captures who escalated, on which project/step, from which mode,
    // and to which level. Drives the same admin dashboards as
    // ai.tutor.request without per-user PII beyond local users.id.
    req.log.info(
      {
        evt: "hint.escalate",
        userId: user.id,
        projectId: ctx.project.id,
        projectSlug: ctx.project.slug,
        stepId: ctx.step.id,
        mode: toAtlasLearnerMode(progressRow?.learningMode ?? "guided"),
        priorLevel: currentLevel,
        desiredLevel: desired,
        cap,
        attemptCount,
        lastValidationFailed,
        stepPassed,
      },
      "hint.escalate",
    );

    const out = await buildHintResponse({
      userId: user.id,
      projectId: ctx.project.id,
      stepId: ctx.step.id,
      stepNumber: ctx.step.stepNumber,
      pedagogy,
    });
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "Failed to advance hint");
    res.status(500).json({ error: "Failed to advance hint" });
  }
});

export default router;
