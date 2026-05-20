/**
 * Phase 8 — single source of truth for Phase-7 authored project lineage.
 *
 * Two maps live here so both the backfill script and `author-project promote`
 * can read the same data:
 *
 *   - COURSE_FOR_AUTHORED_SLUG: project slug → Atlas course (9-course taxonomy)
 *   - CANDIDATE_FOR_AUTHORED_SLUG: project slug → originating candidate UUID
 *
 * The `candidateId` is also stamped on each `AuthoredProject` (typed field,
 * not a comment) so the lineage is enforced at the type layer. This map is
 * the one place that owns the Phase-7 cohort listing.
 */
import type { AtlasCourseSlug } from "@workspace/curriculum-quality";

export const COURSE_FOR_AUTHORED_SLUG: Record<string, AtlasCourseSlug> = {
  "sql-time-travel-queries-lab": "sql",
  "ai-engineer-rag-baseline-pgvector": "ai-engineer",
  "python-libraries-fastapi-di": "python-libraries",
  "ai-engineer-multi-stage-rag-reranker": "ai-engineer",
  "applied-llm-planner-executor": "applied-llm-engineer",
  "applied-llm-multi-agent-coordination": "applied-llm-engineer",
  "mlops-kserve-multi-model": "mlops-engineer",
  "mlops-terraform-ml-platform": "mlops-engineer",
  "data-engineering-flink-windowed-aggregations": "data-engineering",
  "data-engineering-cdc-debezium": "data-engineering",
  "cloud-data-engineer-iceberg-compaction-rewrite": "cloud-data-engineer",
  "cloud-data-engineer-hudi-mor-cdc-merge": "cloud-data-engineer",
  "analytics-engineer-snowflake-stream-task-pipeline": "analytics-engineer",
  "analytics-engineer-dbt-ci-state-modified": "analytics-engineer",
  "python-libraries-pydantic-validation-service": "python-libraries",
  "data-scientist-notebook-to-production": "data-scientist",
  "data-scientist-pytorch-image-finetuning": "data-scientist",
  "sql-feature-store-lab": "sql",
};

export const CANDIDATE_FOR_AUTHORED_SLUG: Record<string, string> = {
  "sql-time-travel-queries-lab": "30750cbc-a4cf-4426-97dd-57baddd85b1e",
  "ai-engineer-rag-baseline-pgvector": "1f0d4364-e8af-4054-83fb-918a4976f51c",
  "python-libraries-fastapi-di": "74681082-46ca-4d3c-9bf7-29ea9a563391",
  "ai-engineer-multi-stage-rag-reranker": "9e681a72-cd70-4242-b44b-a880d3e8cd9e",
  "applied-llm-planner-executor": "68e53f49-ccce-4c79-a44a-6d9cfb1c24d2",
  "applied-llm-multi-agent-coordination": "cd46a53e-8532-4cdb-b5ee-9db38a3dfbd8",
  "mlops-kserve-multi-model": "0acbb8e4-0910-403f-b714-4ec2b78420ca",
  "mlops-terraform-ml-platform": "49204556-683d-4ad7-b0e9-167f8b3cf212",
  "data-engineering-flink-windowed-aggregations": "9a704771-3360-45b3-88e2-8020a627a6d6",
  "data-engineering-cdc-debezium": "e74740b9-152a-40b7-bbdb-798a485e89e6",
  "cloud-data-engineer-iceberg-compaction-rewrite": "bbb58131-76b5-41f3-b2ae-7bea4e2c0981",
  "cloud-data-engineer-hudi-mor-cdc-merge": "e9b594d1-fe69-4bd5-b7f6-6b53456c18a7",
  "analytics-engineer-snowflake-stream-task-pipeline": "3f258d41-44b7-4c78-8e6b-9f7d9c0e85fd",
  "analytics-engineer-dbt-ci-state-modified": "d1f6eeff-77d0-4cfe-a557-b41b02e268ba",
  "python-libraries-pydantic-validation-service": "f8836bb9-48b8-4709-8254-6b6e6357786f",
  "data-scientist-notebook-to-production": "a40f5e5d-01b8-4feb-aa01-dbdc7146e9ad",
  "data-scientist-pytorch-image-finetuning": "e376cd0d-a945-43f5-8ec9-3edade7fd5f5",
  "sql-feature-store-lab": "660b9b59-d6a2-41fe-9e76-137160b06063",
};

/**
 * DB has 4 domain rows (ai-engineering, ai-mlops, data-engineering,
 * data-science); the 9 courses fan in onto those. Phase 9 may split
 * tracks per course without changing this contract.
 */
export const COURSE_TO_DOMAIN_SLUG: Record<AtlasCourseSlug, string> = {
  "ai-engineer": "ai-engineering",
  "applied-llm-engineer": "ai-engineering",
  "mlops-engineer": "ai-mlops",
  "data-engineering": "data-engineering",
  "cloud-data-engineer": "data-engineering",
  "analytics-engineer": "data-engineering",
  "python-libraries": "data-engineering",
  "sql": "data-engineering",
  "data-scientist": "data-science",
};

/**
 * Phase 8 — canonical course → track slug map. Replaces the legacy
 * `limit(1)` track lookup. Today every course maps to the single existing
 * track per domain (`-core`); Phase 9 can split per course.
 *
 * Track slugs MUST exist in the seeded `tracks` table for the
 * corresponding domain — promote will fail loudly if not.
 */
export const COURSE_TO_TRACK_SLUG: Record<AtlasCourseSlug, string> = {
  "ai-engineer": "ai-engineering-core",
  "applied-llm-engineer": "ai-engineering-core",
  "mlops-engineer": "ai-mlops-core",
  "data-engineering": "de-core",
  "cloud-data-engineer": "de-core",
  "analytics-engineer": "de-core",
  "python-libraries": "de-core",
  "sql": "de-core",
  "data-scientist": "data-science-core",
};
