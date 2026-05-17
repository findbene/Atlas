/**
 * Public profile endpoint. Returns a small, public-safe view of a user
 * keyed by their `username`. Includes completed-project badges so the
 * profile page can render shareable evidence of work.
 *
 * NOT authed — explicitly available to anonymous visitors so completed
 * projects act as a shareable signal. We never expose email, clerkId,
 * subscriptionTier, stripeCustomerId, or any progress on incomplete projects.
 */
import { Router } from "express";
import { db, users, userProgress, userXp, userStreaks, projects } from "@workspace/db";
import { and, eq, desc, isNull } from "drizzle-orm";

const router = Router();

router.get("/u/:username", async (req, res) => {
  try {
    const raw = String(req.params.username ?? "").trim();
    // Conservative pattern: 1-40 chars of alnum, dash, underscore, dot.
    if (!raw || raw.length > 40 || !/^[A-Za-z0-9._-]+$/.test(raw)) {
      res.status(400).json({ error: "Invalid username" });
      return;
    }
    const user = await db.query.users.findFirst({
      where: and(eq(users.username, raw), isNull(users.deletedAt)),
      columns: {
        id: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const [xp, streak, allProgress] = await Promise.all([
      db.query.userXp.findFirst({ where: eq(userXp.userId, user.id) }),
      db.query.userStreaks.findFirst({ where: eq(userStreaks.userId, user.id) }),
      db.query.userProgress.findMany({
        where: and(eq(userProgress.userId, user.id), eq(userProgress.status, "completed")),
        orderBy: [desc(userProgress.completedAt)],
        limit: 50,
      }),
    ]);

    // Resolve project metadata for each completed project. We deliberately
    // ignore in-progress projects here — only completions are public.
    const projectIds = allProgress.map(p => p.projectId);
    // Filter out soft-deleted projects so retiring a project also retracts
    // it from public badges. Without this, a learner could keep showing off
    // a badge for a project we've taken down.
    const completedProjects = projectIds.length === 0
      ? []
      : await db.query.projects.findMany({
          where: (p, { and, inArray, isNull }) => and(
            inArray(p.id, projectIds),
            isNull(p.deletedAt),
          ),
          columns: {
            id: true, slug: true, title: true,
            difficultyLevel: true, xpReward: true, jobOutcomes: true,
          },
        });
    const byId = new Map(completedProjects.map(p => [p.id, p]));

    res.json({
      username: user.username,
      displayName: user.name ?? user.username,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      joinedAt: user.createdAt.toISOString(),
      totalXp: xp?.totalXp ?? 0,
      level: xp?.level ?? 1,
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      completedCount: allProgress.length,
      badges: allProgress
        .map(p => {
          const project = byId.get(p.projectId);
          if (!project) return null;
          return {
            projectSlug: project.slug,
            projectTitle: project.title,
            difficulty: project.difficultyLevel,
            xpReward: project.xpReward,
            completedAt: p.completedAt?.toISOString() ?? null,
            topRole: (project.jobOutcomes as { roles?: string[] } | null)?.roles?.[0] ?? null,
          };
        })
        .filter(Boolean),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load public profile");
    res.status(500).json({ error: "Failed to load public profile" });
  }
});

export default router;
