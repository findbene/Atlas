/**
 * Phase 7 — authoring helpers.
 *
 * Pure helpers (no DB, no IO) that produce the exact JSONB shapes consumed by:
 *   - the DB schema (`project_steps.pedagogy_config`, `project_steps.validation_config`)
 *   - the scoring lib (`scorePedagogy`, `scorePortfolio`, `scoreProductionRealism`)
 *
 * Every helper enforces all 12 required fields from the Phase-7 plan §3.3 (C4)
 * at the type layer: a missing field is a compile error, not a runtime miss.
 *
 * Adding/changing fields here MUST NOT touch rubric weights. The rubric is
 * frozen at v1.0.1; these helpers only normalize input shape.
 */

import type { PedagogyConfigShape } from "./types";

// ── pedagogy ────────────────────────────────────────────────────────────────

/** Hint ladder: exactly 5 strings, ordered L1 (subtle nudge) → L5 (full solution). */
export type HintLadder = readonly [string, string, string, string, string];

export type AuthoredPedagogyInput = {
  hints: HintLadder;
  successFeedback: string;
  failureFeedback: string;
  /**
   * Why this specific step matters in a 2026 hiring conversation.
   * Required by C4. Separate from the project-level `portfolioRelevance`
   * on the portfolio artifact.
   */
  portfolioRelevance: string;
  finalExplanation: string;
  misconceptionToWatchFor: string;
};

/**
 * Build a pedagogy_config jsonb. Type signature guarantees all 10 fields
 * `scorePedagogy` checks for are non-empty strings.
 */
export function pedagogyConfig(input: AuthoredPedagogyInput): Required<PedagogyConfigShape> {
  const [hintLevel1, hintLevel2, hintLevel3, hintLevel4, hintLevel5] = input.hints;
  return {
    misconceptionToWatchFor: input.misconceptionToWatchFor,
    hintLevel1,
    hintLevel2,
    hintLevel3,
    hintLevel4,
    hintLevel5,
    finalExplanation: input.finalExplanation,
    successFeedback: input.successFeedback,
    failureFeedback: input.failureFeedback,
    portfolioRelevance: input.portfolioRelevance,
  };
}

// ── validation ──────────────────────────────────────────────────────────────

/**
 * Validation kinds. Two layers:
 *   - DB enum `project_steps.validation_type`: self_attest | code_python | code_sql | multi_file
 *   - In-config `kind`: same set + concrete result-shape variants
 *     (sql_resultset, json_equal, exact, regex, contains, numeric_tolerance,
 *      csv_set_equal, csv_ordered) — these are the strings that
 *      `scoreProductionRealism.REAL_VALIDATION` whitelists.
 */
export type ValidationKind =
  | "self_attest"
  | "code_python"
  | "code_sql"
  | "multi_file"
  | "sql_resultset"
  | "json_equal"
  | "exact"
  | "regex"
  | "contains"
  | "numeric_tolerance"
  | "csv_set_equal"
  | "csv_ordered";

export type AuthoredValidationConfig = {
  kind: ValidationKind;
  /** Plain-language description of what's being validated. */
  description: string;
  /** Kind-specific payload — runner reads this. */
  spec: Record<string, unknown>;
};

export function validationConfig(
  kind: ValidationKind,
  description: string,
  spec: Record<string, unknown>,
): AuthoredValidationConfig {
  return { kind, description, spec };
}

// ── portfolio artifact ──────────────────────────────────────────────────────

export type PortfolioArtifactKind = "repo" | "dashboard" | "report" | "service" | "notebook";

export type AuthoredPortfolioArtifact = {
  kind: PortfolioArtifactKind;
  /** What the learner walks away with (file paths, deployment URL pattern, etc.). */
  deliverable: string;
  /**
   * Why a 2026 hiring manager cares about this artifact specifically.
   * Required by C4 — distinct from per-step `pedagogy.portfolioRelevance`.
   */
  portfolioRelevance: string;
  demoUrl?: string;
  repoUrl?: string;
};

export function portfolioArtifact(input: AuthoredPortfolioArtifact): AuthoredPortfolioArtifact {
  return { ...input };
}

// ── project meta ────────────────────────────────────────────────────────────

export type AuthoredProjectMeta = {
  /** Real workplace scenario the learner steps into (C4). */
  scenario: string;
  /** Why this project maps to 2026+ hiring signals (C4). */
  hiringRelevance2026: string;
  /** GitHub-ready README outline — h2 section titles in order (C4). */
  readmeOutline: string[];
};

export function projectMeta(input: AuthoredProjectMeta): AuthoredProjectMeta {
  if (input.readmeOutline.length < 4) {
    throw new Error("projectMeta.readmeOutline must have at least 4 h2 sections (Overview, Setup, Steps, Validation minimum).");
  }
  return { ...input };
}

// ── authored project/step shape ────────────────────────────────────────────

export type AuthoredStep = {
  stepNumber: number;
  title: string;
  /** Markdown instructions shown to the learner. */
  instructionMd: string;
  learningObjective: string;
  requiredSkill: string;
  /** Starter code the learner edits (SQL, Python, or multi-file JSON blob). */
  starterCode: string;
  /**
   * Maps to the `project_steps.validation_type` DB enum. Must be one of the
   * concrete result-shape kinds the runner + scorer's REAL_VALIDATION set
   * understands (sql_resultset, json_equal, exact, ...) or `self_attest`.
   * Use the same value as `validation.kind` 99% of the time.
   */
  validationType:
    | "self_attest"
    | "sql_resultset"
    | "json_equal"
    | "exact"
    | "regex"
    | "contains"
    | "numeric_tolerance"
    | "csv_set_equal"
    | "csv_ordered";
  /** Maps to `project_steps.type` text col. */
  stepType: "code_python" | "code_sql" | "multi_file" | "writeup";
  /** jsonb persisted to `project_steps.validation_config`. */
  validation: AuthoredValidationConfig;
  /** jsonb persisted to `project_steps.expected_outputs`. */
  expectedOutputs: Record<string, unknown>;
  /** Concrete dataset references (filenames, table names, etc.) — drives the scorer's `hasDatasetRefs`. */
  datasetRefs?: string[];
  /** jsonb persisted to `project_steps.pedagogy_config`. */
  pedagogy: Required<PedagogyConfigShape>;
};

export type AuthoredProject = {
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  language: "python" | "sql" | "both";
  difficulty: "beginner" | "intermediate" | "advanced";
  techStack: string[];
  tags: string[];
  learningObjectives: string[];
  /** Realistic time budget — must be ≥60min for the realism scorer to award the duration bonus. */
  estimatedMinutes: number;
  xpReward: number;
  /** When true the realism scorer awards +8. Required true for Phase-7 (every project has ≥4 steps). */
  isMultiFile: boolean;
  meta: AuthoredProjectMeta;
  portfolio: AuthoredPortfolioArtifact;
  steps: AuthoredStep[];
};

/**
 * Runtime sanity check that an authored project satisfies the Phase-7
 * 12-required-fields contract. Throws on first violation. Cheap to call
 * inside the CLI before the DB write.
 */
export function assertAuthoredProjectComplete(p: AuthoredProject): void {
  if (p.steps.length < 4) {
    throw new Error(`${p.slug}: needs ≥4 steps (got ${p.steps.length}) — Phase-7 plan §4.2.`);
  }
  if (p.estimatedMinutes < 60) {
    throw new Error(`${p.slug}: estimatedMinutes ${p.estimatedMinutes} < 60 — realism scorer penalty.`);
  }
  if (!p.meta.scenario || !p.meta.hiringRelevance2026 || p.meta.readmeOutline.length < 4) {
    throw new Error(`${p.slug}: projectMeta incomplete.`);
  }
  if (!p.portfolio.portfolioRelevance || p.portfolio.portfolioRelevance.length < 20) {
    throw new Error(`${p.slug}: portfolio.portfolioRelevance missing or too short.`);
  }
  const seen = new Set<number>();
  for (const s of p.steps) {
    if (seen.has(s.stepNumber)) throw new Error(`${p.slug}: duplicate stepNumber ${s.stepNumber}`);
    seen.add(s.stepNumber);
    if (!s.starterCode || s.starterCode.length < 10) {
      throw new Error(`${p.slug} step ${s.stepNumber}: starterCode missing or trivially short.`);
    }
    if (!s.validation.spec || Object.keys(s.validation.spec).length === 0) {
      throw new Error(`${p.slug} step ${s.stepNumber}: validation.spec is empty.`);
    }
    if (Object.keys(s.expectedOutputs).length === 0) {
      throw new Error(`${p.slug} step ${s.stepNumber}: expectedOutputs is empty.`);
    }
    // Pedagogy: typed as Required, but double-check non-empty strings.
    const ped = s.pedagogy;
    const requiredKeys: Array<keyof typeof ped> = [
      "misconceptionToWatchFor", "hintLevel1", "hintLevel2", "hintLevel3", "hintLevel4", "hintLevel5",
      "finalExplanation", "successFeedback", "failureFeedback", "portfolioRelevance",
    ];
    for (const k of requiredKeys) {
      if (typeof ped[k] !== "string" || (ped[k] as string).length === 0) {
        throw new Error(`${p.slug} step ${s.stepNumber}: pedagogy.${String(k)} empty.`);
      }
    }
  }
}
