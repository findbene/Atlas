/**
 * Phase 29 — GET /api/user/portfolio
 *
 * Authenticated learner-facing portfolio. Returns one PortfolioEvidence
 * row per completed project owned by the requesting user, enriched with
 * the Phase 26/27 trustworthy completion evidence (passed-step count,
 * evidence-hash count, project-scoped XP ledger rollup, first-step →
 * completed span) using the same SQL fragments and clamps as the public
 * Phase 28 /verify/:certId route.
 *
 * Privacy contract (symmetric with Phase 28):
 *   - userId comes EXCLUSIVELY from getCurrentUser(req). There is no
 *     path/query/body param that accepts a userId, username, or
 *     project-ownership claim.
 *   - Response never contains: email, clerkId, internal user IDs,
 *     Stripe identifiers, subscription state, raw submissionExcerpt,
 *     raw submission content, raw per-step submissionSha256 values,
 *     or any data scoped to a different user.
 *   - Hidden (learner_visible=false) and soft-deleted (deletedAt IS NOT NULL)
 *     projects are silently dropped — same anti-leak posture as
 *     dashboard.ts and public-profile.ts.
 *
 * No schema, /check, /submit, dashboard, cert-verify, or public-profile
 * behavior is changed by this route.
 */
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  projects,
  userProgress,
  userStepCompletions,
  xpTransactions,
} from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";

const router: IRouter = Router();

type ProjectMeta = {
  id: string;
  slug: string;
  title: string;
  course: string;
  difficultyLevel: string;
  totalSteps: number;
  jobOutcomes: unknown;
};

function toLearnerDifficulty(d: string): "beginner" | "intermediate" | "advanced" {
  if (d === "beginner" || d === "intermediate" || d === "advanced") return d;
  return "advanced";
}

function pickTopRole(jobOutcomes: unknown): string | null {
  if (!jobOutcomes || typeof jobOutcomes !== "object") return null;
  const roles = (jobOutcomes as { roles?: unknown }).roles;
  if (!Array.isArray(roles) || roles.length === 0) return null;
  const first = roles[0];
  return typeof first === "string" ? first : null;
}

router.get("/user/portfolio", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 1) Completed enrollments for THIS user only. userId is sourced
    //    exclusively from the authenticated session — no params.
    const progressRows = await db.query.userProgress.findMany({
      where: and(
        eq(userProgress.userId, user.id),
        eq(userProgress.status, "completed"),
      ),
      orderBy: [desc(userProgress.completedAt)],
    });

    if (progressRows.length === 0) {
      res.json({
        completedCount: 0,
        totalProjectXp: 0,
        evidenceBackedCount: 0,
        items: [],
      });
      return;
    }

    const projectIds = Array.from(new Set(progressRows.map((p) => p.projectId)));

    // 2) Project metadata — strictly learner-visible AND not soft-deleted.
    //    A completion of a since-hidden / since-deleted project is silently
    //    dropped (no item rendered) — same anti-leak as dashboard.ts.
    const projectRows = (await db.query.projects.findMany({
      where: and(
        inArray(projects.id, projectIds),
        eq(projects.learnerVisible, true),
        isNull(projects.deletedAt),
      ),
      columns: {
        id: true,
        slug: true,
        title: true,
        course: true,
        difficultyLevel: true,
        totalSteps: true,
        jobOutcomes: true,
      },
    })) as unknown as ProjectMeta[];

    const projById = new Map(projectRows.map((p) => [p.id, p]));

    // 3) Batched step aggregates GROUP BY projectId. Scoped to THIS user
    //    AND projectIds we're actually returning, so no cross-user / cross-
    //    project rows can bleed in.
    const stepAggs = await db
      .select({
        projectId: userStepCompletions.projectId,
        stepsCompleted: sql<number>`count(*) filter (where ${userStepCompletions.passed} = true)::int`,
        evidenceHashCount: sql<number>`count(*) filter (where ${userStepCompletions.passed} = true and ${userStepCompletions.submissionSha256} is not null)::int`,
        firstStepCompletedAt: sql<Date | null>`min(${userStepCompletions.completedAt}) filter (where ${userStepCompletions.passed} = true)`,
      })
      .from(userStepCompletions)
      .where(
        and(
          eq(userStepCompletions.userId, user.id),
          inArray(userStepCompletions.projectId, projectIds),
        ),
      )
      .groupBy(userStepCompletions.projectId);

    const stepAggByProject = new Map<
      string,
      {
        stepsCompleted: number;
        evidenceHashCount: number;
        firstStepCompletedAt: Date | null;
      }
    >();
    for (const row of stepAggs) {
      stepAggByProject.set(row.projectId, {
        stepsCompleted: row.stepsCompleted ?? 0,
        evidenceHashCount: row.evidenceHashCount ?? 0,
        firstStepCompletedAt: row.firstStepCompletedAt ?? null,
      });
    }

    // 4) Batched XP rollup by metadata->>'projectId'. Scoped to THIS
    //    user AND projectIds — prevents ledger entries for other
    //    projects from leaking into any item or summary.
    const xpAggs = await db
      .select({
        projectId: sql<string>`${xpTransactions.metadata}->>'projectId'`,
        totalXpEarned: sql<number>`coalesce(sum(${xpTransactions.amount}), 0)::int`,
      })
      .from(xpTransactions)
      .where(
        and(
          eq(xpTransactions.userId, user.id),
          sql`${xpTransactions.metadata}->>'projectId' = ANY(${projectIds})`,
        ),
      )
      .groupBy(sql`${xpTransactions.metadata}->>'projectId'`);

    const xpByProject = new Map<string, number>();
    for (const row of xpAggs) {
      if (row.projectId) xpByProject.set(row.projectId, row.totalXpEarned ?? 0);
    }

    // 5) Compose items with the same defensive clamps as cert-verify.ts.
    const items = progressRows.flatMap((prog) => {
      const project = projById.get(prog.projectId);
      if (!project) return []; // hidden / deleted / unknown — silently dropped
      if (!prog.completedAt) return [];

      const stepAgg = stepAggByProject.get(prog.projectId);
      const stepsCompletedRaw = stepAgg?.stepsCompleted ?? 0;
      const evidenceHashCountRaw = stepAgg?.evidenceHashCount ?? 0;
      const firstStepCompletedAtRaw = stepAgg?.firstStepCompletedAt ?? null;

      const totalSteps = Math.max(0, project.totalSteps ?? 0);
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
        const last = prog.completedAt.getTime();
        const seconds = Math.floor((last - first) / 1000);
        durationSeconds = seconds >= 0 ? seconds : 0;
      }

      const totalXpEarned = xpByProject.get(prog.projectId) ?? 0;

      return [
        {
          certId: prog.id,
          projectSlug: project.slug,
          projectTitle: project.title,
          course: project.course,
          difficulty: toLearnerDifficulty(project.difficultyLevel),
          completedAt: prog.completedAt.toISOString(),
          firstStepCompletedAt: firstStepCompletedAtIso,
          durationSeconds,
          stepsCompleted,
          totalSteps,
          evidenceHashCount,
          totalXpEarned,
          verifyUrl: `/verify/${prog.id}`,
          printUrl: `/certificates/${project.slug}/print`,
          topRole: pickTopRole(project.jobOutcomes),
        },
      ];
    });

    const totalProjectXp = items.reduce((acc, it) => acc + it.totalXpEarned, 0);
    const evidenceBackedCount = items.reduce(
      (acc, it) => acc + (it.evidenceHashCount >= 1 ? 1 : 0),
      0,
    );

    res.json({
      completedCount: items.length,
      totalProjectXp,
      evidenceBackedCount,
      items,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load user portfolio");
    res.status(500).json({ error: "Failed to load portfolio" });
  }
});

export default router;
