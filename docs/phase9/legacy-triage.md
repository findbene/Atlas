# Phase 9 — Legacy Catalog Triage Manifest

Generated from `scripts/src/triage-legacy.ts` against 45 projects with `course_source='heuristic_legacy'`.
Decision rules are deterministic and live in code — see the file header for the exact thresholds.

## Action totals

| Action | Count |
|---|---|
| grandfather | 0 |
| upgrade | 6 |
| revise | 17 |
| archive | 22 |

## By course

| Course | grandfather | upgrade | revise | archive | total |
|---|---|---|---|---|---|
| ai-engineer | 0 | 0 | 4 | 0 | 4 |
| analytics-engineer | 0 | 0 | 1 | 1 | 2 |
| cloud-data-engineer | 0 | 2 | 2 | 2 | 6 |
| data-engineering | 0 | 4 | 8 | 16 | 28 |
| data-scientist | 0 | 0 | 2 | 0 | 2 |
| mlops-engineer | 0 | 0 | 0 | 3 | 3 |

## GRANDFATHER — 0 projects

_(none)_

## UPGRADE — 6 projects

| Slug | Course | Score | Steps | Enriched | Rationale |
|---|---|---|---|---|---|
| debezium-cdc | data-engineering | 57.2 | 5 | 0/5 | Strong skeleton — small lift to reach ≥70 |
| real-time-dashboard | data-engineering | 59 | 5 | 0/5 | Strong skeleton — small lift to reach ≥70 |
| stream-processing-flink | data-engineering | 55.1 | 5 | 0/5 | Strong skeleton — small lift to reach ≥70 |
| vector-database-search | data-engineering | 56.1 | 5 | 0/5 | Strong skeleton — small lift to reach ≥70 |
| dbt-macros-mastery | cloud-data-engineer | 56.1 | 5 | 0/5 | Strong skeleton — small lift to reach ≥70 |
| iceberg-table-format | cloud-data-engineer | 52.1 | 5 | 0/5 | Strong skeleton — small lift to reach ≥70 |

## REVISE — 17 projects

| Slug | Course | Score | Steps | Enriched | Rationale |
|---|---|---|---|---|---|
| airflow-etl-dag | data-engineering | 49.3 | 1 | 0/1 | Mid-quality, has step skeleton — needs substantive rewrite |
| api-to-warehouse-ingestion | data-engineering | 49.9 | 2 | 0/2 | Mid-quality, has step skeleton — needs substantive rewrite |
| column-store-engine | data-engineering | 41.9 | 5 | 0/5 | Mid-quality, has step skeleton — needs substantive rewrite |
| data-mesh-design | data-engineering | 41.7 | 5 | 0/5 | Mid-quality, has step skeleton — needs substantive rewrite |
| data-quality-framework | data-engineering | 45.9 | 1 | 0/1 | Mid-quality, has step skeleton — needs substantive rewrite |
| kafka-streaming-pipeline | data-engineering | 49.2 | 1 | 0/1 | Mid-quality, has step skeleton — needs substantive rewrite |
| ml-feature-store | data-engineering | 47.7 | 1 | 0/1 | Mid-quality, has step skeleton — needs substantive rewrite |
| spark-batch-processing | data-engineering | 43.8 | 1 | 0/1 | Mid-quality, has step skeleton — needs substantive rewrite |
| ai-eng-llm-eval-harness | ai-engineer | 44.2 | 5 | 0/5 | Mid-quality, has step skeleton — needs substantive rewrite |
| ai-eng-rag-pipeline | ai-engineer | 48.7 | 5 | 0/5 | Mid-quality, has step skeleton — needs substantive rewrite |
| mlops-feature-store | ai-engineer | 49.4 | 5 | 0/5 | Mid-quality, has step skeleton — needs substantive rewrite |
| mlops-model-serving-canary | ai-engineer | 44.7 | 5 | 0/5 | Mid-quality, has step skeleton — needs substantive rewrite |
| ds-ab-test-from-scratch | data-scientist | 40.6 | 5 | 0/5 | Mid-quality, has step skeleton — needs substantive rewrite |
| ds-causal-inference-uplift | data-scientist | 41.9 | 5 | 0/5 | Mid-quality, has step skeleton — needs substantive rewrite |
| data-catalog-implementation | analytics-engineer | 49.8 | 5 | 0/5 | Mid-quality, has step skeleton — needs substantive rewrite |
| delta-lake-lakehouse | cloud-data-engineer | 51.8 | 1 | 0/1 | Edge case (review individually) |
| snowflake-data-warehouse | cloud-data-engineer | 49.6 | 1 | 0/1 | Mid-quality, has step skeleton — needs substantive rewrite |

## ARCHIVE — 22 projects

| Slug | Course | Score | Steps | Enriched | Rationale |
|---|---|---|---|---|---|
| advanced-partitioning | data-engineering | 17.2 | 0 | 0/0 | Thin stub, no learner-facing content |
| capstone-streaming | data-engineering | 28.9 | 0 | 0/0 | Thin stub, no learner-facing content |
| data-access-governance | data-engineering | 16.2 | 0 | 0/0 | Thin stub, no learner-facing content |
| data-contracts | data-engineering | 18.5 | 0 | 0/0 | Thin stub, no learner-facing content |
| data-freshness-monitoring | data-engineering | 16.9 | 0 | 0/0 | Thin stub, no learner-facing content |
| data-lineage-graph | data-engineering | 15.9 | 0 | 0/0 | Thin stub, no learner-facing content |
| data-platform-api | data-engineering | 28.9 | 0 | 0/0 | Thin stub, no learner-facing content |
| geospatial-data-pipeline | data-engineering | 15.2 | 0 | 0/0 | Thin stub, no learner-facing content |
| graph-data-pipeline | data-engineering | 15.9 | 0 | 0/0 | Thin stub, no learner-facing content |
| llm-data-pipeline | data-engineering | 19.7 | 0 | 0/0 | Thin stub, no learner-facing content |
| log-analytics-pipeline | data-engineering | 18.5 | 0 | 0/0 | Thin stub, no learner-facing content |
| multi-cloud-platform | data-engineering | 18.1 | 0 | 0/0 | Thin stub, no learner-facing content |
| reverse-etl-pipeline | data-engineering | 21.2 | 0 | 0/0 | Thin stub, no learner-facing content |
| streaming-joins-windows | data-engineering | 23.4 | 0 | 0/0 | Thin stub, no learner-facing content |
| time-series-pipeline | data-engineering | 15.6 | 0 | 0/0 | Thin stub, no learner-facing content |
| trino-federated-queries | data-engineering | 15.5 | 0 | 0/0 | Thin stub, no learner-facing content |
| dbt-testing-ci | mlops-engineer | 24.9 | 0 | 0/0 | Thin stub, no learner-facing content |
| kubernetes-data-platform | mlops-engineer | 22.7 | 0 | 0/0 | Thin stub, no learner-facing content |
| mlflow-pipeline | mlops-engineer | 22.5 | 0 | 0/0 | Thin stub, no learner-facing content |
| dbt-advanced-patterns | analytics-engineer | 22.2 | 0 | 0/0 | Thin stub, no learner-facing content |
| capstone-lakehouse | cloud-data-engineer | 29.6 | 0 | 0/0 | Thin stub, no learner-facing content |
| warehouse-cost-optimization | cloud-data-engineer | 23.4 | 0 | 0/0 | Thin stub, no learner-facing content |
