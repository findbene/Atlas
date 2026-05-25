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
 *  - `contains`           → substring match against `validationConfig.needle`
 *                           (fallback to `expectedOutput`).
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
    const config = step.validationConfig as { needle?: string };
    const needle = config.needle ?? expected ?? "";
    const passed = submission?.includes(needle) ?? false;
    return {
      passed,
      feedback: passed
        ? "Correct!"
        : `Your output should contain: ${needle}`,
    };
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
