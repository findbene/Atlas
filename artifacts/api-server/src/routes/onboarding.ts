/**
 * Phase 21 — Onboarding state machine (thin).
 *
 * GET  /api/onboarding/state    — derive `{completed, hasEnrollments, lastSeenStep}`
 * POST /api/onboarding/complete — idempotently flip `users.onboarding_completed=true`
 *
 * No schema change: uses the existing `users.onboarding_completed` boolean.
 * `lastSeenStep` is derived (not stored) so the 3-step UI can resume:
 *   - completed                              → null
 *   - !completed, no enrollments             → "pick_course"
 *   - !completed, has enrollments            → "first_enroll"
 */
import { Router } from "express";
import { db, users, userProgress } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getCurrentUser, invalidateUserCache } from "../lib/auth";

const router = Router();

async function buildState(userId: string, completed: boolean) {
  const firstProgress = await db.query.userProgress.findFirst({
    where: eq(userProgress.userId, userId),
    columns: { id: true },
  });
  const hasEnrollments = Boolean(firstProgress);
  const lastSeenStep = completed
    ? null
    : hasEnrollments
    ? "first_enroll"
    : "pick_course";
  return { completed, hasEnrollments, lastSeenStep };
}

router.get("/onboarding/state", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(await buildState(user.id, user.onboardingCompleted));
  } catch (err) {
    req.log.error({ err }, "Phase 21 onboarding state failed");
    res.status(500).json({ error: "Failed to load onboarding state" });
  }
});

router.post("/onboarding/complete", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // Only write when actually flipping false → true. Avoids needless UPDATE
    // load and keeps the call idempotent. Cache invalidation is required
    // because requireAuth caches the row in-process.
    if (!user.onboardingCompleted) {
      await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, user.id));
      invalidateUserCache(user.clerkId);
    }
    res.json(await buildState(user.id, true));
  } catch (err) {
    req.log.error({ err }, "Phase 21 onboarding complete failed");
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

export default router;
