import type {
  ExpectedOutputs,
  RunResult,
  ValidationInput,
  ValidationOutcome,
} from "./types.js";

/**
 * Normalize a tabular row from "array-of-arrays aligned to columns" form
 * (what adapters return) into "object keyed by column name" form (what
 * `ExpectedOutputs.rows` uses). Returns null when the result isn't tabular.
 */
function rowsAsObjects(result: RunResult): Array<Record<string, unknown>> | null {
  if (!result.columns || !result.rows) return null;
  const cols = result.columns;
  return result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => {
      obj[c] = row[i] ?? null;
    });
    return obj;
  });
}

function canonicalRow(row: Record<string, unknown>, columns: string[]): string {
  return JSON.stringify(columns.map((c) => row[c] ?? null));
}

/**
 * Generic validation: compares a RunResult against ExpectedOutputs and returns
 * structured, educational feedback. Order of checks: tabular rows → stdout →
 * stdoutMatches → metrics. The first failing check wins so feedback is focused.
 *
 * Adapters with bespoke grading semantics (e.g. AI evaluation) can ignore this
 * helper and produce their own ValidationOutcome.
 */
export function validateExpected(input: ValidationInput): ValidationOutcome {
  const { expected, result } = input;

  if (!result.ok) {
    return {
      passed: false,
      summary: "Your run errored before validation could check the output.",
      feedback: result.error ?? result.stderr ?? "Fix the runtime error and run again.",
    };
  }

  // 1. Tabular row check
  if (expected.rows && expected.rows.length >= 0) {
    const actual = rowsAsObjects(result);
    if (!actual) {
      return {
        passed: false,
        summary: "This step expects tabular output but the run produced none.",
        feedback: "Make sure your query returns rows (e.g. SELECT ...). The runtime didn't emit any columns or rows.",
      };
    }
    const expectedCols = expected.rows.length > 0 ? Object.keys(expected.rows[0]) : (result.columns ?? []);
    const actualCols = result.columns ?? [];
    const missingColumns = expectedCols.filter((c) => !actualCols.includes(c));
    const extraColumns = actualCols.filter((c) => !expectedCols.includes(c));

    if (missingColumns.length > 0) {
      return {
        passed: false,
        summary: "Your result is missing some expected columns.",
        feedback: `Expected columns: ${expectedCols.join(", ")}. Missing: ${missingColumns.join(", ")}.`,
        diff: { missingColumns, extraColumns },
      };
    }
    // Extra columns are also a failure: the step contract specifies an exact
    // column set, and silently passing on superset results would let learners
    // submit `SELECT *` against tables that happen to contain the expected
    // columns.
    if (extraColumns.length > 0) {
      return {
        passed: false,
        summary: "Your result has extra columns that weren't expected.",
        feedback: `Expected columns: ${expectedCols.join(", ")}. Unexpected: ${extraColumns.join(", ")}. Project only the columns the step asks for.`,
        diff: { missingColumns, extraColumns },
      };
    }

    if (expected.orderSensitive) {
      const sameLen = expected.rows.length === actual.length;
      const sameOrder =
        sameLen &&
        expected.rows.every((r, i) => canonicalRow(r, expectedCols) === canonicalRow(actual[i], expectedCols));
      if (!sameOrder) {
        return {
          passed: false,
          summary: "Your result has the right columns but rows are out of order or wrong count.",
          feedback: `Expected ${expected.rows.length} row(s) in a specific order; got ${actual.length}. This step is order-sensitive — re-check your ORDER BY and filters.`,
        };
      }
    } else {
      // Multiset comparison: preserve duplicate-row cardinality so a query
      // missing a GROUP BY (and producing duplicates) doesn't accidentally
      // pass.
      const tally = new Map<string, number>();
      for (const r of expected.rows) {
        const k = canonicalRow(r, expectedCols);
        tally.set(k, (tally.get(k) ?? 0) + 1);
      }
      for (const r of actual) {
        const k = canonicalRow(r, expectedCols);
        tally.set(k, (tally.get(k) ?? 0) - 1);
      }
      let missingCount = 0;
      let extraCount = 0;
      for (const v of tally.values()) {
        if (v > 0) missingCount += v;
        else if (v < 0) extraCount += -v;
      }
      if (missingCount > 0 || extraCount > 0) {
        return {
          passed: false,
          summary: `Row mismatch: expected ${expected.rows.length} rows, got ${actual.length}.`,
          feedback: missingCount > 0
            ? `Missing ${missingCount} expected row(s). Your filter, join, or aggregation may be dropping data.`
            : `Got ${extraCount} extra/duplicate row(s) you weren't expecting. Check your WHERE / GROUP BY clauses.`,
          diff: {
            missingRowCount: missingCount,
            extraRowCount: extraCount,
          },
        };
      }
    }
  }

  // 2. Exact-stdout check
  if (expected.stdout !== undefined) {
    const got = (result.stdout ?? "").trim();
    const want = expected.stdout.trim();
    if (got !== want) {
      return {
        passed: false,
        summary: "Your printed output doesn't match what's expected.",
        feedback: `Expected:\n${want}\n\nGot:\n${got}`,
      };
    }
  }

  // 3. Regex stdout check
  if (expected.stdoutMatches !== undefined) {
    let re: RegExp;
    try {
      re = new RegExp(expected.stdoutMatches);
    } catch {
      return {
        passed: false,
        summary: "Validator misconfigured (bad regex). Report this to the author.",
      };
    }
    if (!re.test(result.stdout ?? "")) {
      return {
        passed: false,
        summary: "Your output doesn't match the expected pattern.",
        feedback: `Pattern: /${expected.stdoutMatches}/. Hint: re-read the step's example output.`,
      };
    }
  }

  // 4. Numeric metrics check (best-effort; adapters that don't surface metrics skip this)
  if (expected.metrics && Object.keys(expected.metrics).length > 0) {
    // Generic adapters don't yet surface metrics on RunResult, so we treat
    // missing metrics as "not failing" rather than a hard error. Metric-aware
    // adapters can override.
  }

  return { passed: true, summary: "Looks good — output matches expectations." };
}

export type { ExpectedOutputs };
