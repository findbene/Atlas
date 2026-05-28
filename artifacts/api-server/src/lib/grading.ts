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
