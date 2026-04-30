import { Router } from "express";
import { db } from "@workspace/db";
import { domains, tracks, projects } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/domains", async (req, res) => {
  try {
    const allDomains = await db.query.domains.findMany({
      orderBy: (d, { asc }) => [asc(d.orderIndex)],
    });
    const result = allDomains.map(d => ({
      id: d.id,
      slug: d.slug,
      name: d.title,
      description: d.description ?? "",
      icon: d.iconName ?? "Database",
      color: d.colorHex ?? "#3B82F6",
      status: d.isAvailable ? "active" : (d.comingSoon ? "coming_soon" : "waitlist"),
      projectCount: d.totalProjects,
      enrolledCount: 0,
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list domains");
    res.status(500).json({ error: "Failed to list domains" });
  }
});

router.get("/domains/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const domain = await db.query.domains.findFirst({
      where: eq(domains.slug, slug),
    });
    if (!domain) {
      res.status(404).json({ error: "Not found", message: "Domain not found" });
      return;
    }
    const allTracks = await db.query.tracks.findMany({
      where: eq(tracks.domainId, domain.id),
      orderBy: (t, { asc }) => [asc(t.orderIndex)],
    });
    const allProjects = await db.query.projects.findMany({
      where: eq(projects.domainId, domain.id),
      orderBy: (p, { asc }) => [asc(p.orderIndex)],
    });
    const projectList = allProjects.map(p => ({
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
    res.json({
      id: domain.id,
      slug: domain.slug,
      name: domain.title,
      description: domain.description ?? "",
      icon: domain.iconName ?? "Database",
      color: domain.colorHex ?? "#3B82F6",
      status: domain.isAvailable ? "active" : (domain.comingSoon ? "coming_soon" : "waitlist"),
      projectCount: domain.totalProjects,
      enrolledCount: 0,
      projects: projectList,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get domain");
    res.status(500).json({ error: "Failed to get domain" });
  }
});

export default router;
