import type { DimensionScore, StepInput, PedagogyConfigShape } from "../types";

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

const LADDER_KEYS = ["hintLevel1", "hintLevel2", "hintLevel3", "hintLevel4", "hintLevel5"] as const;

function stepIsFullyEnriched(step: StepInput): boolean {
  const cfg: PedagogyConfigShape | null = step.pedagogyConfig;
  if (!cfg) return false;
  const ladderFilled = LADDER_KEYS.filter(k => typeof cfg[k] === "string" && (cfg[k] as string).length > 0).length;
  return (
    !!step.learningObjective &&
    !!step.requiredSkill &&
    ladderFilled === 5 &&
    !!cfg.successFeedback &&
    !!cfg.failureFeedback &&
    !!cfg.portfolioRelevance
  );
}

export function scorePedagogy(steps: StepInput[]): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];

  if (steps.length === 0) {
    return { score: 0, signals: [], gaps: ["No steps."] };
  }

  const enriched = steps.filter(stepIsFullyEnriched).length;
  const ratio = enriched / steps.length;

  // Partial credit: count individual fields filled across all steps.
  let totalFields = 0;
  let filledFields = 0;
  for (const step of steps) {
    totalFields += 9;
    if (step.learningObjective) filledFields++;
    if (step.requiredSkill) filledFields++;
    const cfg = step.pedagogyConfig ?? ({} as PedagogyConfigShape);
    for (const k of LADDER_KEYS) {
      if (typeof cfg[k] === "string" && (cfg[k] as string).length > 0) filledFields++;
    }
    if (cfg.successFeedback) filledFields++;
    if (cfg.failureFeedback) filledFields++;
  }
  const fieldRatio = totalFields === 0 ? 0 : filledFields / totalFields;

  const score = Math.round(70 * ratio + 30 * fieldRatio);

  if (ratio === 1) signals.push("Every step is fully enriched (objective + skill + 5-hint ladder + feedback + portfolio).");
  else if (ratio === 0) gaps.push(`0 of ${steps.length} steps are fully enriched.`);
  else gaps.push(`Only ${enriched} of ${steps.length} steps fully enriched (${Math.round(ratio * 100)}%).`);

  if (fieldRatio < 0.5 && ratio < 1) gaps.push(`${Math.round(fieldRatio * 100)}% of pedagogy fields populated overall.`);

  return { score: clamp(score), signals, gaps };
}
