import type { DimensionScore, ProjectInput } from "../types";

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

const KIND_BASE: Record<string, number> = {
  service: 90,
  repo: 85,
  dashboard: 80,
  report: 65,
  notebook: 45,
};

const DEPLOY_KEYWORDS = /\b(deploy|deployed|production|publish|ship|launch|host|live\s+url|kubernetes|docker\s+image)\b/i;
const DASHBOARD_KEYWORDS = /\b(dashboard|streamlit|metabase|superset|looker|tableau|grafana|chart|visualiz)/i;
const REPO_KEYWORDS = /\b(github|gitlab|repository|monorepo|portfolio|open[-\s]?source|readme)\b/i;
const REPORT_KEYWORDS = /\b(report|writeup|case\s+study|analysis\s+report|findings)\b/i;
const SERVICE_KEYWORDS = /\b(api|endpoint|service|fastapi|express|flask|microservice|webhook)\b/i;
// Rubric 1.0.1: data-asset projects (ETL pipelines, dbt models, warehouses)
// produce portfolio-worthy artifacts even without an explicit deploy.
const DATA_ASSET_KEYWORDS = /\b(pipeline|etl|elt|warehouse|lakehouse|data\s+model|transformations?|medallion|bronze\/silver\/gold|dbt\s+(?:project|model)|ingestion|cdc|stream(?:ing)?)\b/i;

export function scorePortfolio(project: ProjectInput): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];

  const declaredKind = project.proposal?.portfolioArtifact?.kind;
  if (declaredKind && KIND_BASE[declaredKind] != null) {
    const base = KIND_BASE[declaredKind] ?? 0;
    signals.push(`Declared portfolio artifact: ${declaredKind}.`);
    if (project.proposal?.portfolioArtifact?.summary && project.proposal.portfolioArtifact.summary.length >= 20) {
      signals.push("Artifact summary present.");
    } else {
      gaps.push("Artifact declared but summary is missing or too short.");
    }
    return { score: clamp(base), signals, gaps };
  }

  // Infer from project description.
  const text = `${project.shortDescription ?? ""}\n${project.fullDescription ?? ""}`;
  let inferred: string | null = null;
  let score = 30;

  if (SERVICE_KEYWORDS.test(text)) { inferred = "service"; score = 70; }
  if (REPO_KEYWORDS.test(text)) { inferred = inferred ?? "repo"; score = Math.max(score, 65); }
  if (DASHBOARD_KEYWORDS.test(text)) { inferred = inferred ?? "dashboard"; score = Math.max(score, 60); }
  if (DATA_ASSET_KEYWORDS.test(text)) { inferred = inferred ?? "repo"; score = Math.max(score, 60); signals.push("Produces a data asset (pipeline / model / warehouse)."); }
  if (REPORT_KEYWORDS.test(text)) { inferred = inferred ?? "report"; score = Math.max(score, 50); }
  if (DEPLOY_KEYWORDS.test(text)) { score += 10; signals.push("Mentions deployment/production."); }

  if (inferred) signals.push(`Inferred portfolio artifact: ${inferred}.`);
  else gaps.push("No portfolio artifact declared or inferable from description.");

  if (project.isWalkthroughOnly) {
    score = Math.min(score, 25);
    gaps.push("Walkthrough-only project — produces no shareable artifact.");
  }

  return { score: clamp(score), signals, gaps };
}
