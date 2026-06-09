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

  // Phase 61J interaction (pinned per architect review): the envelope json_equal
  // authoring-gap fallback delegates to `gradeSubmission`, which now has a
  // json_equal branch. Document both the preserved case and the superseded case.
  it("Phase 61J — the realistic authoring gap (validationConfig null + null expectedOutput) STILL default-passes — the canary no-punish contract is preserved (gradeSubmission's `&& validationConfig` guard short-circuits to the generic auto-pass)", () => {
    const out = gradeEnvelopeCapture(
      step({ expectedOutput: null, validationConfig: null }),
      capture("anything"),
    );
    expect(out.passed).toBe(true);
  });

  it("Phase 61J — with a populated validationConfig that LACKS spec.expected (+ null expectedOutput) the fallback now FAILS CLOSED — the commit-path json_equal contract supersedes the old dead-gate-tolerant default-pass (consistent with 61H/61I/61J fail-closed; moot today: envelope canary is off + 0 authored json_equal steps)", () => {
    const out = gradeEnvelopeCapture(
      step({ expectedOutput: null, validationConfig: { kind: "json_equal", description: "d", spec: {} } }),
      capture("anything"),
    );
    expect(out.passed).toBe(false);
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

// ── Phase 57B-prereq — DARK csv_set_equal envelope branch ──────────────────
function sqlCapture(
  columns: string[],
  rows: Array<Array<string | number | boolean | null>>,
  stdout = "",
) {
  return {
    version: 1 as const,
    language: "sql" as const,
    code: "SELECT 1",
    stdout,
    stderr: "",
    exitCode: 0,
    durationMs: 1,
    timedOut: false,
    columns,
    rows,
  };
}

describe("gradeEnvelopeCapture — csv_set_equal is DARK (no opt-in)", () => {
  it("auto-passes a structured capture when spec omits serverGrade (legacy tuple)", () => {
    const out = gradeEnvelopeCapture(
      step({
        validationType: "csv_set_equal",
        expectedOutput: null,
        validationConfig: { spec: { columns: ["id"], expectedRows: [[1]] } },
      }),
      sqlCapture(["id"], [[1]]),
    );
    expect(out).toEqual({ passed: true, feedback: "Step completed." });
  });

  it("auto-passes even when the captured rows do NOT match expected (proves darkness)", () => {
    const out = gradeEnvelopeCapture(
      step({
        validationType: "csv_set_equal",
        expectedOutput: null,
        validationConfig: { spec: { columns: ["id"], expectedRows: [[1]] } },
      }),
      sqlCapture(["id"], [[999]]),
    );
    expect(out).toEqual({ passed: true, feedback: "Step completed." });
  });

  it("auto-passes a stdout-only capture (no columns/rows) — pre-57B fall-through preserved", () => {
    const out = gradeEnvelopeCapture(
      step({
        validationType: "csv_set_equal",
        expectedOutput: null,
        validationConfig: { spec: { columns: ["id"], expectedRows: [[1]] } },
      }),
      capture("2 row(s) in 5ms"),
    );
    expect(out).toEqual({ passed: true, feedback: "Step completed." });
  });

  it("auto-passes when validationConfig is null (default-pass, matches grading.ts)", () => {
    const out = gradeEnvelopeCapture(
      step({ validationType: "csv_set_equal", expectedOutput: null, validationConfig: null }),
      sqlCapture(["id"], [[1]]),
    );
    expect(out).toEqual({ passed: true, feedback: "Step completed." });
  });
});

describe("gradeEnvelopeCapture — csv_set_equal opted-in (future flip behavior)", () => {
  const optedSpec = {
    spec: {
      serverGrade: true,
      columns: ["id", "name"],
      expectedRows: [
        [1, "alice"],
        [2, "bob"],
      ],
    },
  };

  it("passes when structured rows match (order-insensitive multiset)", () => {
    const out = gradeEnvelopeCapture(
      step({ validationType: "csv_set_equal", expectedOutput: null, validationConfig: optedSpec }),
      sqlCapture(
        ["id", "name"],
        [
          [2, "bob"],
          [1, "alice"],
        ],
      ),
    );
    expect(out).toEqual({ passed: true, feedback: "Correct!" });
  });

  it("fails when structured rows do not match", () => {
    const out = gradeEnvelopeCapture(
      step({ validationType: "csv_set_equal", expectedOutput: null, validationConfig: optedSpec }),
      sqlCapture(["id", "name"], [[1, "alice"]]),
    );
    expect(out.passed).toBe(false);
  });

  it("fails closed on a stdout-only capture when opted-in — the reason the rows branch exists", () => {
    // Pre-57B, every csv_set_equal envelope routed `capture.stdout` (the
    // "N row(s) in Tms" summary) through the grader. With serverGrade on that
    // summary cannot be JSON-parsed → fail closed. The structured branch added
    // in 57B-prereq is what lets a real opt-in actually pass.
    const out = gradeEnvelopeCapture(
      step({ validationType: "csv_set_equal", expectedOutput: null, validationConfig: optedSpec }),
      capture("2 row(s) in 5ms"),
    );
    expect(out.passed).toBe(false);
  });
});

// ── Phase 58A — DARK sql_resultset envelope branch ─────────────────────────
describe("gradeEnvelopeCapture — sql_resultset is DARK (no opt-in)", () => {
  it("auto-passes a structured capture when spec omits serverGrade (legacy tuple)", () => {
    const out = gradeEnvelopeCapture(
      step({
        validationType: "sql_resultset",
        expectedOutput: null,
        validationConfig: { spec: { query: "q", expectedRow: { n: 7 } } },
      }),
      sqlCapture(["n"], [[7]]),
    );
    expect(out).toEqual({ passed: true, feedback: "Step completed." });
  });

  it("auto-passes even when captured rows do NOT match expected (proves darkness)", () => {
    const out = gradeEnvelopeCapture(
      step({
        validationType: "sql_resultset",
        expectedOutput: null,
        validationConfig: { spec: { columns: ["n"], expectedRows: [[7]] } },
      }),
      sqlCapture(["n"], [[999]]),
    );
    expect(out).toEqual({ passed: true, feedback: "Step completed." });
  });

  it("auto-passes a stdout-only capture (no columns/rows) — pre-58A fall-through preserved", () => {
    const out = gradeEnvelopeCapture(
      step({
        validationType: "sql_resultset",
        expectedOutput: null,
        validationConfig: { spec: { columns: ["n"], expectedRows: [[7]] } },
      }),
      capture("1 row(s) in 3ms"),
    );
    expect(out).toEqual({ passed: true, feedback: "Step completed." });
  });

  it("auto-passes when validationConfig is null (default-pass, matches grading.ts)", () => {
    const out = gradeEnvelopeCapture(
      step({ validationType: "sql_resultset", expectedOutput: null, validationConfig: null }),
      sqlCapture(["n"], [[7]]),
    );
    expect(out).toEqual({ passed: true, feedback: "Step completed." });
  });
});

describe("gradeEnvelopeCapture — sql_resultset opted-in (future flip behavior)", () => {
  const optedSpec = {
    spec: {
      serverGrade: true,
      columns: ["check", "value"],
      expectedRows: [
        ["one_current", 0],
        ["overlap", 0],
      ],
    },
  };

  it("passes when structured rows match (order-insensitive multiset)", () => {
    const out = gradeEnvelopeCapture(
      step({ validationType: "sql_resultset", expectedOutput: null, validationConfig: optedSpec }),
      sqlCapture(
        ["check", "value"],
        [
          ["overlap", 0],
          ["one_current", 0],
        ],
      ),
    );
    expect(out).toEqual({ passed: true, feedback: "Correct!" });
  });

  it("fails when structured rows do not match", () => {
    const out = gradeEnvelopeCapture(
      step({ validationType: "sql_resultset", expectedOutput: null, validationConfig: optedSpec }),
      sqlCapture(["check", "value"], [["one_current", 1], ["overlap", 0]]),
    );
    expect(out.passed).toBe(false);
  });

  it("fails closed on a stdout-only capture when opted-in", () => {
    const out = gradeEnvelopeCapture(
      step({ validationType: "sql_resultset", expectedOutput: null, validationConfig: optedSpec }),
      capture("2 row(s) in 5ms"),
    );
    expect(out.passed).toBe(false);
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
