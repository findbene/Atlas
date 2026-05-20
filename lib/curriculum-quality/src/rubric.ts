import type { DimensionKey } from "./types";

/**
 * Versioned curriculum quality rubric.
 *
 * CHANGELOG:
 * - 1.0.0 (2026-05-20) — initial weights per Phase 5 plan correction #6:
 *     25/20/15/20/15/5. Bands: <50 needs_revision, 50-69 candidate,
 *     >=70 approved (still requires human sign-off).
 * - 1.0.1 (2026-05-20) — calibration pass. Production-realism gives credit
 *     for projects whose validation enum is `self_attest` BUT whose
 *     `executionProfile` provides a real grading harness (Pyodide runs
 *     assertions in-browser — the DB enum doesn't capture this nuance).
 *     Portfolio inference recognizes pipeline/ETL/warehouse/model/dbt
 *     keywords as repo-grade portfolio artifacts.
 */
export const RUBRIC_VERSION = "1.0.1" as const;

export const RUBRIC_WEIGHTS: Record<DimensionKey, number> = {
  jobReadiness: 25,
  productionRealism: 20,
  pythonSqlDepth: 15,
  pedagogy: 20,
  portfolio: 15,
  uniqueness: 5,
};

/** Total must equal 100; asserted at module load. */
const WEIGHT_SUM = Object.values(RUBRIC_WEIGHTS).reduce((a, b) => a + b, 0);
if (WEIGHT_SUM !== 100) {
  throw new Error(`Rubric weights must sum to 100; got ${WEIGHT_SUM}`);
}

export const DUPLICATE_WARNING_THRESHOLD = 0.6;

export function recommendStatus(overall: number): "approved" | "candidate" | "needs_revision" {
  if (overall >= 70) return "approved";
  if (overall >= 50) return "candidate";
  return "needs_revision";
}
