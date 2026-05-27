/**
 * Phase 25 — ValidationFeedbackPanel render tests.
 *
 * Pins the Phase 24 invariants that the panel is responsible for:
 *   - Provisional tag visible iff `provisional === true`.
 *   - XP visible only on committed passed results.
 *   - Attempt counter visible only on committed results with attempt > 1.
 *   - Submit-when-ready CTA visible only on provisional+passed.
 *   - Completion celebration visible iff committed+passed+projectComplete
 *     +showCelebration (the four-way Phase-24 gate).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { GradingResult } from "./types";

// useHintState would otherwise fire a real fetch; stub it.
vi.mock("./useHintState", () => ({
  useHintState: () => ({
    state: null,
    loading: false,
    advancing: false,
    refetch: vi.fn(),
    advance: vi.fn(),
  }),
}));

// JobOutcomesPanel pulls in heavy UI; replace with a marker.
vi.mock("@/components/JobOutcomesPanel", () => ({
  JobOutcomesPanel: ({ trigger }: { trigger: React.ReactNode }) => (
    <div data-testid="job-outcomes-panel">{trigger}</div>
  ),
}));

import { ValidationFeedbackPanel } from "./ValidationFeedbackPanel";

const baseProject = { id: "p1", slug: "p1", title: "Test" };

beforeEach(() => {
  cleanup();
});

describe("ValidationFeedbackPanel — provisional tag", () => {
  it("renders the provisional tag when provisional=true", () => {
    const grading: GradingResult = { status: "passed", feedback: "ok" };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={true}
        project={baseProject}
        showCelebration={true}
      />,
    );
    expect(screen.getByTestId("check-provisional-tag")).toBeInTheDocument();
  });

  it("does NOT render the provisional tag when provisional=false", () => {
    const grading: GradingResult = {
      status: "passed",
      feedback: "ok",
      xpEarned: 25,
    };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={false}
        project={baseProject}
        showCelebration={true}
      />,
    );
    expect(
      screen.queryByTestId("check-provisional-tag"),
    ).not.toBeInTheDocument();
  });
});

describe("ValidationFeedbackPanel — XP display", () => {
  it("shows XP on a committed passed result", () => {
    const grading: GradingResult = {
      status: "passed",
      feedback: "ok",
      xpEarned: 30,
    };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={false}
        project={baseProject}
        showCelebration={true}
      />,
    );
    expect(screen.getByText(/\+30 XP/)).toBeInTheDocument();
  });

  it("does NOT show XP on a provisional passed result, even if xpEarned is set", () => {
    const grading: GradingResult = {
      status: "passed",
      feedback: "ok",
      xpEarned: 30,
    };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={true}
        project={baseProject}
        showCelebration={true}
      />,
    );
    expect(screen.queryByText(/\+30 XP/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Looks good — Submit when ready/),
    ).toBeInTheDocument();
  });
});

describe("ValidationFeedbackPanel — attempt counter", () => {
  it("shows 'Attempt N' only on committed result with attempt > 1", () => {
    const grading: GradingResult = {
      status: "failed",
      feedback: "Try again",
      attempt: 3,
    };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={false}
        project={baseProject}
        showCelebration={false}
      />,
    );
    expect(screen.getByTestId("validation-attempt-counter").textContent).toBe(
      "Attempt 3",
    );
  });

  it("hides attempt counter when attempt is 1 (first try)", () => {
    const grading: GradingResult = {
      status: "failed",
      feedback: "x",
      attempt: 1,
    };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={false}
        project={baseProject}
        showCelebration={false}
      />,
    );
    expect(
      screen.queryByTestId("validation-attempt-counter"),
    ).not.toBeInTheDocument();
  });

  it("hides attempt counter on provisional results regardless of attempt value", () => {
    const grading: GradingResult = {
      status: "failed",
      feedback: "x",
      attempt: 5,
    };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={true}
        project={baseProject}
        showCelebration={false}
      />,
    );
    expect(
      screen.queryByTestId("validation-attempt-counter"),
    ).not.toBeInTheDocument();
  });
});

describe("ValidationFeedbackPanel — Submit-when-ready CTA", () => {
  it("renders the CTA on provisional+passed and wires it to onSubmit", () => {
    const onSubmit = vi.fn();
    const grading: GradingResult = { status: "passed", feedback: "ok" };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={true}
        project={baseProject}
        showCelebration={true}
        onSubmit={onSubmit}
      />,
    );
    const btn = screen.getByTestId("validation-submit-when-ready");
    btn.click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does NOT render the CTA on a failed check", () => {
    const grading: GradingResult = { status: "failed", feedback: "x" };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={true}
        project={baseProject}
        showCelebration={false}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("validation-submit-when-ready"),
    ).not.toBeInTheDocument();
  });

  it("does NOT render the CTA on a committed (non-provisional) result", () => {
    const grading: GradingResult = {
      status: "passed",
      feedback: "ok",
      xpEarned: 10,
    };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={false}
        project={baseProject}
        showCelebration={true}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("validation-submit-when-ready"),
    ).not.toBeInTheDocument();
  });

  it("disables the CTA while submitPending=true", () => {
    const grading: GradingResult = { status: "passed", feedback: "ok" };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={true}
        project={baseProject}
        showCelebration={true}
        onSubmit={vi.fn()}
        submitPending={true}
      />,
    );
    const btn = screen.getByTestId("validation-submit-when-ready");
    expect(btn).toBeDisabled();
  });
});

describe("ValidationFeedbackPanel — completion celebration gate", () => {
  const completed: GradingResult = {
    status: "passed",
    feedback: "Done!",
    xpEarned: 50,
    projectComplete: true,
  };

  it("RENDERS the completion block on committed+passed+projectComplete+showCelebration", () => {
    render(
      <ValidationFeedbackPanel
        grading={completed}
        provisional={false}
        project={baseProject}
        showCelebration={true}
      />,
    );
    expect(screen.getByTestId("completion-block")).toBeInTheDocument();
  });

  it("HIDES the completion block on a provisional result, even if projectComplete=true", () => {
    render(
      <ValidationFeedbackPanel
        grading={completed}
        provisional={true}
        project={baseProject}
        showCelebration={true}
      />,
    );
    expect(screen.queryByTestId("completion-block")).not.toBeInTheDocument();
  });

  it("HIDES the completion block when showCelebration=false (parent idempotency guard)", () => {
    render(
      <ValidationFeedbackPanel
        grading={completed}
        provisional={false}
        project={baseProject}
        showCelebration={false}
      />,
    );
    expect(screen.queryByTestId("completion-block")).not.toBeInTheDocument();
  });

  it("HIDES the completion block when projectComplete is not true", () => {
    const notComplete: GradingResult = {
      status: "passed",
      feedback: "ok",
      xpEarned: 10,
      projectComplete: false,
    };
    render(
      <ValidationFeedbackPanel
        grading={notComplete}
        provisional={false}
        project={baseProject}
        showCelebration={true}
      />,
    );
    expect(screen.queryByTestId("completion-block")).not.toBeInTheDocument();
  });
});

describe("ValidationFeedbackPanel — region structure", () => {
  it("renders the three named regions", () => {
    const grading: GradingResult = {
      status: "passed",
      feedback: "ok",
      xpEarned: 10,
      projectComplete: true,
    };
    render(
      <ValidationFeedbackPanel
        grading={grading}
        provisional={false}
        project={baseProject}
        showCelebration={true}
      />,
    );
    expect(screen.getByTestId("validation-status-header")).toBeInTheDocument();
    expect(screen.getByTestId("validation-feedback-region")).toBeInTheDocument();
    expect(screen.getByTestId("validation-next-action")).toBeInTheDocument();
  });
});

