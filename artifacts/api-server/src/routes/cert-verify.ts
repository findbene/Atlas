import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  userProgress,
  users,
  projects,
  userStepCompletions,
  xpTransactions,
} from "@workspace/db";

const router: IRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public certificate verification. Anyone with the certId (the
 * user_progress.id UUID of a completed project) can confirm authenticity.
 *
 * Phase 28 — Response is enriched with completion evidence summary derived
 * from the Phase 26/27 trustworthy completion model: passed-step count,
 * evidence-hash count, project-scoped XP ledger rollup, first-step → completed
 * span. PRIVACY: never returns email, clerkId, internal user IDs, Stripe
 * fields, raw submission excerpts/content, raw per-step sha256 values, or any
 * data from a project other than the certificate's own project.
 *
 * Always 404 (never 403) for malformed / missing / non-completed certs —
 * no existence leak.
 */
router.get("/verify/:certId", async (req, res) => {
  const certId = String(req.params.certId ?? "");
  if (!UUID_RE.test(certId)) {
    res.status(404).json({ error: "Certificate not found" });
    return;
  }
  try {
    const row = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.id, certId), eq(userProgress.status, "completed")),
    });
    if (!row || !row.completedAt) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }
    const [user, project] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, row.userId) }),
      db.query.projects.findFirst({ where: eq(projects.id, row.projectId) }),
    ]);
    if (!user || !project) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }

    // Phase 28 — evidence rollups. All scoped to (userId, projectId)
    // so no cross-project data can leak. Counts only; raw hashes and
    // raw submission content are never exposed.
    const [stepAgg, xpAgg] = await Promise.all([
      db
        .select({
          stepsCompleted: sql<number>`count(*) filter (where ${userStepCompletions.passed} = true)::int`,
          evidenceHashCount: sql<number>`count(*) filter (where ${userStepCompletions.passed} = true and ${userStepCompletions.submissionSha256} is not null)::int`,
          firstStepCompletedAt: sql<Date | null>`min(${userStepCompletions.completedAt}) filter (where ${userStepCompletions.passed} = true)`,
        })
        .from(userStepCompletions)
        .where(
          and(
            eq(userStepCompletions.userId, row.userId),
            eq(userStepCompletions.projectId, row.projectId),
          ),
        ),
      db
        .select({
          totalXpEarned: sql<number>`coalesce(sum(${xpTransactions.amount}), 0)::int`,
        })
        .from(xpTransactions)
        .where(
          and(
            eq(xpTransactions.userId, row.userId),
            sql`${xpTransactions.metadata}->>'projectId' = ${row.projectId}`,
          ),
        ),
    ]);

    const stepsCompletedRaw = stepAgg[0]?.stepsCompleted ?? 0;
    const evidenceHashCountRaw = stepAgg[0]?.evidenceHashCount ?? 0;
    const firstStepCompletedAtRaw = stepAgg[0]?.firstStepCompletedAt ?? null;
    const totalXpEarned = xpAgg[0]?.totalXpEarned ?? 0;

    const totalSteps = Math.max(0, project.totalSteps ?? 0);
    // Defensive clamps: invariants must hold even against drifted legacy
    // data. `stepsCompleted <= totalSteps` MUST hold unconditionally,
    // including when totalSteps=0 (archived / thin-stub projects).
    const stepsCompleted = Math.max(0, Math.min(stepsCompletedRaw, totalSteps));
    const evidenceHashCount = Math.max(
      0,
      Math.min(evidenceHashCountRaw, stepsCompleted),
    );

    const firstStepCompletedAtIso =
      firstStepCompletedAtRaw instanceof Date
        ? firstStepCompletedAtRaw.toISOString()
        : firstStepCompletedAtRaw
          ? new Date(firstStepCompletedAtRaw).toISOString()
          : null;

    let durationSeconds: number | null = null;
    if (firstStepCompletedAtRaw) {
      const first = new Date(firstStepCompletedAtRaw).getTime();
      const last = row.completedAt.getTime();
      const seconds = Math.floor((last - first) / 1000);
      durationSeconds = seconds >= 0 ? seconds : 0;
    }

    res.json({
      certId,
      recipientName: user.name ?? user.username ?? "Atlas Learner",
      recipientUsername: user.username ?? null,
      projectTitle: project.title,
      projectSlug: project.slug,
      completedAt: row.completedAt.toISOString(),
      firstStepCompletedAt: firstStepCompletedAtIso,
      durationSeconds,
      stepsCompleted,
      totalSteps,
      evidenceHashCount,
      totalXpEarned,
      issuer: "Atlas Projects",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to verify certificate");
    res.status(500).json({ error: "Failed to verify certificate" });
  }
});

export default router;
