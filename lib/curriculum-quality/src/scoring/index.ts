import type {
  DimensionKey,
  DimensionScore,
  NeighborRef,
  ProjectInput,
  Scorecard,
  StepInput,
} from "../types";
import { RUBRIC_VERSION, RUBRIC_WEIGHTS, recommendStatus } from "../rubric";
import { scoreJobReadiness } from "./jobReadiness";
import { scoreProductionRealism } from "./productionRealism";
import { scorePythonSqlDepth } from "./depth";
import { scorePedagogy } from "./pedagogy";
import { scorePortfolio } from "./portfolio";
import { scoreUniqueness } from "./uniqueness";

export { scoreJobReadiness, scoreProductionRealism, scorePythonSqlDepth, scorePedagogy, scorePortfolio, scoreUniqueness };

export type ScoreContext = {
  steps: StepInput[];
  neighbors: NeighborRef[];
  /**
   * 'authored' — the project has been built (steps, pedagogy_config, execution
   *   profile authored). Full rubric applies.
   * 'candidate' — proposal-stage scoring; the `pedagogy` dimension is excluded
   *   (pedagogy ladders/feedback can only exist once authored) and the
   *   remaining 5 dimension weights are renormalized to sum to 100. Without
   *   this, candidate scoring artificially caps below the approval band even
   *   for strong proposals — see rubric 1.0.1 changelog.
   */
  stage?: "authored" | "candidate";
};

export function composeScorecard(
  project: ProjectInput,
  ctx: ScoreContext,
): Scorecard {
  const stage = ctx.stage ?? "authored";
  const jobReadiness = scoreJobReadiness(project);
  const productionRealism = scoreProductionRealism(project, ctx.steps);
  const pythonSqlDepth = scorePythonSqlDepth(project, ctx.steps);
  const pedagogy = scorePedagogy(ctx.steps);
  const portfolio = scorePortfolio(project);
  const { dimension: uniqueness, duplicateWarning } = scoreUniqueness(ctx.neighbors);

  const dimensions: Record<DimensionKey, DimensionScore> = {
    jobReadiness, productionRealism, pythonSqlDepth, pedagogy, portfolio, uniqueness,
  };

  const activeKeys: DimensionKey[] = stage === "candidate"
    ? ["jobReadiness", "productionRealism", "pythonSqlDepth", "portfolio", "uniqueness"]
    : (Object.keys(RUBRIC_WEIGHTS) as DimensionKey[]);
  const activeWeightSum = activeKeys.reduce((a, k) => a + RUBRIC_WEIGHTS[k], 0);

  let overall = 0;
  for (const k of activeKeys) {
    overall += (dimensions[k].score * RUBRIC_WEIGHTS[k]) / activeWeightSum;
  }
  const overallRounded = Math.round(overall * 10) / 10;

  return {
    rubricVersion: RUBRIC_VERSION,
    overall: overallRounded,
    dimensions,
    recommendedStatus: recommendStatus(overallRounded),
    duplicateWarning,
    nearestNeighbors: ctx.neighbors,
  };
}
