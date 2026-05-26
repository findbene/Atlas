/**
 * Phase 25 — Unit tests for the grading-feedback parser.
 * Pins the literal strings emitted by `gradeSubmission` so any drift
 * fails the test before users see broken remediation UI.
 */
import { describe, it, expect } from "vitest";
import { parseRemediation } from "./remediationParser";

describe("parseRemediation — exact rule", () => {
  it("parses 'Expected: <value>' into an exact-diff", () => {
    const r = parseRemediation("Expected: hello world", "hello");
    expect(r).toEqual({
      kind: "exact-diff",
      expected: "hello world",
      actual: "hello",
    });
  });

  it("preserves colons inside the expected value", () => {
    const r = parseRemediation("Expected: foo: bar: baz", "x");
    expect(r.kind).toBe("exact-diff");
    if (r.kind === "exact-diff") {
      expect(r.expected).toBe("foo: bar: baz");
    }
  });

  it("preserves leading and trailing whitespace inside expected", () => {
    const r = parseRemediation("Expected:   spaced   ", "");
    expect(r.kind).toBe("exact-diff");
    if (r.kind === "exact-diff") {
      expect(r.expected).toBe("  spaced   ");
    }
  });

  it("uses empty string for actual when submission is null/undefined", () => {
    expect(parseRemediation("Expected: x", null)).toEqual({
      kind: "exact-diff",
      expected: "x",
      actual: "",
    });
    expect(parseRemediation("Expected: x", undefined)).toEqual({
      kind: "exact-diff",
      expected: "x",
      actual: "",
    });
  });
});

describe("parseRemediation — contains rule", () => {
  it("parses 'Your output should contain: <needle>' into a contains-miss", () => {
    const r = parseRemediation(
      "Your output should contain: SELECT *",
      "select 1",
    );
    expect(r).toEqual({
      kind: "contains-miss",
      needle: "SELECT *",
      actual: "select 1",
    });
  });

  it("preserves colons and newlines in the needle", () => {
    const r = parseRemediation(
      "Your output should contain: line1\nline2: end",
      "",
    );
    expect(r.kind).toBe("contains-miss");
    if (r.kind === "contains-miss") {
      expect(r.needle).toBe("line1\nline2: end");
    }
  });
});

describe("parseRemediation — regex rule", () => {
  it("parses the regex-miss sentinel into a regex-miss", () => {
    const r = parseRemediation(
      "Your output doesn't match the expected pattern.",
      "abc",
    );
    expect(r).toEqual({ kind: "regex-miss", actual: "abc" });
  });

  it("does NOT match a near-miss string (regex-miss must be exact)", () => {
    const r = parseRemediation(
      "Your output doesn't match the pattern.",
      "abc",
    );
    expect(r.kind).toBe("generic");
  });

  it("treats regex config-error feedback as generic (authoring bug, not learner mistake)", () => {
    const r = parseRemediation(
      "Invalid regex pattern in grading config.",
      "abc",
    );
    expect(r).toEqual({ kind: "generic" });
  });
});

describe("parseRemediation — generic fallback", () => {
  it("returns generic for unrecognized feedback", () => {
    expect(parseRemediation("Step completed.", "x").kind).toBe("generic");
    expect(parseRemediation("Correct!", "x").kind).toBe("generic");
    expect(parseRemediation("Great work!", "x").kind).toBe("generic");
  });

  it("returns generic for null / undefined / empty feedback", () => {
    expect(parseRemediation(null, "x").kind).toBe("generic");
    expect(parseRemediation(undefined, "x").kind).toBe("generic");
    expect(parseRemediation("", "x").kind).toBe("generic");
  });
});
