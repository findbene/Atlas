/**
 * Adapters between DB rows and the pure ProjectInput/StepInput shapes
 * consumed by @workspace/curriculum-quality.
 *
 * Keeps the lib free of any Drizzle / DB-specific types.
 */
import { db } from "@workspace/db";
import {
  projects, projectSteps, domains, tracks, projectCandidates,
  type Project, type ProjectStep, type ProjectCandidate,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import type {
  ProjectInput, StepInput, PedagogyConfigShape, AtlasCourseSlug, AtlasRole, Difficulty,
} from "@workspace/curriculum-quality";

export type LoadedProject = {
  raw: Project;
  course: AtlasCourseSlug | null;
  input: ProjectInput;
  steps: StepInput[];
};

function stepRowToInput(step: ProjectStep): StepInput {
  const cfg = (step.pedagogyConfig ?? null) as PedagogyConfigShape | null;
  return {
    stepNumber: step.stepNumber,
    title: step.title,
    instructionMd: step.instructionMd ?? "",
    validationType: step.validationType,
    type: step.type,
    hasDatasetRefs: !!step.datasetRefs,
    hasExpectedOutputs: !!step.expectedOutputs,
    pedagogyConfig: cfg,
    learningObjective: step.learningObjective ?? null,
    requiredSkill: step.requiredSkill ?? null,
  };
}

export function projectRowToInput(row: Project): ProjectInput {
  // Authored promotes stash the AuthoredPortfolioArtifact under
  // `qualityBreakdown.portfolioArtifact` (see author-project.ts). Hoist
  // it into ProposalInput.portfolioArtifact so the portfolio scorer reads
  // the declared kind/summary instead of falling back to keyword inference
  // on the description text. Mapping is intentional: AuthoredPortfolioArtifact
  // uses `deliverable` for the human-facing summary string.
  const qb = (row.qualityBreakdown ?? null) as { portfolioArtifact?: {
    kind?: "repo" | "dashboard" | "report" | "service" | "notebook";
    deliverable?: string;
    portfolioRelevance?: string;
  } } | null;
  const authoredPortfolio = qb?.portfolioArtifact;
  const proposal = authoredPortfolio?.kind && authoredPortfolio?.deliverable
    ? {
        portfolioArtifact: {
          kind: authoredPortfolio.kind,
          summary: authoredPortfolio.deliverable,
        } as const,
      }
    : undefined;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    language: row.language,
    difficulty: row.difficultyLevel,
    techStack: row.techStack ?? [],
    tags: row.tags ?? [],
    totalSteps: row.totalSteps,
    estimatedMinutes: row.estimatedMinutes,
    isMultiFile: row.isMultiFile,
    isWalkthroughOnly: row.isWalkthroughOnly,
    hasExecutionProfile: !!row.executionProfile,
    proposal,
  };
}

export async function loadAllProjects(
  mapCourse: (hint: {
    domainSlug?: string | null;
    trackSlug?: string | null;
    tags?: string[] | null;
    techStack?: string[] | null;
  }) => AtlasCourseSlug,
): Promise<LoadedProject[]> {
  const rows = await db.query.projects.findMany({ orderBy: [asc(projects.orderIndex)] });
  const out: LoadedProject[] = [];

  // Build domain/track slug lookups in one batch.
  const domainRows = await db.select({ id: domains.id, slug: domains.slug }).from(domains);
  const trackRows = await db.select({ id: tracks.id, slug: tracks.slug }).from(tracks);
  const domainSlug = new Map(domainRows.map(d => [d.id, d.slug]));
  const trackSlug = new Map(trackRows.map(t => [t.id, t.slug]));

  for (const row of rows) {
    const stepRows = await db.query.projectSteps.findMany({
      where: eq(projectSteps.projectId, row.id),
      orderBy: [asc(projectSteps.stepNumber)],
    });
    // Phase 8 — prefer the native `projects.course` column. Fall back
    // to the heuristic `mapCourse` only for legacy rows that haven't
    // been backfilled (none post-Phase-8, but keep the safety net).
    const course = (row.course as AtlasCourseSlug | null) ?? mapCourse({
      domainSlug: domainSlug.get(row.domainId) ?? null,
      trackSlug: trackSlug.get(row.trackId) ?? null,
      tags: row.tags,
      techStack: row.techStack,
    });
    out.push({
      raw: row,
      course,
      input: projectRowToInput(row),
      steps: stepRows.map(stepRowToInput),
    });
  }
  return out;
}

export type CandidateScoringContext = { input: ProjectInput; steps: StepInput[] };

/**
 * Convert a candidate row + its proposal into a (project, steps) shape the
 * scoring lib can grade. Pseudo-steps are synthesized from
 * `proposal.proposedSteps` so production-realism / depth / pedagogy
 * scorers receive non-empty input (otherwise 55% of rubric weight
 * collapses to zero and no candidate can ever clear the approval band
 * without --force).
 *
 * The pseudo-steps are intentionally conservative: validation defaults to
 * `self_attest` (candidates haven't authored validators yet) and no
 * pedagogy_config is attached, so a strong candidate proposal still has
 * room to grow once authored. The candidate must demonstrate stack/
 * uniqueness/portfolio strength on its own merits.
 */
export function candidateRowToContext(row: ProjectCandidate): CandidateScoringContext {
  const proposal = (row.proposal as Record<string, unknown> | null) ?? {};
  const portfolioArtifact = (proposal.portfolioArtifact as
    { kind: "repo" | "dashboard" | "report" | "service" | "notebook"; summary: string }
    | undefined) ?? undefined;
  const proposedSteps = Array.isArray(proposal.proposedSteps)
    ? (proposal.proposedSteps as Array<{ title: string; summary: string; requiredSkill: string }>)
    : [];

  // Infer language from stack so depth/realism scorers map correctly.
  const stackLower = (row.proposedStack ?? []).map(s => s.toLowerCase());
  const hasPy = stackLower.some(s => /python|pandas|polars|fastapi|django|pyodide|pyarrow|numpy|sklearn|scikit/.test(s));
  const hasSql = stackLower.some(s => /sql|postgres|mysql|snowflake|bigquery|duckdb|dbt/.test(s));
  const inferredLang: "python" | "sql" | "both" = hasPy && hasSql ? "both" : hasSql ? "sql" : "python";
  const stepCodeType: "code_python" | "code_sql" = inferredLang === "sql" ? "code_sql" : "code_python";

  const steps: StepInput[] = proposedSteps.map((s, i) => ({
    stepNumber: i + 1,
    title: s.title,
    instructionMd: s.summary,
    validationType: "self_attest",
    type: stepCodeType,
    hasDatasetRefs: false,
    hasExpectedOutputs: false,
    pedagogyConfig: null,
    learningObjective: s.summary,
    requiredSkill: s.requiredSkill,
  }));

  const input: ProjectInput = {
    id: row.id,
    slug: row.id,
    title: row.proposedTitle,
    shortDescription: (proposal.rationale as string | undefined) ?? null,
    fullDescription: (proposal.rationale as string | undefined) ?? null,
    language: inferredLang,
    difficulty: row.difficulty as Difficulty,
    techStack: row.proposedStack ?? [],
    tags: [],
    totalSteps: proposedSteps.length,
    estimatedMinutes: typeof proposal.estimatedHours === "number" ? (proposal.estimatedHours as number) * 60 : null,
    isMultiFile: proposedSteps.length >= 4,
    isWalkthroughOnly: false,
    hasExecutionProfile: false,
    proposedCourse: row.proposedCourse as AtlasCourseSlug,
    targetRoles: row.targetRoles as AtlasRole[],
    proposal: portfolioArtifact ? { portfolioArtifact } : undefined,
  };
  return { input, steps };
}

/** Back-compat for callers that only need the ProjectInput shape. */
export function candidateRowToInput(row: ProjectCandidate): ProjectInput {
  return candidateRowToContext(row).input;
}

export async function loadAllCandidates(): Promise<ProjectCandidate[]> {
  return await db.query.projectCandidates.findMany({
    orderBy: [asc(projectCandidates.createdAt)],
  });
}
