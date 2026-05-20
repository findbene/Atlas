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
];

export function findAuthored(slug: string): AuthoredProject | undefined {
  return AUTHORED_PROJECTS.find(p => p.slug === slug);
}

export const PHASE7_SLUGS: readonly string[] = AUTHORED_PROJECTS.map(p => p.slug);
