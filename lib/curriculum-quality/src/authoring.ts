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
  // Phase 56 — kind-specific structural validation for `contains`.
  // Legacy `{ needle }` and empty `{}` (expectedOutput fallback) shapes
  // remain accepted. New structured fields are validated here so authoring
  // failures surface at construction time, not at runtime grader entry.
  // Other kinds remain untouched (pass-through spec).
  if (kind === "contains") {
    assertValidContainsSpec(spec);
  }
  if (kind === "csv_set_equal") {
    assertValidCsvSetEqualSpec(spec);
  }
  if (kind === "sql_resultset") {
    // Phase 58A — `sql_resultset` shares the csv_set_equal opt-in rowset
    // contract. The guard only validates when `serverGrade: true`; the legacy
    // free-form sql_resultset specs (`{query, expectedRow(s)}`, scalar
    // `expected*` assertions) carry no serverGrade and pass through untouched,
    // exactly as the runtime auto-passes them.
    assertValidSqlResultsetSpec(spec);
  }
  return { kind, description, spec };
}

// ── Phase 56 — `contains` structured-spec validator ────────────────────────
//
// Authoring-time guard for the `contains` validation kind. Mirrors the
// runtime semantics matrix in `artifacts/api-server/src/lib/grading.ts`
// (`matchContains`). Zod has no first-class "warning" channel — this
// helper parses-or-rejects. Non-blocking concerns (e.g. `needle` AND
// `needles` both set, `match: "any"`) are emitted by the authoring audit
// as advisories, NOT raised here. See
// `docs/phases/phase-56-contains-hardening.md` for the matrix.

/** Maximum number of needles in a single `needles[]` entry. Mirrors the
 *  runtime cap in `matchContains` (`MAX_NEEDLES = 16`). */
export const CONTAINS_MAX_NEEDLES = 16;

/** Shape accepted for a `contains` validation spec. All fields optional;
 *  legacy `{ needle }` and `{}` (expectedOutput-fallback) shapes remain
 *  valid. Runtime ignores unknown keys for forward-compatibility. */
export type ContainsSpec = {
  needle?: string;
  needles?: string[];
  match?: "all" | "any";
  caseInsensitive?: boolean;
};

function assertValidContainsSpec(spec: Record<string, unknown>): void {
  if (spec.needle !== undefined && typeof spec.needle !== "string") {
    throw new Error(
      `contains spec: 'needle' must be a string when present (got ${typeof spec.needle}).`,
    );
  }

  if (spec.needles !== undefined) {
    if (!Array.isArray(spec.needles)) {
      throw new Error("contains spec: 'needles' must be an array of strings.");
    }
    if (spec.needles.length === 0) {
      throw new Error("contains spec: 'needles' must contain at least one entry (use legacy 'needle' for a single string).");
    }
    if (spec.needles.length > CONTAINS_MAX_NEEDLES) {
      throw new Error(`contains spec: 'needles' must contain at most ${CONTAINS_MAX_NEEDLES} entries.`);
    }
    if (!spec.needles.every((n) => typeof n === "string" && n.length > 0)) {
      throw new Error("contains spec: every entry in 'needles' must be a non-empty string.");
    }
  }

  if (spec.match !== undefined) {
    if (spec.match !== "all" && spec.match !== "any") {
      throw new Error(`contains spec: 'match' must be \"all\" or \"any\" (got ${JSON.stringify(spec.match)}).`);
    }
  }

  if (spec.caseInsensitive !== undefined && typeof spec.caseInsensitive !== "boolean") {
    throw new Error(`contains spec: 'caseInsensitive' must be a boolean when present (got ${typeof spec.caseInsensitive}).`);
  }

  // Phase 61G — reject the specific dead `mustContainAll` alias the runtime never
  // reads. It shipped on C2 / SaaS mart / FinOps pre-61G and silently auto-passed
  // any submission; the canonical multi-marker key is `needles` (defaults to
  // match:"all"). Failing it here makes the mistake surface at authoring time
  // instead of shipping a dead gate.
  //
  // NOTE (tracked follow-up, NOT fixed in 61G): a broader set of legacy authored
  // contains steps use OTHER bespoke keys the runtime also ignores (`mustContain`,
  // `userMsgMustContain`, `reportMustContain`, `expected`, …) — those are
  // catalog-wide dead gates too. They are tolerated here (a hard reject would
  // break importing the authored index) and surfaced by `audit:contains-bc` for
  // the visible ones; converting them all to `needles` is a separate content
  // sweep. See docs/phases/phase-61g-*.
  if (spec.mustContainAll !== undefined) {
    throw new Error(
      `contains spec: 'mustContainAll' is not a key the runtime reads — it would ` +
      `silently auto-pass any submission. Use the canonical 'needles' array instead.`,
    );
  }
}

// ── Phase 57A — `csv_set_equal` structured-spec validator ─────────────────
//
// Authoring-time guard. Mirrors the runtime semantics in
// `artifacts/api-server/src/lib/grading.ts` (`gradeCsvSetEqual`):
//   - When `serverGrade: true`, REQUIRE `columns` + (`expectedRows` OR `expectedRowsHash`).
//   - When `serverGrade` is absent or false, accept legacy fixture-based
//     shapes (e.g. `{columns, expectedCsv, orderSensitive?}`) and Phase-7
//     `{cleanColumns, expectedClean, rejectColumns, expectedRejects}`
//     (Shape E, deferred from Phase 57A) — only validate the types of any
//     known new fields that are present.
//   - All optional new fields strictly type-checked: booleans must be
//     booleans (no coercion), `dedupe` must be one of the three literals,
//     `expectedRowsHash` must be 64-char lowercase hex.
//   - Unknown spec keys are tolerated for forward-compatibility (matches
//     the Phase 56 contains pattern).

/** Acceptable values for `expectedRows[][]` cells. Mirrors `RunCapture` row cells. */
export type CsvSetEqualCell = string | number | boolean | null;
export type CsvSetEqualRow = ReadonlyArray<CsvSetEqualCell>;

/** Shape accepted for a `csv_set_equal` validation spec. All fields optional. */
export type CsvSetEqualSpec = {
  /** Opt-in flag for server-side grading. When absent or false, server
   *  preserves pre-Phase-57A auto-pass behavior (BC). */
  serverGrade?: boolean;
  /** Expected column order (required when `serverGrade: true`). */
  columns?: string[];
  /** Inline expected rows (positional cells matching `columns`). */
  expectedRows?: CsvSetEqualRow[];
  /** SHA-256 (64 lowercase hex chars) of the canonical multiset fingerprint.
   *  Compute with `pnpm --filter @workspace/scripts run hash:csv-rows`. */
  expectedRowsHash?: string;
  /** When true, row order is enforced positionally. Default false (multiset). */
  orderSensitive?: boolean;
  /** When true, string cells are trimmed before comparison. Default false. */
  trimStrings?: boolean;
  /** When true, null and "" are treated as equal (both → null). Default false. */
  nullEqualsEmpty?: boolean;
  /** When true, decimal-string cells are coerced to numbers. Default false. */
  coerceNumericStrings?: boolean;
  /** When true, string cells AND headers are lowercased. Default false. */
  caseInsensitive?: boolean;
  /** Duplicate-row handling. "expected" dedupes the expected side only;
   *  "both" dedupes both sides; false (default) preserves multiset semantics. */
  dedupe?: "expected" | "both" | false;
};

/**
 * Shared rowset-spec authoring guard (Phase 58A extraction).
 *
 * `csv_set_equal` (Phase 57A) and `sql_resultset` (Phase 58A) share ONE
 * opt-in server-grading contract (`{columns, expectedRows|expectedRowsHash}`
 * + normalization flags), graded by one runtime comparator
 * (`gradeRowsetSubmission` in api-server). This guard is the authoring-time
 * mirror of that comparator — anything it rejects here, the runtime rejects.
 * `kindLabel` only personalizes the error-message prefix; the rules are
 * identical for both kinds.
 */
function assertValidRowsetSpec(spec: Record<string, unknown>, kindLabel: string): void {
  const serverGrade = spec.serverGrade;

  // `serverGrade` type itself is ALWAYS lint-checked at authoring time.
  // Runtime is unaffected (it treats anything !== true as opt-out, which
  // is safe), but rejecting non-boolean values here catches typos like
  // `serverGrade: "true"` that would silently leave a step on the BC
  // auto-pass path forever. This is a strictly additive author lint that
  // does NOT diverge runtime semantics.
  if (serverGrade !== undefined && typeof serverGrade !== "boolean") {
    throw new Error(
      `${kindLabel} spec: 'serverGrade' must be a boolean when present (got ${typeof serverGrade}).`,
    );
  }

  // ── Symmetry with runtime (Phase 57A architect-fix) ────────────────
  // Comparator fields are validated ONLY when opted in. When
  // `serverGrade !== true`, the runtime auto-passes the spec verbatim
  // (BC path) and never inspects these fields — so the authoring guard
  // does the same to keep both layers strictly identical and to preserve
  // pass-through of legacy fixture shapes (csv: A–E; sql_resultset:
  // `{query, expectedRow(s)}` + scalar `expected*` assertions). The
  // minimum-contract checks below (columns + expectedRows/Hash present)
  // also live inside this branch and run exactly when the runtime would
  // inspect them.
  if (serverGrade !== true) {
    return;
  }

  for (const k of ["orderSensitive", "trimStrings", "nullEqualsEmpty", "coerceNumericStrings", "caseInsensitive"] as const) {
    const v = spec[k];
    if (v !== undefined && typeof v !== "boolean") {
      throw new Error(`${kindLabel} spec: '${k}' must be a boolean when present (got ${typeof v}).`);
    }
  }

  if (spec.dedupe !== undefined) {
    if (spec.dedupe !== false && spec.dedupe !== "expected" && spec.dedupe !== "both") {
      throw new Error(
        `${kindLabel} spec: 'dedupe' must be false | "expected" | "both" (got ${JSON.stringify(spec.dedupe)}).`,
      );
    }
  }

  if (spec.columns !== undefined) {
    if (!Array.isArray(spec.columns)) {
      throw new Error(`${kindLabel} spec: 'columns' must be an array of strings.`);
    }
    if (!spec.columns.every((c) => typeof c === "string" && c.length > 0)) {
      throw new Error(`${kindLabel} spec: every entry in 'columns' must be a non-empty string.`);
    }
  }

  if (spec.expectedRows !== undefined) {
    if (!Array.isArray(spec.expectedRows)) {
      throw new Error(`${kindLabel} spec: 'expectedRows' must be a 2D array.`);
    }
    if (
      !spec.expectedRows.every(
        (row) =>
          Array.isArray(row) &&
          row.every(
            (cell) =>
              cell === null ||
              typeof cell === "string" ||
              typeof cell === "number" ||
              typeof cell === "boolean",
          ),
      )
    ) {
      throw new Error(
        `${kindLabel} spec: 'expectedRows' entries must be arrays of (string|number|boolean|null) cells.`,
      );
    }
  }

  if (spec.expectedRowsHash !== undefined) {
    if (typeof spec.expectedRowsHash !== "string" || !/^[0-9a-f]{64}$/.test(spec.expectedRowsHash)) {
      throw new Error(
        `${kindLabel} spec: 'expectedRowsHash' must be a 64-character lowercase hex SHA-256.`,
      );
    }
  }

  // Minimum runtime contract — at this point serverGrade === true.
  {
    if (!Array.isArray(spec.columns) || spec.columns.length === 0) {
      throw new Error(
        `${kindLabel} spec: 'columns' (non-empty) is required when 'serverGrade: true'.`,
      );
    }
    if (spec.expectedRows === undefined && spec.expectedRowsHash === undefined) {
      throw new Error(
        `${kindLabel} spec: must provide 'expectedRows' or 'expectedRowsHash' when 'serverGrade: true'.`,
      );
    }
    if (spec.orderSensitive === true && spec.expectedRows === undefined) {
      throw new Error(
        `${kindLabel} spec: 'orderSensitive: true' requires inline 'expectedRows' (positional). Hash alone is multiset-only.`,
      );
    }
    if (spec.expectedRows !== undefined) {
      const cols = spec.columns as string[];
      const allWidthsMatch = (spec.expectedRows as unknown[][]).every(
        (r) => Array.isArray(r) && r.length === cols.length,
      );
      if (!allWidthsMatch) {
        throw new Error(
          `${kindLabel} spec: every 'expectedRows' entry must have exactly ${cols.length} cells (matching 'columns').`,
        );
      }
    }
  }
}

/** Phase 57A — `csv_set_equal` authoring guard (thin wrapper over the shared
 *  rowset guard). */
function assertValidCsvSetEqualSpec(spec: Record<string, unknown>): void {
  assertValidRowsetSpec(spec, "csv_set_equal");
}

/** Phase 58A — `sql_resultset` authoring guard. Same opt-in rowset contract
 *  as csv_set_equal; legacy free-form sql_resultset specs (no serverGrade)
 *  pass through untouched. */
function assertValidSqlResultsetSpec(spec: Record<string, unknown>): void {
  assertValidRowsetSpec(spec, "sql_resultset");
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
  /**
   * Phase 8 — explicit lineage from the originating `project_candidates.id`.
   * Required for every authored project so promote can stamp
   * `projects.source_candidate_id` without falling back to title-matching.
   * UUID string.
   */
  candidateId: string;
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
