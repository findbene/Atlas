import { Router } from "express";
import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { users, userProgress, userXp, userStreaks, xpTransactions, projects, projectSteps, userStepCompletions } from "@workspace/db";
import { eq, and, desc, asc, isNull, ne, sql } from "drizzle-orm";
import { requireAuth, getCurrentUser, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";
import { sendEmail, renderProjectCompletionEmail } from "../lib/email";
import { bumpStreak } from "../lib/streak";
import { gradeSubmission } from "../lib/grading";

/** Phase 26 — Server-side cap on persisted submission excerpts. Keeps the
 *  table compact regardless of what a learner pastes; the full content is
 *  still proven by `submission_sha256`. 4 KB matches typical learner-code
 *  step sizes and is well below Postgres TOAST inline thresholds. */
const SUBMISSION_EXCERPT_MAX_BYTES = 4096;

/** Phase 26 — Capture submission evidence for the user_step_completions
 *  row. Returns `{ excerpt, sha256 }` for a non-empty submission and
 *  `{ excerpt: null, sha256: null }` otherwise (e.g. self_attest steps
 *  with no learner-authored content). The hash is computed against the
 *  FULL submission so two identical submissions hash equal even when the
 *  excerpt is truncated. */
function captureSubmissionEvidence(
  submission: string | null | undefined,
): { excerpt: string | null; sha256: string | null } {
  if (typeof submission !== "string" || submission.length === 0) {
    return { excerpt: null, sha256: null };
  }
  const sha256 = createHash("sha256").update(submission, "utf8").digest("hex");
  let excerpt = submission;
  // Truncate by UTF-8 byte length, not character count.
  const buf = Buffer.from(submission, "utf8");
  if (buf.byteLength > SUBMISSION_EXCERPT_MAX_BYTES) {
    excerpt = buf.subarray(0, SUBMISSION_EXCERPT_MAX_BYTES).toString("utf8");
  }
  return { excerpt, sha256 };
}

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

/**
 * Daily activity for the streak heatmap. Returns one row per day for the
 * last `days` calendar days (default 84 = 12 weeks), counting the user's
 * step completions on that day. Days with zero activity are filled in so
 * the client can render a stable grid without holes.
 *
 * Date math is done in the user's IANA timezone (default UTC) — same as the
 * streak bump — so the heatmap aligns with the streak counter.
 */
router.get("/user/activity", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const rawDays = Number.parseInt(String(req.query.days ?? "84"), 10);
    const days = Number.isFinite(rawDays) ? Math.max(7, Math.min(rawDays, 365)) : 84;
    const tzRaw = typeof req.query.tz === "string" ? req.query.tz : "UTC";
    // Allow-list IANA-ish chars only; fall back to UTC for anything weird.
    const tz = /^[A-Za-z0-9._+/-]{1,40}$/.test(tzRaw) ? tzRaw : "UTC";

    // GROUP BY the user-local calendar date. We aggregate inside Postgres so
    // late-night-in-LA submissions land in the right bucket.
    const result = await db.execute(sql`
      SELECT to_char(date_trunc('day', completed_at AT TIME ZONE ${tz}), 'YYYY-MM-DD') AS date,
             COUNT(*)::int AS count
      FROM user_step_completions
      WHERE user_id = ${user.id}
        AND completed_at >= NOW() - (${days}::int || ' days')::interval
      GROUP BY 1
      ORDER BY 1
    `);
    const counts = new Map<string, number>();
    for (const row of result.rows as Array<{ date: string; count: number }>) {
      counts.set(row.date, Number(row.count));
    }
    // Fill the requested window densely so the client renders a stable grid.
    const out: Array<{ date: string; count: number }> = [];
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86_400_000);
      const key = fmt.format(d);
      out.push({ date: key, count: counts.get(key) ?? 0 });
    }
    res.json({ days, timezone: tz, activity: out });
  } catch (err) {
    req.log.error({ err }, "Failed to load activity");
    res.status(500).json({ error: "Failed to load activity" });
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

    // Phase 24 — shared grading helper (also used by POST .../check). The
    // commit/persistence/XP/email side effects below remain unique to /submit.
    const { passed, feedback } = gradeSubmission(step, submission);

    // Record completion
    const existing = await db.query.userStepCompletions.findFirst({
      where: and(
        eq(userStepCompletions.userId, user.id),
        eq(userStepCompletions.projectId, projectId),
        eq(userStepCompletions.stepNumber, step.stepNumber),
      ),
    });

    // Phase 26 — Idempotency keys:
    //   wasAlreadyPassed  → this step has already been marked passed in a
    //                       prior submit. A re-submit must NOT award XP
    //                       again, must NOT insert a new xp_transactions
    //                       ledger row, and must NOT overwrite the
    //                       canonical first-pass evidence.
    //   isFreshPass       → this submission is the FIRST passing one for
    //                       this (user, project, step). The only path
    //                       that earns XP and writes evidence.
    const wasAlreadyPassed = existing?.passed === true;
    const isFreshPass = passed && !wasAlreadyPassed;
    const evidence = isFreshPass
      ? captureSubmissionEvidence(typeof submission === "string" ? submission : null)
      : { excerpt: null, sha256: null };

    let attempt = 1;
    if (existing) {
      attempt = existing.attemptCount + 1;
      // Phase 26 (architect R1 fix) — MONOTONIC pass state. Once a step
      // has been demonstrated as passed, the `passed` column never
      // downgrades to false on a subsequent failing attempt. Without
      // this, a pass→fail→pass sequence on the same step would re-enter
      // the fresh-pass branch on the third attempt and double-award XP
      // / append a duplicate xp_transactions row / overwrite the
      // canonical first-pass evidence. attemptCount + validationOutput
      // still reflect the latest attempt so the learner sees fresh
      // feedback, but the earned-reward state is immutable.
      const updateSet: Record<string, unknown> = {
        passed: passed || wasAlreadyPassed,
        attemptCount: attempt,
        validationOutput: feedback,
        completedAt: new Date(),
      };
      // Only populate evidence on a FRESH pass (existing row was failed → now
      // passes). Re-submits of an already-passed step keep the original
      // canonical evidence — Atlas remembers the first time the learner
      // actually demonstrated the answer.
      if (isFreshPass) {
        updateSet.submissionExcerpt = evidence.excerpt;
        updateSet.submissionSha256 = evidence.sha256;
      }
      await db.update(userStepCompletions)
        .set(updateSet)
        .where(eq(userStepCompletions.id, existing.id));
    } else {
      await db.insert(userStepCompletions).values({
        userId: user.id,
        projectId,
        stepNumber: step.stepNumber,
        passed,
        validationOutput: feedback,
        attemptCount: 1,
        submissionExcerpt: evidence.excerpt,
        submissionSha256: evidence.sha256,
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

      // Phase 26 (H2 fix) — Count distinct passed steps for this learner
      // AFTER recording the current step's pass. The old `isLastStep`
      // gate let a learner deep-link to the last step, submit once, and
      // claim project completion without doing any prior work.
      // `allStepsPassed` is the authoritative completion signal — only
      // when every required step has been passed does Atlas flip
      // `user_progress.status` to `completed`, send the completion
      // email, and report `projectComplete: true` to the client (which
      // drives the project-celebration UI).
      const [{ passedCount }] = await db
        .select({ passedCount: sql<number>`count(*)::int` })
        .from(userStepCompletions)
        .where(
          and(
            eq(userStepCompletions.userId, user.id),
            eq(userStepCompletions.projectId, projectId),
            eq(userStepCompletions.passed, true),
          ),
        );
      const allStepsPassed = passedCount >= totalSteps;
      const completionPercent = Math.round((passedCount / totalSteps) * 100);

      // Use a conditional UPDATE so two concurrent last-step submissions cannot
      // both observe "not completed" and both trigger the completion email.
      // Only the row that actually transitions status from non-completed → completed
      // returns a row, and only that request fires the side effects.
      let didTransitionToCompleted = false;
      if (progress) {
        if (allStepsPassed) {
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
          // Not yet complete. Advance the cursor to nextStep when there is
          // one; on a non-final unpassed-prerequisite path (e.g. learner
          // deep-linked to the last step), `nextStep` would overflow — keep
          // the cursor at the current step instead.
          await db.update(userProgress).set({
            currentStep: isLastStep ? step.stepNumber : nextStep,
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

      // Phase 26 (H1 + H3 fix) — XP + ledger writes are gated on
      // `isFreshPass`. Re-submits of an already-passed step are a no-op
      // for both `user_xp.totalXp` AND `xp_transactions`, so the value
      // returned to the client (`xpEarned: 0`) is now truthful and the
      // ledger is an append-only audit trail of real awards.
      const xpEarned = isFreshPass ? step.xpReward : 0;
      if (isFreshPass) {
        const xpRecord = await db.query.userXp.findFirst({ where: eq(userXp.userId, user.id) });
        if (xpRecord) {
          const newTotal = xpRecord.totalXp + xpEarned;
          const newLevel = Math.floor(newTotal / 100) + 1;
          await db.update(userXp).set({ totalXp: newTotal, level: newLevel, updatedAt: new Date() }).where(eq(userXp.userId, user.id));
        } else {
          await db.insert(userXp).values({ userId: user.id, totalXp: xpEarned, level: 1 });
        }
        await db.insert(xpTransactions).values({
          userId: user.id,
          amount: xpEarned,
          reason: "step_pass",
          metadata: {
            projectId,
            stepNumber: step.stepNumber,
            stepId: step.id,
            attempt,
          },
        });
      }

      res.json({
        status: "passed",
        feedback,
        xpEarned,
        attempt,
        isFirstPass: isFreshPass,
        projectComplete: didTransitionToCompleted,
      });
      return;
    }

    res.json({ status: "failed", feedback, xpEarned: 0, attempt });
  } catch (err) {
    req.log.error({ err }, "Failed to submit step");
    res.status(500).json({ error: "Failed to submit step" });
  }
});

/**
 * Phase 24 — Low-stakes "Check" endpoint. Grades a step submission using
 * the SAME helper as /submit but performs ZERO side effects: no DB
 * writes, no user_step_completions insert/update, no attemptCount bump,
 * no XP, no streak update, no progress mutation, no project completion,
 * no completion email. The response shape (CheckResult) intentionally
 * omits xpEarned/attempt/isFirstPass/projectComplete as the on-the-wire
 * guarantee that nothing was committed.
 */
router.post("/user/projects/:projectId/steps/:stepId/check", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { projectId, stepId } = req.params as { projectId: string; stepId: string };
    const { submission } = req.body ?? {};

    // Same enrollment gate as /submit — a free user can't bypass the
    // premium-project gate by hitting /check instead of /submit.
    const enrollment = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, projectId)),
    });
    if (!enrollment) {
      res.status(403).json({ error: "Forbidden", message: "You must enroll in this project before checking." });
      return;
    }

    const step = await db.query.projectSteps.findFirst({ where: eq(projectSteps.id, stepId) });
    if (!step || step.projectId !== projectId) {
      res.status(404).json({ error: "Step not found" });
      return;
    }

    const { passed, feedback } = gradeSubmission(step, submission);
    res.json({ status: passed ? "passed" : "failed", feedback });
  } catch (err) {
    req.log.error({ err }, "Failed to check step");
    res.status(500).json({ error: "Failed to check step" });
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
