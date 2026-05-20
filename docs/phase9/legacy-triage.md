# Legacy Catalog Triage Manifest (Phase 9 + Phase 10)

> **Phase 10 outcome:** 7 revise candidates promoted to authored ≥70 (batch 2). 22 archive stubs flipped to `learner_visible=false` — they remain in the DB but no longer appear in the learner catalog. Run `pnpm --filter @workspace/scripts run archive:thin-stubs` to re-apply (idempotent).

Generated from `scripts/src/triage-legacy.ts` against 32 projects with `course_source='heuristic_legacy'`.
Decision rules are deterministic and live in code — see the file header for the exact thresholds. Atlas is a 9-course platform; this manifest reads `projects.course` directly (no `mapToCourse` heuristic).

## 9-course inventory (DB truth)

| Course | Authored | Legacy | Total |
|---|---|---|---|
| data-engineering | 9 | 22 | 31 |
| ai-engineer | 4 | 2 | 6 |
| mlops-engineer | 2 | 3 | 5 |
| data-scientist | 4 | 0 | 4 |
| analytics-engineer | 4 | 1 | 5 |
| applied-llm-engineer | 2 | 0 | 2 |
| cloud-data-engineer | 4 | 4 | 8 |
| python-libraries | 2 | 0 | 2 |
| sql | 2 | 0 | 2 |
| **TOTAL** | **33** | **32** | **65** |

## Action totals

| Action | Count |
|---|---|
| grandfather | 0 |
| upgrade | 0 |
| revise | 10 |
| archive | 22 |
| _(hidden via learner_visible=false)_ | 22 |

## By course (legacy only)

| Course | grandfather | upgrade | revise | archive | total |
|---|---|---|---|---|---|
| ai-engineer | 0 | 0 | 2 | 0 | 2 |
| analytics-engineer | 0 | 0 | 0 | 1 | 1 |
| cloud-data-engineer | 0 | 0 | 2 | 2 | 4 |
| data-engineering | 0 | 0 | 6 | 16 | 22 |
| mlops-engineer | 0 | 0 | 0 | 3 | 3 |

## GRANDFATHER — 0 projects

_(none)_

## UPGRADE — 0 projects

_(none)_

## REVISE — 10 projects

| Slug | Course | Score | Steps | Enriched | Hidden | Replace candidate | Rationale |
|---|---|---|---|---|---|---|---|
| airflow-etl-dag | data-engineering | 49.3 | 1 | 0/1 |  |  | Mid-quality, has step skeleton — needs substantive rewrite |
| api-to-warehouse-ingestion | data-engineering | 49.9 | 2 | 0/2 |  |  | Mid-quality, has step skeleton — needs substantive rewrite |
| data-quality-framework | data-engineering | 45.9 | 1 | 0/1 |  |  | Mid-quality, has step skeleton — needs substantive rewrite |
| kafka-streaming-pipeline | data-engineering | 49.2 | 1 | 0/1 |  |  | Mid-quality, has step skeleton — needs substantive rewrite |
| ml-feature-store | data-engineering | 47.7 | 1 | 0/1 |  |  | Mid-quality, has step skeleton — needs substantive rewrite |
| spark-batch-processing | data-engineering | 43.8 | 1 | 0/1 |  |  | Mid-quality, has step skeleton — needs substantive rewrite |
| ai-eng-llm-eval-harness | ai-engineer | 44.2 | 5 | 0/5 |  |  | Mid-quality, has step skeleton — needs substantive rewrite |
| mlops-model-serving-canary | ai-engineer | 44.7 | 5 | 0/5 |  |  | Mid-quality, has step skeleton — needs substantive rewrite |
| delta-lake-lakehouse | cloud-data-engineer | 51.8 | 1 | 0/1 |  |  | Edge case (review individually) |
| snowflake-data-warehouse | cloud-data-engineer | 49.6 | 1 | 0/1 |  |  | Mid-quality, has step skeleton — needs substantive rewrite |

## ARCHIVE — 22 projects

| Slug | Course | Score | Steps | Enriched | Hidden | Replace candidate | Rationale |
|---|---|---|---|---|---|---|---|
| advanced-partitioning | data-engineering | 17.2 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| capstone-streaming | data-engineering | 28.9 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| data-access-governance | data-engineering | 16.2 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| data-contracts | data-engineering | 18.5 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| data-freshness-monitoring | data-engineering | 16.9 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| data-lineage-graph | data-engineering | 15.9 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| data-platform-api | data-engineering | 28.9 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| geospatial-data-pipeline | data-engineering | 15.2 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| graph-data-pipeline | data-engineering | 15.9 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| llm-data-pipeline | data-engineering | 19.7 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| log-analytics-pipeline | data-engineering | 18.5 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| multi-cloud-platform | data-engineering | 18.1 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| reverse-etl-pipeline | data-engineering | 21.2 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| streaming-joins-windows | data-engineering | 23.4 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| time-series-pipeline | data-engineering | 15.6 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| trino-federated-queries | data-engineering | 15.5 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| dbt-testing-ci | mlops-engineer | 24.9 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| kubernetes-data-platform | mlops-engineer | 22.7 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| mlflow-pipeline | mlops-engineer | 22.5 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| dbt-advanced-patterns | analytics-engineer | 22.2 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| capstone-lakehouse | cloud-data-engineer | 29.6 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
| warehouse-cost-optimization | cloud-data-engineer | 23.4 | 0 | 0/0 | hidden ✓ |  | Thin stub, no learner-facing content |
