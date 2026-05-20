/**
 * Atlas 2026+ job-demand map — derived from .local/job-demand-map.md.
 *
 * If you edit this file, bump JOB_DEMAND_VERSION and update the markdown
 * source-of-truth first. Tests assert version sync.
 */

import type { AtlasCourseSlug, AtlasRole } from "./types";

export const JOB_DEMAND_VERSION = "1.0.0" as const;

export type DemandTier = "tier1" | "tier2" | "tier3" | "legacy";

const TIER1 = new Set([
  "dbt", "dlt", "snowflake", "databricks", "duckdb", "iceberg", "delta-lake", "hudi",
  "spark", "kafka", "flink", "airflow", "dagster", "prefect",
  "langchain", "langgraph", "llamaindex", "openai", "anthropic", "gemini",
  "pinecone", "weaviate", "qdrant", "chromadb", "pgvector",
  "rag", "evals", "fastapi", "polars", "mlflow", "kubeflow", "kubernetes", "terraform",
  "bigquery", "redshift", "athena", "streaming", "vector-search",
  "huggingface", "transformers", "observability", "opentelemetry",
]);

const TIER2 = new Set([
  "python", "sql", "postgres", "mysql", "redis", "docker", "aws", "gcp", "azure",
  "pandas", "numpy", "scikit-learn", "pytorch", "tensorflow", "jupyter",
  "sqlalchemy", "drizzle", "prisma", "rest", "graphql", "json", "parquet", "avro",
  "ci", "github-actions", "gitlab-ci", "prometheus", "grafana",
  "git", "linux", "bash",
]);

const TIER3 = new Set([
  "html", "css", "csv", "xml", "http", "oop", "functions", "loops", "classes",
  "markdown", "regex",
]);

const LEGACY = new Set([
  "hadoop", "mapreduce", "hive", "pig", "oozie", "sqoop",
  "oracle-forms", "sas", "spss", "cobol", "perl",
  "ftp",
]);

export function normalizeStackToken(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    // common aliases
    .replace(/^postgresql$/, "postgres")
    .replace(/^psql$/, "postgres")
    .replace(/^k8s$/, "kubernetes")
    .replace(/^sklearn$/, "scikit-learn")
    .replace(/^scikit_learn$/, "scikit-learn")
    .replace(/^tf$/, "tensorflow")
    .replace(/^hf$/, "huggingface")
    .replace(/^gha$/, "github-actions")
    .replace(/^vectordb$/, "vector-search")
    .replace(/^vector-db$/, "vector-search");
}

export function tierOf(token: string): DemandTier | null {
  const t = normalizeStackToken(token);
  if (TIER1.has(t)) return "tier1";
  if (TIER2.has(t)) return "tier2";
  if (TIER3.has(t)) return "tier3";
  if (LEGACY.has(t)) return "legacy";
  return null;
}

/** Course -> tier1 anchors expected to appear. Used by catalog gap detection. */
export const COURSE_TIER1_ANCHORS: Record<AtlasCourseSlug, string[]> = {
  "data-engineering": ["airflow", "dbt", "kafka", "spark", "postgres", "snowflake", "dlt"],
  "ai-engineer": ["openai", "anthropic", "rag", "evals", "fastapi", "pgvector"],
  "mlops-engineer": ["mlflow", "kubernetes", "docker", "terraform", "kubeflow"],
  "data-scientist": ["polars", "scikit-learn", "pytorch", "huggingface", "mlflow"],
  "analytics-engineer": ["dbt", "snowflake", "bigquery", "duckdb", "polars"],
  "applied-llm-engineer": ["langgraph", "langchain", "evals", "observability"],
  "cloud-data-engineer": ["iceberg", "delta-lake", "terraform", "athena", "bigquery"],
  "python-libraries": ["polars", "pandas", "fastapi", "pydantic", "sqlalchemy"],
  "sql": ["duckdb", "snowflake", "dbt", "postgres"],
};

/** Role -> expected stack overlap. Used for role-coverage signals. */
export const ROLE_PRIMARY_STACK: Record<AtlasRole, string[]> = {
  data_engineer: ["python", "sql", "postgres", "airflow", "dbt", "kafka", "docker"],
  ai_engineer: ["python", "openai", "anthropic", "rag", "fastapi", "pgvector", "evals"],
  mlops_engineer: ["python", "mlflow", "docker", "kubernetes", "terraform"],
  data_scientist: ["python", "pandas", "polars", "scikit-learn"],
  analytics_engineer: ["sql", "dbt", "snowflake", "bigquery", "duckdb"],
  applied_llm_engineer: ["langgraph", "langchain", "evals", "observability"],
  cloud_data_engineer: ["iceberg", "delta-lake", "terraform", "bigquery", "athena"],
};

export const ALL_ROLES: AtlasRole[] = [
  "data_engineer", "ai_engineer", "mlops_engineer", "data_scientist",
  "analytics_engineer", "applied_llm_engineer", "cloud_data_engineer",
];

export const ALL_COURSES: AtlasCourseSlug[] = [
  "data-engineering", "ai-engineer", "mlops-engineer", "data-scientist",
  "analytics-engineer", "applied-llm-engineer", "cloud-data-engineer",
  "python-libraries", "sql",
];
