/**
 * Phase 33 — useLearningMode + dispatchLearningModeChanged.
 *
 * Pins:
 *   - Hook fetches once on mount and exposes currentMode + recommendation.
 *   - 404 / non-OK fetch yields {mode: null, recommendation: null, ready: true}.
 *   - undefined slug yields the same "no signal" shape without fetching.
 *   - dispatchLearningModeChanged optimistically updates mode and triggers
 *     a background refetch (no event when slug doesn't match).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useLearningMode,
  dispatchLearningModeChanged,
} from "./useLearningMode";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function mockOnce(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("useLearningMode", () => {
  it("returns 'no signal' shape (mode=null) when slug is undefined and does not fetch", async () => {
    const { result } = renderHook(() => useLearningMode(undefined));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.mode).toBeNull();
    expect(result.current.recommendation).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches recommendation and exposes currentMode + recommendation", async () => {
    mockOnce({
      recommendedMode: "hint",
      reasonCode: "stay-the-course",
      reason: "fine",
      signals: { currentMode: "guided" },
    });
    const { result } = renderHook(() => useLearningMode("p1"));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.mode).toBe("guided");
    expect(result.current.recommendation?.recommendedMode).toBe("hint");
  });

  it("returns {mode:null} on 404 (not enrolled)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    const { result } = renderHook(() => useLearningMode("p1"));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.mode).toBeNull();
  });

  it("optimistically updates mode on dispatchLearningModeChanged for matching slug", async () => {
    mockOnce({
      recommendedMode: "hint",
      reasonCode: "stay-the-course",
      reason: "fine",
      signals: { currentMode: "guided" },
    });
    const { result } = renderHook(() => useLearningMode("p1"));
    await waitFor(() => expect(result.current.mode).toBe("guided"));

    // Mock the second fetch triggered by the event listener.
    mockOnce({
      recommendedMode: "hint",
      reasonCode: "stay-the-course",
      reason: "fine",
      signals: { currentMode: "independent" },
    });

    act(() => dispatchLearningModeChanged("p1", "independent"));
    // Optimistic update is synchronous.
    await waitFor(() => expect(result.current.mode).toBe("independent"));
  });

  it("preserves last-known mode when a refetch returns non-OK (transient error)", async () => {
    mockOnce({
      recommendedMode: "hint",
      reasonCode: "stay-the-course",
      reason: "fine",
      signals: { currentMode: "guided" },
    });
    const { result } = renderHook(() => useLearningMode("p1"));
    await waitFor(() => expect(result.current.mode).toBe("guided"));
    // Next call (triggered by the dispatch) returns a 500. The hook
    // must NOT null out the already-known mode — that would briefly
    // hide ModeSelector and revert panels to legacy default rendering.
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    act(() => dispatchLearningModeChanged("p1", "independent"));
    await waitFor(() => expect(result.current.mode).toBe("independent"));
    // Even after the failed refetch settles, mode stays at the
    // optimistic 'independent' value, not back to null.
    await new Promise(r => setTimeout(r, 20));
    expect(result.current.mode).toBe("independent");
    expect(result.current.ready).toBe(true);
  });

  it("ignores dispatchLearningModeChanged for non-matching slug", async () => {
    mockOnce({
      recommendedMode: "hint",
      reasonCode: "stay-the-course",
      reason: "fine",
      signals: { currentMode: "guided" },
    });
    const { result } = renderHook(() => useLearningMode("p1"));
    await waitFor(() => expect(result.current.mode).toBe("guided"));
    const before = fetchMock.mock.calls.length;

    act(() => dispatchLearningModeChanged("other-project", "independent"));
    // No optimistic update, no extra fetch.
    expect(result.current.mode).toBe("guided");
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});
