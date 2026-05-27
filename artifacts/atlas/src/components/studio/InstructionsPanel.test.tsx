/**
 * Phase 33 — InstructionsPanel mode-aware behavior.
 *
 * Pins:
 *   - Guided mode: shows the "Ask Ada" CTA at the top of instructions
 *     when an onRequestTutorNudge handler is provided.
 *   - Independent mode + long instructions: hides the markdown body
 *     behind a disclosure toggle (default closed).
 *   - Independent mode + short instructions: no toggle, body renders inline.
 *   - Independent mode + pedagogy step + no failed check yet: hides the
 *     proactive "Show first hint" escalation button and surfaces the
 *     "give it a real attempt first" message instead.
 *   - Independent mode + pedagogy step + hasFailedCheck=true: hint
 *     escalation re-enabled.
 *   - Default mode (null) preserves legacy behavior — no toggle, no
 *     Ask Ada CTA, no suppression message.
 *   - Legacy hints[] path (no pedagogy_config) is also suppressed in
 *     independent mode until a failed check is on record.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { StepVM } from "./types";

vi.mock("./useHintState", () => ({
  useHintState: () => ({
    state: {
      level: 0,
      maxLevel: 3,
      availableLevels: 3,
      canEscalate: true,
      contents: [],
      finalExplanation: null,
      shouldOffer: true,
    },
    loading: false,
    advancing: false,
    refetch: vi.fn(),
    advance: vi.fn(),
  }),
}));

import { InstructionsPanel } from "./InstructionsPanel";

const longText = "x".repeat(400);

function makeStep(overrides: Partial<StepVM> = {}): StepVM {
  return {
    id: "s1",
    title: "Test step",
    description: "Do the thing.",
    type: "code_python",
    learningObjective: undefined,
    requiredSkill: undefined,
    hasPedagogy: true,
    hints: [],
    starterCode: "",
    datasetRefs: [],
    ...overrides,
  } as unknown as StepVM;
}

beforeEach(() => cleanup());

describe("InstructionsPanel — Phase 33 mode-aware rendering", () => {
  it("guided mode shows the Ask Ada CTA when handler provided", () => {
    const onRequestTutorNudge = vi.fn();
    render(
      <InstructionsPanel
        step={makeStep()}
        stepNumber={1}
        totalSteps={3}
        mode="guided"
        onRequestTutorNudge={onRequestTutorNudge}
      />,
    );
    expect(screen.getByTestId("guided-ada-cta")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("guided-ada-cta-button"));
    expect(onRequestTutorNudge).toHaveBeenCalledTimes(1);
  });

  it("default/null mode does NOT show the Ask Ada CTA", () => {
    render(
      <InstructionsPanel
        step={makeStep()}
        stepNumber={1}
        totalSteps={3}
        mode={null}
        onRequestTutorNudge={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("guided-ada-cta")).toBeNull();
  });

  it("independent mode + long instructions hides body behind a toggle (default closed)", () => {
    render(
      <InstructionsPanel
        step={makeStep({ description: longText })}
        stepNumber={1}
        totalSteps={3}
        mode="independent"
        hasFailedCheck={false}
      />,
    );
    expect(screen.getByTestId("instructions-collapsible")).toBeInTheDocument();
    expect(screen.queryByTestId("instructions-body")).toBeNull();
    fireEvent.click(screen.getByTestId("instructions-disclosure-toggle"));
    expect(screen.getByTestId("instructions-body")).toBeInTheDocument();
  });

  it("independent mode + short instructions renders body inline (no toggle)", () => {
    render(
      <InstructionsPanel
        step={makeStep({ description: "tiny" })}
        stepNumber={1}
        totalSteps={3}
        mode="independent"
      />,
    );
    expect(screen.queryByTestId("instructions-collapsible")).toBeNull();
    expect(screen.getByTestId("instructions-body")).toBeInTheDocument();
  });

  it("independent mode hides hint escalation until a failed check", () => {
    render(
      <InstructionsPanel
        step={makeStep()}
        stepNumber={1}
        totalSteps={3}
        mode="independent"
        hasFailedCheck={false}
      />,
    );
    expect(screen.queryByTestId("hint-button")).toBeNull();
    expect(
      screen.getByTestId("independent-hint-suppressed"),
    ).toBeInTheDocument();
  });

  it("independent mode + hasFailedCheck=true re-enables hint escalation", () => {
    render(
      <InstructionsPanel
        step={makeStep()}
        stepNumber={1}
        totalSteps={3}
        mode="independent"
        hasFailedCheck={true}
      />,
    );
    expect(screen.getByTestId("hint-button")).toBeInTheDocument();
    expect(screen.queryByTestId("independent-hint-suppressed")).toBeNull();
  });

  it("independent mode + legacy hints[] + already-revealed: keeps the hint visible (no suppression)", () => {
    // Switch the useHintState stub off so we hit the legacy `step.hints[]`
    // path. The fix for the architect-flagged regression is that a hint
    // the learner has already toggled open MUST remain visible — we
    // suppress only the proactive reveal button, not earned content.
    vi.resetModules();
    vi.doMock("./useHintState", () => ({
      useHintState: () => ({
        state: null,
        loading: false,
        advancing: false,
        refetch: vi.fn(),
        advance: vi.fn(),
      }),
    }));
    return import("./InstructionsPanel").then(({ InstructionsPanel: P }) => {
      const stepLegacy = {
        ...makeStep({ hasPedagogy: false, hints: ["The legacy hint body."] }),
      };
      const { rerender } = render(
        <P
          step={stepLegacy}
          stepNumber={1}
          totalSteps={3}
          mode={null}
          hasFailedCheck={false}
        />,
      );
      // Open the legacy hint in a non-independent mode first (proves
      // the showLegacyHint state has been flipped on).
      fireEvent.click(screen.getByTestId("hint-button"));
      expect(screen.getByText("The legacy hint body.")).toBeInTheDocument();

      // Flip to independent mode with no failed check — the hint body
      // and reveal button must both still be present.
      rerender(
        <P
          step={stepLegacy}
          stepNumber={1}
          totalSteps={3}
          mode="independent"
          hasFailedCheck={false}
        />,
      );
      expect(screen.getByText("The legacy hint body.")).toBeInTheDocument();
      expect(screen.getByTestId("hint-button")).toBeInTheDocument();
      expect(screen.queryByTestId("independent-hint-suppressed")).toBeNull();
    });
  });

  it("default mode shows hint escalation (no suppression message)", () => {
    render(
      <InstructionsPanel
        step={makeStep()}
        stepNumber={1}
        totalSteps={3}
        mode={null}
      />,
    );
    expect(screen.getByTestId("hint-button")).toBeInTheDocument();
    expect(screen.queryByTestId("independent-hint-suppressed")).toBeNull();
  });
});
