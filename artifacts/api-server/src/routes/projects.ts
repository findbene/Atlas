import { Router } from "express";
import { db } from "@workspace/db";
import { projects, projectSteps, projectHints, domains, projectSolutions } from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { userProgress, userStepCompletions } from "@workspace/db";

const router = Router();

router.get("/projects", async (req, res) => {
  try {
    const { domainSlug, difficulty, tier, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    let domainId: string | undefined;
    if (domainSlug) {
      const domain = await db.query.domains.findFirst({ where: eq(domains.slug, domainSlug) });
      domainId = domain?.id;
    }

    const allProjects = await db.query.projects.findMany({
      where: (p, { and, eq, isNull }) => and(
        isNull(p.deletedAt),
        domainId ? eq(p.domainId, domainId) : undefined,
        difficulty ? eq(p.difficultyLevel, difficulty as any) : undefined,
        tier === "free" ? eq(p.isPremium, false) : tier === "pro" ? eq(p.isPremium, true) : undefined,
      ),
      orderBy: (p, { asc }) => [asc(p.orderIndex)],
      limit: limitNum,
      offset,
    });

    const total = allProjects.length;
    const result = allProjects.map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.shortDescription,
      difficulty: p.difficultyLevel,
      tier: p.isPremium ? "pro" : "free",
      xpReward: p.xpReward,
      estimatedHours: Math.round(p.estimatedMinutes / 60 * 10) / 10,
      stepCount: p.totalSteps,
      enrolledCount: p.enrolledCount,
      completionRate: p.completionRate,
      tags: p.tags ?? [],
      position: p.orderIndex,
      jobOutcomes: p.jobOutcomes ?? undefined,
    }));

    res.json({ data: result, total, page: pageNum, limit: limitNum, hasMore: offset + limitNum < total + limitNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list projects");
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// GET /projects/resume — the user's most recently-touched in-progress project,
// for the dashboard "Resume where you left off" banner. Returns 204 if there's
// nothing in progress.
router.get("/projects/resume", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rows = await db.query.userProgress.findMany({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.status, "in_progress")),
      orderBy: [desc(userProgress.lastUpdatedAt)],
      limit: 1,
    });
    const row = rows[0];
    if (!row) {
      res.status(204).end();
      return;
    }
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, row.projectId),
      columns: { id: true, slug: true, title: true, totalSteps: true, shortDescription: true },
    });
    if (!project) {
      res.status(204).end();
      return;
    }
    res.json({
      projectId: project.id,
      projectSlug: project.slug,
      projectTitle: project.title,
      shortDescription: project.shortDescription,
      currentStep: row.currentStep,
      totalSteps: project.totalSteps,
      completionPercent: row.completionPercent,
      lastUpdatedAt: row.lastUpdatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load resume project");
    res.status(500).json({ error: "Failed to load resume" });
  }
});

// GET /projects/:slug/solution — Pro-gated reference solution. Free users
// receive 402 (Payment Required) so the UI can render an upsell. We also
// only reveal solutions for projects where the user has progressed at least
// one step — this keeps the gate from being trivially bypassed by users who
// want to copy the solution without engaging with the project at all.
router.get("/projects/:slug/solution", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const slug = String(req.params.slug);
    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
      columns: { id: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (user.subscriptionTier !== "pro") {
      res.status(402).json({
        error: "Pro plan required",
        message: "Reference solutions are a Pro feature. Upgrade to view.",
      });
      return;
    }
    // Engagement gate: require at least one completed step (or any progress
    // row past step 1) before revealing.
    const progress = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, project.id)),
    });
    const attempts = await db.query.userStepCompletions.findMany({
      where: and(eq(userStepCompletions.userId, user.id), eq(userStepCompletions.projectId, project.id)),
      limit: 1,
    });
    if (!progress || (progress.currentStep <= 1 && attempts.length === 0)) {
      res.status(403).json({
        error: "Try the project first",
        message: "Attempt at least one step before viewing the reference solution.",
      });
      return;
    }

    const solution = await db.query.projectSolutions.findFirst({
      where: eq(projectSolutions.projectId, project.id),
    });
    if (!solution) {
      res.status(404).json({
        error: "No solution available",
        message: "A reference solution hasn't been published for this project yet.",
      });
      return;
    }
    res.json({
      solutionCode: solution.solutionCode,
      explanationMd: solution.solutionExplanationMd,
      videoUrl: solution.videoExplanationUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load solution");
    res.status(500).json({ error: "Failed to load solution" });
  }
});

router.get("/projects/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.slug, slug)),
    });
    if (!project) {
      res.status(404).json({ error: "Not found", message: "Project not found" });
      return;
    }
    const steps = await db.query.projectSteps.findMany({
      where: eq(projectSteps.projectId, project.id),
      orderBy: (s, { asc }) => [asc(s.stepNumber)],
    });
    const domain = await db.query.domains.findFirst({ where: eq(domains.id, project.domainId) });

    res.json({
      id: project.id,
      slug: project.slug,
      title: project.title,
      description: project.shortDescription,
      longDescription: project.fullDescription,
      difficulty: project.difficultyLevel,
      tier: project.isPremium ? "pro" : "free",
      xpReward: project.xpReward,
      estimatedHours: Math.round(project.estimatedMinutes / 60 * 10) / 10,
      stepCount: project.totalSteps,
      enrolledCount: project.enrolledCount,
      completionRate: project.completionRate,
      tags: project.tags ?? [],
      position: project.orderIndex,
      learningObjectives: project.learningObjectives ?? [],
      prerequisites: project.prerequisites ?? [],
      domainSlug: domain?.slug ?? "data-engineering",
      domainName: domain?.title ?? "Data Engineering",
      jobOutcomes: project.jobOutcomes ?? undefined,
      steps: steps.map(s => ({
        id: s.id,
        position: s.stepNumber,
        title: s.title,
        description: s.instructionMd,
        type: s.type,
        starterCode: s.starterCode ?? project.starterCodePython ?? "",
        expectedOutput: s.expectedOutput ?? "",
        hints: [],
        xpReward: s.xpReward,
        isLocked: false,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get project");
    res.status(500).json({ error: "Failed to get project" });
  }
});

export default router;
