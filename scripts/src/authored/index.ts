/**
 * Phase 7 — barrel of authored projects.
 *
 * Each entry is a fully-authored `AuthoredProject` (project metadata + N steps
 * with starter_code, validation_config, expected_outputs, pedagogy_config).
 *
 * `author-project promote <slug>` upserts a single entry into the DB.
 * `author-project wave-report` audits every entry that has been promoted.
 *
 * Adding a new authored project:
 *   1. Create `scripts/src/authored/<course>__<slug>.ts` exporting a const
 *      typed as `AuthoredProject`.
 *   2. Import it here and push it into `AUTHORED_PROJECTS`.
 *   3. Run `pnpm --filter @workspace/scripts run author:project -- promote <slug>`.
 */
import type { AuthoredProject } from "@workspace/curriculum-quality";
import { sqlTimeTravelQueriesLab } from "./sql__time-travel-queries-lab";
import { aiEngineerRagBaselinePgvector } from "./ai-engineer__rag-baseline-pgvector";
import { pythonLibrariesFastapiDi } from "./python-libraries__fastapi-di";
import { aiEngineerMultiStageRagReranker } from "./ai-engineer__multi-stage-rag-reranker";
import { appliedLlmPlannerExecutor } from "./applied-llm__planner-executor";
import { appliedLlmMultiAgentCoordination } from "./applied-llm__multi-agent-coordination";
import { mlopsKserveMultiModel } from "./mlops__kserve-multi-model";
import { mlopsTerraformMlPlatform } from "./mlops__terraform-ml-platform";
import { dataEngineeringFlinkWindowedAggregations } from "./data-engineering__flink-windowed-aggregations";
import { dataEngineeringCdcDebezium } from "./data-engineering__cdc-debezium";
import { cloudDataEngineerIcebergCompactionRewrite } from "./cloud-data-engineer__iceberg-compaction-rewrite";
import { cloudDataEngineerHudiMorCdcMerge } from "./cloud-data-engineer__hudi-mor-cdc-merge";
import { analyticsEngineerSnowflakeStreamTaskPipeline } from "./analytics-engineer__snowflake-stream-task-pipeline";
import { analyticsEngineerDbtCiStateModified } from "./analytics-engineer__dbt-ci-state-modified";
// Phase 10 batch-2 revise upgrades (already registered below).
// Phase 11 batch-3 revise upgrades (skeleton rebuilds + carry-overs).
import { aiEngineerLlmEvalHarness } from "./ai-engineer__llm-eval-harness";
import { aiEngineerModelServingCanary } from "./ai-engineer__model-serving-canary";
import { cloudDataEngineerDeltaLakeLakehouse } from "./cloud-data-engineer__delta-lake-lakehouse";
import { cloudDataEngineerSnowflakeDataWarehouse } from "./cloud-data-engineer__snowflake-data-warehouse";
import { dataEngineeringAirflowEtlDag } from "./data-engineering__airflow-etl-dag";
import { dataEngineeringApiToWarehouseIngestion } from "./data-engineering__api-to-warehouse-ingestion";
import { dataEngineeringDataQualityFramework } from "./data-engineering__data-quality-framework";
import { pythonLibrariesPydanticValidationService } from "./python-libraries__pydantic-validation-service";
import { dataScientistNotebookToProduction } from "./data-scientist__notebook-to-production";
import { dataScientistPytorchImageFinetuning } from "./data-scientist__pytorch-image-finetuning";
import { sqlFeatureStoreLab } from "./sql__feature-store-lab";
// Phase 9 batch-1 upgrades.
import { dataEngineeringRealTimeDashboard } from "./data-engineering__real-time-dashboard";
import { dataEngineeringDebeziumCdc } from "./data-engineering__debezium-cdc";
import { dataEngineeringVectorDatabaseSearch } from "./data-engineering__vector-database-search";
import { dataEngineeringStreamProcessingFlink } from "./data-engineering__stream-processing-flink";
import { cloudDataEngineerIcebergTableFormat } from "./cloud-data-engineer__iceberg-table-format";
import { cloudDataEngineerDbtMacrosMastery } from "./cloud-data-engineer__dbt-macros-mastery";
// Phase 10 batch-2 revise upgrades.
import { analyticsEngineerDataCatalogImplementation } from "./analytics-engineer__data-catalog-implementation";
import { aiEngineerRagPipeline } from "./ai-engineer__rag-pipeline";
import { aiEngineerFeatureStore } from "./ai-engineer__feature-store";
import { dataScientistCausalInferenceUplift } from "./data-scientist__causal-inference-uplift";
import { dataScientistAbTestFromScratch } from "./data-scientist__ab-test-from-scratch";
import { dataEngineeringColumnStoreEngine } from "./data-engineering__column-store-engine";
import { dataEngineeringDataMeshDesign } from "./data-engineering__data-mesh-design";

// Phase-7 authored modules (appended as each is written).
export const AUTHORED_PROJECTS: AuthoredProject[] = [
  sqlTimeTravelQueriesLab,
  aiEngineerRagBaselinePgvector,
  pythonLibrariesFastapiDi,
  aiEngineerMultiStageRagReranker,
  appliedLlmPlannerExecutor,
  appliedLlmMultiAgentCoordination,
  mlopsKserveMultiModel,
  mlopsTerraformMlPlatform,
  dataEngineeringFlinkWindowedAggregations,
  dataEngineeringCdcDebezium,
  cloudDataEngineerIcebergCompactionRewrite,
  cloudDataEngineerHudiMorCdcMerge,
  analyticsEngineerSnowflakeStreamTaskPipeline,
  analyticsEngineerDbtCiStateModified,
  pythonLibrariesPydanticValidationService,
  dataScientistNotebookToProduction,
  dataScientistPytorchImageFinetuning,
  sqlFeatureStoreLab,
  // Phase 9 batch-1 upgrades.
  dataEngineeringRealTimeDashboard,
  dataEngineeringDebeziumCdc,
  dataEngineeringVectorDatabaseSearch,
  dataEngineeringStreamProcessingFlink,
  cloudDataEngineerIcebergTableFormat,
  cloudDataEngineerDbtMacrosMastery,
  // Phase 10 batch-2 revise upgrades.
  analyticsEngineerDataCatalogImplementation,
  aiEngineerRagPipeline,
  aiEngineerFeatureStore,
  dataScientistCausalInferenceUplift,
  dataScientistAbTestFromScratch,
  dataEngineeringColumnStoreEngine,
  dataEngineeringDataMeshDesign,
  // Phase 11 batch-3 revise upgrades (skeleton rebuilds + carry-overs).
  aiEngineerLlmEvalHarness,
  aiEngineerModelServingCanary,
  cloudDataEngineerDeltaLakeLakehouse,
  cloudDataEngineerSnowflakeDataWarehouse,
  dataEngineeringAirflowEtlDag,
  dataEngineeringApiToWarehouseIngestion,
  dataEngineeringDataQualityFramework,
];

export function findAuthored(slug: string): AuthoredProject | undefined {
  return AUTHORED_PROJECTS.find(p => p.slug === slug);
}

export const PHASE7_SLUGS: readonly string[] = AUTHORED_PROJECTS.map(p => p.slug);
