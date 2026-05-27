/**
 * Phase 34 — Ada Tutor Step Contract.
 *
 * Pure helper that turns a snapshot of the learner's current step state
 * into a structured tutor contract. The contract is rendered into the
 * Ada system prompt as an explicit, mode-aware policy block — replacing
 * the loose inline "tone bullets" that lived in ai.ts since Phase 4.
 *
 * Goals:
 *  - Make Ada's help boundary explicit per mode (no full-solution
 *    leaks in independent, progressive hints in hint-based, proactive
 *    scaffolding in guided).
 *  - Make adaptive mode resolve to a concrete underlying mode based on
 *    the same signals the hint policy already uses (attemptCount,
 *    lastValidationFailed, stepPassed, currentHintLevel) so Ada is
 *    never vague in adaptive mode.
 *  - Stay pure: no DB, no IO, deterministic, fully unit-testable.
 *  - Stay additive: existing hint discipline + safety rails in ai.ts
 *    are preserved unchanged. This block layers ON TOP of them.
 *
 * Hard rules encoded here mirror — and never weaken — the existing
 * hint discipline (e.g. "never reveal L≥currentHintLevel+1 content",
 * "never reveal full solution before L4 unless stepPassed"). The
 * mode-specific rules add per-mode tightening, never loosening.
 */

import type { AtlasLearnerMode } from "./pedagogy.js";

export type TutorContractInput = {
  /** Atlas-facing mode (already translated from the DB enum). */
  mode: AtlasLearnerMode;
  /** Failed validation attempts on this step so far. */
  attemptCount: number;
  /** Highest hint level the learner has currently unlocked. */
  currentHintLevel: number;
  /** Most recent /check or /submit attempt on this step failed. */
  lastValidationFailed: boolean;
  /** Step is already passed (review mode — Ada may be more forthcoming). */
  stepPassed: boolean;
};

/**
 * The four boundary tiers Ada is allowed to operate within. Each
 * underlying mode is pinned to exactly one boundary so the rendered
 * prompt cannot drift.
 */
export type HelpBoundary =
  | "proactive-scaffolded"
  | "progressive-hints"
  | "diagnostic-only"
  | "review-permissive";

export type TutorContract = {
  /** The mode the contract was BUILT for (may be `dynamic_ai_adaptive`). */
  mode: AtlasLearnerMode;
  /**
   * The mode Ada should actually BEHAVE as. For non-adaptive inputs this
   * is identical to `mode`. For `dynamic_ai_adaptive` it resolves to one
   * of guided / hint / independent based on the signals — never left as
   * adaptive at render time.
   */
  effectiveMode: Exclude<AtlasLearnerMode, "dynamic_ai_adaptive">;
  /** Whether the contract was synthesized from adaptive mode. */
  resolvedFromAdaptive: boolean;
  /** Help boundary tier, pinned per effectiveMode. */
  helpBoundary: HelpBoundary;
  /** Human-readable rules Ada IS allowed to do. */
  allowedBehaviors: string[];
  /** Human-readable rules Ada is FORBIDDEN to do. */
  forbiddenBehaviors: string[];
  /** Mode-specific guidance on how to respond to a failed /check. */
  validationGuidance: string;
  /** One-sentence response-style directive. */
  responseStyle: string;
};

/**
 * Resolve `dynamic_ai_adaptive` → a concrete underlying mode using the
 * same struggling/comfortable signals the hint policy uses. Pure.
 *
 *   stepPassed                                          → independent (review)
 *   lastValidationFailed AND attemptCount >= 2          → guided      (rescue)
 *   currentHintLevel >= 3 OR attemptCount >= 3          → guided      (rescue)
 *   attemptCount >= 1 OR currentHintLevel >= 1          → hint        (engaged)
 *   else                                                → hint        (default)
 *
 * The default is `hint` rather than `guided` because adaptive learners
 * have opted out of always-on scaffolding; we only escalate to guided
 * when the signals show repeated friction.
 */
export function resolveAdaptiveMode(
  signals: Omit<TutorContractInput, "mode">,
): Exclude<AtlasLearnerMode, "dynamic_ai_adaptive"> {
  const { attemptCount, currentHintLevel, lastValidationFailed, stepPassed } =
    signals;
  if (stepPassed) return "mastery_gated_independent_ai_assisted";
  if (lastValidationFailed && attemptCount >= 2) return "guided_ai_assisted";
  if (currentHintLevel >= 3 || attemptCount >= 3) return "guided_ai_assisted";
  // Default (including fresh-start): hint-based, NOT guided. Adaptive
  // learners have opted out of always-on scaffolding; we only escalate
  // to guided when the rescue signals above fire.
  return "adaptive_inquiry_ai_assisted";
}

export function buildTutorContract(input: TutorContractInput): TutorContract {
  const { mode, stepPassed } = input;
  const resolvedFromAdaptive = mode === "dynamic_ai_adaptive";
  const effectiveMode: Exclude<AtlasLearnerMode, "dynamic_ai_adaptive"> =
    resolvedFromAdaptive
      ? resolveAdaptiveMode(input)
      : (mode as Exclude<AtlasLearnerMode, "dynamic_ai_adaptive">);

  switch (effectiveMode) {
    case "guided_ai_assisted":
      return {
        mode,
        effectiveMode,
        resolvedFromAdaptive,
        helpBoundary: "proactive-scaffolded",
        allowedBehaviors: [
          "Explain concepts clearly with worked examples.",
          "Walk through step-by-step reasoning when asked.",
          "Offer the next nudge proactively when the learner seems stuck.",
          "Show partial code structure (skeletons, stubs, signatures) freely.",
        ],
        forbiddenBehaviors: [
          "Do NOT dump a complete final solution unless the hint ladder allows it (currentHintLevel >= 4 or stepPassed=true).",
          "Do NOT reveal any hint content above the learner's currentHintLevel.",
          "Do NOT skip the concept and jump straight to the answer.",
        ],
        validationGuidance:
          "If the learner shares a failed validation: restate the error in plain English, name the underlying concept, then give one concrete next step. You may suggest a small code change.",
        responseStyle:
          "Proactive, supportive, concrete. Default under 400 words.",
      };

    case "adaptive_inquiry_ai_assisted":
      return {
        mode,
        effectiveMode,
        resolvedFromAdaptive,
        helpBoundary: "progressive-hints",
        allowedBehaviors: [
          "Lead with a conceptual nudge or one diagnostic question.",
          "After the learner responds, escalate to a technical clue.",
          "After repeated struggle, offer partial structure (NOT a complete answer).",
          "Riff freely on hint content the learner has ALREADY unlocked.",
        ],
        forbiddenBehaviors: [
          "Do NOT volunteer hints the learner has not asked for.",
          "Do NOT reveal hint content above currentHintLevel.",
          "Do NOT reveal the full solution before currentHintLevel >= 4 or stepPassed=true.",
          "Do NOT collapse the hint ladder by combining multiple levels into one response.",
        ],
        validationGuidance:
          "If the learner shares a failed validation: ask ONE short diagnostic question first ('What did you expect this row to look like?'). Only expand after they respond.",
        responseStyle:
          "Inquiry-first. One question or one short clue, not both. Default under 250 words.",
      };

    case "mastery_gated_independent_ai_assisted":
      return {
        mode,
        effectiveMode,
        resolvedFromAdaptive,
        helpBoundary: stepPassed ? "review-permissive" : "diagnostic-only",
        allowedBehaviors: stepPassed
          ? [
              "Step is already passed — you may discuss the full solution, trade-offs, and alternatives openly.",
              "Connect the step to real-world DE / MLOps / AI engineering practice.",
            ]
          : [
              "Answer literally what was asked, nothing more.",
              "Explain WHY a validation failed conceptually.",
              "Suggest debugging strategies (print statements, smaller test inputs, schema checks).",
              "Confirm or deny the learner's own hypothesis when they propose one.",
            ],
        forbiddenBehaviors: stepPassed
          ? [
              "Do NOT reveal solutions for OTHER (still-locked) steps in this project.",
            ]
          : [
              "Do NOT reveal the full solution under any circumstance — the learner chose independent mode to preserve portfolio credibility.",
              "Do NOT volunteer hints, code skeletons, or step-by-step walkthroughs.",
              "Do NOT reveal hint content above currentHintLevel even if asked directly.",
              "Do NOT say 'the answer is X' or 'just write Y'.",
            ],
        validationGuidance: stepPassed
          ? "Step passed — feel free to discuss the failed attempt as a teaching moment."
          : "If the learner shares a failed validation: explain WHY the output is wrong (conceptually) and suggest ONE debugging move (e.g. 'try printing intermediate state'). Never hand over the exact correction.",
        responseStyle: stepPassed
          ? "Open and discursive. Default under 400 words."
          : "Terse, diagnostic, Socratic. Default under 200 words. No code blocks unless the learner pasted code and you are pointing at a specific line.",
      };
  }
}

/**
 * Render the contract into a compact text block suitable for inclusion
 * in the Ada system prompt. The shape is intentionally simple (labeled
 * lines, no XML) so it composes with the existing <learner_state> /
 * <step_pedagogy> envelopes without re-introducing parsing concerns.
 */
export function renderTutorContractForPrompt(contract: TutorContract): string {
  const lines: string[] = [];
  lines.push("TUTOR CONTRACT (mode-aware policy — follow strictly):");
  lines.push(`- learner_mode: ${contract.mode}`);
  if (contract.resolvedFromAdaptive) {
    lines.push(`- effective_mode (adaptive resolution): ${contract.effectiveMode}`);
  }
  lines.push(`- help_boundary: ${contract.helpBoundary}`);
  lines.push("- allowed:");
  for (const a of contract.allowedBehaviors) lines.push(`  - ${a}`);
  lines.push("- forbidden:");
  for (const f of contract.forbiddenBehaviors) lines.push(`  - ${f}`);
  lines.push(`- validation_guidance: ${contract.validationGuidance}`);
  lines.push(`- response_style: ${contract.responseStyle}`);
  return lines.join("\n");
}
