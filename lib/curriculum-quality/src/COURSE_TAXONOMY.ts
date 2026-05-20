/**
 * Phase 6 — Nine-Course Curriculum Taxonomy (versioned source-of-truth).
 *
 * MIRRORS `.local/course-skill-maps.md` v1.0.0. The markdown file is the
 * human-reviewable canonical source. This TS file is what the candidate
 * generator + skill-coverage helpers consume. The `COURSE_TAXONOMY_VERSION`
 * constant is asserted by `COURSE_TAXONOMY.test.ts` to match the markdown
 * version — drift between the two breaks the build.
 *
 * Editing rules: bump the version when adding/removing skills or
 * cloud-tooling anchors, and update the markdown in the same PR. Do NOT
 * change `RUBRIC_VERSION` here — rubric and taxonomy version independently.
 */
import type { AtlasCourseSlug, AtlasRole, Difficulty } from "./types";
import { COURSE_TIER1_ANCHORS } from "./jobDemand";

export const COURSE_TAXONOMY_VERSION = "1.0.0" as const;

export type DifficultyTier = Difficulty;
export type PortfolioKind = "repo" | "dashboard" | "report" | "service" | "notebook";

export type PortfolioOutcome = {
  kind: PortfolioKind;
  description: string;
};

export type CourseSkillMap = {
  courseSlug: AtlasCourseSlug;
  /** Primary role used to default `targetRoles[]` when generating candidates. */
  primaryRole: AtlasRole;
  skills: Record<DifficultyTier, string[]>;
  /** Minimum Python depth this course expects across its candidate projects. */
  pythonDepth: DifficultyTier;
  /** Minimum SQL depth this course expects across its candidate projects. */
  sqlDepth: DifficultyTier;
  /** Tier-1 cloud/tooling anchors learners are expected to touch. */
  cloudTooling: string[];
  portfolioOutcomes: PortfolioOutcome[];
};

export const COURSE_TAXONOMY: Record<AtlasCourseSlug, CourseSkillMap> = {
  "data-engineering": {
    courseSlug: "data-engineering",
    primaryRole: "data_engineer",
    skills: {
      beginner: ["csv-ingest", "python-stdlib", "postgres-basics", "sql-joins", "cron-schedule", "git-basics", "docker-pull"],
      intermediate: ["airflow-dag", "dbt-staging", "kafka-producer", "parquet", "s3-lifecycle", "incremental-load", "schema-evolution"],
      advanced: ["kafka-streams", "flink-windows", "iceberg-table-format", "spark-tuning", "data-contracts", "slo-monitoring", "lineage-openlineage", "cdc-debezium"],
    },
    pythonDepth: "intermediate",
    sqlDepth: "advanced",
    cloudTooling: COURSE_TIER1_ANCHORS["data-engineering"],
    portfolioOutcomes: [
      { kind: "repo", description: "Runnable batch+streaming pipeline with CI, schema tests, observability hooks." },
      { kind: "dashboard", description: "Grafana/Prometheus board showing SLO + freshness metrics." },
      { kind: "service", description: "REST/gRPC ingestion endpoint backed by a queue." },
    ],
  },
  "ai-engineer": {
    courseSlug: "ai-engineer",
    primaryRole: "ai_engineer",
    skills: {
      beginner: ["openai-completion", "prompt-basics", "python-functions", "json-mode", "env-secrets"],
      intermediate: ["rag-baseline", "pgvector-index", "chunking-strategy", "eval-harness", "streaming-sse", "fastapi-route", "pydantic-output"],
      advanced: ["multi-stage-rag", "hybrid-search", "tool-use", "eval-regression-suite", "cost-latency-tuning", "caching-semantic", "observability-llm"],
    },
    pythonDepth: "advanced",
    sqlDepth: "intermediate",
    cloudTooling: COURSE_TIER1_ANCHORS["ai-engineer"],
    portfolioOutcomes: [
      { kind: "service", description: "FastAPI RAG endpoint with eval traces and SSE streaming." },
      { kind: "repo", description: "Eval suite repo with golden-set + regression report." },
      { kind: "notebook", description: "Chunking / retrieval ablation study." },
    ],
  },
  "mlops-engineer": {
    courseSlug: "mlops-engineer",
    primaryRole: "mlops_engineer",
    skills: {
      beginner: ["dockerfile-basics", "python-package", "mlflow-track", "gha-yaml", "pickle-serialize"],
      intermediate: ["model-registry", "inference-endpoint", "feature-store", "data-drift-baseline", "terraform-module", "helm-chart"],
      advanced: ["kserve-deploy", "gpu-scheduling", "prom-grafana-mlmetrics", "shadow-deploy", "canary-rollout", "slo-error-budget", "triton-multimodel"],
    },
    pythonDepth: "advanced",
    sqlDepth: "beginner",
    cloudTooling: COURSE_TIER1_ANCHORS["mlops-engineer"],
    portfolioOutcomes: [
      { kind: "repo", description: "End-to-end model-registry → deploy → monitor pipeline (Terraform + Helm)." },
      { kind: "service", description: "KServe/Triton model endpoint with metrics + alerts." },
      { kind: "dashboard", description: "Drift / latency / cost dashboard." },
    ],
  },
  "data-scientist": {
    courseSlug: "data-scientist",
    primaryRole: "data_scientist",
    skills: {
      beginner: ["pandas-basics", "seaborn-plot", "train-test-split", "accuracy-precision-recall", "notebook-hygiene"],
      intermediate: ["polars-lazy", "feature-engineering", "sklearn-pipeline", "cross-validation", "class-imbalance", "experiment-tracking-mlflow"],
      advanced: ["pytorch-trainer", "huggingface-finetune", "causal-inference-basics", "bayesian-ab", "time-series-arima-prophet", "production-notebook-to-pipeline", "feature-store-online"],
    },
    pythonDepth: "advanced",
    sqlDepth: "intermediate",
    cloudTooling: COURSE_TIER1_ANCHORS["data-scientist"],
    portfolioOutcomes: [
      { kind: "notebook", description: "Reproducible analysis with eval + decision narrative." },
      { kind: "report", description: "Written analysis with business recommendation + uncertainty." },
      { kind: "repo", description: "Notebook converted to a runnable pipeline with tests." },
    ],
  },
  "analytics-engineer": {
    courseSlug: "analytics-engineer",
    primaryRole: "analytics_engineer",
    skills: {
      beginner: ["sql-joins", "dbt-init", "staging-models", "source-yml", "dbt-tests-basics"],
      intermediate: ["dbt-marts", "incremental-models", "snapshots", "exposures", "semantic-layer-metricflow", "dbt-ci-state-modified"],
      advanced: ["dimensional-modeling-kimball", "slowly-changing-dim-type2", "dbt-mesh-cross-project-refs", "bigquery-partition-cluster", "snowflake-stream-task", "query-cost-optimization", "dq-elementary-monitors"],
    },
    pythonDepth: "beginner",
    sqlDepth: "advanced",
    cloudTooling: COURSE_TIER1_ANCHORS["analytics-engineer"],
    portfolioOutcomes: [
      { kind: "repo", description: "dbt project with staging→intermediate→mart layers + CI + dq tests." },
      { kind: "dashboard", description: "Semantic-layer-backed BI dashboard." },
      { kind: "report", description: "Model lineage + cost-tuning writeup." },
    ],
  },
  "applied-llm-engineer": {
    courseSlug: "applied-llm-engineer",
    primaryRole: "applied_llm_engineer",
    skills: {
      beginner: ["langchain-chain", "tool-call-basics", "prompt-template", "messages-api", "function-calling"],
      intermediate: ["langgraph-state-machine", "agent-with-memory", "react-agent-pattern", "eval-trajectory", "guardrails-validation", "cost-budget-policy"],
      advanced: ["multi-agent-coordination", "planner-executor-split", "self-critique-loop", "tool-use-with-retries", "agent-observability-langsmith", "agent-eval-task-success-rate", "streaming-tool-calls"],
    },
    pythonDepth: "advanced",
    sqlDepth: "beginner",
    cloudTooling: COURSE_TIER1_ANCHORS["applied-llm-engineer"],
    portfolioOutcomes: [
      { kind: "service", description: "Deployed agent with traces + eval dashboard." },
      { kind: "repo", description: "Multi-agent system with reproducible eval harness." },
      { kind: "report", description: "Agent-failure taxonomy from production traces." },
    ],
  },
  "cloud-data-engineer": {
    courseSlug: "cloud-data-engineer",
    primaryRole: "cloud_data_engineer",
    skills: {
      beginner: ["s3-bucket-basics", "iam-roles", "parquet-write", "athena-basics", "terraform-resource"],
      intermediate: ["iceberg-table", "delta-merge", "glue-catalog", "partition-pruning", "terraform-modules", "serverless-spark-emr"],
      advanced: ["iceberg-rewrite-compaction", "delta-uniform", "hudi-mor", "lakehouse-cdc-merge", "cross-region-replication", "lake-formation-fine-grained", "iac-multi-env-cdktf"],
    },
    pythonDepth: "intermediate",
    sqlDepth: "advanced",
    cloudTooling: COURSE_TIER1_ANCHORS["cloud-data-engineer"],
    portfolioOutcomes: [
      { kind: "repo", description: "IaC-deployed lakehouse with table-format ops + CDC merge." },
      { kind: "service", description: "Managed compaction / vacuum job." },
      { kind: "report", description: "Cost + query-performance comparison across table formats." },
    ],
  },
  "python-libraries": {
    courseSlug: "python-libraries",
    primaryRole: "data_engineer",
    skills: {
      beginner: ["typing-basics", "dataclasses", "pathlib", "argparse", "pytest-basics", "pip-venv"],
      intermediate: ["pydantic-v2", "httpx-async", "sqlalchemy-2-core", "polars-lazy", "pandas-extension-dtypes", "packaging-pyproject"],
      advanced: ["fastapi-dependency-injection", "asyncio-tasks-cancellation", "generators-coroutines", "pyarrow-zerocopy", "c-extension-cython", "mypy-strict", "performance-profiling-py-spy"],
    },
    pythonDepth: "advanced",
    sqlDepth: "beginner",
    cloudTooling: COURSE_TIER1_ANCHORS["python-libraries"],
    portfolioOutcomes: [
      { kind: "repo", description: "Typed library or CLI published to PyPI test index." },
      { kind: "notebook", description: "Benchmark comparing polars / pandas / pyarrow paths." },
      { kind: "service", description: "Async FastAPI service with dependency-injection patterns." },
    ],
  },
  "sql": {
    courseSlug: "sql",
    primaryRole: "analytics_engineer",
    skills: {
      beginner: ["select-where-groupby", "inner-outer-join", "aggregates", "subqueries", "case-when"],
      intermediate: ["cte", "window-functions", "lateral-join", "indexes-and-explain", "materialized-views", "recursive-cte"],
      advanced: ["query-plan-tuning", "partitioning-clustering", "correlated-subqueries", "pivot-unpivot", "sql-feature-store", "time-travel-queries", "incremental-mv-refresh"],
    },
    pythonDepth: "beginner",
    sqlDepth: "advanced",
    cloudTooling: COURSE_TIER1_ANCHORS["sql"],
    portfolioOutcomes: [
      { kind: "repo", description: "Query-tuning lab with EXPLAIN-driven optimizations." },
      { kind: "notebook", description: "DuckDB-backed analysis with window-function showcase." },
      { kind: "report", description: "Schema-design + indexing writeup." },
    ],
  },
};

/** Convenience: get the skill set for a course at-or-below a difficulty tier. */
export function skillsUpTo(course: AtlasCourseSlug, difficulty: DifficultyTier): string[] {
  const map = COURSE_TAXONOMY[course];
  if (difficulty === "beginner") return [...map.skills.beginner];
  if (difficulty === "intermediate") return [...map.skills.beginner, ...map.skills.intermediate];
  return [...map.skills.beginner, ...map.skills.intermediate, ...map.skills.advanced];
}
