/**
 * Map an existing DB project (domain slug + track slug + tags + language)
 * to one of the 9 Atlas mastery course slugs.
 *
 * @deprecated Phase 8 — for runtime catalog use, read `projects.course`
 * directly. This heuristic is now only acceptable in two paths:
 *   1. one-shot backfill of legacy rows in `scripts/src/backfill-course.ts`,
 *   2. mapping a not-yet-promoted candidate proposal to its target course.
 * Adding new runtime callers must be flagged in code review.
 */

import type { AtlasCourseSlug, ProjectLanguage } from "./types";
import { normalizeStackToken } from "./jobDemand";

type Hint = {
  domainSlug?: string | null;
  trackSlug?: string | null;
  tags?: string[] | null;
  techStack?: string[] | null;
  language?: ProjectLanguage;
};

const MLOPS_KEYWORDS = new Set([
  "mlflow", "kubernetes", "kubeflow", "terraform", "ci-cd", "model-registry",
  "model-monitoring", "ml-platform",
]);

const APPLIED_LLM_KEYWORDS = new Set([
  "langgraph", "agents", "agent", "tool-use", "multi-agent", "crewai",
  "agentic", "planner",
]);

const CLOUD_DE_KEYWORDS = new Set([
  "iceberg", "delta-lake", "hudi", "athena", "lake-formation",
  "lakehouse", "redshift", "bigquery", "snowflake",
]);

const ANALYTICS_KEYWORDS = new Set([
  "dbt", "semantic-layer", "bi", "looker", "tableau", "metabase", "powerbi",
  "metrics-layer", "warehouse",
]);

export function mapToCourse(hint: Hint): AtlasCourseSlug {
  const tags = new Set((hint.tags ?? []).map(normalizeStackToken));
  const stack = new Set((hint.techStack ?? []).map(normalizeStackToken));
  const all = new Set([...tags, ...stack]);

  // Mastery sections first — they win.
  if (hint.trackSlug?.startsWith("python-mastery") || hint.domainSlug === "python-mastery") {
    return "python-libraries";
  }
  if (hint.trackSlug?.startsWith("sql-mastery") || hint.domainSlug === "sql-mastery") {
    return "sql";
  }

  // Niche specializations (most specific first).
  if ([...all].some(t => APPLIED_LLM_KEYWORDS.has(t))) return "applied-llm-engineer";
  if ([...all].some(t => CLOUD_DE_KEYWORDS.has(t))) return "cloud-data-engineer";
  if ([...all].some(t => MLOPS_KEYWORDS.has(t))) return "mlops-engineer";

  // Domain-level routing.
  switch (hint.domainSlug) {
    case "ai-engineering":
      return "ai-engineer";
    case "data-science":
      return "data-scientist";
    case "ai-mlops":
      return [...all].some(t => MLOPS_KEYWORDS.has(t)) ? "mlops-engineer" : "ai-engineer";
    case "data-engineering":
    default:
      if ([...all].some(t => ANALYTICS_KEYWORDS.has(t))) return "analytics-engineer";
      return "data-engineering";
  }
}
