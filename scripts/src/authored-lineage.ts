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
  // Phase 9 batch-1.
  "data-engineering-real-time-dashboard":      "data-engineering",
  "data-engineering-debezium-cdc":             "data-engineering",
  "data-engineering-vector-database-search":   "data-engineering",
  "data-engineering-stream-processing-flink":  "data-engineering",
  "cloud-data-engineer-iceberg-table-format":  "cloud-data-engineer",
  "cloud-data-engineer-dbt-macros-mastery":    "cloud-data-engineer",
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
  // Phase 10 batch-2 (synthetic candidates, source='phase10_revise').
  "analytics-engineer-data-catalog-implementation": "analytics-engineer",
  "ai-engineer-rag-pipeline":                       "ai-engineer",
  "ai-engineer-feature-store":                      "ai-engineer",
  "data-scientist-causal-inference-uplift":         "data-scientist",
  "data-scientist-ab-test-from-scratch":            "data-scientist",
  "data-engineering-column-store-engine":           "data-engineering",
  "data-engineering-data-mesh-design":              "data-engineering",
  // Phase 11 batch-3 (synthetic candidates, source='phase11_revise').
  // 2 already-5-step ai-engineer revise upgrades P10 diversity-capped out
  // + 2 cloud-DE skeleton rebuilds + 3 DE skeleton rebuilds. Cap = 7.
  "ai-engineer-llm-eval-harness":                   "ai-engineer",
  "ai-engineer-model-serving-canary":               "ai-engineer",
  "cloud-data-engineer-delta-lake-lakehouse":       "cloud-data-engineer",
  "cloud-data-engineer-snowflake-data-warehouse":   "cloud-data-engineer",
  "data-engineering-airflow-etl-dag":               "data-engineering",
  "data-engineering-api-to-warehouse-ingestion":    "data-engineering",
  "data-engineering-data-quality-framework":        "data-engineering",
  // Phase 12B batch (Phase-11 deferral completion; synthetic candidates, source='phase12b_revise').
  // 3 DE skeleton rebuilds the P11 plan explicitly deferred to "Phase 12" when cap=7.
  "data-engineering-kafka-streaming-pipeline":      "data-engineering",
  "data-engineering-ml-feature-store":              "data-engineering",
  "data-engineering-spark-batch-processing":        "data-engineering",
};

/**
 * Phase 9 — Phase-4 originals that predate the candidate pipeline. They are
 * granted synthetic `project_candidates` rows (created by
 * `backfill:grandfather-candidates`) marked with `source='grandfathered_phase4'`
 * so they preserve the same lineage contract as Phase-7 promotes without
 * weakening `AuthoredProject.candidateId` to optional. UUIDs are pinned here
 * to keep the backfill idempotent across environments.
 */
export const GRANDFATHERED_CANDIDATE_FOR_SLUG: Record<string, string> = {
  "csv-to-postgres-pipeline": "fe7f1f43-2c5f-4739-9768-6365e03c8d5c",
  "dbt-data-models":          "e1d464c4-a7a1-47ca-a680-de271c8821fe",
};

/**
 * Phase 9 batch-1 — six legacy projects with ≥4 step skeletons and quality
 * score ≥50 that we're upgrading in place (adding pedagogy + validation +
 * portfolio metadata). They predate the candidate pipeline just like the
 * grandfather cohort, so they're granted synthetic `project_candidates` rows
 * marked `source='phase9_upgrade'`. The slug keys are the FINAL course-prefixed
 * project slugs the upgrade writes to (e.g. `data-engineering-real-time-dashboard`),
 * NOT the original legacy slugs (`real-time-dashboard`) — the upgrade renames
 * to the Phase-7 convention. The legacy rows are deleted by the upgrade.
 */
/**
 * Phase 10 batch-2 — seven legacy revise-cohort projects with 5-step skeletons
 * being upgraded in place (full pedagogy, real validation, portfolio metadata).
 * Same lineage convention as `UPGRADE_CANDIDATE_FOR_SLUG`: synthetic
 * `project_candidates` rows marked `source='phase10_revise'`. Keys are the
 * FINAL course-prefixed slugs the upgrade writes to; original legacy slugs
 * (e.g. `data-catalog-implementation`) are deleted by the upgrade and mapped
 * via `PHASE10_LEGACY_SLUG_MAP` below.
 */
export const REVISE_CANDIDATE_FOR_SLUG: Record<string, string> = {
  "analytics-engineer-data-catalog-implementation": "fd08c08c-9998-4287-b3ad-b950647a8e29",
  "ai-engineer-rag-pipeline":                       "390df952-8a61-4d05-81fa-3e45fa89b606",
  "ai-engineer-feature-store":                      "97562dba-7f15-4767-a2ab-89195bc02065",
  "data-scientist-causal-inference-uplift":         "94b29e9d-48e5-4125-8486-478cd7361914",
  "data-scientist-ab-test-from-scratch":            "3338abcb-8b49-4fb3-9eff-203263415369",
  "data-engineering-column-store-engine":           "41d1a898-798e-44cc-bf54-4dbc03bf9084",
  "data-engineering-data-mesh-design":              "c4fb285a-971f-4aa5-b98e-c6ed60a92933",
  // Phase 11 batch-3 (source='phase11_revise').
  "ai-engineer-llm-eval-harness":                   "b6a7c1e2-5d34-4f88-9012-1a2b3c4d5e6f",
  "ai-engineer-model-serving-canary":               "c7b8d2f3-6e45-4a99-9123-2b3c4d5e6f70",
  "cloud-data-engineer-delta-lake-lakehouse":       "d8c9e3a4-7f56-4b00-9234-3c4d5e6f7081",
  "cloud-data-engineer-snowflake-data-warehouse":   "e9d0f4b5-8067-4c11-9345-4d5e6f708192",
  "data-engineering-airflow-etl-dag":               "f0e1a5c6-9178-4d22-9456-5e6f70819203",
  "data-engineering-api-to-warehouse-ingestion":    "a1f2b6d7-0289-4e33-9567-6f7081920314",
  "data-engineering-data-quality-framework":        "b2031ce8-139a-4f44-9678-708192031425",
  // Phase 12B batch (source='phase12b_revise') — Phase-11 deferral completion.
  "data-engineering-kafka-streaming-pipeline":      "c3142df9-24ab-4055-9789-819203142536",
  "data-engineering-ml-feature-store":              "d4253ea0-35bc-4166-989a-92031425364a",
  "data-engineering-spark-batch-processing":        "e5364fb1-46cd-4277-9aab-a3142536475b",
};

/**
 * Phase 12B — exactly 3 entries. Phase-11 deferral cohort completion: the
 * 3 DE skeleton rebuilds the original Phase-11 plan deferred to "Phase 12"
 * when the cap was set to 7. Same lineage convention as Phase 11 — synthetic
 * candidates marked `source='phase12b_revise'`.
 */
export const REVISE_CANDIDATE_FOR_SLUG_PHASE12B: Record<string, string> = {
  "data-engineering-kafka-streaming-pipeline":      "c3142df9-24ab-4055-9789-819203142536",
  "data-engineering-ml-feature-store":              "d4253ea0-35bc-4166-989a-92031425364a",
  "data-engineering-spark-batch-processing":        "e5364fb1-46cd-4277-9aab-a3142536475b",
};

/** Phase 10 legacy slug → upgraded slug. Used by the batch-2 backfill to
 *  delete the legacy row after promote runs so we don't double-count. */
export const PHASE10_LEGACY_SLUG_MAP: Record<string, string> = {
  "data-catalog-implementation": "analytics-engineer-data-catalog-implementation",
  "ai-eng-rag-pipeline":         "ai-engineer-rag-pipeline",
  "mlops-feature-store":         "ai-engineer-feature-store",
  "ds-causal-inference-uplift":  "data-scientist-causal-inference-uplift",
  "ds-ab-test-from-scratch":     "data-scientist-ab-test-from-scratch",
  "column-store-engine":         "data-engineering-column-store-engine",
  "data-mesh-design":            "data-engineering-data-mesh-design",
};

/** Phase 11 legacy slug → upgraded slug. Same convention as PHASE10 map:
 *  the legacy slug (no course prefix) is deleted by the Phase-11 backfill
 *  after the upgraded course-prefixed slug is promoted. */
export const PHASE11_LEGACY_SLUG_MAP: Record<string, string> = {
  "ai-eng-llm-eval-harness":     "ai-engineer-llm-eval-harness",
  "mlops-model-serving-canary":  "ai-engineer-model-serving-canary",
  "delta-lake-lakehouse":        "cloud-data-engineer-delta-lake-lakehouse",
  "snowflake-data-warehouse":    "cloud-data-engineer-snowflake-data-warehouse",
  "airflow-etl-dag":             "data-engineering-airflow-etl-dag",
  "api-to-warehouse-ingestion":  "data-engineering-api-to-warehouse-ingestion",
  "data-quality-framework":      "data-engineering-data-quality-framework",
};

/**
 * Phase 12B — exactly 3 mappings. Legacy slug → upgraded slug for the
 * Phase-11 deferral completion cohort. The legacy rows are NOT deleted by
 * the Phase-12B archive script; only `learner_visible` is flipped to false
 * (archive-by-hide pattern, same as Phase 12A).
 */
export const PHASE12B_LEGACY_SLUG_MAP: Record<string, string> = {
  "kafka-streaming-pipeline":  "data-engineering-kafka-streaming-pipeline",
  "ml-feature-store":          "data-engineering-ml-feature-store",
  "spark-batch-processing":    "data-engineering-spark-batch-processing",
};

export const UPGRADE_CANDIDATE_FOR_SLUG: Record<string, string> = {
  "data-engineering-real-time-dashboard":      "49f38e2b-c7ba-4e44-9374-412f0e33844e",
  "data-engineering-debezium-cdc":             "0a2e73a8-abd8-41a1-b74c-e7de3fcb3acc",
  "data-engineering-vector-database-search":   "1559c008-acd5-499b-9fc3-b93b2b9cc72d",
  "data-engineering-stream-processing-flink":  "01047b6e-bc8c-46dc-8044-e022915f2002",
  "cloud-data-engineer-iceberg-table-format":  "52e7704a-c3a1-4e56-bfcd-36f102ad6e6c",
  "cloud-data-engineer-dbt-macros-mastery":    "08624753-d098-4c13-b87e-9936bb68a48c",
};

/**
 * Legacy slug → upgraded slug. Used by the Phase-9 upgrade backfill to delete
 * the legacy row after the new one is promoted so we don't double-count.
 */
export const PHASE9_LEGACY_SLUG_MAP: Record<string, string> = {
  "real-time-dashboard":      "data-engineering-real-time-dashboard",
  "debezium-cdc":             "data-engineering-debezium-cdc",
  "vector-database-search":   "data-engineering-vector-database-search",
  "stream-processing-flink":  "data-engineering-stream-processing-flink",
  "iceberg-table-format":     "cloud-data-engineer-iceberg-table-format",
  "dbt-macros-mastery":       "cloud-data-engineer-dbt-macros-mastery",
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
  // Phase 9 batch-1 (synthetic candidates, source='phase9_upgrade').
  "data-engineering-real-time-dashboard":      "49f38e2b-c7ba-4e44-9374-412f0e33844e",
  "data-engineering-debezium-cdc":             "0a2e73a8-abd8-41a1-b74c-e7de3fcb3acc",
  "data-engineering-vector-database-search":   "1559c008-acd5-499b-9fc3-b93b2b9cc72d",
  "data-engineering-stream-processing-flink":  "01047b6e-bc8c-46dc-8044-e022915f2002",
  "cloud-data-engineer-iceberg-table-format":  "52e7704a-c3a1-4e56-bfcd-36f102ad6e6c",
  "cloud-data-engineer-dbt-macros-mastery":    "08624753-d098-4c13-b87e-9936bb68a48c",
  // Phase 10 batch-2 (synthetic candidates, source='phase10_revise').
  "analytics-engineer-data-catalog-implementation": "fd08c08c-9998-4287-b3ad-b950647a8e29",
  "ai-engineer-rag-pipeline":                       "390df952-8a61-4d05-81fa-3e45fa89b606",
  "ai-engineer-feature-store":                      "97562dba-7f15-4767-a2ab-89195bc02065",
  "data-scientist-causal-inference-uplift":         "94b29e9d-48e5-4125-8486-478cd7361914",
  "data-scientist-ab-test-from-scratch":            "3338abcb-8b49-4fb3-9eff-203263415369",
  "data-engineering-column-store-engine":           "41d1a898-798e-44cc-bf54-4dbc03bf9084",
  "data-engineering-data-mesh-design":              "c4fb285a-971f-4aa5-b98e-c6ed60a92933",
  // Phase 11 batch-3 (synthetic candidates, source='phase11_revise').
  "ai-engineer-llm-eval-harness":                   "b6a7c1e2-5d34-4f88-9012-1a2b3c4d5e6f",
  "ai-engineer-model-serving-canary":               "c7b8d2f3-6e45-4a99-9123-2b3c4d5e6f70",
  "cloud-data-engineer-delta-lake-lakehouse":       "d8c9e3a4-7f56-4b00-9234-3c4d5e6f7081",
  "cloud-data-engineer-snowflake-data-warehouse":   "e9d0f4b5-8067-4c11-9345-4d5e6f708192",
  "data-engineering-airflow-etl-dag":               "f0e1a5c6-9178-4d22-9456-5e6f70819203",
  "data-engineering-api-to-warehouse-ingestion":    "a1f2b6d7-0289-4e33-9567-6f7081920314",
  "data-engineering-data-quality-framework":        "b2031ce8-139a-4f44-9678-708192031425",
  // Phase 12B batch (synthetic candidates, source='phase12b_revise').
  "data-engineering-kafka-streaming-pipeline":      "c3142df9-24ab-4055-9789-819203142536",
  "data-engineering-ml-feature-store":              "d4253ea0-35bc-4166-989a-92031425364a",
  "data-engineering-spark-batch-processing":        "e5364fb1-46cd-4277-9aab-a3142536475b",
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
