/**
 * Phase 49 — Unit tests for envelope client-side helpers.
 *
 * Covers the soft-fail contract (every server failure code maps to a skip
 * reason → legacy bare-string fallback) and the pre-gates that save the
 * round-trip in obviously-unsignable cases.
 */
import { describe, expect, it } from "vitest";
import {
  buildPythonCapture,
  buildSqlCapture,
  classifySignError,
  isCaptureLikelyOversize,
  preCheckCapture,
} from "./envelopeClient";
import type { ExecResult } from "./pyodideRunner";
import type { RunResult } from "@workspace/execution-core";

function pyResult(over: Partial<ExecResult> = {}): ExecResult {
  return {
    stdout: "42\n",
    stderr: "",
    exitCode: 0,
    timedOut: false,
    durationMs: 17,
    ...over,
  };
}

describe("buildPythonCapture", () => {
  it("packages code + ExecResult into a v1 python RunCapture", () => {
    const cap = buildPythonCapture("print(42)", pyResult());
    expect(cap).toEqual({
      version: 1,
      language: "python",
      code: "print(42)",
      stdout: "42\n",
      stderr: "",
      exitCode: 0,
      durationMs: 17,
      timedOut: false,
    });
  });

  it("preserves stderr and timedOut/exitCode from a failed run", () => {
    const cap = buildPythonCapture(
      "raise ValueError",
      pyResult({ exitCode: 1, stderr: "ValueError\n", stdout: "" }),
    );
    expect(cap.exitCode).toBe(1);
    expect(cap.stderr).toBe("ValueError\n");
    expect(cap.timedOut).toBe(false);
  });
});

describe("buildSqlCapture", () => {
  it("emits sql language with stdout summary and rounded durationMs", () => {
    const r: RunResult = {
      ok: true,
      columns: ["a", "b"],
      rows: [[1, "x"]],
      durationMs: 12.7,
    };
    const cap = buildSqlCapture("SELECT 1", r);
    expect(cap.language).toBe("sql");
    expect(cap.exitCode).toBe(0);
    expect(cap.stdout).toBe("1 row(s) in 12.7ms");
    expect(cap.columns).toEqual(["a", "b"]);
    expect(cap.rows).toEqual([[1, "x"]]);
    expect(cap.durationMs).toBe(13);
    expect(cap.timedOut).toBe(false);
  });

  it("normalizes undefined and non-finite cells to null", () => {
    const r: RunResult = {
      ok: true,
      columns: ["a", "b", "c"],
      rows: [[Number.NaN, undefined as unknown as number, Number.POSITIVE_INFINITY]],
      durationMs: 1,
    };
    const cap = buildSqlCapture("SELECT 1", r);
    expect(cap.rows).toEqual([[null, null, null]]);
  });

  it("maps a failed RunResult to exitCode=1 and stderr=error", () => {
    const r: RunResult = { ok: false, error: "syntax error", durationMs: 3 };
    const cap = buildSqlCapture("BAD SQL", r);
    expect(cap.exitCode).toBe(1);
    expect(cap.stderr).toBe("syntax error");
    expect(cap.stdout).toBe("");
  });
});

describe("preCheckCapture — saves the /runs/sign round-trip on obvious cases", () => {
  it("skips when code is empty / whitespace", () => {
    expect(preCheckCapture(buildPythonCapture("", pyResult()))).toBe("no-code");
    expect(preCheckCapture(buildPythonCapture("   \n\t", pyResult()))).toBe("no-code");
  });

  it("skips when the run timed out", () => {
    expect(
      preCheckCapture(buildPythonCapture("print(1)", pyResult({ timedOut: true }))),
    ).toBe("timed-out");
  });

  it("skips when exitCode is non-zero", () => {
    expect(
      preCheckCapture(
        buildPythonCapture("raise", pyResult({ exitCode: 1, stderr: "x" })),
      ),
    ).toBe("non-zero-exit");
  });

  it("skips when capture exceeds size caps", () => {
    const big = "x".repeat(40_000);
    expect(
      preCheckCapture(buildPythonCapture(big, pyResult())),
    ).toBe("capture-oversize");
  });

  it("returns null (proceed to sign) for a normal successful run", () => {
    expect(preCheckCapture(buildPythonCapture("print(1)", pyResult()))).toBe(null);
  });
});

describe("isCaptureLikelyOversize", () => {
  it("flags oversize stdout", () => {
    const cap = buildPythonCapture("print(1)", pyResult({ stdout: "x".repeat(70_000) }));
    expect(isCaptureLikelyOversize(cap)).toBe(true);
  });

  it("does not flag normal-size captures", () => {
    expect(isCaptureLikelyOversize(buildPythonCapture("print(1)", pyResult()))).toBe(false);
  });
});

describe("classifySignError — server failure → skip reason mapping (soft-fail contract)", () => {
  const cases: Array<[number, ReturnType<typeof classifySignError>]> = [
    [422, "unsignable-kind"],
    [503, "signing-unavailable"],
    [403, "not-enrolled"],
    [404, "step-or-project-not-found"],
    [400, "invalid-request"],
    [413, "invalid-request"],
    [500, "sign-unknown-error"],
  ];
  for (const [status, reason] of cases) {
    it(`maps status ${status} → ${reason}`, () => {
      expect(classifySignError({ status, message: `Request failed: ${status}` })).toBe(reason);
      // Also via message-only (orval's customFetch throws Error with message)
      expect(classifySignError(new Error(`Request failed: ${status}`))).toBe(reason);
    });
  }

  it("maps a network error (no status) to sign-network-error", () => {
    expect(classifySignError(new Error("Failed to fetch"))).toBe("sign-network-error");
    expect(classifySignError(new TypeError("NetworkError"))).toBe("sign-network-error");
  });
});
