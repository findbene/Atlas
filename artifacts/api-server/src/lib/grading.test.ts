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

  // ── Phase 56 — structured literal `contains` ──────────────────────────
  describe("contains (Phase 56 — structured literal)", () => {
    const cstep = (config: unknown, expected: string | null = null) =>
      step({
        validationType: "contains",
        validationConfig: config as Parameters<typeof gradeSubmission>[0]["validationConfig"],
        expectedOutput: expected,
      });

    it("BC: validationConfig=null falls through to generic 'Step completed.' (NOT the contains branch)", () => {
      // Critical Phase 56 invariant: null config preserves pre-existing
      // generic-fallthrough behavior. The contains branch is gated on
      // truthy validationConfig.
      const r = gradeSubmission(
        step({ validationType: "contains", validationConfig: null, expectedOutput: "foo" }),
        "anything",
      );
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: empty config {} with expectedOutput keeps legacy fallback", () => {
      const r = gradeSubmission(cstep({}, "foo"), "barfoobaz");
      expect(r.passed).toBe(true);
    });

    it("BC: legacy quirk — {needle:''} still passes on any submission", () => {
      const r = gradeSubmission(cstep({ needle: "" }), "");
      expect(r.passed).toBe(true);
    });

    // multi-needle ALL
    it("needles[] (no match) defaults to ALL — all present passes", () => {
      const r = gradeSubmission(cstep({ needles: ["a", "b"] }), "a then b");
      expect(r.passed).toBe(true);
    });

    it("needles[] ALL — one missing fails and names it", () => {
      const r = gradeSubmission(cstep({ needles: ["a", "b"] }), "only a");
      expect(r.passed).toBe(false);
      expect(r.feedback).toContain("b");
    });

    it("needles[] match:'all' explicit — passes when all present", () => {
      const r = gradeSubmission(cstep({ needles: ["a", "b"], match: "all" }), "a and b");
      expect(r.passed).toBe(true);
    });

    // multi-needle ANY
    it("needles[] match:'any' — one present passes", () => {
      const r = gradeSubmission(cstep({ needles: ["a", "b"], match: "any" }), "only a");
      expect(r.passed).toBe(true);
    });

    it("needles[] match:'any' — none present fails with all listed", () => {
      const r = gradeSubmission(cstep({ needles: ["a", "b"], match: "any" }), "neither");
      expect(r.passed).toBe(false);
      expect(r.feedback).toContain("a");
      expect(r.feedback).toContain("b");
    });

    // case-insensitive
    it("caseInsensitive on legacy needle passes mixed-case match", () => {
      const r = gradeSubmission(cstep({ needle: "FOO", caseInsensitive: true }), "barfoobaz");
      expect(r.passed).toBe(true);
    });

    it("caseInsensitive on needles[] passes mixed-case", () => {
      const r = gradeSubmission(
        cstep({ needles: ["FOO", "BAR"], caseInsensitive: true }),
        "foo bar",
      );
      expect(r.passed).toBe(true);
    });

    // precedence + ignore rules
    it("precedence: needle + needles → needles wins (positive)", () => {
      const r = gradeSubmission(cstep({ needle: "x", needles: ["y"] }), "only y");
      expect(r.passed).toBe(true);
    });

    it("precedence: needle + needles → needles wins (negative — needle ignored)", () => {
      // submission contains the legacy `needle` ("alpha") but NOT the
      // structured `needles[]` entry ("beta"). Legacy would pass; new path
      // must fail because `needles[]` wins.
      const r = gradeSubmission(cstep({ needle: "alpha", needles: ["beta"] }), "alpha alpha");
      expect(r.passed).toBe(false);
    });

    it("match without needles is silently ignored (legacy single-needle runs)", () => {
      const r = gradeSubmission(cstep({ needle: "foo", match: "any" }), "foo");
      expect(r.passed).toBe(true);
    });

    it("match without needles is silently ignored — legacy fail still fails", () => {
      const r = gradeSubmission(cstep({ needle: "foo", match: "any" }), "bar");
      expect(r.passed).toBe(false);
    });

    // malformed fails closed
    it("malformed: needles:[] fails closed", () => {
      const r = gradeSubmission(cstep({ needles: [] }), "anything");
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: needles with empty-string entry fails closed (no silent always-pass)", () => {
      const r = gradeSubmission(cstep({ needles: [""] }), "anything");
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: needles with mixed empty-string entry fails closed", () => {
      const r = gradeSubmission(cstep({ needles: ["ok", ""] }), "ok");
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: needles with non-string entry fails closed", () => {
      const r = gradeSubmission(cstep({ needles: ["a", 5 as unknown as string] }), "anything");
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: needles[] with invalid match value fails closed", () => {
      const r = gradeSubmission(
        cstep({ needles: ["a"], match: "weird" as unknown as "all" }),
        "a",
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: needles over 16-cap fails closed", () => {
      const big = Array.from({ length: 17 }, (_, i) => `n${i}`);
      const r = gradeSubmission(cstep({ needles: big }), big.join(" "));
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("caseInsensitive non-boolean coerced to false (legacy still matches case-sensitively)", () => {
      const r = gradeSubmission(
        cstep({ needle: "foo", caseInsensitive: "yes" as unknown as boolean }),
        "foo",
      );
      expect(r.passed).toBe(true);
    });

    it("caseInsensitive non-boolean coerced to false — DOES NOT silently enable ci", () => {
      const r = gradeSubmission(
        cstep({ needle: "FOO", caseInsensitive: "yes" as unknown as boolean }),
        "foo",
      );
      expect(r.passed).toBe(false);
    });
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
