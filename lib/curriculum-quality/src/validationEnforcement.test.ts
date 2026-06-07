import { describe, expect, it } from "vitest";
import {
  ENFORCEMENT_VALIDATION_KINDS,
  LEGACY_JSON_EQUAL_SPEC_KEYS,
  NON_TEXT_SUBMISSION_STEP_TYPES,
  classifyValidationKind,
  classifyValidationKindWithSpec,
  isServerGradedRowset,
  describeEnforcement,
  detectLegacyJsonEqualSpecKeys,
  jsonEqualHasSubmissionShapeMismatch,
  tallyValidationKinds,
  tallyValidationKindsWithSpec,
} from "./validationEnforcement";

describe("classifyValidationKind", () => {
  it("classifies the 4 server-enforced kinds as 'enforced'", () => {
    expect(classifyValidationKind("self_attest")).toBe("enforced");
    expect(classifyValidationKind("exact")).toBe("enforced");
    expect(classifyValidationKind("contains")).toBe("enforced");
    expect(classifyValidationKind("regex")).toBe("enforced");
  });

  it("classifies SQL-shaped kinds as 'client-provisional'", () => {
    expect(classifyValidationKind("sql_resultset")).toBe("client-provisional");
    expect(classifyValidationKind("csv_set_equal")).toBe("client-provisional");
    expect(classifyValidationKind("csv_ordered")).toBe("client-provisional");
  });

  it("classifies Python-structured kinds as 'contract-shaped'", () => {
    expect(classifyValidationKind("json_equal")).toBe("contract-shaped");
    expect(classifyValidationKind("numeric_tolerance")).toBe("contract-shaped");
  });

  it("returns 'unknown' for nullish or unrecognized values", () => {
    expect(classifyValidationKind(null)).toBe("unknown");
    expect(classifyValidationKind(undefined)).toBe("unknown");
    expect(classifyValidationKind("")).toBe("unknown");
    expect(classifyValidationKind("not_a_kind")).toBe("unknown");
    expect(classifyValidationKind("EXACT")).toBe("unknown"); // case-sensitive
  });

  it("covers every kind in the ENFORCEMENT_VALIDATION_KINDS array (no orphans)", () => {
    for (const kind of ENFORCEMENT_VALIDATION_KINDS) {
      expect(classifyValidationKind(kind)).not.toBe("unknown");
    }
  });
});

describe("describeEnforcement", () => {
  it("returns distinct human strings for each status", () => {
    const strings = new Set([
      describeEnforcement("enforced"),
      describeEnforcement("client-provisional"),
      describeEnforcement("contract-shaped"),
      describeEnforcement("unknown"),
    ]);
    expect(strings.size).toBe(4);
  });

  it("returns non-empty strings", () => {
    expect(describeEnforcement("enforced").length).toBeGreaterThan(0);
    expect(describeEnforcement("client-provisional").length).toBeGreaterThan(0);
    expect(describeEnforcement("contract-shaped").length).toBeGreaterThan(0);
    expect(describeEnforcement("unknown").length).toBeGreaterThan(0);
  });
});

describe("tallyValidationKinds", () => {
  it("counts kinds and tags each with its enforcement status", () => {
    const tally = tallyValidationKinds([
      "exact",
      "exact",
      "contains",
      "json_equal",
      "json_equal",
      "json_equal",
      "sql_resultset",
    ]);
    expect(tally.get("exact")).toEqual({ count: 2, status: "enforced" });
    expect(tally.get("contains")).toEqual({ count: 1, status: "enforced" });
    expect(tally.get("json_equal")).toEqual({ count: 3, status: "contract-shaped" });
    expect(tally.get("sql_resultset")).toEqual({ count: 1, status: "client-provisional" });
  });

  it("records null values under '(null)' bucket as unknown", () => {
    const tally = tallyValidationKinds([null, null, undefined]);
    expect(tally.get("(null)")).toEqual({ count: 3, status: "unknown" });
  });

  it("records unrecognized values verbatim so operators can grep typos", () => {
    const tally = tallyValidationKinds(["json_eq", "exact"]);
    expect(tally.get("json_eq")).toEqual({ count: 1, status: "unknown" });
    expect(tally.get("exact")).toEqual({ count: 1, status: "enforced" });
  });

  it("returns an empty map for an empty input", () => {
    expect(tallyValidationKinds([]).size).toBe(0);
  });
});

// ── Phase 43B-prime — submission-shape advisories ────────────────────────

describe("NON_TEXT_SUBMISSION_STEP_TYPES", () => {
  it("contains exactly the 3 step types whose submission is source code, not JSON output", () => {
    expect([...NON_TEXT_SUBMISSION_STEP_TYPES].sort()).toEqual([
      "code_python",
      "code_sql",
      "multi_file",
    ]);
  });
});

describe("jsonEqualHasSubmissionShapeMismatch", () => {
  it("flags json_equal with each code-shaped step type", () => {
    expect(jsonEqualHasSubmissionShapeMismatch("json_equal", "code_python")).toBe(true);
    expect(jsonEqualHasSubmissionShapeMismatch("json_equal", "code_sql")).toBe(true);
    expect(jsonEqualHasSubmissionShapeMismatch("json_equal", "multi_file")).toBe(true);
  });

  it("does NOT flag json_equal with writeup (text submission — server can JSON.parse)", () => {
    expect(jsonEqualHasSubmissionShapeMismatch("json_equal", "writeup")).toBe(false);
  });

  it("returns false for any non-json_equal validation kind", () => {
    expect(jsonEqualHasSubmissionShapeMismatch("exact", "code_python")).toBe(false);
    expect(jsonEqualHasSubmissionShapeMismatch("numeric_tolerance", "code_python")).toBe(false);
    expect(jsonEqualHasSubmissionShapeMismatch("sql_resultset", "code_sql")).toBe(false);
    expect(jsonEqualHasSubmissionShapeMismatch("self_attest", "code_python")).toBe(false);
  });

  it("returns false for nullish inputs (defensive)", () => {
    expect(jsonEqualHasSubmissionShapeMismatch(null, "code_python")).toBe(false);
    expect(jsonEqualHasSubmissionShapeMismatch(undefined, "code_python")).toBe(false);
    expect(jsonEqualHasSubmissionShapeMismatch("json_equal", null)).toBe(false);
    expect(jsonEqualHasSubmissionShapeMismatch("json_equal", undefined)).toBe(false);
    expect(jsonEqualHasSubmissionShapeMismatch("json_equal", "")).toBe(false);
  });

  it("returns false for an unknown step type (defensive — only flags KNOWN code-shaped types)", () => {
    expect(jsonEqualHasSubmissionShapeMismatch("json_equal", "freeform")).toBe(false);
    expect(jsonEqualHasSubmissionShapeMismatch("json_equal", "code_haskell")).toBe(false);
  });
});

describe("detectLegacyJsonEqualSpecKeys", () => {
  it("detects stdoutMustEqualJson at spec level", () => {
    expect(
      detectLegacyJsonEqualSpecKeys({
        kind: "json_equal",
        description: "x",
        spec: { stdoutMustEqualJson: { foo: 1 } },
      }),
    ).toEqual(["stdoutMustEqualJson"]);
  });

  it("detects stdoutMustContainShape at spec level", () => {
    expect(
      detectLegacyJsonEqualSpecKeys({
        kind: "json_equal",
        description: "x",
        spec: { stdoutMustContainShape: { foo: 1 } },
      }),
    ).toEqual(["stdoutMustContainShape"]);
  });

  it("detects BOTH legacy keys when present in the same spec", () => {
    expect(
      detectLegacyJsonEqualSpecKeys({
        spec: {
          stdoutMustEqualJson: { a: 1 },
          stdoutMustContainShape: { b: 2 },
        },
      }),
    ).toEqual(["stdoutMustEqualJson", "stdoutMustContainShape"]);
  });

  it("detects legacy keys flattened at the top level (defensive)", () => {
    expect(
      detectLegacyJsonEqualSpecKeys({ stdoutMustEqualJson: { foo: 1 } }),
    ).toEqual(["stdoutMustEqualJson"]);
  });

  it("returns [] for the canonical { expected } shape", () => {
    expect(
      detectLegacyJsonEqualSpecKeys({
        kind: "json_equal",
        description: "x",
        spec: { expected: { foo: 1 } },
      }),
    ).toEqual([]);
  });

  it("returns [] for empty / nullish / non-object input", () => {
    expect(detectLegacyJsonEqualSpecKeys(null)).toEqual([]);
    expect(detectLegacyJsonEqualSpecKeys(undefined)).toEqual([]);
    expect(detectLegacyJsonEqualSpecKeys({})).toEqual([]);
    expect(detectLegacyJsonEqualSpecKeys("")).toEqual([]);
    expect(detectLegacyJsonEqualSpecKeys(42)).toEqual([]);
  });

  it("returns the constant key strings (not author-typed variants)", () => {
    const out = detectLegacyJsonEqualSpecKeys({
      spec: { stdoutMustEqualJson: {} },
    });
    expect(LEGACY_JSON_EQUAL_SPEC_KEYS).toContain(out[0]!);
  });
});

// ── Phase 59B — serverGrade-aware classification ─────────────────────────

describe("isServerGradedRowset", () => {
  const opted = (kind: string) => ({ kind, description: "d", spec: { serverGrade: true, columns: ["a"], expectedRows: [[1]] } });
  it("true for opted-in csv_set_equal / sql_resultset", () => {
    expect(isServerGradedRowset("csv_set_equal", opted("csv_set_equal"))).toBe(true);
    expect(isServerGradedRowset("sql_resultset", opted("sql_resultset"))).toBe(true);
  });
  it("false for a rowset kind WITHOUT serverGrade (dark) — including the live free-form sql shape", () => {
    expect(isServerGradedRowset("sql_resultset", { spec: { query: "q", expectedRow: { n: 7 } } })).toBe(false);
    expect(isServerGradedRowset("csv_set_equal", { spec: { columns: ["a"], expectedCsv: "f.csv" } })).toBe(false);
    expect(isServerGradedRowset("csv_set_equal", { spec: { serverGrade: false } })).toBe(false);
    expect(isServerGradedRowset("csv_set_equal", { spec: { serverGrade: "yes" } })).toBe(false); // non-boolean
  });
  it("false for non-rowset kinds even if serverGrade somehow set", () => {
    expect(isServerGradedRowset("exact", { spec: { serverGrade: true } })).toBe(false);
    expect(isServerGradedRowset("json_equal", { spec: { serverGrade: true } })).toBe(false);
  });
  it("false for nullish / malformed config (defensive)", () => {
    expect(isServerGradedRowset("csv_set_equal", null)).toBe(false);
    expect(isServerGradedRowset("csv_set_equal", undefined)).toBe(false);
    expect(isServerGradedRowset("csv_set_equal", { spec: null })).toBe(false);
    expect(isServerGradedRowset(null, { spec: { serverGrade: true } })).toBe(false);
  });
});

describe("classifyValidationKindWithSpec", () => {
  it("upgrades an opted-in rowset row to enforced", () => {
    expect(classifyValidationKindWithSpec("sql_resultset", { spec: { serverGrade: true } })).toBe("enforced");
    expect(classifyValidationKindWithSpec("csv_set_equal", { spec: { serverGrade: true } })).toBe("enforced");
  });
  it("leaves dark rowset rows client-provisional (matches kind-only classifier)", () => {
    expect(classifyValidationKindWithSpec("sql_resultset", { spec: { query: "q" } })).toBe("client-provisional");
    expect(classifyValidationKindWithSpec("csv_set_equal", null)).toBe("client-provisional");
  });
  it("is identical to classifyValidationKind for every non-rowset kind", () => {
    for (const k of ["self_attest", "exact", "contains", "regex", "json_equal", "numeric_tolerance", "csv_ordered", "nope", null]) {
      expect(classifyValidationKindWithSpec(k, { spec: { serverGrade: true } })).toBe(classifyValidationKind(k));
    }
  });
});

describe("tallyValidationKindsWithSpec", () => {
  it("buckets an opted-in rowset row under '<kind> (server-graded)' with enforced status", () => {
    const tally = tallyValidationKindsWithSpec([
      { kind: "sql_resultset", validationConfig: { spec: { serverGrade: true } } }, // opted-in
      { kind: "sql_resultset", validationConfig: { spec: { query: "q" } } },        // dark
      { kind: "sql_resultset", validationConfig: { spec: { query: "q2" } } },       // dark
      { kind: "csv_set_equal", validationConfig: { spec: { serverGrade: true } } }, // opted-in
      { kind: "exact", validationConfig: null },
    ]);
    expect(tally.get("sql_resultset (server-graded)")).toEqual({ count: 1, status: "enforced" });
    expect(tally.get("sql_resultset")).toEqual({ count: 2, status: "client-provisional" });
    expect(tally.get("csv_set_equal (server-graded)")).toEqual({ count: 1, status: "enforced" });
    expect(tally.get("csv_set_equal")).toBeUndefined(); // the only csv row is opted-in
    expect(tally.get("exact")).toEqual({ count: 1, status: "enforced" });
  });
  it("returns an empty map for empty input", () => {
    expect(tallyValidationKindsWithSpec([]).size).toBe(0);
  });
});
