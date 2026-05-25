/**
 * Phase 24 — Pure unit tests for the shared grading helper.
 * Verifies the rules used by BOTH /submit and /check stay byte-identical
 * to the legacy inline switch.
 */
import { describe, expect, it } from "vitest";
import { gradeSubmission, NO_CHECK_STEP_TYPES } from "./grading";

const step = (over: Partial<Parameters<typeof gradeSubmission>[0]> = {}) => ({
  validationType: null,
  validationConfig: null,
  expectedOutput: null,
  ...over,
});

describe("gradeSubmission", () => {
  it("self_attest always passes", () => {
    expect(gradeSubmission(step({ validationType: "self_attest" }), "")).toEqual({
      passed: true,
      feedback: "Great work! You've marked this step as complete.",
    });
  });

  it("exact: pass on trimmed match", () => {
    const r = gradeSubmission(
      step({ validationType: "exact", expectedOutput: "  42 \n" }),
      "  42  ",
    );
    expect(r.passed).toBe(true);
  });

  it("exact: fail surfaces the expected value", () => {
    const r = gradeSubmission(
      step({ validationType: "exact", expectedOutput: "42" }),
      "41",
    );
    expect(r.passed).toBe(false);
    expect(r.feedback).toBe("Expected: 42");
  });

  it("contains: needle from validationConfig wins over expectedOutput", () => {
    const r = gradeSubmission(
      step({
        validationType: "contains",
        validationConfig: { needle: "abc" },
        expectedOutput: "ZZZ",
      }),
      "xx abc yy",
    );
    expect(r.passed).toBe(true);
  });

  it("contains: needle falls back to expectedOutput when config missing needle", () => {
    const r = gradeSubmission(
      step({
        validationType: "contains",
        validationConfig: {},
        expectedOutput: "abc",
      }),
      "xx abc yy",
    );
    expect(r.passed).toBe(true);
  });

  it("contains: failure includes the needle in feedback", () => {
    const r = gradeSubmission(
      step({
        validationType: "contains",
        validationConfig: { needle: "abc" },
      }),
      "xyz",
    );
    expect(r.passed).toBe(false);
    expect(r.feedback).toContain("abc");
  });

  it("regex: passes with valid pattern + flags", () => {
    const r = gradeSubmission(
      step({
        validationType: "regex",
        validationConfig: { pattern: "^hello", flags: "i" },
      }),
      "HELLO world",
    );
    expect(r.passed).toBe(true);
  });

  it("regex: invalid pattern is non-throwing and returns failure with config-error feedback", () => {
    const r = gradeSubmission(
      step({
        validationType: "regex",
        validationConfig: { pattern: "([", flags: "" },
      }),
      "anything",
    );
    expect(r.passed).toBe(false);
    expect(r.feedback).toMatch(/invalid regex/i);
  });

  it("unknown / null validationType passes with generic feedback (legacy default)", () => {
    expect(gradeSubmission(step({ validationType: null }), "anything").passed).toBe(true);
    expect(gradeSubmission(step({ validationType: "mystery" }), "x").feedback).toBe("Step completed.");
  });
});

describe("NO_CHECK_STEP_TYPES", () => {
  it("covers the four non-checkable step kinds", () => {
    expect(NO_CHECK_STEP_TYPES.has("self_attest")).toBe(true);
    expect(NO_CHECK_STEP_TYPES.has("reflection")).toBe(true);
    expect(NO_CHECK_STEP_TYPES.has("concept_check")).toBe(true);
    expect(NO_CHECK_STEP_TYPES.has("file_upload")).toBe(true);
    expect(NO_CHECK_STEP_TYPES.has("code_python")).toBe(false);
    expect(NO_CHECK_STEP_TYPES.has("code_sql")).toBe(false);
  });
});
