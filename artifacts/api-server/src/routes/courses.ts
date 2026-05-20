/**
 * Phase 10 — Course taxonomy endpoints (learner-facing).
 *
 *   GET /api/courses          → list of 9 Atlas courses
 *   GET /api/courses/:slug    → one course + its learner-visible projects
 *
 * Source of truth = `projects.course` + `projects.learner_visible`. This
 * deliberately bypasses the `domains` / `tracks` tables — those remain
 * internal-only (legacy grouping for routing / admin reports).
 *
 * Heuristic course inference is NOT used here — only `projects.course`.
 * The `check:no-heuristic-runtime` lint guards against re-introduction.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { projects } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import {
  ALL_COURSES,
  type AtlasCourseSlug,
} from "@workspace/curriculum-quality";

const router = Router();

type CourseMetadata = {
  name: string;
  description: string;
  icon: string;
  color: string;
};

/**
 * Static, learner-facing display metadata for each of the 9 Atlas courses.
 * Names mirror `.local/course-skill-maps.md`. Icons map to lucide-react icon
 * names that the frontend resolves via its own iconMap.
 */
const COURSE_METADATA: Record<AtlasCourseSlug, CourseMetadata> = {
  "data-engineering": {
    name: "Data Engineering",
    description: "Batch + streaming pipelines, schemas, observability — production-grade data infra.",
    icon: "Database",
    color: "#3B82F6",
  },
  "ai-engineer": {
    name: "AI Engineering",
    description: "RAG, eval harnesses, streaming endpoints — applied LLM systems engineering.",
    icon: "Sparkles",
    color: "#8B5CF6",
  },
  "mlops-engineer": {
    name: "MLOps Engineering",
    description: "Model registry → deploy → monitor. Kubernetes, Terraform, drift, SLOs.",
    icon: "Brain",
    color: "#10B981",
  },
  "data-scientist": {
    name: "Data Scientist",
    description: "Notebook-to-pipeline analyses, causal inference, experimentation, time series.",
    icon: "LineChart",
    color: "#F59E0B",
  },
  "analytics-engineer": {
    name: "Analytics Engineering",
    description: "dbt staging → marts, semantic layer, dimensional modeling, query-cost tuning.",
    icon: "Layers",
    color: "#06B6D4",
  },
  "applied-llm-engineer": {
    name: "Applied LLM Engineer",
    description: "Agents, multi-agent systems, eval-driven development, agent observability.",
    icon: "Bot",
    color: "#EC4899",
  },
  "cloud-data-engineer": {
    name: "Cloud Data Engineering",
    description: "Iceberg / Delta lakehouse, IaC, CDC merge, table-format ops on AWS/GCP.",
    icon: "Cloud",
    color: "#0EA5E9",
  },
  "python-libraries": {
    name: "Python Libraries",
    description: "Typed Python, async, packaging, pyarrow, pydantic — production library craft.",
    icon: "Code2",
    color: "#FBBF24",
  },
  "sql": {
    name: "SQL Mastery",
    description: "Window functions, query plans, partitioning, time-travel — SQL beyond joins.",
    icon: "Table",
    color: "#A855F7",
  },
};

router.get("/courses", async (req, res) => {
  try {
    // Only learner-visible rows count toward the learner-facing catalog.
    const rows = await db.query.projects.findMany({
      where: eq(projects.learnerVisible, true),
      columns: { course: true, courseSource: true },
    });

    const counts: Record<AtlasCourseSlug, { total: number; authored: number }> = Object.fromEntries(
      ALL_COURSES.map(c => [c, { total: 0, authored: 0 }]),
    ) as Record<AtlasCourseSlug, { total: number; authored: number }>;

    for (const r of rows) {
      const c = r.course as AtlasCourseSlug;
      counts[c].total++;
      if (r.courseSource === "authored") counts[c].authored++;
    }

    const result = ALL_COURSES.map(slug => {
      const meta = COURSE_METADATA[slug];
      const { total, authored } = counts[slug];
      return {
        slug,
        name: meta.name,
        description: meta.description,
        icon: meta.icon,
        color: meta.color,
        status: total > 0 ? "active" : "coming_soon",
        projectCount: total,
        authoredCount: authored,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list courses");
    res.status(500).json({ error: "Failed to list courses" });
  }
});

router.get("/courses/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!ALL_COURSES.includes(slug as AtlasCourseSlug)) {
      res.status(404).json({ error: "Not found", message: "Course not found" });
      return;
    }
    const courseSlug = slug as AtlasCourseSlug;
    const meta = COURSE_METADATA[courseSlug];

    const rows = await db.query.projects.findMany({
      where: and(eq(projects.course, courseSlug), eq(projects.learnerVisible, true)),
      orderBy: [asc(projects.orderIndex)],
    });

    const projectList = rows.map(p => ({
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

    const authoredCount = rows.filter(r => r.courseSource === "authored").length;

    res.json({
      slug: courseSlug,
      name: meta.name,
      description: meta.description,
      icon: meta.icon,
      color: meta.color,
      status: rows.length > 0 ? "active" : "coming_soon",
      projectCount: rows.length,
      authoredCount,
      projects: projectList,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get course");
    res.status(500).json({ error: "Failed to get course" });
  }
});

export default router;
