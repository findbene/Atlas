import { Router } from "express";
import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { users, userProgress, userXp, userStreaks, xpTransactions, projects, projectSteps, userStepCompletions, portfolioSubmissionSnapshots } from "@workspace/db";
import { eq, and, desc, asc, isNull, ne, sql } from "drizzle-orm";
import { requireAuth, getCurrentUser, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";
import { sendEmail, renderProjectCompletionEmail } from "../lib/email";
import { bumpStreak } from "../lib/streak";
import { gradeSubmission, isServerGradeOptedIn } from "../lib/grading";
import { verifyEnvelopeForSubmit, parseEnvelopeAllowList, isEnvelopeEnforcedFor } from "../lib/envelopeSubmit";
import { gradeEnvelopeCapture } from "../lib/envelopeGrade";
import { recordVerifyOk, recordVerifyFailed, recordFallback } from "../lib/envelopeMetrics";
import type { RunCapture } from "@workspace/execution-core/run-envelope";

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
    // Phase 39 — durable enrolled_count writer.
    // Atomic SQL-level increment, fires ONLY when a NEW user_progress row was
    // inserted (the `existing` branch above returns early). Non-fatal on
    // failure: enrolled_count is display metadata, not a safety gate (see
    // Phase 38). Operators can reconcile with `backfill:enrolled-count`.
    try {
      await db.update(projects)
        .set({ enrolledCount: sql`${projects.enrolledCount} + 1` })
        .where(eq(projects.id, projectId));
    } catch (counterErr) {
      // Phase 40 — structured fields for downstream alerting/log filtering.
      req.log.warn(
        { err: counterErr, evt: "enrolled_count.increment_failed", route: "POST /api/user/projects/:projectId/enroll", phase: "P40", projectId, projectSlug: project.slug, userId: user.id },
        "enrolled_count increment failed (non-fatal; run backfill:enrolled-count to reconcile)",
      );
    }
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

/**
 * Phase 27 — Transactional reward boundary for /submit.
 *
 * All side-effecting work for a single /submit lives inside a single
 * `db.transaction(async (tx) => ...)` block, serialized per-user by a
 * `pg_advisory_xact_lock` keyed on the learner's user id. The lock is
 * acquired as the FIRST statement in the tx and is released
 * automatically at commit/rollback.
 *
 * This closes the Phase-26 known race caveat: two concurrent /submit
 * requests for the same (user, project, step) — or for two different
 * steps of the same project — can no longer interleave the read-then-
 * write windows on `user_step_completions`, `user_xp`, and
 * `xp_transactions`, so:
 *
 *   - `isFreshPass` is decided exactly once per real first-pass.
 *   - `user_xp.totalXp` increments are not lost.
 *   - `xp_transactions` row count matches real award count.
 *   - the canonical first-pass evidence is not overwritten by a
 *     concurrent loser.
 *
 * Pure grading (`gradeSubmission`) stays OUTSIDE the tx — it has no
 * side effects, and keeping it out shortens the lock window.
 *
 * Best-effort post-commit work (`bumpStreak`, completion email) also
 * stays OUTSIDE the tx so a streak hiccup or email failure cannot
 * roll back the persisted reward state. The completion email is
 * still gated on `didTransitionToCompleted` returned from the tx, so
 * it fires at most once per real completion transition.
 *
 * Phase 26 invariants preserved verbatim: monotonic `passed`,
 * evidence-on-first-pass-only, XP awarded only on real first
 * transitions, ledger row count = real award count, project
 * completion requires `allStepsPassed`. Response shape unchanged.
 */
router.post("/user/projects/:projectId/steps/:stepId/submit", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { projectId, stepId } = req.params as { projectId: string; stepId: string };
    const { submission, submissionType } = req.body;
    const wireEnvelope: unknown = (req.body ?? {}).envelope;

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

    // Phase 47 — Signed-envelope branch. The legacy bare-string `submission`
    // path is preserved verbatim below; we only enter the envelope branch
    // when the client signaled intent by including a top-level `envelope`
    // field. Allow-list (ATLAS_ENVELOPE_REQUIRED_KINDS) is EMPTY by default
    // in Phase 47, so this branch returns 400 for all kinds unless an
    // operator explicitly opts a kind in via env var. Trust model H3.
    // Phase 48 — When the envelope branch is taken, `envelopeCapture` holds
    // the verified `RunCapture` and drives BOTH grading (via
    // `gradeEnvelopeCapture`) and evidence (the executed code becomes
    // the persisted submission excerpt, since the wire `submission` field
    // is null in the envelope path). Legacy bare-string path: this stays
    // null and grading + evidence use `submission` exactly as before.
    // Phase 49 — Soft-fail contract update: when the client attaches an
    // envelope for a validation kind that is NOT in the allow-list, we
    // silently SKIP the envelope branch and fall through to the legacy
    // bare-string grading path (instead of the Phase 47-original 400
    // `envelope_kind_not_enabled`). Rationale: the frontend always attaches
    // a freshly-signed envelope when one is available, and has no way to
    // know the server's current allow-list — rejecting would introduce a
    // brand-new Submit failure mode the moment Phase 49 ships. Operator
    // control is unchanged: nothing about the verified grading path runs
    // until `ATLAS_ENVELOPE_REQUIRED_KINDS` includes the step's kind.
    let envelopeCapture: RunCapture | null = null;
    if (wireEnvelope !== undefined && wireEnvelope !== null) {
      const kind = step.validationType ?? "";
      const allowList = parseEnvelopeAllowList();
      // Phase 50 — canary gate. Three-state outcome:
      //   (A) kind not allow-listed   → reason: "kind_not_enabled"
      //   (B) kind allow-listed, user
      //       not in canary bucket    → reason: "canary_bucket_skip"
      //   (C) kind allow-listed, user
      //       in canary bucket        → fall through to verify
      // (A) + (B) both downgrade to legacy grading silently — soft-fail
      // contract from Phase 49 preserved verbatim.
      const enforced = isEnvelopeEnforcedFor(kind, user.id);
      if (!enforced) {
        const reason = allowList.has(kind) ? "canary_bucket_skip" : "kind_not_enabled";
        req.log.info(
          {
            evt: "envelope.submit.kind_not_enabled.fallback",
            phase: "P50",
            reason,
            userId: user.id,
            projectId,
            stepId,
            validationKind: kind,
          },
          reason === "canary_bucket_skip"
            ? "Envelope present but user not in canary bucket — falling back to legacy grading"
            : "Envelope present for non-allow-listed kind — falling back to legacy grading",
        );
        recordFallback(reason);
        // Drop straight into the legacy bare-string grading path below.
      } else {
      // Phase 50 — measure verify latency for canary observability.
      const verifyStartedAtMs = Date.now();
      const verifyRes = await verifyEnvelopeForSubmit(wireEnvelope, {
        userId: user.id,
        projectId,
        stepId,
        validationKind: kind,
      });
      const verifyDurationMs = Date.now() - verifyStartedAtMs;
      if (!verifyRes.ok) {
        req.log.warn(
          {
            evt: "envelope.verify.failed",
            phase: "P50",
            reason: verifyRes.error,
            detail: verifyRes.detail,
            verifyDurationMs,
            userId: user.id,
            projectId,
            stepId,
            validationKind: kind,
          },
          "Envelope verification failed",
        );
        recordVerifyFailed(verifyRes.error, verifyDurationMs);
        res.status(verifyRes.status).json({ error: verifyRes.error });
        return;
      }

      req.log.info(
        {
          evt: "envelope.verify.ok",
          phase: "P50",
          verifyDurationMs,
          userId: user.id,
          projectId,
          stepId,
          validationKind: kind,
          nonce: verifyRes.binding.nonce,
        },
        "Envelope verified",
      );
      recordVerifyOk(verifyDurationMs);

      envelopeCapture = verifyRes.capture;
      }
    }

    // Phase 24 + 48 — shared grading helpers (legacy is also used by
    // POST .../check). Both helpers are pure (no DB side effects) and
    // run OUTSIDE the tx so the lock window covers only the persistence
    // work below.
    //
    // Phase 48 pilot grader (`gradeEnvelopeCapture`) only does real
    // comparison for the narrow pilot kinds and falls back to legacy
    // default-pass for everything else — preserving the "no global
    // json_equal enforcement" hard stop until an operator opts in via
    // ATLAS_ENVELOPE_REQUIRED_KINDS (still empty by default).
    const { passed, feedback } = envelopeCapture
      ? gradeEnvelopeCapture(step, envelopeCapture)
      : gradeSubmission(step, submission);

    // Phase 48 — Evidence source. Legacy path: the wire `submission`
    // string. Envelope path: the executed code from the verified
    // capture (this is what the learner actually ran; the wire
    // `submission` field is null in the envelope path).
    const submittedCode: string | null = envelopeCapture
      ? envelopeCapture.code
      : (typeof submission === "string" ? submission : null);

    // Phase 27 — Transactional reward boundary. See block comment above.
    const txResult = await db.transaction(async (tx) => {
      // Serialize concurrent /submit work for this learner. Any other
      // /submit tx for the same user blocks here until this tx
      // commits/rollbacks. Released automatically on tx end.
      // hashtextextended(text, 0) -> bigint, which matches the
      // pg_advisory_xact_lock(bigint) signature.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`atlas-submit:${user.id}`}, 0))`,
      );

      // Read existing completion under the lock — race-free.
      const existing = await tx.query.userStepCompletions.findFirst({
        where: and(
          eq(userStepCompletions.userId, user.id),
          eq(userStepCompletions.projectId, projectId),
          eq(userStepCompletions.stepNumber, step.stepNumber),
        ),
      });

      // Phase 26 — Idempotency keys:
      //   wasAlreadyPassed  → this step has already been marked passed
      //                       in a prior submit. A re-submit must NOT
      //                       award XP again, must NOT insert a new
      //                       xp_transactions ledger row, and must NOT
      //                       overwrite the canonical first-pass
      //                       evidence.
      //   isFreshPass       → this submission is the FIRST passing one
      //                       for this (user, project, step). The only
      //                       path that earns XP and writes evidence.
      const wasAlreadyPassed = existing?.passed === true;
      const isFreshPass = passed && !wasAlreadyPassed;
      const evidence = isFreshPass
        ? captureSubmissionEvidence(submittedCode)
        : { excerpt: null, sha256: null };

      let attempt = 1;
      if (existing) {
        attempt = existing.attemptCount + 1;
        // Phase 26 (architect R1 fix) — MONOTONIC pass state. Once a
        // step has been demonstrated as passed, the `passed` column
        // never downgrades to false on a subsequent failing attempt.
        // Without this, a pass→fail→pass sequence would re-enter the
        // fresh-pass branch on the third attempt and double-award XP /
        // append a duplicate ledger row / overwrite the canonical
        // first-pass evidence.
        const updateSet: Record<string, unknown> = {
          passed: passed || wasAlreadyPassed,
          attemptCount: attempt,
          validationOutput: feedback,
          completedAt: new Date(),
        };
        if (isFreshPass) {
          updateSet.submissionExcerpt = evidence.excerpt;
          updateSet.submissionSha256 = evidence.sha256;
        }
        await tx.update(userStepCompletions)
          .set(updateSet)
          .where(eq(userStepCompletions.id, existing.id));
      } else {
        await tx.insert(userStepCompletions).values({
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

      // Phase 60B — append-only portfolio submission snapshot. Written ONLY on
      // a FRESH passing attempt (never by /check — which has no DB writes at
      // all — and never on a failing attempt, since isFreshPass requires
      // `passed`). Stores learner EVIDENCE (clamped excerpt + sha256 of the
      // full content), never answer keys / specs / expected rows. The unique
      // (user, project, step) index + `onConflictDoNothing` make it
      // append-only-once: a re-submit has isFreshPass=false so it never reaches
      // here, and even a hypothetical double-fresh-pass cannot duplicate.
      if (isFreshPass) {
        const runtimeEvidence = envelopeCapture
          ? captureSubmissionEvidence(envelopeCapture.stdout)
          : { excerpt: null, sha256: null };
        await tx
          .insert(portfolioSubmissionSnapshots)
          .values({
            userId: user.id,
            projectId,
            stepId: step.id,
            stepNumber: step.stepNumber,
            validationKind: step.validationType ?? "self_attest",
            isServerGraded: isServerGradeOptedIn(step.validationType, step.validationConfig),
            passed: true,
            submittedAt: new Date(),
            submissionSha256: evidence.sha256,
            submissionExcerpt: evidence.excerpt,
            runtimeOutputSha256: runtimeEvidence.sha256,
            runtimeOutputExcerpt: runtimeEvidence.excerpt,
            source: envelopeCapture ? "submit_envelope" : "submit_legacy",
          })
          .onConflictDoNothing();
      }

      // Update progress
      let project: typeof projects.$inferSelect | undefined;
      let didTransitionToCompleted = false;
      if (passed) {
        project = await tx.query.projects.findFirst({ where: eq(projects.id, projectId) });
        const progress = await tx.query.userProgress.findFirst({
          where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, projectId)),
        });
        const nextStep = step.stepNumber + 1;
        const totalSteps = project?.totalSteps ?? 1;
        const isLastStep = step.stepNumber >= totalSteps;

        // Phase 26 (H2 fix) — Count distinct passed steps for this
        // learner AFTER recording the current step's pass. The old
        // `isLastStep` gate let a learner deep-link to the last step,
        // submit once, and claim project completion without doing any
        // prior work. `allStepsPassed` is the authoritative completion
        // signal — only when every required step has been passed does
        // Atlas flip `user_progress.status` to `completed`.
        const [{ passedCount }] = await tx
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

        // Conditional UPDATE guards completion-email idempotency even
        // for the never-should-happen case where the advisory lock
        // were ever bypassed (defense in depth). Only the row that
        // actually transitions from non-completed → completed returns
        // a row.
        if (progress) {
          if (allStepsPassed) {
            const updatedRows = await tx.update(userProgress).set({
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
              await tx.update(userProgress)
                .set({ lastUpdatedAt: new Date() })
                .where(eq(userProgress.id, progress.id));
            }
          } else {
            await tx.update(userProgress).set({
              currentStep: isLastStep ? step.stepNumber : nextStep,
              status: "in_progress",
              completionPercent,
              completedAt: null,
              lastUpdatedAt: new Date(),
            }).where(eq(userProgress.id, progress.id));
          }
        }

        // Phase 26 (H1 + H3 fix) — XP + ledger writes are gated on
        // `isFreshPass`. Under the Phase-27 user-level advisory lock,
        // the read-then-write of `user_xp` is fully serialized for
        // this user, so the simple read→compute→update pattern can
        // no longer lose updates across concurrent /submit calls
        // (same step OR different steps of the same/different
        // projects). xp_transactions stays append-only.
        const xpEarned = isFreshPass ? step.xpReward : 0;
        if (isFreshPass) {
          const xpRecord = await tx.query.userXp.findFirst({ where: eq(userXp.userId, user.id) });
          if (xpRecord) {
            const newTotal = xpRecord.totalXp + xpEarned;
            const newLevel = Math.floor(newTotal / 100) + 1;
            await tx.update(userXp).set({ totalXp: newTotal, level: newLevel, updatedAt: new Date() }).where(eq(userXp.userId, user.id));
          } else {
            await tx.insert(userXp).values({ userId: user.id, totalXp: xpEarned, level: 1 });
          }
          await tx.insert(xpTransactions).values({
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

        return { attempt, isFreshPass, xpEarned, didTransitionToCompleted, project: project ?? null };
      }

      return { attempt, isFreshPass: false, xpEarned: 0, didTransitionToCompleted: false, project: null };
    });

    // Post-commit best-effort side effects. These intentionally live
    // OUTSIDE the tx so a streak or email failure cannot roll back
    // the persisted reward state.
    if (passed) {
      // Bump the day-streak. Best-effort: failures here must not
      // block the grading response. We intentionally fire this for
      // every passing submission — the helper is idempotent within a
      // calendar day.
      try {
        await bumpStreak(user.id, user.timezone ?? "UTC");
      } catch (err) {
        req.log.warn({ err, userId: user.id }, "Failed to bump streak");
      }

      // Fire-and-forget completion email — only on the actual
      // transition to completed, which the tx return value pins.
      if (txResult.didTransitionToCompleted && txResult.project && user.email) {
        const { subject, html, text } = renderProjectCompletionEmail({
          userName: user.name,
          projectTitle: txResult.project.title,
          projectSlug: txResult.project.slug,
          jobOutcomes: txResult.project.jobOutcomes as any,
        });
        void sendEmail({ to: user.email, subject, html, text }).catch((err) => {
          req.log.warn({ err, projectId, userId: user.id }, "Completion email failed");
        });
      }

      res.json({
        status: "passed",
        feedback,
        xpEarned: txResult.xpEarned,
        attempt: txResult.attempt,
        isFirstPass: txResult.isFreshPass,
        projectComplete: txResult.didTransitionToCompleted,
      });
      return;
    }

    res.json({ status: "failed", feedback, xpEarned: 0, attempt: txResult.attempt });
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
