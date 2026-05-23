/**
 * Phase 21 — Slug-based enrollment overlay.
 *
 * POST /api/enrollments  body: { projectSlug }
 *
 * Idempotent thin wrapper around the existing UUID-based
 * `POST /api/user/projects/:projectId/enroll` flow. Resolves slug → projectId,
 * enforces `learner_visible=true` (hidden/archived slugs return 404 with no
 * existence leak), and creates a `user_progress` row only if one does not
 * already exist for `(userId, projectId)`. Reuses the existing unique index
 * `progress_user_project_idx (user_id, project_id)` for idempotency.
 */
import { Router } from "express";
import { db, projects, projectSteps, userProgress } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";

const router = Router();

router.post("/enrollments", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const projectSlug = typeof req.body?.projectSlug === "string" ? req.body.projectSlug.trim() : "";
    if (!projectSlug) {
      res.status(400).json({ error: "Invalid request body", message: "projectSlug is required" });
      return;
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, projectSlug),
      columns: { id: true, slug: true, isPremium: true, learnerVisible: true, totalSteps: true },
    });
    // Hidden/archived and missing slugs both return 404 — no existence leak.
    if (!project || project.learnerVisible !== true) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (project.isPremium && user.subscriptionTier !== "pro") {
      res.status(403).json({ error: "Forbidden", message: "This project requires a Pro subscription" });
      return;
    }

    const existing = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, project.id)),
      columns: { id: true, currentStep: true },
    });

    let currentStepNumber: number;
    let created = false;
    if (existing) {
      currentStepNumber = existing.currentStep;
    } else {
      const [row] = await db.insert(userProgress).values({
        userId: user.id,
        projectId: project.id,
        status: "in_progress",
        startedAt: new Date(),
      }).returning({ currentStep: userProgress.currentStep });
      currentStepNumber = row?.currentStep ?? 1;
      created = true;
    }

    // Resolve the step UUID for the learner's current position so the
    // frontend can deep-link directly into the workspace.
    const step = await db.query.projectSteps.findFirst({
      where: and(eq(projectSteps.projectId, project.id), eq(projectSteps.stepNumber, currentStepNumber)),
      orderBy: [asc(projectSteps.stepNumber)],
      columns: { id: true },
    });

    res.json({
      projectId: project.id,
      projectSlug: project.slug,
      currentStepNumber,
      currentStepId: step?.id ?? null,
      created,
    });
  } catch (err) {
    req.log.error({ err }, "Phase 21 enrollment failed");
    res.status(500).json({ error: "Failed to enroll" });
  }
});

export default router;
