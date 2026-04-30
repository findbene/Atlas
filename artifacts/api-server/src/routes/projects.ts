import { Router } from "express";
import { db } from "@workspace/db";
import { projects, projectSteps, projectHints, domains } from "@workspace/db";
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
    }));

    res.json({ data: result, total, page: pageNum, limit: limitNum, hasMore: offset + limitNum < total + limitNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list projects");
    res.status(500).json({ error: "Failed to list projects" });
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
