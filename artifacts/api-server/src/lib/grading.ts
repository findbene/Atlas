/**
 * Phase 24 — Pure server-side grading helper.
 *
 * Extracted verbatim from the inline switch that used to live inside
 * `POST /user/projects/:projectId/steps/:stepId/submit` so the same rule
 * can be reused by the new `POST .../check` route without duplicating
 * (and risking drift on) the rubric. The submit route remains
 * byte-identical in behavior — it just calls this helper instead of
 * inlining the switch.
 *
 * IMPORTANT:
 * - This helper is pure. It MUST NOT perform any DB writes, XP
 *   accounting, streak bumps, progress mutation, completion emails, or
 *   anything else with side effects. The /check route relies on this
 *   purity to guarantee its no-commit contract.
 * - The grading rules here are the source of truth for both /check and
 *   /submit. If a rule changes, both endpoints change together.
 */

export type GradableStep = {
  validationType: string | null;
  validationConfig: unknown;
  expectedOutput: string | null;
};

export type GradingOutcome = {
  passed: boolean;
  feedback: string;
};

/** Grade a submission against a step's validation rule.
 *
 *  Rules (preserved verbatim from the legacy /submit switch):
 *  - `self_attest`        → always passes; learner self-declares.
 *  - `exact`              → trimmed string equality vs `step.expectedOutput`.
 *  - `contains`           → literal substring match. Legacy shape
 *                           `{ needle }` preserved byte-identically;
 *                           Phase 56 adds optional structured fields
 *                           `{ needles[], match: "all"|"any", caseInsensitive }`.
 *                           See `matchContains` for the full semantics matrix.
 *                           Malformed new-shape configs fail CLOSED with a
 *                           generic "config malformed" feedback — they never
 *                           fall through to a silent pass.
 *  - `regex`              → `validationConfig.{pattern, flags}` test;
 *                           invalid regex fails with a config-error feedback
 *                           (NOT thrown) so the route can return cleanly.
 *  - anything else / null → passes with the generic "Step completed."
 *                           feedback (preserves legacy behavior).
 */
export function gradeSubmission(
  step: GradableStep,
  submission: string | null | undefined,
): GradingOutcome {
  const expected = step.expectedOutput?.trim();

  if (step.validationType === "self_attest") {
    return {
      passed: true,
      feedback: "Great work! You've marked this step as complete.",
    };
  }

  if (step.validationType === "exact" && expected) {
    const passed = submission?.trim() === expected;
    return { passed, feedback: passed ? "Correct!" : `Expected: ${expected}` };
  }

  if (step.validationType === "contains" && step.validationConfig) {
    return matchContains(step.validationConfig, submission, expected);
  }

  if (step.validationType === "csv_set_equal" && step.validationConfig) {
    // Phase 57A — DARK foundation. The opt-in gate is inside
    // `gradeCsvSetEqual` (`spec.serverGrade === true`); every visible row
    // today omits the flag, so this branch returns the legacy
    // `{passed:true, "Step completed."}` exactly as the pre-57A
    // fallthrough did. Audit `audit:csv-set-equal-bc` enforces byte-identity.
    const cfg = step.validationConfig as { spec?: unknown };
    return gradeCsvSetEqual(cfg.spec, submission);
  }

  if (step.validationType === "regex" && step.validationConfig) {
    const config = step.validationConfig as { pattern?: string; flags?: string };
    try {
      const re = new RegExp(config.pattern ?? "", config.flags ?? "");
      const passed = re.test(submission ?? "");
      return {
        passed,
        feedback: passed
          ? "Correct!"
          : "Your output doesn't match the expected pattern.",
      };
    } catch {
      return { passed: false, feedback: "Invalid regex pattern in grading config." };
    }
  }

  return { passed: true, feedback: "Step completed." };
}

/**
 * Phase 56 — structured literal `contains` matcher.
 *
 * Semantics matrix (BC-critical — see docs/phases/phase-56-contains-hardening.md):
 *
 *   shape                                    | path             | behavior
 *   -----------------------------------------|------------------|---------------------------------------------------
 *   {}                                       | LEGACY-FALLBACK  | needle = expectedOutput ?? "" ; submission.includes
 *   { needle }                               | LEGACY           | submission.includes(needle)
 *   { needle, caseInsensitive: true }        | LEGACY-CI        | lowercase both, includes
 *   { needles[] }                            | MULTI-ALL        | every needle found
 *   { needles[], match: "all" }              | MULTI-ALL        | every needle found
 *   { needles[], match: "any" }              | MULTI-ANY        | at least one needle found
 *   { needles[], caseInsensitive: true }     | MULTI-CI         | combinator on lowercased strings
 *   { needle, needles[] }                    | MULTI-*          | `needles` WINS; `needle` ignored
 *   { needle, match: "any" }  (no needles)   | LEGACY           | `match` SILENTLY IGNORED; legacy single-needle
 *   { caseInsensitive: "yes" }               | COERCE-FALSE     | non-boolean ci is coerced to false
 *   { needles: [] }                          | MALFORMED        | fails closed
 *   { needles: non-array | non-string item } | MALFORMED        | fails closed
 *   { needles[], match: "weird" }            | MALFORMED        | fails closed
 *
 * The caller (`gradeSubmission`) only enters this helper when both
 * `validationType === "contains"` AND `validationConfig` is truthy. The
 * `validationConfig === null/undefined` case stays in the outer fallthrough
 * and returns the generic `{passed:true, "Step completed."}` exactly as
 * pre-Phase-56 did. Do not change that guard.
 */
type ContainsConfig = {
  needle?: unknown;
  needles?: unknown;
  match?: unknown;
  caseInsensitive?: unknown;
};

const MALFORMED: GradingOutcome = {
  passed: false,
  feedback: "Grading config is malformed — please report this step.",
};

const MAX_NEEDLES = 16;

function fold(s: string, ci: boolean): string {
  return ci ? s.toLowerCase() : s;
}

function previewList(items: string[], cap = 3): string {
  const head = items.slice(0, cap).join(", ");
  return items.length > cap ? `${head}, …` : head;
}

export function matchContains(
  config: unknown,
  submission: string | null | undefined,
  expectedOutput: string | undefined,
): GradingOutcome {
  if (config === null || typeof config !== "object") {
    // Defensive: outer guard already filters null/undefined; non-object
    // configs are malformed for a structured kind.
    return MALFORMED;
  }
  const c = config as ContainsConfig;
  const sub = submission ?? "";
  const ci = c.caseInsensitive === true; // non-boolean values coerced to false

  // ── MULTI path: `needles[]` wins over legacy `needle` when present ──
  if (c.needles !== undefined) {
    if (!Array.isArray(c.needles)) return MALFORMED;
    if (c.needles.length === 0) return MALFORMED;
    if (c.needles.length > MAX_NEEDLES) return MALFORMED;
    // Every entry must be a NON-EMPTY string. Allowing `""` would silently
    // create an always-pass gate ("".includes is true for any string) and
    // breaks runtime↔authoring symmetry (assertValidContainsSpec rejects
    // the same). The legacy `{needle:""}` BC quirk is the *only* accepted
    // empty-string asymmetry; it does not extend to `needles[]`.
    if (!c.needles.every((n) => typeof n === "string" && n.length > 0))
      return MALFORMED;
    const needles = c.needles as string[];

    let mode: "all" | "any";
    if (c.match === undefined || c.match === "all") {
      mode = "all";
    } else if (c.match === "any") {
      mode = "any";
    } else {
      return MALFORMED;
    }

    const foldedSub = fold(sub, ci);
    const folded = needles.map((n) => fold(n, ci));

    if (mode === "all") {
      const missing: string[] = [];
      for (let i = 0; i < folded.length; i++) {
        if (!foldedSub.includes(folded[i])) missing.push(needles[i]);
      }
      if (missing.length === 0) return { passed: true, feedback: "Correct!" };
      return {
        passed: false,
        feedback: `Your output is missing required text: ${missing[0]}`,
      };
    }

    // mode === "any"
    const passed = folded.some((n) => foldedSub.includes(n));
    return {
      passed,
      feedback: passed
        ? "Correct!"
        : `Your output should contain at least one of: ${previewList(needles)}`,
    };
  }

  // ── LEGACY path: single-needle, byte-identical to pre-Phase-56 ──
  // `match` is SILENTLY IGNORED here (advisory surfaced by audit-authoring).
  // `caseInsensitive` is the only new field that affects the legacy path.
  const rawNeedle =
    typeof c.needle === "string"
      ? c.needle
      : c.needle === undefined
      ? expectedOutput ?? ""
      : null;
  if (rawNeedle === null) {
    // `needle` was present but not a string — malformed.
    return MALFORMED;
  }
  const needle = rawNeedle;
  const passed = fold(sub, ci).includes(fold(needle, ci));
  return {
    passed,
    feedback: passed ? "Correct!" : `Your output should contain: ${needle}`,
  };
}

// ── Phase 57A — `csv_set_equal` DARK server-side comparator ───────────────
//
// Goals (decided in `docs/phases/phase-57-proposal-csv-set-equal-hardening.md`):
//   1. Provide a real server-side row-set comparator for `csv_set_equal`
//      without changing any learner-visible behavior today.
//   2. Opt-in via `spec.serverGrade === true`. When absent or non-true,
//      this function returns the pre-Phase-57A auto-pass tuple verbatim
//      (`{passed:true, feedback:"Step completed."}`) so all 15 visible
//      `csv_set_equal` steps stay byte-identical to today.
//   3. Symmetric with the authoring guard `assertValidCsvSetEqualSpec` in
//      `@workspace/curriculum-quality/authoring`. Anything the guard
//      rejects at authoring time, this comparator rejects at runtime.
//
// Scope explicitly EXCLUDED from 57A (will land in later phases):
//   - Envelope pilot grading (57B).
//   - Shape E (multi-output `expectedClean` + `expectedRejects`).
//   - Server-side fixture loader (`expectedCsv` file references). The
//     comparator only consumes inline `expectedRows` or `expectedRowsHash`.
//   - `/check` semantics are unchanged.
//
// Submission contract (when opted in): the route layer passes the learner's
// raw submission string. For `csv_set_equal` opt-in, that string MUST be
// JSON with shape `{columns: string[], rows: unknown[][]}` — mirrors the
// `RunCapture` envelope shape so 57B can reuse this helper. Anything else
// fails CLOSED with a learner-readable feedback string. (No row opts in
// during 57A, so this contract is currently only exercised by tests.)
//
// Canonicalization (all defaults preserve current client-side behavior):
//   - headers: case-sensitive by default; `caseInsensitive: true` lowercases.
//   - row order: insensitive by default; `orderSensitive: true` enforces.
//   - duplicates: multiset by default; `dedupe: "expected" | "both"` collapse.
//   - whitespace: NOT trimmed by default; `trimStrings: true` trims string cells.
//   - null vs "": distinct by default; `nullEqualsEmpty: true` collapses both to null.
//   - numeric strings: distinct from numbers by default; `coerceNumericStrings: true` coerces.
//   - case (cell values): sensitive by default; `caseInsensitive: true` lowercases strings.
//   - quoting: out of scope here — the submission arrives parsed as JSON rows.

import { createHash } from "node:crypto";

type CsvSetEqualSpec = {
  serverGrade?: unknown;
  columns?: unknown;
  expectedRows?: unknown;
  expectedRowsHash?: unknown;
  orderSensitive?: unknown;
  trimStrings?: unknown;
  nullEqualsEmpty?: unknown;
  coerceNumericStrings?: unknown;
  caseInsensitive?: unknown;
  dedupe?: unknown;
  // Forward-compat: unknown keys are ignored (matches Phase 56 contains pattern).
};

type CsvCell = string | number | boolean | null;
type CsvRow = CsvCell[];

const BC_AUTO_PASS: GradingOutcome = { passed: true, feedback: "Step completed." };
const PASS_OK: GradingOutcome = { passed: true, feedback: "Correct!" };

function failSubmission(reason: string): GradingOutcome {
  return {
    passed: false,
    feedback: `Your submission could not be graded — ${reason}`,
  };
}

function isCsvCell(v: unknown): v is CsvCell {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

function isCsvRow(v: unknown): v is CsvRow {
  return Array.isArray(v) && v.every(isCsvCell);
}

function normalizeCell(
  cell: CsvCell,
  opts: { trim: boolean; nullEqEmpty: boolean; coerceNum: boolean; ci: boolean },
): CsvCell {
  let c: CsvCell = cell;
  if (typeof c === "string" && opts.trim) c = c.trim();
  if (opts.nullEqEmpty && (c === null || c === "")) c = null;
  if (typeof c === "string" && opts.coerceNum && /^-?\d+(?:\.\d+)?$/.test(c)) {
    c = Number(c);
  }
  if (typeof c === "string" && opts.ci) c = c.toLowerCase();
  return c;
}

function canonicalRowString(row: CsvRow, opts: Parameters<typeof normalizeCell>[1]): string {
  return JSON.stringify(row.map((cell) => normalizeCell(cell, opts)));
}

function applyDedupe(rows: string[], mode: "expected" | "both" | false, side: "expected" | "submitted"): string[] {
  if (mode === false) return rows;
  if (mode === "both") return [...new Set(rows)];
  // mode === "expected": only dedupe the expected side
  if (side === "expected") return [...new Set(rows)];
  return rows;
}

function canonicalDatasetHash(columns: string[], canonicalRows: string[]): string {
  // Hash is a multiset fingerprint: sort canonical row strings lexically
  // before hashing so order does not affect the hash. Order-sensitive
  // verification is performed positionally against `expectedRows` instead.
  const sorted = [...canonicalRows].sort();
  return createHash("sha256")
    .update(JSON.stringify({ columns, rows: sorted }))
    .digest("hex");
}

/**
 * Compute the canonical multiset hash for a given (columns, rows) pair
 * under the supplied normalization options. Exposed so the authoring CLI
 * helper (`scripts/src/hash-csv-rows.ts`) can emit hashes that match the
 * comparator byte-for-byte.
 */
export function computeCsvSetEqualHash(
  columns: string[],
  rows: ReadonlyArray<CsvRow>,
  opts: {
    trimStrings?: boolean;
    nullEqualsEmpty?: boolean;
    coerceNumericStrings?: boolean;
    caseInsensitive?: boolean;
    dedupe?: "expected" | "both" | false;
  } = {},
): string {
  const normOpts = {
    trim: opts.trimStrings === true,
    nullEqEmpty: opts.nullEqualsEmpty === true,
    coerceNum: opts.coerceNumericStrings === true,
    ci: opts.caseInsensitive === true,
  };
  const canonical = rows.map((r) => canonicalRowString(r, normOpts));
  const deduped = applyDedupe(canonical, opts.dedupe ?? false, "expected");
  return canonicalDatasetHash(columns, deduped);
}

export function gradeCsvSetEqual(
  spec: unknown,
  submission: string | null | undefined,
): GradingOutcome {
  // ── Opt-in gate (BC preserved when off) ─────────────────────────────
  if (spec === null || typeof spec !== "object") {
    // Live rows always carry an object spec. If missing, behave like the
    // pre-57A fallthrough — auto-pass. (Authoring guard rejects this.)
    return BC_AUTO_PASS;
  }
  const s = spec as CsvSetEqualSpec;
  if (s.serverGrade !== true) {
    // The ONLY way to enter real grading is an explicit boolean true.
    // Non-boolean ("yes", 1, etc.) is treated as opt-out for runtime
    // safety; authoring guard rejects the same shape so it cannot ship.
    return BC_AUTO_PASS;
  }

  // ── From here on, malformed spec / submission FAIL CLOSED ───────────
  if (
    !Array.isArray(s.columns) ||
    s.columns.length === 0 ||
    !s.columns.every((c) => typeof c === "string" && c.length > 0)
  ) {
    return MALFORMED;
  }
  const expectedColumns = s.columns as string[];

  const hasRows = Array.isArray(s.expectedRows);
  const hasHash = typeof s.expectedRowsHash === "string";
  if (!hasRows && !hasHash) return MALFORMED;
  if (hasRows && !(s.expectedRows as unknown[]).every(isCsvRow)) return MALFORMED;
  if (hasHash && !/^[0-9a-f]{64}$/.test(s.expectedRowsHash as string)) return MALFORMED;

  // Flag validation (mirrors authoring guard exactly)
  for (const k of ["orderSensitive", "trimStrings", "nullEqualsEmpty", "coerceNumericStrings", "caseInsensitive"] as const) {
    if (s[k] !== undefined && typeof s[k] !== "boolean") return MALFORMED;
  }
  if (s.dedupe !== undefined && s.dedupe !== false && s.dedupe !== "expected" && s.dedupe !== "both") {
    return MALFORMED;
  }

  const orderSensitive = s.orderSensitive === true;
  if (orderSensitive && !hasRows) {
    // Cannot do positional comparison from a hash alone.
    return MALFORMED;
  }

  const normOpts = {
    trim: s.trimStrings === true,
    nullEqEmpty: s.nullEqualsEmpty === true,
    coerceNum: s.coerceNumericStrings === true,
    ci: s.caseInsensitive === true,
  };
  const dedupe = (s.dedupe ?? false) as "expected" | "both" | false;

  // ── Parse submission ────────────────────────────────────────────────
  if (typeof submission !== "string" || submission.length === 0) {
    return failSubmission("submission is empty.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(submission);
  } catch {
    return failSubmission("submission is not valid JSON.");
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { columns?: unknown }).columns) ||
    !Array.isArray((parsed as { rows?: unknown }).rows)
  ) {
    return failSubmission('submission must be `{"columns": [...], "rows": [[...]]}`.');
  }
  const subColumns = (parsed as { columns: unknown[] }).columns;
  const subRows = (parsed as { rows: unknown[] }).rows;
  if (!subColumns.every((c) => typeof c === "string")) {
    return failSubmission("submission columns must all be strings.");
  }
  if (!subRows.every(isCsvRow)) {
    return failSubmission("submission rows must be arrays of cells (string|number|boolean|null).");
  }

  // ── Column-set check ────────────────────────────────────────────────
  if (subColumns.length !== expectedColumns.length) {
    return {
      passed: false,
      feedback: `Column count mismatch: expected ${expectedColumns.length} (${expectedColumns.join(", ")}), got ${subColumns.length}.`,
    };
  }
  for (let i = 0; i < expectedColumns.length; i++) {
    const a = normOpts.ci ? (subColumns[i] as string).toLowerCase() : (subColumns[i] as string);
    const b = normOpts.ci ? expectedColumns[i].toLowerCase() : expectedColumns[i];
    if (a !== b) {
      return {
        passed: false,
        feedback: `Column ${i + 1} mismatch: expected "${expectedColumns[i]}", got "${subColumns[i]}".`,
      };
    }
  }

  // ── Canonicalize rows ───────────────────────────────────────────────
  for (const r of subRows) {
    if (r.length !== expectedColumns.length) {
      return {
        passed: false,
        feedback: `Row width mismatch: expected ${expectedColumns.length} cells per row, got ${r.length}.`,
      };
    }
  }
  const canonSub = (subRows as CsvRow[]).map((r) => canonicalRowString(r, normOpts));

  let canonExp: string[] | null = null;
  if (hasRows) {
    const expRows = s.expectedRows as CsvRow[];
    for (const r of expRows) {
      if (r.length !== expectedColumns.length) return MALFORMED;
    }
    canonExp = expRows.map((r) => canonicalRowString(r, normOpts));
  }

  // ── Positional (order-sensitive) comparison ─────────────────────────
  if (orderSensitive) {
    const exp = canonExp!; // hasRows enforced above
    const expDeduped = applyDedupe(exp, dedupe, "expected");
    const subDeduped = applyDedupe(canonSub, dedupe, "submitted");
    if (subDeduped.length !== expDeduped.length) {
      return {
        passed: false,
        feedback: `Row count mismatch: expected ${expDeduped.length} row(s), got ${subDeduped.length}.`,
      };
    }
    for (let i = 0; i < expDeduped.length; i++) {
      if (subDeduped[i] !== expDeduped[i]) {
        return {
          passed: false,
          feedback: `Row ${i + 1} does not match the expected ordered output.`,
        };
      }
    }
    return PASS_OK;
  }

  // ── Multiset comparison ─────────────────────────────────────────────
  const subFinal = applyDedupe(canonSub, dedupe, "submitted");

  if (canonExp) {
    const expFinal = applyDedupe(canonExp, dedupe, "expected");
    const tally = new Map<string, number>();
    for (const r of expFinal) tally.set(r, (tally.get(r) ?? 0) + 1);
    for (const r of subFinal) {
      const n = tally.get(r);
      if (n === undefined || n === 0) {
        return {
          passed: false,
          feedback: `Unexpected row in submission (does not appear in expected set).`,
        };
      }
      tally.set(r, n - 1);
    }
    const remaining = [...tally.values()].reduce((a, b) => a + b, 0);
    if (remaining > 0) {
      return {
        passed: false,
        feedback: `Missing ${remaining} expected row(s) from submission.`,
      };
    }
    return PASS_OK;
  }

  // ── Hash-only path ──────────────────────────────────────────────────
  const subHash = canonicalDatasetHash(expectedColumns, subFinal);
  if (subHash !== (s.expectedRowsHash as string)) {
    return {
      passed: false,
      feedback: `Submission rows do not match the expected dataset fingerprint.`,
    };
  }
  return PASS_OK;
}

/** Step types that do not benefit from a separate "Check" affordance
 *  (the grading is binary self-declaration or non-textual). The frontend
 *  uses this list to hide the Check button — exported here so the FE
 *  and BE share a single source of truth. */
export const NO_CHECK_STEP_TYPES = new Set<string>([
  "self_attest",
  "reflection",
  "concept_check",
  "file_upload",
]);
