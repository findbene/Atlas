/**
 * Phase 24 — Pure unit tests for the shared grading helper.
 * Verifies the rules used by BOTH /submit and /check stay byte-identical
 * to the legacy inline switch.
 */
import { describe, expect, it } from "vitest";
import {
  gradeSubmission,
  gradeCsvSetEqual,
  gradeSqlResultset,
  computeCsvSetEqualHash,
  isServerGradeOptedIn,
  NO_CHECK_STEP_TYPES,
} from "./grading";

const step = (over: Partial<Parameters<typeof gradeSubmission>[0]> = {}) => ({
  validationType: null,
  validationConfig: null,
  expectedOutput: null,
  ...over,
});

describe("isServerGradeOptedIn — canonical serverGrade predicate", () => {
  it("true ONLY for an opted-in rowset kind (spec.serverGrade === true)", () => {
    const cfg = { spec: { serverGrade: true, columns: ["a"], expectedRows: [[1]] } };
    expect(isServerGradeOptedIn("csv_set_equal", cfg)).toBe(true);
    expect(isServerGradeOptedIn("sql_resultset", cfg)).toBe(true);
  });
  it("false for a rowset kind that is not opted in", () => {
    expect(isServerGradeOptedIn("csv_set_equal", { spec: { columns: ["a"] } })).toBe(false);
    expect(isServerGradeOptedIn("sql_resultset", { spec: { serverGrade: false } })).toBe(false);
    expect(isServerGradeOptedIn("csv_set_equal", {})).toBe(false);
    expect(isServerGradeOptedIn("csv_set_equal", null)).toBe(false);
  });
  it("never upgrades a non-rowset kind even with a stray flag", () => {
    const cfg = { spec: { serverGrade: true } };
    expect(isServerGradeOptedIn("contains", cfg)).toBe(false);
    expect(isServerGradeOptedIn("json_equal", cfg)).toBe(false);
    expect(isServerGradeOptedIn("self_attest", cfg)).toBe(false);
    expect(isServerGradeOptedIn(null, cfg)).toBe(false);
  });
  it("treats a non-true serverGrade (e.g. string) as not opted in (no coercion)", () => {
    expect(isServerGradeOptedIn("csv_set_equal", { spec: { serverGrade: "true" } })).toBe(false);
  });
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

  // ── Phase 61G — wrapped `{kind, spec, description}` config extraction ──
  // Before 61G the contains branch passed the WRAPPED validationConfig to
  // matchContains, which reads TOP-LEVEL needle/needles → an authored
  // `{spec:{needles}}` was never read → the step auto-passed ANY submission (a
  // dead gate). gradeSubmission now extracts the inner spec; these prove the
  // wrapped shape actually enforces, and that the legacy top-level shape is BC.
  describe("contains (Phase 61G — wrapped-spec extraction enforces)", () => {
    const wrapped = (spec: unknown) =>
      step({
        validationType: "contains",
        validationConfig: { kind: "contains", spec, description: "x" } as Parameters<typeof gradeSubmission>[0]["validationConfig"],
        expectedOutput: null,
      });
    const legacy = (needle: string) =>
      step({
        validationType: "contains",
        validationConfig: { needle } as Parameters<typeof gradeSubmission>[0]["validationConfig"],
        expectedOutput: null,
      });

    it("wrapped needles: all markers present → pass", () => {
      expect(gradeSubmission(wrapped({ needles: ["alpha", "beta"] }), "has alpha and beta here").passed).toBe(true);
    });
    it("wrapped needles: a required marker missing → FAIL (was a dead auto-pass pre-61G)", () => {
      const r = gradeSubmission(wrapped({ needles: ["alpha", "beta"] }), "only alpha here");
      expect(r.passed).toBe(false);
      expect(r.feedback).toContain("beta");
    });
    it("wrapped needles: empty submission → FAIL", () => {
      expect(gradeSubmission(wrapped({ needles: ["alpha", "beta"] }), "").passed).toBe(false);
    });
    it("wrapped needles: garbage submission → FAIL", () => {
      expect(gradeSubmission(wrapped({ needles: ["alpha", "beta"] }), "zzz unrelated yyy").passed).toBe(false);
    });
    it("wrapped single needle: present → pass; absent → fail", () => {
      expect(gradeSubmission(wrapped({ needle: "gamma" }), "xx gamma yy").passed).toBe(true);
      expect(gradeSubmission(wrapped({ needle: "gamma" }), "xx yy").passed).toBe(false);
    });
    it("BC: legacy TOP-LEVEL {needle} (no nested spec, the live seed shape) still enforces", () => {
      expect(gradeSubmission(legacy("copy_expert"), "uses copy_expert now").passed).toBe(true);
      expect(gradeSubmission(legacy("copy_expert"), "no match").passed).toBe(false);
    });
  });

  // ── Phase 61H — exact must fail closed without a configured expected ──
  // Before 61H, `exact` with no `expected_output` fell through to the generic
  // auto-pass (a dead gate — the authored-exact path never populates it; C2
  // steps 4/6 were exactly this). It now fails closed.
  describe("exact (Phase 61H — fail closed without expected)", () => {
    const ex = (expected: string | null) =>
      step({
        validationType: "exact",
        validationConfig: null,
        expectedOutput: expected,
      });
    it("valid: submission === expected → pass (whitespace-trimmed)", () => {
      expect(gradeSubmission(ex("foo"), "foo").passed).toBe(true);
      expect(gradeSubmission(ex("foo"), "  foo  ").passed).toBe(true);
    });
    it("wrong submission → fail with expected in feedback", () => {
      const r = gradeSubmission(ex("foo"), "bar");
      expect(r.passed).toBe(false);
      expect(r.feedback).toContain("foo");
    });
    it("empty submission (expected non-empty) → fail", () => {
      expect(gradeSubmission(ex("foo"), "").passed).toBe(false);
    });
    it("null expected → FAIL CLOSED (was a dead auto-pass pre-61H)", () => {
      expect(gradeSubmission(ex(null), "anything").passed).toBe(false);
    });
    it("empty-string expected → FAIL CLOSED", () => {
      expect(gradeSubmission(ex(""), "anything").passed).toBe(false);
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

  // ── Phase 58A — sql_resultset DARK comparator ────────────────────────
  describe("sql_resultset (Phase 58A — dark server-side comparator)", () => {
    const sstep = (spec: unknown) =>
      step({
        validationType: "sql_resultset",
        validationConfig: { kind: "sql_resultset", spec, description: "t" } as Parameters<typeof gradeSubmission>[0]["validationConfig"],
      });
    const okSub = (columns: string[], rows: unknown[][]) =>
      JSON.stringify({ columns, rows });

    // ── DARK / BC: every live shape auto-passes byte-identically ───────
    it("BC: validationConfig=null → generic 'Step completed.' (no sql_resultset case before 58A)", () => {
      const r = gradeSubmission(
        step({ validationType: "sql_resultset", validationConfig: null }),
        "select * from t",
      );
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: spec without serverGrade → auto-pass (no behavior change for the 25 live rows)", () => {
      // Mirrors the live `{query, expectedRow}` shape used by the C2 semantic-layer steps.
      const r = gradeSubmission(
        sstep({ query: "select count(*) as n from t", expectedRow: { n: 7 } }),
        "select count(*) as n from t",
      );
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: free-form scalar-assertion spec (Snowflake shape) → auto-pass", () => {
      const r = gradeSubmission(
        sstep({ expectedActionCounts: { INSERT: 3 } }),
        "create stream ...",
      );
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: array-of-objects expectedRows without serverGrade → auto-pass", () => {
      const r = gradeSubmission(
        sstep({ query: "q", expectedRows: [{ check: "one_current", value: 0 }] }),
        "garbage",
      );
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: serverGrade=false → auto-pass", () => {
      const r = gradeSubmission(sstep({ serverGrade: false, columns: ["a"], expectedRows: [[1]] }), "garbage");
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    it("BC: serverGrade non-boolean ('yes') → auto-pass (runtime treats !==true as opt-out)", () => {
      const r = gradeSubmission(sstep({ serverGrade: "yes", columns: ["a"], expectedRows: [[1]] }), "garbage");
      expect(r).toEqual({ passed: true, feedback: "Step completed." });
    });

    // ── opted-in: malformed specs fail closed ──────────────────────────
    it("malformed: serverGrade=true but no expectedRows/hash → MALFORMED", () => {
      const r = gradeSubmission(sstep({ serverGrade: true, columns: ["a"] }), okSub(["a"], [[1]]));
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: serverGrade=true but columns missing → MALFORMED", () => {
      const r = gradeSubmission(sstep({ serverGrade: true, expectedRows: [[1]] }), okSub(["a"], [[1]]));
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    it("malformed: orderSensitive=true with hash-only → MALFORMED", () => {
      const hash = computeCsvSetEqualHash(["a"], [[1]]);
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["a"], expectedRowsHash: hash, orderSensitive: true }),
        okSub(["a"], [[1]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/malformed/i);
    });

    // ── opted-in: submission fails closed (raw SQL / empty / non-JSON) ─
    it("submission: raw SQL (not JSON) fails closed", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["n"], expectedRows: [[7]] }),
        "select count(*) as n from stg_customers",
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/not valid JSON/i);
    });

    it("submission: empty string fails closed", () => {
      const r = gradeSubmission(sstep({ serverGrade: true, columns: ["n"], expectedRows: [[7]] }), "");
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/submission is empty/i);
    });

    it("submission: wrong shape (missing rows) fails closed", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["n"], expectedRows: [[7]] }),
        JSON.stringify({ columns: ["n"] }),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/columns.*rows/i);
    });

    // ── opted-in: happy path + result-set semantics ───────────────────
    it("PASS: exact result-set match (default multiset)", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["check", "value"], expectedRows: [["one_current", 0], ["overlap", 0]] }),
        okSub(["check", "value"], [["overlap", 0], ["one_current", 0]]),
      );
      expect(r).toEqual({ passed: true, feedback: "Correct!" });
    });

    it("FAIL: wrong columns", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["n"], expectedRows: [[7]] }),
        okSub(["count"], [[7]]),
      );
      expect(r.passed).toBe(false);
    });

    it("FAIL: wrong rows (missing expected row)", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["n"], expectedRows: [[7]] }),
        okSub(["n"], [[6]]),
      );
      expect(r.passed).toBe(false);
    });

    it("FAIL: extra unmatched row", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["n"], expectedRows: [[7]] }),
        okSub(["n"], [[7], [99]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/unexpected/i);
    });

    // ── order-sensitive result-set (ORDER BY contracts) ───────────────
    it("FAIL: rows out of order with orderSensitive=true", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["a"], expectedRows: [[1], [2]], orderSensitive: true }),
        okSub(["a"], [[2], [1]]),
      );
      expect(r.passed).toBe(false);
      expect(r.feedback).toMatch(/ordered/i);
    });

    it("PASS: orderSensitive=true with correct order", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["a"], expectedRows: [[1], [2]], orderSensitive: true }),
        okSub(["a"], [[1], [2]]),
      );
      expect(r.passed).toBe(true);
    });

    // ── normalization edge cases (delegated to the shared comparator) ─
    it("FAIL: null vs '' distinct by default", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["a"], expectedRows: [[null]] }),
        okSub(["a"], [[""]]),
      );
      expect(r.passed).toBe(false);
    });

    it("PASS: nullEqualsEmpty=true collapses null and ''", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["a"], expectedRows: [[null]], nullEqualsEmpty: true }),
        okSub(["a"], [[""]]),
      );
      expect(r.passed).toBe(true);
    });

    it("FAIL: '42' vs 42 distinct by default; PASS with coerceNumericStrings", () => {
      const strict = gradeSubmission(
        sstep({ serverGrade: true, columns: ["a"], expectedRows: [[42]] }),
        okSub(["a"], [["42"]]),
      );
      expect(strict.passed).toBe(false);
      const coerced = gradeSubmission(
        sstep({ serverGrade: true, columns: ["a"], expectedRows: [[42]], coerceNumericStrings: true }),
        okSub(["a"], [["42"]]),
      );
      expect(coerced.passed).toBe(true);
    });

    it("boolean cells are distinct from string 'true'", () => {
      const r = gradeSubmission(
        sstep({ serverGrade: true, columns: ["a"], expectedRows: [[true]] }),
        okSub(["a"], [["true"]]),
      );
      expect(r.passed).toBe(false);
    });

    // ── direct helper symmetry with dispatch ──────────────────────────
    it("gradeSqlResultset called directly returns same outcome as dispatch", () => {
      const spec = { serverGrade: true, columns: ["n"], expectedRows: [[7]] };
      const direct = gradeSqlResultset(spec, okSub(["n"], [[7]]));
      const viaDispatch = gradeSubmission(sstep(spec), okSub(["n"], [[7]]));
      expect(direct).toEqual(viaDispatch);
    });

    it("shares ONE comparator with csv_set_equal: identical opted-in outcomes", () => {
      const spec = { serverGrade: true, columns: ["a", "b"], expectedRows: [[1, "x"], [2, "y"]] };
      const sub = okSub(["a", "b"], [[2, "y"], [1, "x"]]);
      expect(gradeSqlResultset(spec, sub)).toEqual(gradeCsvSetEqual(spec, sub));
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

  it("regex (Phase 61I — wrapped spec): reads inner spec.pattern, passes on match", () => {
    const r = gradeSubmission(
      step({
        validationType: "regex",
        // The validationConfig() wrapped shape — pre-61I the runtime read the
        // (absent) top-level `pattern` → new RegExp("") → matched anything.
        validationConfig: { kind: "regex", description: "d", spec: { pattern: "^hello", flags: "i" } },
      }),
      "HELLO world",
    );
    expect(r.passed).toBe(true);
  });

  it("regex (Phase 61I — wrapped spec): a non-matching submission FAILS (not a dead gate)", () => {
    const r = gradeSubmission(
      step({
        validationType: "regex",
        validationConfig: { kind: "regex", description: "d", spec: { pattern: "^hello", flags: "" } },
      }),
      "goodbye world",
    );
    expect(r.passed).toBe(false);
  });

  it("regex (Phase 61I): legacy top-level { pattern } still works (BC fallback)", () => {
    const r = gradeSubmission(
      step({ validationType: "regex", validationConfig: { pattern: "^ok$" } }),
      "ok",
    );
    expect(r.passed).toBe(true);
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
