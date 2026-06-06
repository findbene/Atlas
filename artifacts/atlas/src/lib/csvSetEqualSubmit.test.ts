/**
 * Phase 57B-prereq — unit tests for the client submission-shape decision.
 *
 * The contract under test is the DARK foundation for csv_set_equal opt-in:
 *  - serverGrade off  → ALWAYS raw, verbatim (proves the phase is dark).
 *  - serverGrade on   → JSON {columns,rows} when a fresh capture exists,
 *                        else needs-run.
 */
import { describe, expect, it } from "vitest";
import {
  decideCsvSetEqualSubmission,
  type CsvSetEqualCapture,
} from "./csvSetEqualSubmit";

const capture: CsvSetEqualCapture = {
  columns: ["id", "name"],
  rows: [
    [1, "alice"],
    [2, "bob"],
  ],
};

describe("decideCsvSetEqualSubmission — serverGrade OFF (dark, legacy path)", () => {
  it("returns the raw submission verbatim regardless of capture", () => {
    const out = decideCsvSetEqualSubmission({
      serverGrade: false,
      rawSubmission: "SELECT * FROM users;",
      capture,
    });
    expect(out).toEqual({ kind: "raw", submission: "SELECT * FROM users;" });
  });

  it("returns raw even when capture is null", () => {
    const out = decideCsvSetEqualSubmission({
      serverGrade: false,
      rawSubmission: "some code",
      capture: null,
    });
    expect(out).toEqual({ kind: "raw", submission: "some code" });
  });

  it("preserves empty raw submissions unchanged (caller does the trim check)", () => {
    const out = decideCsvSetEqualSubmission({
      serverGrade: false,
      rawSubmission: "",
      capture: null,
    });
    expect(out).toEqual({ kind: "raw", submission: "" });
  });

  it("does not coerce a non-boolean-true serverGrade into the csv path", () => {
    // Defensive: only an explicit boolean true opts in. The server already
    // derives a strict boolean, but the helper must not be fooled by truthy
    // junk if the contract ever loosens.
    const out = decideCsvSetEqualSubmission({
      // @ts-expect-error — exercising a non-boolean at runtime
      serverGrade: "true",
      rawSubmission: "raw",
      capture,
    });
    expect(out).toEqual({ kind: "raw", submission: "raw" });
  });
});

describe("decideCsvSetEqualSubmission — serverGrade ON", () => {
  it("emits canonical {columns,rows} JSON when a fresh capture exists", () => {
    const out = decideCsvSetEqualSubmission({
      serverGrade: true,
      rawSubmission: "SELECT id, name FROM users;",
      capture,
    });
    expect(out.kind).toBe("csv_set_equal");
    if (out.kind !== "csv_set_equal") throw new Error("unreachable");
    expect(JSON.parse(out.submission)).toEqual({
      columns: ["id", "name"],
      rows: [
        [1, "alice"],
        [2, "bob"],
      ],
    });
  });

  it("treats a zero-row capture as valid (a query may legitimately return nothing)", () => {
    const out = decideCsvSetEqualSubmission({
      serverGrade: true,
      rawSubmission: "SELECT id, name FROM users WHERE 1=0;",
      capture: { columns: ["id", "name"], rows: [] },
    });
    expect(out.kind).toBe("csv_set_equal");
    if (out.kind !== "csv_set_equal") throw new Error("unreachable");
    expect(JSON.parse(out.submission)).toEqual({ columns: ["id", "name"], rows: [] });
  });

  it("returns needs-run when no capture exists", () => {
    const out = decideCsvSetEqualSubmission({
      serverGrade: true,
      rawSubmission: "SELECT 1;",
      capture: null,
    });
    expect(out).toEqual({ kind: "needs-run" });
  });

  it("returns needs-run when the capture has no columns (cannot form a valid contract)", () => {
    const out = decideCsvSetEqualSubmission({
      serverGrade: true,
      rawSubmission: "SELECT 1;",
      capture: { columns: [], rows: [] },
    });
    expect(out).toEqual({ kind: "needs-run" });
  });

  it("preserves cell types (numbers, booleans, null) through serialization", () => {
    const out = decideCsvSetEqualSubmission({
      serverGrade: true,
      rawSubmission: "q",
      capture: { columns: ["a", "b", "c"], rows: [[1, true, null]] },
    });
    if (out.kind !== "csv_set_equal") throw new Error("expected csv_set_equal");
    expect(JSON.parse(out.submission)).toEqual({
      columns: ["a", "b", "c"],
      rows: [[1, true, null]],
    });
  });
});
