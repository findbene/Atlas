import { Router } from "express";
import { db } from "@workspace/db";
import { masterySections, masteryModules, masteryLessons, masteryProgress } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";

const router = Router();

router.get("/modules", async (req, res) => {
  try {
    const { domainSlug, type } = req.query as Record<string, string>;

    const sections = await db.query.masterySections.findMany({
      where: type ? eq(masterySections.type, type) : undefined,
      orderBy: (s, { asc }) => [asc(s.orderIndex)],
    });

    const result = await Promise.all(sections.map(async s => {
      const mods = await db.query.masteryModules.findMany({
        where: eq(masteryModules.sectionId, s.id),
        orderBy: (m, { asc }) => [asc(m.orderIndex)],
      });
      return mods.map(m => ({
        id: m.id,
        slug: m.slug,
        title: m.title,
        description: m.description ?? "",
        type: s.type,
        domainSlug: domainSlug ?? "data-engineering",
        lessonCount: m.lessonCount,
        estimatedHours: m.estimatedHours ?? 2,
        tier: m.isPremium ? "pro" : "free",
        position: m.orderIndex,
      }));
    }));

    res.json(result.flat());
  } catch (err) {
    req.log.error({ err }, "Failed to list modules");
    res.status(500).json({ error: "Failed to list modules" });
  }
});

router.get("/modules/:moduleId", async (req, res) => {
  try {
    const { moduleId } = req.params as { moduleId: string };
    const module = await db.query.masteryModules.findFirst({ where: eq(masteryModules.id, moduleId) });
    if (!module) {
      res.status(404).json({ error: "Module not found" });
      return;
    }
    const section = await db.query.masterySections.findFirst({ where: eq(masterySections.id, module.sectionId) });
    const lessons = await db.query.masteryLessons.findMany({
      where: eq(masteryLessons.moduleId, moduleId),
      orderBy: (l, { asc }) => [asc(l.orderIndex)],
    });

    res.json({
      id: module.id,
      slug: module.slug,
      title: module.title,
      description: module.description ?? "",
      type: section?.type ?? "python_mastery",
      lessonCount: module.lessonCount,
      estimatedHours: module.estimatedHours ?? 2,
      tier: module.isPremium ? "pro" : "free",
      position: module.orderIndex,
      learningObjectives: module.learningObjectives ?? [],
      lessons: lessons.map(l => ({
        id: l.id,
        moduleId: l.moduleId,
        title: l.title,
        content: l.contentMd,
        type: l.type,
        position: l.orderIndex,
        estimatedMinutes: l.estimatedMinutes,
        xpReward: l.xpReward,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get module");
    res.status(500).json({ error: "Failed to get module" });
  }
});

router.post("/user/modules/:moduleId/lessons/:lessonId/complete", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { lessonId } = req.params as { lessonId: string };
    const lesson = await db.query.masteryLessons.findFirst({ where: eq(masteryLessons.id, lessonId) });
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    const existing = await db.query.masteryProgress.findFirst({
      where: and(eq(masteryProgress.userId, user.id), eq(masteryProgress.lessonId, lessonId)),
    });

    if (!existing) {
      await db.insert(masteryProgress).values({
        userId: user.id,
        lessonId,
        xpEarned: lesson.xpReward,
      });
    }

    res.json({
      lessonId,
      userId: user.id,
      completedAt: new Date().toISOString(),
      xpEarned: existing ? 0 : lesson.xpReward,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to complete lesson");
    res.status(500).json({ error: "Failed to complete lesson" });
  }
});

export default router;
