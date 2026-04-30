import { Router } from "express";
import { db } from "@workspace/db";
import { userXp, users } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/leaderboard", async (req, res) => {
  try {
    const { limit = "20" } = req.query as Record<string, string>;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 50);

    const topUsers = await db.query.userXp.findMany({
      orderBy: (x, { desc }) => [desc(x.totalXp)],
      limit: limitNum,
    });

    const result = await Promise.all(topUsers.map(async (xp, idx) => {
      const user = await db.query.users.findFirst({ where: eq(users.id, xp.userId) });
      return {
        rank: idx + 1,
        userId: xp.userId,
        displayName: user?.name ?? user?.username ?? "Anonymous",
        avatarUrl: user?.avatarUrl ?? null,
        totalXp: xp.totalXp,
        level: xp.level,
        projectsCompleted: 0,
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get leaderboard");
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

export default router;
