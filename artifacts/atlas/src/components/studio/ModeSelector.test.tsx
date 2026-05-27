/**
 * Phase 32 — ModeSelector component.
 *
 * Pins:
 *   - Renders nothing while not enrolled (recommendation endpoint 404).
 *   - Renders 4 mode options after recommendation loads.
 *   - Current mode is visually active (aria-pressed=true).
 *   - Clicking a non-current mode issues PATCH and updates active state.
 *   - "Choose for me" button shown only when recommendation differs from
 *     current mode AND reasonCode !== "stay-the-course".
 *   - Clicking "Choose for me" issues PATCH with recommendedMode.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ModeSelector } from "./ModeSelector";

type Rec = {
  recommendedMode: "guided" | "hint" | "independent" | "dynamic_ai_adaptive";
  reasonCode: string;
  reason: string;
  signals: { currentMode: string };
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // BASE_URL is "/" in vite test env by default — no stub needed.
});

function mockRecommendation(rec: Rec) {
  // Phase 33: useLearningMode refetches after a PATCH-triggered event, so
  // the mock must reflect the new currentMode the way the real server
  // would (otherwise the refetch reverts the optimistic update).
  let liveCurrentMode = rec.signals.currentMode;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("/learning-mode/recommendation")) {
      const body = { ...rec, signals: { ...rec.signals, currentMode: liveCurrentMode } };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (init?.method === "PATCH" && typeof url === "string" && url.includes("/learning-mode")) {
      try {
        const parsed = JSON.parse(init.body as string) as { mode?: string };
        if (parsed?.mode) liveCurrentMode = parsed.mode;
      } catch { /* leave unchanged */ }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("nope", { status: 500 });
  });
}

describe("ModeSelector", () => {
  it("renders nothing when not enrolled (404 on recommendation)", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));
    const { container } = render(<ModeSelector projectSlug="x" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("[data-testid='mode-selector']")).toBeNull());
  });

  it("renders nothing when projectSlug is undefined", () => {
    const { container } = render(<ModeSelector projectSlug={undefined} />);
    expect(container.querySelector("[data-testid='mode-selector']")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders 4 mode options with the current mode aria-pressed", async () => {
    mockRecommendation({
      recommendedMode: "guided",
      reasonCode: "stay-the-course",
      reason: "fine",
      signals: { currentMode: "hint" },
    });
    render(<ModeSelector projectSlug="x" />);
    await waitFor(() => expect(screen.getByTestId("mode-selector")).toBeInTheDocument());
    for (const m of ["guided", "hint", "independent", "dynamic_ai_adaptive"] as const) {
      expect(screen.getByTestId(`mode-option-${m}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("mode-option-hint").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("mode-option-guided").getAttribute("aria-pressed")).toBe("false");
  });

  it("does NOT show Choose-for-me when reasonCode='stay-the-course'", async () => {
    mockRecommendation({
      recommendedMode: "hint",
      reasonCode: "stay-the-course",
      reason: "fine",
      signals: { currentMode: "hint" },
    });
    render(<ModeSelector projectSlug="x" />);
    await waitFor(() => expect(screen.getByTestId("mode-selector")).toBeInTheDocument());
    expect(screen.queryByTestId("mode-choose-for-me")).toBeNull();
  });

  it("does NOT show Choose-for-me when recommendation == current", async () => {
    mockRecommendation({
      recommendedMode: "guided",
      reasonCode: "fresh-start",
      reason: "new here",
      signals: { currentMode: "guided" },
    });
    render(<ModeSelector projectSlug="x" />);
    await waitFor(() => expect(screen.getByTestId("mode-selector")).toBeInTheDocument());
    expect(screen.queryByTestId("mode-choose-for-me")).toBeNull();
  });

  it("shows Choose-for-me when recommendation differs from current", async () => {
    mockRecommendation({
      recommendedMode: "hint",
      reasonCode: "ready-to-level-up",
      reason: "you're ready",
      signals: { currentMode: "guided" },
    });
    render(<ModeSelector projectSlug="x" />);
    const cta = await waitFor(() => screen.getByTestId("mode-choose-for-me"));
    expect(cta).toBeInTheDocument();
  });

  it("clicking a mode option issues PATCH with the chosen mode", async () => {
    mockRecommendation({
      recommendedMode: "guided",
      reasonCode: "stay-the-course",
      reason: "fine",
      signals: { currentMode: "guided" },
    });
    render(<ModeSelector projectSlug="csv-pipeline" />);
    const hintBtn = await waitFor(() => screen.getByTestId("mode-option-hint"));
    fireEvent.click(hintBtn);
    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === "PATCH");
      expect(patchCall).toBeDefined();
      expect(patchCall![0]).toContain("/api/user/projects/csv-pipeline/learning-mode");
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ mode: "hint" });
    });
    // After successful PATCH, hint becomes the active pressed option.
    await waitFor(() => {
      expect(screen.getByTestId("mode-option-hint").getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("clicking Choose-for-me issues PATCH with the recommended mode", async () => {
    mockRecommendation({
      recommendedMode: "independent",
      reasonCode: "demonstrated-mastery",
      reason: "you've got this",
      signals: { currentMode: "hint" },
    });
    render(<ModeSelector projectSlug="x" />);
    const cta = await waitFor(() => screen.getByTestId("mode-choose-for-me"));
    fireEvent.click(cta);
    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === "PATCH");
      expect(patchCall).toBeDefined();
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ mode: "independent" });
    });
  });
});
