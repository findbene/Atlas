import type { DimensionScore, ProjectInput, StepInput } from "../types";

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

const PY_ADVANCED = /\b(async|await|asyncio|generator|decorator|context\s+manager|typing|protocol|dataclass|polars|pyarrow|numpy\s+broadcast|vector|gradient|backprop|fastapi|pydantic)\b/i;
const SQL_ADVANCED = /\b(window\s+function|cte|common\s+table\s+expression|recursive|partition\s+by|over\s*\(|lateral|materialized|explain|index|vacuum|qualify|pivot|unpivot)\b/i;

export function scorePythonSqlDepth(
  project: ProjectInput,
  steps: StepInput[],
): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];

  if (steps.length === 0) {
    return { score: 0, signals: [], gaps: ["No steps to evaluate."] };
  }

  const codeSteps = steps.filter(s => s.type.startsWith("code_")).length;
  const codeRatio = codeSteps / steps.length;
  const avgLen = Math.round(
    steps.reduce((a, s) => a + (s.instructionMd?.length ?? 0), 0) / steps.length,
  );

  const corpus = steps.map(s => `${s.title}\n${s.instructionMd}`).join("\n");
  const pyHits = (corpus.match(PY_ADVANCED) ? 1 : 0);
  const sqlHits = (corpus.match(SQL_ADVANCED) ? 1 : 0);
  const lang = project.language;

  let score = 20;
  // Step-count sweet spot 3..8
  if (steps.length >= 3 && steps.length <= 8) { score += 15; signals.push(`Step count ${steps.length} in healthy 3–8 range.`); }
  else if (steps.length < 3) gaps.push(`Only ${steps.length} step(s) — too few for meaningful depth.`);
  else if (steps.length > 10) gaps.push(`${steps.length} steps — risk of dilution.`);

  score += Math.round(25 * codeRatio);
  if (codeRatio < 0.4) gaps.push(`${Math.round(codeRatio * 100)}% code steps — mostly prose.`);
  else if (codeRatio >= 0.7) signals.push(`${Math.round(codeRatio * 100)}% code steps.`);

  if (avgLen >= 600) { score += 15; signals.push(`Avg instruction length ${avgLen} chars — substantive.`); }
  else if (avgLen >= 300) { score += 8; }
  else gaps.push(`Avg instruction length ${avgLen} chars — too terse.`);

  if (lang === "python" || lang === "both") {
    if (pyHits) { score += 10; signals.push("Mentions advanced Python patterns."); }
    else if (lang === "python") gaps.push("No advanced Python patterns mentioned.");
  }
  if (lang === "sql" || lang === "both") {
    if (sqlHits) { score += 10; signals.push("Mentions advanced SQL patterns (windows / CTEs / explain etc.)."); }
    else if (lang === "sql") gaps.push("No advanced SQL patterns mentioned.");
  }
  if (lang === "both") score += 5;

  return { score: clamp(score), signals, gaps };
}
