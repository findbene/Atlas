/**
 * Shared types for the Atlas curriculum quality system.
 *
 * The lib is intentionally pure: no DB, no IO, no Drizzle imports. Callers
 * (scripts, api-server) adapt their DB rows into these structural shapes.
 */

export type AtlasCourseSlug =
  | "data-engineering"
  | "ai-engineer"
  | "mlops-engineer"
  | "data-scientist"
  | "analytics-engineer"
  | "applied-llm-engineer"
  | "cloud-data-engineer"
  | "python-libraries"
  | "sql";

export type AtlasRole =
  | "data_engineer"
  | "ai_engineer"
  | "mlops_engineer"
  | "data_scientist"
  | "analytics_engineer"
  | "applied_llm_engineer"
  | "cloud_data_engineer";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type ProjectLanguage = "python" | "sql" | "both";

export type QualityStatus =
  | "unreviewed"
  | "approved"
  | "needs_revision"
  | "rejected";

export type CandidateStatus =
  | "candidate"
  | "approved"
  | "needs_revision"
  | "rejected";

/**
 * Pedagogy config shape (mirrors the JSONB stored on project_steps).
 * Duplicated here so the lib doesn't depend on execution-core.
 */
export type PedagogyConfigShape = {
  misconceptionToWatchFor?: string;
  hintLevel1?: string;
  hintLevel2?: string;
  hintLevel3?: string;
  hintLevel4?: string;
  hintLevel5?: string;
  finalExplanation?: string;
  successFeedback?: string;
  failureFeedback?: string;
  portfolioRelevance?: string;
};

/** Structural project input used by every scorer. */
export type ProjectInput = {
  id: string;
  slug: string;
  title: string;
  shortDescription?: string | null;
  fullDescription?: string | null;
  language: ProjectLanguage;
  difficulty: Difficulty;
  techStack: string[];
  tags: string[];
  totalSteps: number;
  estimatedMinutes?: number | null;
  isWalkthroughOnly?: boolean;
  isMultiFile?: boolean;
  hasExecutionProfile?: boolean;
  /** Candidates only; null for approved projects. */
  proposedCourse?: AtlasCourseSlug | null;
  /** Candidates only; null for approved projects. */
  targetRoles?: AtlasRole[] | null;
  /** Candidates only; null for approved projects. */
  proposal?: ProposalInput | null;
};

export type StepInput = {
  stepNumber: number;
  title: string;
  instructionMd: string;
  validationType: string;
  type: string;
  hasDatasetRefs: boolean;
  hasExpectedOutputs: boolean;
  pedagogyConfig: PedagogyConfigShape | null;
  learningObjective?: string | null;
  requiredSkill?: string | null;
};

export type ProposalInput = {
  rationale?: string;
  targetRole?: AtlasRole;
  primaryStack?: string[];
  learningObjectives?: string[];
  portfolioArtifact?: {
    kind: "repo" | "dashboard" | "report" | "service" | "notebook";
    summary: string;
  };
  estimatedHours?: number;
  jobReadinessSignals?: string[];
  proposedSteps?: Array<{ title: string; summary: string; requiredSkill: string }>;
  researchSources?: Array<{ title: string; url: string }>;
};

export type DimensionKey =
  | "jobReadiness"
  | "productionRealism"
  | "pythonSqlDepth"
  | "pedagogy"
  | "portfolio"
  | "uniqueness";

export type DimensionScore = {
  score: number; // 0..100
  signals: string[];
  gaps: string[];
};

export type NeighborRef = { slug: string; title: string; similarity: number };

export type Scorecard = {
  rubricVersion: string;
  overall: number;
  dimensions: Record<DimensionKey, DimensionScore>;
  recommendedStatus: "approved" | "candidate" | "needs_revision";
  duplicateWarning: boolean;
  nearestNeighbors: NeighborRef[];
};
