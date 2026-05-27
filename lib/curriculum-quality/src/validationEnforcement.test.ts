import { describe, expect, it } from "vitest";
import {
  ENFORCEMENT_VALIDATION_KINDS,
  classifyValidationKind,
  describeEnforcement,
  tallyValidationKinds,
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
