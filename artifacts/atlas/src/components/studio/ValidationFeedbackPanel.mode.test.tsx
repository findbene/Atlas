/**
 * Phase 33 — Mode-aware nudge swap inside ValidationFeedbackPanel.
 *
 * Lives in its own file because we need a top-level useHintState stub
 * that exposes shouldOffer+canEscalate (the failing-attempt nudge
 * surface). Default stub in the sibling test file returns state=null,
 * which would short-circuit the branch under test.
 *
 * Pins:
 *   - mode === "independent" AND onRequestTutorNudge provided →
 *     renders [data-testid=independent-ada-nudge], NOT hint-offer.
 *   - Click on the Ada button fires the nudge handler.
 *   - mode === null (default) → keeps the legacy hint-offer button.
 *   - mode === "independent" but no onRequestTutorNudge handler →
 *     falls back to the legacy hint-offer button (no regression for
 *     callers that haven't wired the prop yet).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { GradingResult, StepVM } from "./types";

vi.mock("./useHintState", () => ({
  useHintState: () => ({
    state: {
      level: 0,
      maxLevel: 3,
      availableLevels: 3,
      canEscalate: true,
      shouldOffer: true,
      contents: [],
      finalExplanation: null,
      failureFeedback: null,
      successFeedback: null,
      portfolioRelevance: null,
    },
    loading: false,
    advancing: false,
    refetch: vi.fn(),
    advance: vi.fn(),
  }),
}));

vi.mock("@/components/JobOutcomesPanel", () => ({
  JobOutcomesPanel: ({ trigger }: { trigger: React.ReactNode }) => (
    <div data-testid="job-outcomes-panel">{trigger}</div>
  ),
}));

import { ValidationFeedbackPanel } from "./ValidationFeedbackPanel";

const baseProject = { id: "p1", slug: "p1", title: "Test" };
const baseStep = { id: "s1", hasPedagogy: true } as unknown as StepVM;
const failedGrading: GradingResult = { status: "failed", feedback: "no" };

beforeEach(() => cleanup());

describe("ValidationFeedbackPanel — Phase 33 nudge swap", () => {
  it("independent + handler → renders Ask Ada CTA, hides hint-offer", () => {
    const onRequestTutorNudge = vi.fn();
    render(
      <ValidationFeedbackPanel
        grading={failedGrading}
        provisional={true}
        project={baseProject}
        showCelebration={false}
        step={baseStep}
        mode="independent"
        onRequestTutorNudge={onRequestTutorNudge}
      />,
    );
    expect(screen.getByTestId("independent-ada-nudge")).toBeInTheDocument();
    expect(screen.queryByTestId("hint-offer")).toBeNull();
    fireEvent.click(screen.getByTestId("independent-ada-nudge"));
    expect(onRequestTutorNudge).toHaveBeenCalledTimes(1);
  });

  it("default mode keeps the legacy hint-offer button", () => {
    render(
      <ValidationFeedbackPanel
        grading={failedGrading}
        provisional={true}
        project={baseProject}
        showCelebration={false}
        step={baseStep}
        mode={null}
      />,
    );
    expect(screen.getByTestId("hint-offer")).toBeInTheDocument();
    expect(screen.queryByTestId("independent-ada-nudge")).toBeNull();
  });

  it("independent mode but missing handler falls back to legacy hint-offer", () => {
    render(
      <ValidationFeedbackPanel
        grading={failedGrading}
        provisional={true}
        project={baseProject}
        showCelebration={false}
        step={baseStep}
        mode="independent"
        /* no onRequestTutorNudge */
      />,
    );
    expect(screen.getByTestId("hint-offer")).toBeInTheDocument();
    expect(screen.queryByTestId("independent-ada-nudge")).toBeNull();
  });
});
