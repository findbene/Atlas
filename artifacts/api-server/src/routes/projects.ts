import { Router } from "express";
import { db } from "@workspace/db";
import { projects, projectSteps, projectHints, domains, projectSolutions } from "@workspace/db";
import { eq, and, desc, asc, sql, or, ilike } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { userProgress, userStepCompletions } from "@workspace/db";
import type { AtlasCourseSlug } from "@workspace/curriculum-quality";

// Phase 10 — keep in sync with COURSE_METADATA in `./courses.ts`. Only the
// display name is needed in project detail responses; icon/color stay over there.
const COURSE_DISPLAY_NAME: Record<AtlasCourseSlug, string> = {
  "data-engineering": "Data Engineering",
  "ai-engineer": "AI Engineering",
  "mlops-engineer": "MLOps Engineering",
  "data-scientist": "Data Scientist",
  "analytics-engineer": "Analytics Engineering",
  "applied-llm-engineer": "Applied LLM Engineer",
  "cloud-data-engineer": "Cloud Data Engineering",
  "python-libraries": "Python Libraries",
  "sql": "SQL Mastery",
};

const router = Router();

router.get("/projects", async (req, res) => {
  try {
    const { domainSlug, difficulty, tier, language, search, page = "1", limit = "20" } =
      req.query as Record<string, string>;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    let domainId: string | undefined;
    if (domainSlug) {
      const domain = await db.query.domains.findFirst({ where: eq(domains.slug, domainSlug) });
      domainId = domain?.id;
    }

    // Clamp search to a safe length and escape ILIKE wildcards so users can't
    // accidentally pattern-match everything by typing `%`.
    const searchTrim = typeof search === "string" ? search.trim().slice(0, 80) : "";
    const searchEsc = searchTrim
      ? `%${searchTrim.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`
      : null;

    const allProjects = await db.query.projects.findMany({
      where: (p, { and, eq, isNull }) => and(
        isNull(p.deletedAt),
        domainId ? eq(p.domainId, domainId) : undefined,
        difficulty ? eq(p.difficultyLevel, difficulty as any) : undefined,
        tier === "free" ? eq(p.isPremium, false) : tier === "pro" ? eq(p.isPremium, true) : undefined,
        language === "python" || language === "sql" ? eq(p.language, language as any) : undefined,
        searchEsc
          ? or(ilike(p.title, searchEsc), ilike(p.shortDescription, searchEsc))
          : undefined,
      ),
      orderBy: (p, { asc }) => [asc(p.orderIndex)],
      limit: limitNum,
      offset,
    });

    // Correct total — previously this returned the page length, which broke
    // `hasMore` for everything past page 1. Run a small COUNT(*) in parallel
    // with the page query semantics above.
    const totalRow = await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM projects p
      WHERE p.deleted_at IS NULL
        ${domainId ? sql`AND p.domain_id = ${domainId}` : sql``}
        ${difficulty ? sql`AND p.difficulty_level = ${difficulty}` : sql``}
        ${tier === "free" ? sql`AND p.is_premium = false` : tier === "pro" ? sql`AND p.is_premium = true` : sql``}
        ${language === "python" || language === "sql" ? sql`AND p.language = ${language}` : sql``}
        ${searchEsc ? sql`AND (p.title ILIKE ${searchEsc} OR p.short_description ILIKE ${searchEsc})` : sql``}
    `);
    const total = (totalRow.rows[0] as { c: number } | undefined)?.c ?? allProjects.length;
    const result = allProjects.map(p => ({
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
      jobOutcomes: p.jobOutcomes ?? undefined,
    }));

    res.json({ data: result, total, page: pageNum, limit: limitNum, hasMore: offset + result.length < total });
  } catch (err) {
    req.log.error({ err }, "Failed to list projects");
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// GET /projects/resume — the user's most recently-touched in-progress project,
// for the dashboard "Resume where you left off" banner. Returns 204 if there's
// nothing in progress.
router.get("/projects/resume", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rows = await db.query.userProgress.findMany({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.status, "in_progress")),
      orderBy: [desc(userProgress.lastUpdatedAt)],
      limit: 1,
    });
    const row = rows[0];
    if (!row) {
      res.status(204).end();
      return;
    }
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, row.projectId),
      columns: { id: true, slug: true, title: true, totalSteps: true, shortDescription: true },
    });
    if (!project) {
      res.status(204).end();
      return;
    }
    res.json({
      projectId: project.id,
      projectSlug: project.slug,
      projectTitle: project.title,
      shortDescription: project.shortDescription,
      currentStep: row.currentStep,
      totalSteps: project.totalSteps,
      completionPercent: row.completionPercent,
      lastUpdatedAt: row.lastUpdatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load resume project");
    res.status(500).json({ error: "Failed to load resume" });
  }
});

// GET /projects/:slug/solution — Pro-gated reference solution. Free users
// receive 402 (Payment Required) so the UI can render an upsell. We also
// only reveal solutions for projects where the user has progressed at least
// one step — this keeps the gate from being trivially bypassed by users who
// want to copy the solution without engaging with the project at all.
router.get("/projects/:slug/solution", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const slug = String(req.params.slug);
    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
      columns: { id: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (user.subscriptionTier !== "pro") {
      res.status(402).json({
        error: "Pro plan required",
        message: "Reference solutions are a Pro feature. Upgrade to view.",
      });
      return;
    }
    // Engagement gate: require at least one completed step (or any progress
    // row past step 1) before revealing.
    const progress = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, project.id)),
    });
    const attempts = await db.query.userStepCompletions.findMany({
      where: and(eq(userStepCompletions.userId, user.id), eq(userStepCompletions.projectId, project.id)),
      limit: 1,
    });
    // Engagement gate: pass if EITHER they're past step 1 OR they've recorded
    // at least one step completion. A missing progress row alone shouldn't
    // disqualify a user who has completions (can happen if progress was
    // cleared but completions were retained).
    const pastStepOne = !!progress && progress.currentStep > 1;
    if (!pastStepOne && attempts.length === 0) {
      res.status(403).json({
        error: "Try the project first",
        message: "Attempt at least one step before viewing the reference solution.",
      });
      return;
    }

    const solution = await db.query.projectSolutions.findFirst({
      where: eq(projectSolutions.projectId, project.id),
    });
    if (!solution) {
      res.status(404).json({
        error: "No solution available",
        message: "A reference solution hasn't been published for this project yet.",
      });
      return;
    }
    res.json({
      solutionCode: solution.solutionCode,
      explanationMd: solution.solutionExplanationMd,
      videoUrl: solution.videoExplanationUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load solution");
    res.status(500).json({ error: "Failed to load solution" });
  }
});

router.get("/projects/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.slug, slug)),
    });
    if (!project) {
      res.status(404).json({ error: "Not found", message: "Project not found" });
      return;
    }
    const steps = await db.query.projectSteps.findMany({
      where: eq(projectSteps.projectId, project.id),
      orderBy: (s, { asc }) => [asc(s.stepNumber)],
    });
    const domain = await db.query.domains.findFirst({ where: eq(domains.id, project.domainId) });

    res.json({
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
      domainSlug: domain?.slug ?? "data-engineering",
      domainName: domain?.title ?? "Data Engineering",
      // Phase 10 — learner-facing course taxonomy. Reads `projects.course` directly.
      courseSlug: project.course,
      courseName: COURSE_DISPLAY_NAME[project.course as keyof typeof COURSE_DISPLAY_NAME] ?? project.course,
      jobOutcomes: project.jobOutcomes ?? undefined,
      executionProfile: project.executionProfile ?? undefined,
      steps: steps.map(s => ({
        id: s.id,
        position: s.stepNumber,
        title: s.title,
        description: s.instructionMd,
        type: s.type,
        starterCode: s.starterCode ?? project.starterCodePython ?? "",
        expectedOutput: s.expectedOutput ?? "",
        hints: [],
        xpReward: s.xpReward,
        isLocked: false,
        expectedOutputs: s.expectedOutputs ?? undefined,
        datasetRefs: s.datasetRefs ?? undefined,
        executionOverride: s.executionOverride ?? undefined,
        // Phase 4: pedagogy fields (all optional). Hint texts and the full
        // L5 explanation are NEVER returned here — they are gated by the
        // per-user hint endpoints. This response is safe for unauthenticated
        // calls.
        learningObjective: s.learningObjective ?? undefined,
        requiredSkill: s.requiredSkill ?? undefined,
        hasPedagogy: !!s.pedagogyConfig,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get project");
    res.status(500).json({ error: "Failed to get project" });
  }
});

export default router;
