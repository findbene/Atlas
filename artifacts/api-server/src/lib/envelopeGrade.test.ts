/**
 * Phase 48 — Unit tests for the pilot envelope grader (architect follow-up).
 *
 * Pins `gradeEnvelopeCapture` semantics directly, independent of the route
 * harness. Protects against accidental drift in deep-equality or
 * authoring-gap fallback behavior.
 *
 * Honest-claim ceiling H3 — these tests deliberately also pin the feedback
 * strings so any future change that introduces overclaim language ("verified
 * the learner", "proved", "tamper-proof", etc.) breaks a test instead of
 * silently shipping.
 */
import { describe, expect, it } from "vitest";
import { gradeEnvelopeCapture, isPilotRuntimeKind } from "./envelopeGrade";
import type { GradableStep } from "./grading";

function step(overrides: Partial<GradableStep> = {}): GradableStep {
  return {
    id: "s",
    stepNumber: 1,
    validationType: "json_equal",
    expectedOutput: '{"a":1,"b":[2,3]}',
    validationConfig: null,
    ...overrides,
  } as GradableStep;
}

function capture(stdout: string) {
  return {
    version: 1 as const,
    language: "python" as const,
    code: "print(1)",
    stdout,
    stderr: "",
    exitCode: 0,
    durationMs: 1,
    timedOut: false,
  };
}

describe("isPilotRuntimeKind", () => {
  it("recognizes only json_equal in Phase 48", () => {
    expect(isPilotRuntimeKind("json_equal")).toBe(true);
    // Phase 49+ will add these; Phase 48 must NOT activate them yet.
    expect(isPilotRuntimeKind("numeric_tolerance")).toBe(false);
    expect(isPilotRuntimeKind("sql_resultset")).toBe(false);
    expect(isPilotRuntimeKind("csv_set_equal")).toBe(false);
    expect(isPilotRuntimeKind("csv_ordered")).toBe(false);
    expect(isPilotRuntimeKind("self_attest")).toBe(false);
    expect(isPilotRuntimeKind("")).toBe(false);
    expect(isPilotRuntimeKind(null)).toBe(false);
    expect(isPilotRuntimeKind(undefined)).toBe(false);
  });
});

describe("gradeEnvelopeCapture — json_equal pass paths", () => {
  it("passes on identical primitives", () => {
    const out = gradeEnvelopeCapture(step({ expectedOutput: "42" }), capture("42\n"));
    expect(out.passed).toBe(true);
    expect(out.feedback).toBe("Output matched the expected result.");
  });

  it("passes when object keys are in a different order", () => {
    const out = gradeEnvelopeCapture(
      step({ expectedOutput: '{"a":1,"b":2,"c":3}' }),
      capture('{"c":3,"a":1,"b":2}'),
    );
    expect(out.passed).toBe(true);
  });

  it("passes for nested arrays/objects with matching structure", () => {
    const out = gradeEnvelopeCapture(
      step({ expectedOutput: '{"a":[1,{"b":[2,3]}]}' }),
      capture('{"a":[1,{"b":[2,3]}]}'),
    );
    expect(out.passed).toBe(true);
  });

  it("passes when stdout has trailing whitespace/newlines", () => {
    const out = gradeEnvelopeCapture(step(), capture('  {"a":1,"b":[2,3]}  \n\n'));
    expect(out.passed).toBe(true);
  });

  it("passes on null equality", () => {
    const out = gradeEnvelopeCapture(step({ expectedOutput: "null" }), capture("null"));
    expect(out.passed).toBe(true);
  });

  it("passes on boolean equality", () => {
    expect(gradeEnvelopeCapture(step({ expectedOutput: "true" }), capture("true")).passed).toBe(true);
    expect(gradeEnvelopeCapture(step({ expectedOutput: "false" }), capture("false")).passed).toBe(true);
  });
});

describe("gradeEnvelopeCapture — json_equal fail paths", () => {
  it("fails when array order differs (array order IS significant)", () => {
    const out = gradeEnvelopeCapture(
      step({ expectedOutput: "[1,2,3]" }),
      capture("[3,2,1]"),
    );
    expect(out.passed).toBe(false);
    expect(out.feedback).toMatch(/^Output didn't match\./);
  });

  it("fails on type mismatch (number vs string)", () => {
    const out = gradeEnvelopeCapture(step({ expectedOutput: "42" }), capture('"42"'));
    expect(out.passed).toBe(false);
  });

  it("fails on missing object key", () => {
    const out = gradeEnvelopeCapture(
      step({ expectedOutput: '{"a":1,"b":2}' }),
      capture('{"a":1}'),
    );
    expect(out.passed).toBe(false);
  });

  it("fails with empty-stdout educational message", () => {
    const out = gradeEnvelopeCapture(step(), capture("   \n  "));
    expect(out.passed).toBe(false);
    expect(out.feedback).toBe("Your output was empty. Print the expected JSON value.");
  });

  it("fails with JSON parse-error feedback on garbage stdout", () => {
    const out = gradeEnvelopeCapture(step(), capture("not json"));
    expect(out.passed).toBe(false);
    expect(out.feedback).toMatch(/^Your output isn't valid JSON:/);
  });

  it("distinguishes null vs false vs 0 (no JS-truthiness conflation)", () => {
    expect(gradeEnvelopeCapture(step({ expectedOutput: "null" }), capture("false")).passed).toBe(false);
    expect(gradeEnvelopeCapture(step({ expectedOutput: "null" }), capture("0")).passed).toBe(false);
    expect(gradeEnvelopeCapture(step({ expectedOutput: "false" }), capture("0")).passed).toBe(false);
  });

  it("distinguishes [] from {} (array vs object)", () => {
    expect(gradeEnvelopeCapture(step({ expectedOutput: "[]" }), capture("{}")).passed).toBe(false);
    expect(gradeEnvelopeCapture(step({ expectedOutput: "{}" }), capture("[]")).passed).toBe(false);
  });
});

describe("gradeEnvelopeCapture — authoring-gap fallback (never punish learners)", () => {
  it("falls back to legacy default-pass when expectedOutput is null", () => {
    const out = gradeEnvelopeCapture(
      step({ expectedOutput: null }),
      capture("anything"),
    );
    expect(out.passed).toBe(true);
  });

  it("falls back to legacy default-pass when expectedOutput is blank whitespace", () => {
    const out = gradeEnvelopeCapture(step({ expectedOutput: "   " }), capture("anything"));
    expect(out.passed).toBe(true);
  });

  it("falls back to legacy default-pass when expectedOutput is not valid JSON", () => {
    const out = gradeEnvelopeCapture(
      step({ expectedOutput: "{this is not json}" }),
      capture("anything"),
    );
    expect(out.passed).toBe(true);
  });
});

describe("gradeEnvelopeCapture — non-pilot kinds delegate to legacy grader", () => {
  it("numeric_tolerance is NOT activated in Phase 48 — falls back to default-pass", () => {
    const out = gradeEnvelopeCapture(
      step({ validationType: "numeric_tolerance", expectedOutput: "42" }),
      capture("999"),
    );
    expect(out.passed).toBe(true);
  });

  it("self_attest routes through legacy grader on capture.stdout", () => {
    const out = gradeEnvelopeCapture(
      step({ validationType: "self_attest", expectedOutput: null }),
      capture("done"),
    );
    expect(out.passed).toBe(true);
  });
});

describe("Honest-claim feedback audit (H3 ceiling)", () => {
  it("pass feedback contains no anti-cheat overclaim language", () => {
    const fb = gradeEnvelopeCapture(step({ expectedOutput: "1" }), capture("1")).feedback;
    const lower = String(fb).toLowerCase();
    for (const banned of [
      "verified the learner",
      "proved",
      "tamper",
      "cheat-proof",
      "independently",
    ]) {
      expect(lower).not.toContain(banned);
    }
  });

  it("fail feedback contains no anti-cheat overclaim language", () => {
    const fb = gradeEnvelopeCapture(step({ expectedOutput: "1" }), capture("2")).feedback;
    const lower = String(fb).toLowerCase();
    for (const banned of ["verified the learner", "proved", "tamper", "cheat", "independently"]) {
      expect(lower).not.toContain(banned);
    }
  });
});
