/**
 * Phase 24 — Pure unit tests for the shared grading helper.
 * Verifies the rules used by BOTH /submit and /check stay byte-identical
 * to the legacy inline switch.
 */
import { describe, expect, it } from "vitest";
import {
  gradeSubmission,
  gradeCsvSetEqual,
  computeCsvSetEqualHash,
  NO_CHECK_STEP_TYPES,
} from "./grading";

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

  // ── Phase 57A — csv_set_equal DARK comparator ────────────────────────
  describe("csv_set_equal (Phase 57A — dark server-side comparator)", () => {
    const cstep = (spec: unknown) =>
      step({
        validationType: "csv_set_equal",
        validationConfig: { kind: "csv_set_equal", spec, description: "t" } as Parameters<typeof gradeSubmission>[0]["validationConfig"],
      });
    const okSub = (columns: string[], rows: unknown[][]) =>
      JSON.stringify({ columns, rows });

    it("BC: validationConfig=null → generic 'Step completed.' (outer guard preserved)", () => {
      const r = gradeSubmission(
        step({ validationType: "csv_set_equal", validationConfig: null }),
        "anything",
      );
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: spec without serverGrade flag → auto-pass (NO behavior change for live rows)", () => {
      const r = gradeSubmission(cstep({ columns: ["a"], expectedRows: [[1]] }), "garbage");
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: serverGrade=false → auto-pass", () => {
      const r = gradeSubmission(cstep({ serverGrade: false, columns: ["a"], expectedRows: [[1]] }), "garbage");
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: serverGrade non-boolean (e.g. 'yes') → auto-pass (runtime treats !==true as opt-out)", () => {
      const r = gradeSubmission(cstep({ serverGrade: "yes", columns: ["a"], expectedRows: [[1]] }), "garbage");
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: shape E (expectedClean/expectedRejects) with no serverGrade → auto-pass", () => {
      const r = gradeSubmission(
        cstep({ cleanColumns: ["a"], expectedClean: "fixtures/c.csv", rejectColumns: ["a"], expectedRejects: "fixtures/r.csv" }),
        "anything",
      );
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: existing fixture-only shape (expectedCsv) with no serverGrade → auto-pass", () => {
      const r = gradeSubmission(cstep({ columns: ["a"], expectedCsv: "fixtures/x.csv", orderSensitive: true }), "x");
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    // ── opted-in: malformed specs fail closed ──────────────────────────
    it("malformed: serverGrade=true but no expectedRows/expectedRowsHash → MALFORMED", () => {
      const r = gradeSubmission(cstep({ serverGrade: true, columns: ["a"] }), okSub(["a"], [[1]]));
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: serverGrade=true but columns missing → MALFORMED", () => {
      const r = gradeSubmission(cstep({ serverGrade: true, expectedRows: [[1]] }), okSub(["a"], [[1]]));
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: serverGrade=true with empty columns array → MALFORMED", () => {
      const r = gradeSubmission(cstep({ serverGrade: true, columns: [], expectedRows: [] }), okSub([], []));
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: expectedRowsHash with wrong format → MALFORMED", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRowsHash: "not-a-hex" }),
        okSub(["a"], [[1]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: dedupe with invalid value → MALFORMED", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1]], dedupe: "weird" }),
        okSub(["a"], [[1]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: non-boolean flag (e.g. trimStrings:'yes') → MALFORMED", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1]], trimStrings: "yes" }),
        okSub(["a"], [[1]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: orderSensitive=true with hash-only (no expectedRows) → MALFORMED", () => {
      const hash = computeCsvSetEqualHash(["a"], [[1]]);
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRowsHash: hash, orderSensitive: true }),
        okSub(["a"], [[1]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    // ── opted-in: submission-shape failures ────────────────────────────
    it("submission: empty string fails closed with helpful feedback", () => {
      const r = gradeSubmission(cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1]] }), "");
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/submission is empty/i);
    });

    it("submission: invalid JSON fails closed", () => {
      const r = gradeSubmission(cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1]] }), "not json {");
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/not valid JSON/i);
    });

    it("submission: wrong shape (missing rows) fails closed", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1]] }),
        JSON.stringify({ columns: ["a"] }),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/columns.*rows/i);
    });

    // ── happy path comparisons ─────────────────────────────────────────
    it("PASS: exact match with default flags", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a", "b"], expectedRows: [[1, "x"], [2, "y"]] }),
        okSub(["a", "b"], [[1, "x"], [2, "y"]]),
      );
      expect(r).toEqual({ passed: true, feedback: "Correct!" });
    });

    it("PASS: rows out of order with default (multiset)", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1], [2], [3]] }),
        okSub(["a"], [[3], [1], [2]]),
      );
      expect(r.passed).toBe(true);
    });

    it("FAIL: rows out of order with orderSensitive=true", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1], [2]], orderSensitive: true }),
        okSub(["a"], [[2], [1]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/ordered/i);
    });

    it("PASS: orderSensitive=true with correct order", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1], [2]], orderSensitive: true }),
        okSub(["a"], [[1], [2]]),
      );
      expect(r.passed).toBe(true);
    });

    // ── header checks ──────────────────────────────────────────────────
    it("FAIL: column count mismatch", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a", "b"], expectedRows: [[1, 2]] }),
        okSub(["a"], [[1]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/column count/i);
    });

    it("FAIL: column name mismatch (case-sensitive default)", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["Name"], expectedRows: [["x"]] }),
        okSub(["name"], [["x"]]),
      );
      expect(r.passed).toBe(false);
    });

    it("PASS: column name with caseInsensitive=true", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["Name"], expectedRows: [["x"]], caseInsensitive: true }),
        okSub(["NAME"], [["x"]]),
      );
      expect(r.passed).toBe(true);
    });

    // ── duplicate rows / dedupe ────────────────────────────────────────
    it("FAIL: multiset default — duplicate cardinality matters", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1], [1], [2]] }),
        okSub(["a"], [[1], [2]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/missing/i);
    });

    it("PASS: dedupe='both' collapses duplicates on both sides", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1], [1], [2]], dedupe: "both" }),
        okSub(["a"], [[1], [2]]),
      );
      expect(r.passed).toBe(true);
    });

    it("PASS: dedupe='expected' collapses expected duplicates; submission must match deduped tally", () => {
      // Semantics: dedupe='expected' removes duplicate rows from the
      // expected set only. Submission is then multiset-compared against
      // the deduped expected — so [[1],[2]] passes against authored
      // [[1],[1],[2]] when dedupe='expected', but [[1],[1],[2]] would
      // fail (extra duplicate row).
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1], [1], [2]], dedupe: "expected" }),
        okSub(["a"], [[1], [2]]),
      );
      expect(r.passed).toBe(true);
    });

    // ── whitespace ─────────────────────────────────────────────────────
    it("FAIL: trailing space without trimStrings", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [["x"]] }),
        okSub(["a"], [["x "]]),
      );
      expect(r.passed).toBe(false);
    });

    it("PASS: trailing space with trimStrings=true", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [["x"]], trimStrings: true }),
        okSub(["a"], [["x "]]),
      );
      expect(r.passed).toBe(true);
    });

    // ── null vs empty ──────────────────────────────────────────────────
    it("FAIL: null vs '' distinct by default", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[null]] }),
        okSub(["a"], [[""]]),
      );
      expect(r.passed).toBe(false);
    });

    it("PASS: nullEqualsEmpty=true collapses null and ''", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[null]], nullEqualsEmpty: true }),
        okSub(["a"], [[""]]),
      );
      expect(r.passed).toBe(true);
    });

    // ── numeric coercion ───────────────────────────────────────────────
    it("FAIL: '42' vs 42 distinct by default", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[42]] }),
        okSub(["a"], [["42"]]),
      );
      expect(r.passed).toBe(false);
    });

    it("PASS: coerceNumericStrings=true treats '42' as 42", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[42]], coerceNumericStrings: true }),
        okSub(["a"], [["42"]]),
      );
      expect(r.passed).toBe(true);
    });

    // ── case-insensitive cell values ───────────────────────────────────
    it("PASS: caseInsensitive=true on string cells", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [["HELLO"]], caseInsensitive: true }),
        okSub(["a"], [["hello"]]),
      );
      expect(r.passed).toBe(true);
    });

    // ── row width / extras ─────────────────────────────────────────────
    it("FAIL: row width mismatch", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a", "b"], expectedRows: [[1, 2]] }),
        okSub(["a", "b"], [[1]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/row width/i);
    });

    // ── architect-fix: deeper malformed-input coverage ────────────────
    it("submission: rows containing nested object/array cells fail closed", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1]] }),
        JSON.stringify({ columns: ["a"], rows: [[{ x: 1 }]] }),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/arrays of cells/i);
    });

    it("submission: rows containing array-cell fail closed", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1]] }),
        JSON.stringify({ columns: ["a"], rows: [[[1, 2]]] }),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/arrays of cells/i);
    });

    it("malformed (opt-in): expectedRows width does NOT match columns count → MALFORMED", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a", "b"], expectedRows: [[1]] }),
        okSub(["a", "b"], [[1, 2]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("FAIL: extra unexpected row", () => {
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: ["a"], expectedRows: [[1]] }),
        okSub(["a"], [[1], [99]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/unexpected/i);
    });

    // ── hash-only path ────────────────────────────────────────────────
    it("PASS: hash-only path with matching dataset", () => {
      const cols = ["a", "b"];
      const rows = [[1, "x"], [2, "y"]];
      const hash = computeCsvSetEqualHash(cols, rows);
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: cols, expectedRowsHash: hash }),
        okSub(cols, rows),
      );
      expect(r.passed).toBe(true);
    });

    it("FAIL: hash-only path with differing dataset", () => {
      const cols = ["a"];
      const hash = computeCsvSetEqualHash(cols, [[1]]);
      const r = gradeSubmission(
        cstep({ serverGrade: true, columns: cols, expectedRowsHash: hash }),
        okSub(cols, [[2]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/fingerprint/i);
    });

    it("hash is order-insensitive (multiset fingerprint)", () => {
      const h1 = computeCsvSetEqualHash(["a"], [[1], [2], [3]]);
      const h2 = computeCsvSetEqualHash(["a"], [[3], [2], [1]]);
      expect(h1).toBe(h2);
    });

    // ── direct helper symmetry with dispatch ─────────────────────────
    it("gradeCsvSetEqual called directly returns same outcome as dispatch", () => {
      const spec = { serverGrade: true, columns: ["a"], expectedRows: [[1]] };
      const direct = gradeCsvSetEqual(spec, okSub(["a"], [[1]]));
      const viaDispatch = gradeSubmission(cstep(spec), okSub(["a"], [[1]]));
      expect(direct).toEqual(viaDispatch);
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
