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
  if (kind === "exact") {
    assertValidExactSpec(spec);
  }
  if (kind === "regex") {
    assertValidRegexSpec(spec);
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

/** Canonical keys the `contains` runtime (`matchContains`) actually reads. */
const CONTAINS_ALLOWED_KEYS = new Set(["needle", "needles", "match", "caseInsensitive"]);

function assertValidContainsSpec(spec: Record<string, unknown>): void {
  // Phase 61I — strict allowlist. The contains runtime reads ONLY `needle` /
  // `needles` (+ the `match` / `caseInsensitive` modifiers); ANY other key is
  // silently ignored and would ship a dead gate (auto-pass on every submission).
  // The 61I catalog sweep converted every legacy bespoke key (`mustContainAll`,
  // `mustContain`, `required`, `requiredSubstrings`, `expected`, `*MustContain`,
  // `scenarios`, `cases`, `forbidden`, …) to canonical `needles` or to
  // `self_attest`, so this strict allowlist no longer breaks the authored-index
  // import (proven catalog-wide by `audit:validation-keys`). For a check the
  // contains runtime cannot perform (must-NOT-contain, exit codes, counts,
  // multi-scenario behavior) use `self_attest` — never smuggle it into a contains
  // spec, where it would silently pass everyone.
  for (const k of Object.keys(spec)) {
    if (!CONTAINS_ALLOWED_KEYS.has(k)) {
      throw new Error(
        `contains spec: '${k}' is not a key the runtime reads — it would silently ` +
          `auto-pass any submission. Use the canonical 'needles' array (or legacy ` +
          `'needle'); for a check 'contains' cannot perform, use self_attest.`,
      );
    }
  }

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
  // (Phase 61I: the dead `mustContainAll` / bespoke-marker rejection is now
  // subsumed by the strict allowlist at the top of this function.)
}

// ── Phase 61H/61I — `exact` structured-spec validator ──────────────────────
//
// The exact runtime grades the FULL submission against the DB `expected_output`
// text column. Phase 61I closes the authoring→runtime contract: `promote` now
// populates `expected_output` from `spec.expected`, so an authored exact step is
// actually enforceable. Require a non-empty string `expected` and reject every
// other key — a marker key (`needles`/`mustContainAll`/…) or a bespoke
// `expected*` assertion was a category error that, as `exact`, fails closed on a
// null expected (a dead gate pre-61H). For a marker/substring check use
// `contains` with `needles`; for a check Atlas cannot perform use `self_attest`.
// See docs/phases/phase-61i-*.
function assertValidExactSpec(spec: Record<string, unknown>): void {
  for (const k of Object.keys(spec)) {
    if (k !== "expected") {
      throw new Error(
        `exact spec: '${k}' is not read by the exact runtime (it compares the full ` +
        `submission against expected_output). Only 'expected' is allowed; for a ` +
        `marker/substring check use validationConfig("contains", …, { needles: [...] }), ` +
        `and for a check Atlas cannot perform use self_attest.`,
      );
    }
  }
  const expected = (spec as { expected?: unknown }).expected;
  if (typeof expected !== "string" || expected.length === 0) {
    throw new Error(
      `exact spec: a non-empty string 'expected' is required — promote maps it to the ` +
      `expected_output column the exact grader compares against; a missing/empty ` +
      `expected would fail closed (a dead gate).`,
    );
  }
}

// ── Phase 61I — `regex` structured-spec validator ──────────────────────────
//
// The regex runtime tests the submission against `new RegExp(spec.pattern,
// spec.flags)`. An empty/absent pattern compiles to `//`, which matches every
// string → an auto-pass dead gate (the same wrapper-shaped defect 61G fixed for
// contains; 61I also fixes the runtime to read the inner `spec`). Require a
// non-empty string `pattern` that compiles, allow only `pattern`/`flags`, and
// type-check `flags`. There are zero authored regex steps today, so this guard
// is forward-looking — it stops a future regex dead gate from shipping.
function assertValidRegexSpec(spec: Record<string, unknown>): void {
  for (const k of Object.keys(spec)) {
    if (k !== "pattern" && k !== "flags") {
      throw new Error(
        `regex spec: '${k}' is not read by the regex runtime. Only 'pattern' and 'flags' are allowed.`,
      );
    }
  }
  if (typeof spec.pattern !== "string" || spec.pattern.length === 0) {
    throw new Error(
      `regex spec: a non-empty string 'pattern' is required (an empty pattern matches ` +
      `everything = a dead gate).`,
    );
  }
  if (spec.flags !== undefined && typeof spec.flags !== "string") {
    throw new Error(`regex spec: 'flags' must be a string when present (got ${typeof spec.flags}).`);
  }
  try {
    new RegExp(spec.pattern, typeof spec.flags === "string" ? spec.flags : "");
  } catch (e) {
    throw new Error(`regex spec: 'pattern' does not compile — ${(e as Error).message}`);
  }
}

// ── Phase 61J — `json_equal` structured-spec validator ─────────────────────
//
// The commit-path json_equal grader (`gradeSubmission`) deep-compares the learner
// submission against `spec.expected`. Require `expected` present (any JSON value)
// and reject every other key — bespoke assertion keys (`assert*`, `mocked*`,
// `expect*`, `cases`, …) the runtime never reads would ship a dead gate. The 61J
// sweep converted semantic / approximate / multi-scenario json_equal steps to
// `self_attest`, so this strict allowlist no longer breaks the authored-index
// import. (NOTE: the Phase-48/52 ENVELOPE comparator reads the separate
// `expected_output` column; this guard governs only the authored `spec` shape.)
function assertValidJsonEqualSpec(spec: Record<string, unknown>): void {
  for (const k of Object.keys(spec)) {
    if (k !== "expected") {
      throw new Error(
        `json_equal spec: '${k}' is not read by the json_equal runtime (it deep-compares the ` +
        `submission against 'expected'). Only 'expected' is allowed; for a check Atlas cannot ` +
        `perform (running your program, approximate/threshold values) use self_attest.`,
      );
    }
  }
  if (!("expected" in spec) || spec.expected === undefined) {
    throw new Error(
      `json_equal spec: an 'expected' JSON value is required — the runtime deep-compares the ` +
      `submission against it; a missing expected would fail closed (a dead gate).`,
    );
  }
}

// ── Phase 61J — `numeric_tolerance` structured-spec validator ──────────────
//
// The runtime parses the submission as a single number and passes iff
// |submission − expected| ≤ tolerance. Require a finite numeric `expected` + a
// finite non-negative numeric `tolerance`; reject every other key (multi-field
// objects, `floors`, bespoke `*Ratio`/`*Fraction`/`*Min`/`*Max` threshold keys).
// The 61J sweep converted multi-field / threshold (≥/≤) intents to `self_attest`
// (a symmetric ± band cannot honestly express them), so this allowlist is
// import-safe.
function assertValidNumericToleranceSpec(spec: Record<string, unknown>): void {
  for (const k of Object.keys(spec)) {
    if (k !== "expected" && k !== "tolerance") {
      throw new Error(
        `numeric_tolerance spec: '${k}' is not read by the runtime. Only 'expected' (number) and ` +
        `'tolerance' (number) are allowed; for a multi-field or threshold (≥/≤) check use self_attest.`,
      );
    }
  }
  if (typeof spec.expected !== "number" || !Number.isFinite(spec.expected)) {
    throw new Error(
      `numeric_tolerance spec: a finite numeric 'expected' is required (got ${typeof spec.expected}).`,
    );
  }
  if (typeof spec.tolerance !== "number" || !Number.isFinite(spec.tolerance) || spec.tolerance < 0) {
    throw new Error(
      `numeric_tolerance spec: a finite non-negative numeric 'tolerance' is required (got ${JSON.stringify(spec.tolerance)}).`,
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
