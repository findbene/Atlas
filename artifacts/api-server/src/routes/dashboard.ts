/**
 * Phase 21 — Single-call learner dashboard payload.
 *
 * GET /api/dashboard
 *
 * Returns:
 *   - resume                : most recently-updated in-progress enrollment, or null
 *   - inProgress / completed: enrollments joined to `projects`, filtered to
 *                             `learner_visible = true` so hidden/archived
 *                             rows never leak (symmetric with /api/courses/:slug)
 *   - recommendedStartHere  : Start Here for `data-engineering` (the flagship)
 *                             when the learner has zero enrollments; otherwise null
 *
 * `recommendedStartHere` reuses the existing `pickStartHere` helper — no new
 * recommendation logic, no rubric/anchor knowledge, no heuristic course
 * inference. The dashboard exists to read, never to mutate.
 */
import { Router } from "express";
import { db, projects, userProgress } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { pickStartHere, type StartHereCandidate } from "../lib/startHere";

const router = Router();

const RECOMMENDED_FIRST_COURSE = "data-engineering";

type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  course: string | null;
  difficultyLevel: string;
  totalSteps: number;
  estimatedMinutes: number;
};

function toLearnerDifficulty(d: string): "beginner" | "intermediate" | "advanced" {
  if (d === "beginner" || d === "intermediate" || d === "advanced") return d;
  // `expert` rows are not learner-visible by invariant. Defensive default.
  return "advanced";
}

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const progressRows = await db.query.userProgress.findMany({
      where: eq(userProgress.userId, user.id),
      orderBy: [desc(userProgress.lastUpdatedAt)],
    });

    const projectIds = Array.from(new Set(progressRows.map(p => p.projectId)));
    const projectRows: ProjectRow[] = projectIds.length
      ? ((await db.query.projects.findMany({
          where: and(eq(projects.learnerVisible, true)),
          columns: {
            id: true, slug: true, title: true, shortDescription: true,
            course: true, difficultyLevel: true, totalSteps: true, estimatedMinutes: true,
          },
        })) as unknown as ProjectRow[]).filter(p => projectIds.includes(p.id))
      : [];
    const projectsById = new Map(projectRows.map(p => [p.id, p]));

    // `projectsById.get(...)` will miss for hidden/archived projects — those
    // are correctly excluded from the dashboard payload (no leak).
    const enriched = progressRows.flatMap(prog => {
      const p = projectsById.get(prog.projectId);
      if (!p) return [];
      return [{
        progress: prog,
        project: p,
      }];
    });

    const toEnrollment = (e: typeof enriched[number]) => ({
      projectId: e.project.id,
      projectSlug: e.project.slug,
      projectTitle: e.project.title,
      shortDescription: e.project.shortDescription ?? "",
      course: e.project.course ?? "data-engineering",
      difficulty: toLearnerDifficulty(e.project.difficultyLevel),
      status: e.progress.status === "completed" ? "completed" as const : "in_progress" as const,
      currentStep: e.progress.currentStep,
      totalSteps: e.project.totalSteps,
      completionPercent: e.progress.completionPercent,
      startedAt: e.progress.startedAt ? e.progress.startedAt.toISOString() : null,
      lastUpdatedAt: e.progress.lastUpdatedAt.toISOString(),
      completedAt: e.progress.completedAt ? e.progress.completedAt.toISOString() : null,
    });

    const inProgressList = enriched
      .filter(e => e.progress.status === "in_progress")
      .map(toEnrollment);
    const completedList = enriched
      .filter(e => e.progress.status === "completed")
      .map(toEnrollment);

    const resumeSrc = enriched.find(e => e.progress.status === "in_progress");
    const resume = resumeSrc
      ? {
          projectId: resumeSrc.project.id,
          projectSlug: resumeSrc.project.slug,
          projectTitle: resumeSrc.project.title,
          course: resumeSrc.project.course ?? "data-engineering",
          currentStep: resumeSrc.progress.currentStep,
          totalSteps: resumeSrc.project.totalSteps,
          completionPercent: resumeSrc.progress.completionPercent,
          lastUpdatedAt: resumeSrc.progress.lastUpdatedAt.toISOString(),
        }
      : null;

    // Onboarding-time recommendation: only fire for truly fresh learners.
    let recommendedStartHere = null;
    if (enriched.length === 0) {
      const courseRows = await db.query.projects.findMany({
        where: and(eq(projects.learnerVisible, true), eq(projects.course, RECOMMENDED_FIRST_COURSE)),
        columns: {
          id: true, slug: true, title: true, shortDescription: true,
          difficultyLevel: true, totalSteps: true, estimatedMinutes: true,
          isPremium: true, xpReward: true, enrolledCount: true, completionRate: true,
          tags: true, orderIndex: true,
        },
      });
      const candidates: StartHereCandidate[] = courseRows.map(r => ({
        slug: r.slug,
        title: r.title,
        difficulty: r.difficultyLevel,
        estimatedHours: r.estimatedMinutes / 60,
        stepCount: r.totalSteps,
      }));
      const picked = pickStartHere(candidates);
      if (picked) {
        const full = courseRows.find(r => r.slug === picked.project.slug)!;
        recommendedStartHere = {
          courseSlug: RECOMMENDED_FIRST_COURSE,
          startHere: {
            project: {
              id: full.id,
              slug: full.slug,
              title: full.title,
              description: full.shortDescription ?? "",
              difficulty: full.difficultyLevel,
              tier: full.isPremium ? "pro" : "free",
              xpReward: full.xpReward,
              estimatedHours: full.estimatedMinutes / 60,
              stepCount: full.totalSteps,
              enrolledCount: full.enrolledCount,
              completionRate: Number(full.completionRate ?? 0),
              tags: full.tags ?? [],
              position: full.orderIndex,
            },
            kind: picked.kind,
            reasonKey: picked.reasonKey,
            hasBeginner: picked.hasBeginner,
          },
        };
      }
    }

    res.json({
      resume,
      inProgress: inProgressList,
      completed: completedList,
      recommendedStartHere,
    });
  } catch (err) {
    req.log.error({ err }, "Phase 21 dashboard failed");
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

export default router;
