/**
 * Phase 32 — Adaptive learner-mode recommender.
 *
 * Pure function. No DB, no IO. Given a snapshot of signals already
 * persisted by Atlas's existing tables (user_progress.status,
 * user_step_completions.attempt_count + .passed, user_project_step_hints.hint_level,
 * and the learner's current learning_mode on this project), recommend
 * the mode that is likely to keep the learner in productive flow.
 *
 * Importable from the API server (where signals are loaded) and the
 * React client (where the recommendation reason is rendered to the
 * learner so the choice is transparent and overridable).
 *
 * Hard rules:
 *  - Output mode is always one of the four DB enum values.
 *  - Output is deterministic for a given input.
 *  - Reason is always present and human-readable; reasonCode is stable
 *    for UI styling/i18n.
 *  - Signals are echoed back so the client can show "we recommended X
 *    because A=n, B=m".
 *
 * Rules in order (first match wins):
 *  1. struggling-step-back — current mode is `independent` AND
 *     attempts-per-completed-step > 4 OR maxHintLevel >= 3.
 *     → recommend `hint`. Stops the spiral.
 *  2. fresh-start — no prior completed projects AND no/one step done.
 *     → recommend `guided`. Default-safe for true beginners.
 *  3. demonstrated-mastery — 3+ prior completions AND attempts/step ≤ 2
 *     AND maxHintLevel ≤ 1.
 *     → recommend `independent`. Portfolio-grade signal.
 *  4. ready-to-level-up — current is `guided` AND 1+ prior completion
 *     AND attempts/step ≤ 2 AND 2+ steps done here.
 *     → recommend `hint`. Pulls the learner out of training wheels.
 *  5. ready-for-challenge — 1+ prior completion AND moderate friction
 *     (0 < attempts/step ≤ 4).
 *     → recommend `hint`.
 *  6. stay-the-course — anything else; do not change.
 */

import type { DbLearningMode } from "./pedagogy.js";

export type LearnerModeSignals = {
  /** Count of completed projects across this learner's history. */
  priorCompletedProjects: number;
  /** Failed-validation attempts on the CURRENT project, summed across steps. */
  currentProjectAttempts: number;
  /** Number of steps PASSED on the current project. */
  currentProjectStepsCompleted: number;
  /** Highest hint level reached on ANY step of the current project. */
  currentProjectHintLevelMax: number;
  /** Currently persisted mode for this (user, project). */
  currentMode: DbLearningMode;
};

export type LearnerModeReasonCode =
  | "fresh-start"
  | "demonstrated-mastery"
  | "ready-for-challenge"
  | "struggling-step-back"
  | "ready-to-level-up"
  | "stay-the-course";

export type LearnerModeRecommendation = {
  recommendedMode: DbLearningMode;
  reasonCode: LearnerModeReasonCode;
  reason: string;
  signals: LearnerModeSignals;
};

function attemptsPerStep(attempts: number, stepsDone: number): number {
  if (stepsDone <= 0) return 0;
  return attempts / stepsDone;
}

export function recommendLearnerMode(
  signals: LearnerModeSignals,
): LearnerModeRecommendation {
  const {
    priorCompletedProjects,
    currentProjectAttempts,
    currentProjectStepsCompleted,
    currentProjectHintLevelMax,
    currentMode,
  } = signals;

  const aps = attemptsPerStep(currentProjectAttempts, currentProjectStepsCompleted);

  // Rule 1 — struggling in independent.
  if (currentMode === "independent" && (aps > 4 || currentProjectHintLevelMax >= 3)) {
    return rec(
      "hint",
      "struggling-step-back",
      "You're hitting repeated friction in independent mode — switching to hint-based should help you keep momentum without spoiling the work.",
      signals,
    );
  }

  // Rule 2 — fresh learner.
  if (priorCompletedProjects === 0 && currentProjectStepsCompleted <= 1) {
    return rec(
      "guided",
      "fresh-start",
      "New to Atlas — guided mode walks you through the structure of the first project before you take the training wheels off.",
      signals,
    );
  }

  // Rule 3 — demonstrated mastery.
  if (
    priorCompletedProjects >= 3 &&
    aps <= 2 &&
    currentProjectHintLevelMax <= 1
  ) {
    return rec(
      "independent",
      "demonstrated-mastery",
      "Three or more completions with low hint usage — you're ready for portfolio-grade work with minimal scaffolding.",
      signals,
    );
  }

  // Rule 4 — guided + comfortable + some history → level up.
  if (
    currentMode === "guided" &&
    priorCompletedProjects >= 1 &&
    aps <= 2 &&
    currentProjectStepsCompleted >= 2
  ) {
    return rec(
      "hint",
      "ready-to-level-up",
      "You're moving smoothly in guided mode — hint-based mode gives you room to think first while still offering help when you get stuck.",
      signals,
    );
  }

  // Rule 5 — moderate experience and friction → hint.
  if (priorCompletedProjects >= 1 && aps > 0 && aps <= 4) {
    return rec(
      "hint",
      "ready-for-challenge",
      "You've got some completions under your belt — hint mode lets you attempt first, with progressive hints when you get stuck.",
      signals,
    );
  }

  // Default — stay with current mode.
  return rec(
    currentMode,
    "stay-the-course",
    "Your current mode looks like a good fit based on recent activity. You can change it anytime.",
    signals,
  );
}

function rec(
  recommendedMode: DbLearningMode,
  reasonCode: LearnerModeReasonCode,
  reason: string,
  signals: LearnerModeSignals,
): LearnerModeRecommendation {
  return { recommendedMode, reasonCode, reason, signals };
}
