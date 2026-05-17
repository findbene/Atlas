import { Router } from "express";
import { db } from "@workspace/db";
import { users, userProgress, userXp, userStreaks, xpTransactions, projects, projectSteps, userStepCompletions } from "@workspace/db";
import { eq, and, desc, asc, isNull, ne } from "drizzle-orm";
import { requireAuth, getCurrentUser, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";
import { sendEmail, renderProjectCompletionEmail } from "../lib/email";
import { bumpStreak } from "../lib/streak";

const router = Router();

router.get("/user/profile", requireAuth, async (req, res) => {
  try {
    const auth = getAuth(req);
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const xpRecord = await db.query.userXp.findFirst({ where: eq(userXp.userId, user.id) });
    const streakRecord = await db.query.userStreaks.findFirst({ where: eq(userStreaks.userId, user.id) });

    res.json({
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      username: user.username,
      displayName: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      tier: user.subscriptionTier,
      totalXp: xpRecord?.totalXp ?? 0,
      level: xpRecord?.level ?? 1,
      streak: streakRecord?.currentStreak ?? 0,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user profile");
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

router.patch("/user/profile", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { username, displayName, bio } = req.body;
    const [updated] = await db.update(users)
      .set({ username, name: displayName, bio })
      .where(eq(users.id, user.id))
      .returning();
    const xpRecord = await db.query.userXp.findFirst({ where: eq(userXp.userId, user.id) });
    const streakRecord = await db.query.userStreaks.findFirst({ where: eq(userStreaks.userId, user.id) });
    res.json({
      ...updated,
      displayName: updated?.name,
      totalXp: xpRecord?.totalXp ?? 0,
      level: xpRecord?.level ?? 1,
      streak: streakRecord?.currentStreak ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/user/stats", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const xpRecord = await db.query.userXp.findFirst({ where: eq(userXp.userId, user.id) });
    const streakRecord = await db.query.userStreaks.findFirst({ where: eq(userStreaks.userId, user.id) });
    const allProgress = await db.query.userProgress.findMany({ where: eq(userProgress.userId, user.id) });
    const completed = allProgress.filter(p => p.status === "completed").length;
    const inProgress = allProgress.filter(p => p.status === "in_progress").length;

    // Weekly XP (last 7 days)
    const weeklyXp = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return { date: d.toISOString().split("T")[0]!, xp: 0 };
    }).reverse();

    res.json({
      totalXp: xpRecord?.totalXp ?? 0,
      level: xpRecord?.level ?? 1,
      streak: streakRecord?.currentStreak ?? 0,
      longestStreak: streakRecord?.longestStreak ?? 0,
      lastActivityDate: streakRecord?.lastActivityDate
        ? (streakRecord.lastActivityDate as unknown as string)
        : null,
      projectsCompleted: completed,
      projectsInProgress: inProgress,
      lessonsCompleted: 0,
      stepsCompleted: 0,
      rank: 1,
      xpToNextLevel: xpRecord?.xpToNextLevel ?? 100,
      weeklyXp,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user stats");
    res.status(500).json({ error: "Failed to get user stats" });
  }
});

router.get("/user/projects", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const allProgress = await db.query.userProgress.findMany({
      where: eq(userProgress.userId, user.id),
      orderBy: (p, { desc }) => [desc(p.lastUpdatedAt)],
    });
    const result = await Promise.all(allProgress.map(async p => {
      const project = await db.query.projects.findFirst({ where: eq(projects.id, p.projectId) });
      if (!project) return null;
      return {
        id: p.id,
        projectId: p.projectId,
        userId: p.userId,
        status: p.status,
        currentStepPosition: p.currentStep,
        earnedXp: 0,
        startedAt: p.startedAt?.toISOString(),
        completedAt: p.completedAt?.toISOString(),
        project: {
          id: project.id,
          slug: project.slug,
          title: project.title,
          description: project.shortDescription,
          difficulty: project.difficultyLevel,
          tier: project.isPremium ? "pro" : "free",
          xpReward: project.xpReward,
          estimatedHours: Math.round(project.estimatedMinutes / 60 * 10) / 10,
          stepCount: project.totalSteps,
          enrolledCount: project.enrolledCount,
          completionRate: project.completionRate,
          tags: project.tags ?? [],
          position: project.orderIndex,
          jobOutcomes: project.jobOutcomes ?? undefined,
        },
      };
    }));
    res.json(result.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "Failed to list user projects");
    res.status(500).json({ error: "Failed to list user projects" });
  }
});

router.post("/user/projects/:projectId/enroll", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { projectId } = req.params as { projectId: string };
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (project.isPremium && user.subscriptionTier !== "pro") {
      res.status(403).json({ error: "Forbidden", message: "This project requires a Pro subscription" });
      return;
    }
    const existing = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, projectId)),
    });
    if (existing) {
      res.json({ id: existing.id, projectId: existing.projectId, userId: existing.userId, status: existing.status, currentStepPosition: existing.currentStep, earnedXp: 0 });
      return;
    }
    const [created] = await db.insert(userProgress).values({
      userId: user.id,
      projectId,
      status: "in_progress",
      startedAt: new Date(),
    }).returning();
    res.json({ id: created!.id, projectId: created!.projectId, userId: created!.userId, status: created!.status, currentStepPosition: created!.currentStep, earnedXp: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to enroll in project");
    res.status(500).json({ error: "Failed to enroll in project" });
  }
});

router.get("/user/projects/:projectId/progress", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { projectId } = req.params as { projectId: string };
    const progress = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, projectId)),
    });
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const steps = await db.query.projectSteps.findMany({
      where: eq(projectSteps.projectId, projectId),
      orderBy: (s, { asc }) => [asc(s.stepNumber)],
    });
    const completions = progress ? await db.query.userStepCompletions.findMany({
      where: and(eq(userStepCompletions.userId, user.id), eq(userStepCompletions.projectId, projectId)),
    }) : [];
    // Map stepNumber -> step.id so we can return the real step id (the
    // completion row only stores stepNumber, not stepId).
    const stepIdByNumber = new Map(steps.map(s => [s.stepNumber, s.id]));
    const stepCompletions = completions.map(c => ({
      id: c.id,
      stepId: stepIdByNumber.get(c.stepNumber) ?? "",
      userProjectId: progress?.id ?? "",
      status: c.passed ? "passed" : "failed",
      attempt: c.attemptCount,
      submission: "",
      feedback: c.validationOutput ?? "",
      xpEarned: 0,
      completedAt: c.completedAt.toISOString(),
    }));

    res.json({
      id: progress?.id ?? "",
      projectId,
      userId: user.id,
      status: progress?.status ?? "not_started",
      currentStepPosition: progress?.currentStep ?? 1,
      earnedXp: 0,
      startedAt: progress?.startedAt?.toISOString(),
      completedAt: progress?.completedAt?.toISOString(),
      progressPercent: progress?.completionPercent ?? 0,
      stepCompletions,
      project: {
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
        steps: steps.map(s => ({
          id: s.id,
          position: s.stepNumber,
          title: s.title,
          description: s.instructionMd,
          type: s.type,
          starterCode: s.starterCode ?? "",
          expectedOutput: s.expectedOutput ?? "",
          hints: [],
          xpReward: s.xpReward,
          isLocked: false,
        })),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get project progress");
    res.status(500).json({ error: "Failed to get project progress" });
  }
});

router.post("/user/projects/:projectId/steps/:stepId/submit", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { projectId, stepId } = req.params as { projectId: string; stepId: string };
    const { submission, submissionType } = req.body;

    // Require an active enrollment. This transitively enforces premium gating
    // (the enroll route rejects non-pro users on premium projects), so a free
    // user can't skip enrollment and POST submissions directly.
    const enrollment = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, projectId)),
    });
    if (!enrollment) {
      res.status(403).json({ error: "Forbidden", message: "You must enroll in this project before submitting." });
      return;
    }

    const step = await db.query.projectSteps.findFirst({ where: eq(projectSteps.id, stepId) });
    if (!step || step.projectId !== projectId) {
      res.status(404).json({ error: "Step not found" });
      return;
    }

    // Simple grading logic
    let passed = false;
    let feedback = "";
    const expected = step.expectedOutput?.trim();

    if (step.validationType === "self_attest") {
      passed = true;
      feedback = "Great work! You've marked this step as complete.";
    } else if (step.validationType === "exact" && expected) {
      passed = submission?.trim() === expected;
      feedback = passed ? "Correct!" : `Expected: ${expected}`;
    } else if (step.validationType === "contains" && step.validationConfig) {
      const config = step.validationConfig as { needle?: string };
      const needle = config.needle ?? expected ?? "";
      passed = submission?.includes(needle) ?? false;
      feedback = passed ? "Correct!" : `Your output should contain: ${needle}`;
    } else if (step.validationType === "regex" && step.validationConfig) {
      const config = step.validationConfig as { pattern?: string; flags?: string };
      try {
        const re = new RegExp(config.pattern ?? "", config.flags ?? "");
        passed = re.test(submission ?? "");
        feedback = passed ? "Correct!" : "Your output doesn't match the expected pattern.";
      } catch {
        passed = false;
        feedback = "Invalid regex pattern in grading config.";
      }
    } else {
      passed = true;
      feedback = "Step completed.";
    }

    // Record completion
    const existing = await db.query.userStepCompletions.findFirst({
      where: and(
        eq(userStepCompletions.userId, user.id),
        eq(userStepCompletions.projectId, projectId),
        eq(userStepCompletions.stepNumber, step.stepNumber),
      ),
    });

    let attempt = 1;
    if (existing) {
      attempt = existing.attemptCount + 1;
      await db.update(userStepCompletions)
        .set({ passed, attemptCount: attempt, validationOutput: feedback, completedAt: new Date() })
        .where(eq(userStepCompletions.id, existing.id));
    } else {
      await db.insert(userStepCompletions).values({
        userId: user.id,
        projectId,
        stepNumber: step.stepNumber,
        passed,
        validationOutput: feedback,
        attemptCount: 1,
      });
    }

    // Update progress
    if (passed) {
      const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
      const progress = await db.query.userProgress.findFirst({
        where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, projectId)),
      });
      const nextStep = step.stepNumber + 1;
      const totalSteps = project?.totalSteps ?? 1;
      const isLastStep = step.stepNumber >= totalSteps;
      const completionPercent = Math.round((step.stepNumber / totalSteps) * 100);
      // Use a conditional UPDATE so two concurrent last-step submissions cannot
      // both observe "not completed" and both trigger the completion email.
      // Only the row that actually transitions status from non-completed → completed
      // returns a row, and only that request fires the side effects.
      let didTransitionToCompleted = false;
      if (progress) {
        if (isLastStep) {
          const updatedRows = await db.update(userProgress).set({
            currentStep: step.stepNumber,
            status: "completed",
            completionPercent,
            completedAt: progress.completedAt ?? new Date(),
            lastUpdatedAt: new Date(),
          }).where(and(
            eq(userProgress.id, progress.id),
            ne(userProgress.status, "completed"),
          )).returning({ id: userProgress.id });
          didTransitionToCompleted = updatedRows.length > 0;
          if (!didTransitionToCompleted) {
            // Already completed previously — keep lastUpdatedAt fresh but don't re-trigger side effects.
            await db.update(userProgress)
              .set({ lastUpdatedAt: new Date() })
              .where(eq(userProgress.id, progress.id));
          }
        } else {
          await db.update(userProgress).set({
            currentStep: nextStep,
            status: "in_progress",
            completionPercent,
            completedAt: null,
            lastUpdatedAt: new Date(),
          }).where(eq(userProgress.id, progress.id));
        }
      }

      // Fire-and-forget completion email — only on the actual transition to completed.
      if (didTransitionToCompleted && project && user.email) {
        const { subject, html, text } = renderProjectCompletionEmail({
          userName: user.name,
          projectTitle: project.title,
          projectSlug: project.slug,
          jobOutcomes: project.jobOutcomes as any,
        });
        void sendEmail({ to: user.email, subject, html, text }).catch((err) => {
          req.log.warn({ err, projectId, userId: user.id }, "Completion email failed");
        });
      }

      // Bump the day-streak. Best-effort: failures here must not block the
      // grading response. We intentionally fire this for every passing
      // submission — the helper is idempotent within a calendar day.
      try {
        await bumpStreak(user.id, user.timezone ?? "UTC");
      } catch (err) {
        req.log.warn({ err, userId: user.id }, "Failed to bump streak");
      }

      // Award XP
      const xpEarned = step.xpReward;
      const xpRecord = await db.query.userXp.findFirst({ where: eq(userXp.userId, user.id) });
      if (xpRecord) {
        const newTotal = xpRecord.totalXp + xpEarned;
        const newLevel = Math.floor(newTotal / 100) + 1;
        await db.update(userXp).set({ totalXp: newTotal, level: newLevel, updatedAt: new Date() }).where(eq(userXp.userId, user.id));
      } else {
        await db.insert(userXp).values({ userId: user.id, totalXp: xpEarned, level: 1 });
      }

      res.json({
        status: "passed",
        feedback,
        xpEarned: existing ? 0 : xpEarned,
        attempt,
        isFirstPass: !existing,
        projectComplete: isLastStep,
      });
      return;
    }

    res.json({ status: "failed", feedback, xpEarned: 0, attempt });
  } catch (err) {
    req.log.error({ err }, "Failed to submit step");
    res.status(500).json({ error: "Failed to submit step" });
  }
});

router.post("/user/projects/:projectId/steps/:stepId/hint", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { stepId } = req.params as { stepId: string };
    const { hintIndex = 0 } = req.body;
    const step = await db.query.projectSteps.findFirst({ where: eq(projectSteps.id, stepId) });
    const hints = ["Try reviewing the instructions again.", "Think about the expected output.", "Check your syntax carefully."];
    const hint = hints[hintIndex] ?? "No more hints available.";
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.write(`data: ${JSON.stringify({ content: hint })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to get hint");
    res.status(500).json({ error: "Failed to get hint" });
  }
});

export default router;
