/**
 * Phase 4 — Pedagogy helpers.
 *
 * Two concerns live here:
 *  1. Mapping the legacy `learning_mode` Postgres enum (`guided`, `hint`,
 *     `independent`) to the four Atlas-facing learner-mode names used in
 *     prompts and UI. The DB enum is intentionally NOT extended yet — see
 *     replit.md Phase 4 notes for the future migration plan.
 *  2. The progressive-hint policy: given a learner's mode, the per-step
 *     attempt count, hint usage so far, and last validation outcome,
 *     decide whether to *offer* a next hint level (we never auto-spoil).
 *
 * Pure functions only — no DB, no IO. Keeps the policy testable and
 * importable from both the API server and the React client.
 */

// Phase 8 — `dynamic_ai_adaptive` is now a native DB enum value. We no
// longer silently alias it to `guided`. The other three values are kept
// for back-compat with rows persisted before the enum extension.
export type DbLearningMode = "guided" | "hint" | "independent" | "dynamic_ai_adaptive";

export type AtlasLearnerMode =
  | "guided_ai_assisted"
  | "adaptive_inquiry_ai_assisted"
  | "mastery_gated_independent_ai_assisted"
  | "dynamic_ai_adaptive";

/**
 * Legacy-read alias map. Only consulted when the round-trip would otherwise
 * widen an Atlas mode that has no DB pair. Today every Atlas mode has a 1:1
 * DB pair so this is empty — but the explicit constant prevents the silent
 * `dynamic_ai_adaptive → guided` collapse we shipped in Phase 4.
 */
export const LEGACY_MODE_ALIAS: Readonly<Record<string, DbLearningMode>> = Object.freeze({});

/** Map the persisted DB enum value to the Atlas-facing mode label. */
export function toAtlasLearnerMode(db: DbLearningMode): AtlasLearnerMode {
  switch (db) {
    case "guided":               return "guided_ai_assisted";
    case "hint":                 return "adaptive_inquiry_ai_assisted";
    case "independent":          return "mastery_gated_independent_ai_assisted";
    case "dynamic_ai_adaptive":  return "dynamic_ai_adaptive";
  }
}

/** Inverse for any code that needs to round-trip a value into the DB. */
export function fromAtlasLearnerMode(atlas: AtlasLearnerMode): DbLearningMode {
  switch (atlas) {
    case "guided_ai_assisted":                     return "guided";
    case "adaptive_inquiry_ai_assisted":           return "hint";
    case "mastery_gated_independent_ai_assisted":  return "independent";
    case "dynamic_ai_adaptive":                    return "dynamic_ai_adaptive";
  }
}

export const MAX_HINT_LEVEL = 5 as const;

export type HintPolicyInput = {
  mode: AtlasLearnerMode;
  /** Number of failed validation attempts on this step so far. */
  attemptCount: number;
  /** Current persisted hint level for this user+step. */
  currentLevel: number;
  /** Whether the most recent validation attempt failed. */
  lastValidationFailed: boolean;
  /** Whether the step is already passed (unlocks L5 for review). */
  stepPassed: boolean;
};

export type HintPolicyOutcome = {
  /** Whether the UI should surface a "Want a nudge?" CTA right now. */
  shouldOffer: boolean;
  /** Suggested next level to offer (clamped 0..5). Same as current if no offer. */
  suggestedLevel: number;
  /** True once the user has earned access to the full L5 explanation. */
  allowFullExplanation: boolean;
};

/**
 * Decide whether to *offer* a next hint level. Never advances the
 * persisted level on its own — only the explicit `POST /hint/next`
 * endpoint does that.
 */
export function evaluateHintPolicy(input: HintPolicyInput): HintPolicyOutcome {
  const { mode, attemptCount, currentLevel, lastValidationFailed, stepPassed } = input;
  const clamp = (n: number) => Math.max(0, Math.min(MAX_HINT_LEVEL, n));
  const allowFullExplanation = stepPassed || currentLevel >= MAX_HINT_LEVEL;

  if (stepPassed) {
    return { shouldOffer: false, suggestedLevel: currentLevel, allowFullExplanation };
  }

  let shouldOffer = false;
  let suggestedLevel = currentLevel;

  switch (mode) {
    case "guided_ai_assisted":
      if (attemptCount >= 3 && lastValidationFailed && currentLevel < MAX_HINT_LEVEL) {
        shouldOffer = true;
        suggestedLevel = clamp(currentLevel + 1);
      }
      break;

    case "adaptive_inquiry_ai_assisted":
      // After 2 failed attempts, jump to scaffold (L3) if not already past it.
      if (attemptCount >= 2 && lastValidationFailed && currentLevel < 3) {
        shouldOffer = true;
        suggestedLevel = 3;
      }
      break;

    case "mastery_gated_independent_ai_assisted":
      // Never auto-offer. User must explicitly request hints.
      shouldOffer = false;
      break;

    case "dynamic_ai_adaptive": {
      // Simple v1 heuristic: scale with struggle, never exceed +1 of current.
      const struggle = Math.floor(attemptCount / 2) + (lastValidationFailed ? 1 : 0);
      const target = clamp(Math.max(currentLevel, struggle));
      if (target > currentLevel) {
        shouldOffer = true;
        suggestedLevel = clamp(currentLevel + 1);
      }
      break;
    }
  }

  return { shouldOffer, suggestedLevel, allowFullExplanation };
}

/**
 * Shape of `project_steps.pedagogy_config` (all keys optional).
 * Mirrors the JSDoc on the schema column.
 */
export type PedagogyConfig = {
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

/** Return the hint strings up to (and including) `level`. */
export function hintsUpTo(cfg: PedagogyConfig | null | undefined, level: number): string[] {
  if (!cfg) return [];
  const out: string[] = [];
  const keys = ["hintLevel1", "hintLevel2", "hintLevel3", "hintLevel4", "hintLevel5"] as const;
  for (let i = 0; i < Math.min(level, MAX_HINT_LEVEL); i++) {
    const v = cfg[keys[i]];
    if (typeof v === "string" && v.length > 0) out.push(v);
  }
  return out;
}

/** How many hint levels does this pedagogy config actually populate? */
export function availableHintLevels(cfg: PedagogyConfig | null | undefined): number {
  if (!cfg) return 0;
  const keys = ["hintLevel1", "hintLevel2", "hintLevel3", "hintLevel4", "hintLevel5"] as const;
  let n = 0;
  for (const k of keys) {
    if (typeof cfg[k] === "string" && (cfg[k] as string).length > 0) n++;
    else break; // contiguous from the start
  }
  return n;
}
