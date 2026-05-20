import type { DimensionScore, ProjectInput, StepInput } from "../types";

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

const REAL_VALIDATION = new Set([
  "exact", "regex", "contains", "numeric_tolerance",
  "csv_set_equal", "csv_ordered", "json_equal", "sql_resultset",
]);

export function scoreProductionRealism(
  project: ProjectInput,
  steps: StepInput[],
): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];

  if (steps.length === 0) {
    return { score: 0, signals: [], gaps: ["No steps defined."] };
  }

  const realValidations = steps.filter(s => REAL_VALIDATION.has(s.validationType)).length;
  const rawRealRatio = realValidations / steps.length;
  // Rubric 1.0.1: when an executionProfile is wired up, Pyodide runs real
  // in-browser assertions even if the DB validation enum is `self_attest`.
  // Give that path partial credit so projects on the modern runner aren't
  // unfairly penalized for the legacy enum value.
  const realRatio = project.hasExecutionProfile ? Math.max(rawRealRatio, 0.8) : rawRealRatio;

  const datasetSteps = steps.filter(s => s.hasDatasetRefs).length;
  const expectedSteps = steps.filter(s => s.hasExpectedOutputs).length;

  let score = 20;
  score += Math.round(40 * realRatio);
  if (project.isMultiFile) { score += 8; signals.push("Multi-file project."); }
  if (project.hasExecutionProfile) { score += 10; signals.push("Has explicit execution profile."); }
  if (datasetSteps > 0) { score += Math.min(10, 3 * datasetSteps); signals.push(`${datasetSteps} step(s) reference real datasets.`); }
  if (expectedSteps > 0) { score += Math.min(8, 2 * expectedSteps); }
  if (project.isWalkthroughOnly) {
    gaps.push("Walkthrough-only — learner does not actually build.");
    score = Math.min(score, 35);
  }
  if ((project.estimatedMinutes ?? 0) >= 60) score += 4;
  if ((project.estimatedMinutes ?? 0) < 20) gaps.push("Estimated duration < 20 min — likely too shallow.");

  if (rawRealRatio === 0 && !project.hasExecutionProfile) {
    gaps.push("All steps use self_attest validation — no automated grading.");
  } else if (rawRealRatio === 0 && project.hasExecutionProfile) {
    signals.push("Validation is via execution profile (Pyodide harness).");
  } else if (rawRealRatio < 0.5) {
    gaps.push(`Only ${Math.round(rawRealRatio * 100)}% of steps have real validation.`);
  } else {
    signals.push(`${Math.round(rawRealRatio * 100)}% of steps have real validation.`);
  }

  if (!project.hasExecutionProfile && !project.isWalkthroughOnly) {
    gaps.push("No execution profile — falls back to simulated runner.");
  }

  return { score: clamp(score), signals, gaps };
}
