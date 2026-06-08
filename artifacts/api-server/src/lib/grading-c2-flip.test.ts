/**
 * Phase 61A — server-graded opt-in flip contract for C2 steps 1 + 5.
 *
 * Pins, as a durable regression, that the EXACT browser-DuckDB-WASM captures
 * (byte-verified in the real learner runtime, engine 1.33.1-dev45.0) PASS the
 * server comparator for the two newly-flipped `sql_resultset` rows, and that
 * representative wrong submissions FAIL CLOSED. This is the unit-level twin of
 * the data-driven `audit:sql-resultset-bc` opt-in contract.
 *
 * Captures (from the verify harness):
 *   step 1: columns=[n,n_unique]  rows=[[7,7]]      (integer counts)
 *   step 5: columns=[value]       rows=[[2746]]     (integer-valued sum)
 *
 * Step 8 (NRR float `1.05`) is intentionally NOT flipped this phase (float
 * exact-match brittleness); no flip contract is asserted for it here.
 */
import { describe, expect, it } from "vitest";
import { gradeSubmission, type GradableStep } from "./grading";

type Flip = { label: string; columns: string[]; expectedRows: (string | number | boolean | null)[][] };

const FLIPS: Flip[] = [
  { label: "C2 step 1 (stg_customers dedupe counts)", columns: ["n", "n_unique"], expectedRows: [[7, 7]] },
  { label: "C2 step 5 (_metric_mrr 2025-06)", columns: ["value"], expectedRows: [[2746]] },
];

function stepFor(f: Flip): GradableStep {
  return {
    validationType: "sql_resultset",
    validationConfig: { spec: { serverGrade: true, columns: f.columns, expectedRows: f.expectedRows } },
    expectedOutput: null,
  };
}

describe("Phase 61A — C2 sql_resultset flip contract (steps 1 + 5)", () => {
  for (const f of FLIPS) {
    describe(f.label, () => {
      const step = stepFor(f);

      it("PASSES the exact browser-verified capture", () => {
        const capture = JSON.stringify({ columns: f.columns, rows: f.expectedRows });
        const r = gradeSubmission(step, capture);
        expect(r.passed).toBe(true);
      });

      it("FAILS CLOSED on a wrong-value capture", () => {
        const wrongRows = f.expectedRows.map((row) =>
          row.map((c) => (typeof c === "number" ? c + 1 : `__wrong_${c}__`)),
        );
        const r = gradeSubmission(step, JSON.stringify({ columns: f.columns, rows: wrongRows }));
        expect(r.passed).toBe(false);
      });

      it("FAILS CLOSED on raw SQL / malformed / empty submissions", () => {
        for (const bad of ["select * from t", "not json {", ""]) {
          expect(gradeSubmission(step, bad).passed).toBe(false);
        }
      });

      it("FAILS CLOSED on a wrong-columns capture", () => {
        const r = gradeSubmission(
          step,
          JSON.stringify({ columns: ["__wrong_col__", ...f.columns.slice(1)], rows: f.expectedRows }),
        );
        expect(r.passed).toBe(false);
      });
    });
  }

  it("a non-opted-in sql_resultset spec still auto-passes (dark BC preserved for step 8's kind)", () => {
    const darkStep: GradableStep = {
      validationType: "sql_resultset",
      // No serverGrade → BC auto-pass, exactly as step 8 remains.
      validationConfig: { spec: { query: "select 1", expectedRow: { value: 1.05 } } },
      expectedOutput: null,
    };
    expect(gradeSubmission(darkStep, "anything at all").passed).toBe(true);
  });
});
