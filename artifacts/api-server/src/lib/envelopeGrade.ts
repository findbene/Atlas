/**
 * Phase 48 — Signed-envelope runtime grader pilot.
 *
 * Consumes a verified `RunCapture` (produced by the Phase 47 envelope
 * branch of POST /submit after `verifyEnvelopeForSubmit` succeeded) and
 * performs deterministic comparison grading for ONE narrow validation
 * kind: `json_equal`. Every other kind falls through to the Phase 47
 * default — `gradeSubmission(step, capture.stdout)` — so this module
 * never changes behavior for any code path that isn't (a) inside the
 * envelope branch AND (b) using a pilot kind AND (c) for a step whose
 * `expectedOutput` is authored.
 *
 * Honest-claim ceiling H3 (docs/runtime-validation-threat-model.md §7):
 *   "Atlas verified that the runtime output submitted for this step
 *    matched the expected result."
 *
 * Explicit non-claims (must not appear in feedback / cert copy / UX):
 *   - "Atlas proved the learner wrote the code."
 *   - "Atlas proved the learner executed THIS code honestly."
 *   - "Tamper-proof completion."
 * The verifier signature proves Atlas issued the envelope with a given
 * binding, NOT that the captured output came from honest learner
 * execution (accepted residual A2 / A5).
 *
 * Activation surface:
 *   - This module is imported by `routes/user.ts` ONLY from within the
 *     envelope branch. Legacy /submit (bare-string `submission`) NEVER
 *     touches this code.
 *   - The envelope branch itself is gated by `ATLAS_ENVELOPE_REQUIRED_KINDS`
 *     which is EMPTY by default in Phase 48. No catalog-wide
 *     `json_equal` enforcement is enabled until an operator deliberately
 *     opts the kind into the env var (Phase 49+).
 *
 * Authoring-gap policy (must not fail learners on catalog bugs):
 *   A `json_equal` step with a missing or unparseable `expectedOutput`
 *   falls back to `gradeSubmission(step, capture.stdout)` which currently
 *   default-passes (the Phase 47 contract-shaped behavior). The pilot
 *   never punishes a learner for an authoring error. Authoring quality
 *   is enforced separately by `audit:authoring`.
 */
import type { RunCapture } from "@workspace/execution-core/run-envelope";
import { gradeSubmission, type GradableStep, type GradingOutcome } from "./grading";

/** Pilot kinds where the envelope branch performs real comparison
 *  grading on captured stdout. Anything not on this list falls through
 *  to the legacy grader. */
const PILOT_RUNTIME_KINDS: ReadonlySet<string> = new Set(["json_equal"]);

export function isPilotRuntimeKind(kind: string | null | undefined): boolean {
  return typeof kind === "string" && PILOT_RUNTIME_KINDS.has(kind);
}

export function gradeEnvelopeCapture(
  step: GradableStep,
  capture: RunCapture,
): GradingOutcome {
  const kind = step.validationType ?? "";

  if (kind === "json_equal") {
    const expectedRaw = step.expectedOutput?.trim();
    if (!expectedRaw) {
      // Authoring gap — no expected configured. Fall back to legacy
      // default-pass so Phase 47 callers + steps without an authored
      // expected don't suddenly start failing learners.
      return gradeSubmission(step, capture.stdout);
    }
    let expected: unknown;
    try {
      expected = JSON.parse(expectedRaw);
    } catch {
      // Authoring gap — expected is not valid JSON. Same fallback.
      return gradeSubmission(step, capture.stdout);
    }

    const trimmedStdout = capture.stdout.trim();
    if (trimmedStdout.length === 0) {
      return {
        passed: false,
        feedback: "Your output was empty. Print the expected JSON value.",
      };
    }

    let actual: unknown;
    try {
      actual = JSON.parse(trimmedStdout);
    } catch (err) {
      return {
        passed: false,
        feedback: `Your output isn't valid JSON: ${(err as Error).message}`,
      };
    }

    if (deepEqualJson(expected, actual)) {
      return {
        passed: true,
        feedback: "Output matched the expected result.",
      };
    }
    return {
      passed: false,
      feedback: `Output didn't match. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`,
    };
  }

  // Not a pilot kind — preserve Phase 47 behavior exactly: route the
  // verified stdout through the legacy grader.
  return gradeSubmission(step, capture.stdout);
}

/** Structural deep-equality for JSON values only. Object key order is
 *  insignificant; array order IS significant (matches JSON semantics
 *  and matches `numeric_tolerance` / `csv_ordered` siblings for Phase 50+).
 *  Does not handle Date / function / bigint — those cannot appear in
 *  a JSON.parse result. */
function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === "number") {
    // Both numbers; NaN !== NaN and we treat that as not-equal (already
    // covered by `a === b` short-circuit). +0/-0 collapse via ===.
    return false;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualJson(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === "object") {
    if (Array.isArray(b)) return false;
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao).sort();
    const bk = Object.keys(bo).sort();
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i++) {
      if (ak[i] !== bk[i]) return false;
      if (!deepEqualJson(ao[ak[i]!], bo[bk[i]!])) return false;
    }
    return true;
  }
  return false;
}
