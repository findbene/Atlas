/**
 * Phase 23 — Unit tests for the workspace step URL helpers.
 *
 * Pure-function coverage of the 0↔1 indexing conversion and the resume
 * precedence rule (URL → progress → null). The companion render-level test
 * lives in `project-workspace.test.tsx`.
 */
import { describe, it, expect } from "vitest";
import {
  parseStepParam,
  clampStepIdx,
  idxToStepNumber,
  buildStepSearch,
  resolveInitialStepIdx,
} from "./workspaceStepUrl";

describe("parseStepParam", () => {
  it("parses a valid positive integer", () => {
    expect(parseStepParam("?step=3")).toBe(3);
    expect(parseStepParam("step=3")).toBe(3);
  });
  it("returns null for missing param", () => {
    expect(parseStepParam("")).toBeNull();
    expect(parseStepParam("?other=1")).toBeNull();
  });
  it("returns null for zero, negative, non-integer, NaN, and leading-zero values", () => {
    expect(parseStepParam("?step=0")).toBeNull();
    expect(parseStepParam("?step=-1")).toBeNull();
    expect(parseStepParam("?step=1.5")).toBeNull();
    expect(parseStepParam("?step=abc")).toBeNull();
    expect(parseStepParam("?step=01")).toBeNull();
    expect(parseStepParam("?step=1e2")).toBeNull();
  });
});

describe("clampStepIdx", () => {
  it("converts 1-indexed position to 0-indexed idx", () => {
    expect(clampStepIdx(1, 5)).toBe(0);
    expect(clampStepIdx(3, 5)).toBe(2);
    expect(clampStepIdx(5, 5)).toBe(4);
  });
  it("clamps out-of-range positions", () => {
    expect(clampStepIdx(0, 5)).toBe(0);
    expect(clampStepIdx(-3, 5)).toBe(0);
    expect(clampStepIdx(999, 5)).toBe(4);
  });
  it("returns 0 when totalSteps is non-positive", () => {
    expect(clampStepIdx(2, 0)).toBe(0);
    expect(clampStepIdx(2, -1)).toBe(0);
  });
});

describe("idxToStepNumber + buildStepSearch", () => {
  it("converts 0-indexed idx back to 1-indexed", () => {
    expect(idxToStepNumber(0)).toBe(1);
    expect(idxToStepNumber(4)).toBe(5);
  });
  it("builds ?step=N preserving other params", () => {
    expect(buildStepSearch(2)).toBe("?step=3");
    expect(buildStepSearch(0, "?foo=bar")).toBe("?foo=bar&step=1");
    expect(buildStepSearch(1, "?step=99&keep=1")).toBe("?step=2&keep=1");
  });
});

describe("resolveInitialStepIdx — precedence", () => {
  const totalSteps = 5;

  it("prefers a valid URL ?step= over progress", () => {
    expect(
      resolveInitialStepIdx({
        search: "?step=4",
        totalSteps,
        progressPosition: 2,
        progressLoaded: true,
      }),
    ).toBe(3);
  });

  it("clamps an out-of-range URL ?step= instead of ignoring it", () => {
    expect(
      resolveInitialStepIdx({
        search: "?step=999",
        totalSteps,
        progressPosition: 2,
        progressLoaded: true,
      }),
    ).toBe(4);
  });

  it("falls back to progress.currentStepPosition when no URL param", () => {
    expect(
      resolveInitialStepIdx({
        search: "",
        totalSteps,
        progressPosition: 3,
        progressLoaded: true,
      }),
    ).toBe(2);
  });

  it("returns null while progress is still loading and no URL param", () => {
    // This is the key flash-prevention: caller renders skeleton until ready.
    expect(
      resolveInitialStepIdx({
        search: "",
        totalSteps,
        progressPosition: null,
        progressLoaded: false,
      }),
    ).toBeNull();
  });

  it("defaults to step 0 once progress is loaded with no usable position", () => {
    expect(
      resolveInitialStepIdx({
        search: "",
        totalSteps,
        progressPosition: null,
        progressLoaded: true,
      }),
    ).toBe(0);
  });

  it("returns null when totalSteps <= 0 regardless of inputs", () => {
    expect(
      resolveInitialStepIdx({
        search: "?step=2",
        totalSteps: 0,
        progressPosition: 1,
        progressLoaded: true,
      }),
    ).toBeNull();
  });

  it("rejects invalid URL ?step= and falls through to progress", () => {
    // ?step=0 is invalid → fall through to progress, not clamped to idx 0.
    expect(
      resolveInitialStepIdx({
        search: "?step=0",
        totalSteps,
        progressPosition: 3,
        progressLoaded: true,
      }),
    ).toBe(2);
  });
});
