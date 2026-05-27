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
import { and, asc, eq, sql } from "drizzle-orm";
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

    // Race-safe idempotency: pre-read first (fast path), but if a concurrent
    // request slipped a row in between SELECT and INSERT, the (user_id,
    // project_id) unique index (`progress_user_project_idx`) trips with
    // Postgres SQLSTATE 23505 and we recover by re-reading. This preserves
    // the "idempotent under double-click / retry" contract without needing
    // a serializable transaction.
    const findExisting = () => db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, project.id)),
      columns: { id: true, currentStep: true },
    });
    const existing = await findExisting();

    let currentStepNumber: number;
    let created = false;
    if (existing) {
      currentStepNumber = existing.currentStep;
    } else {
      try {
        const [row] = await db.insert(userProgress).values({
          userId: user.id,
          projectId: project.id,
          status: "in_progress",
          startedAt: new Date(),
        }).returning({ currentStep: userProgress.currentStep });
        currentStepNumber = row?.currentStep ?? 1;
        created = true;
        // Phase 39 — durable enrolled_count writer.
        // Atomic SQL-level increment (NOT JS read-modify-write) so concurrent
        // first-enrollments by different users race-safely sum. Fires ONLY on
        // the successful-insert branch — NOT on `existing` (idempotent re-enroll)
        // and NOT on the 23505 recovery path (the parallel request that won the
        // unique-index race already incremented for the same row). The increment
        // is best-effort and intentionally non-blocking on failure: enrolled_count
        // is display/social-proof metadata, not a safety gate (see Phase 38), so
        // a counter-write failure must not 500 the enrollment itself. Operators
        // can re-converge via `pnpm --filter @workspace/scripts run backfill:enrolled-count`.
        try {
          await db.update(projects)
            .set({ enrolledCount: sql`${projects.enrolledCount} + 1` })
            .where(eq(projects.id, project.id));
        } catch (counterErr) {
          req.log.warn({ err: counterErr, projectId: project.id }, "enrolled_count increment failed (non-fatal; run backfill:enrolled-count to reconcile)");
        }
      } catch (insertErr) {
        const code = (insertErr as { code?: string } | null)?.code;
        if (code !== "23505") throw insertErr;
        const winner = await findExisting();
        if (!winner) throw insertErr;
        currentStepNumber = winner.currentStep;
        // created stays false — the parallel request won the race.
      }
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
