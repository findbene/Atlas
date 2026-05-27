import { describe, expect, it } from "vitest";
import { hintLeakSuspected } from "./authoringAudit";

describe("hintLeakSuspected", () => {
  it("returns false when pedagogy is null/undefined", () => {
    expect(hintLeakSuspected(null, { rows: [{ id: 1, name: "alice-the-developer" }] })).toBe(false);
    expect(hintLeakSuspected(undefined, { rows: [{ id: 1, name: "alice-the-developer" }] })).toBe(false);
  });

  it("returns false when expectedOutputs is null/undefined", () => {
    expect(hintLeakSuspected({ hintLevel5: "x".repeat(80) }, null)).toBe(false);
    expect(hintLeakSuspected({ hintLevel5: "x".repeat(80) }, undefined)).toBe(false);
  });

  it("returns false when expectedOutputs signature is too short", () => {
    expect(hintLeakSuspected({ hintLevel5: "long hint ".repeat(20) }, { a: 1 })).toBe(false);
  });

  it("returns false when no L4/L5 hints meet the length floor", () => {
    expect(
      hintLeakSuspected(
        { hintLevel4: "short", hintLevel5: "also short" },
        { rows: [{ id: 1, name: "alice-the-developer-from-segment-A" }] },
      ),
    ).toBe(false);
  });

  it("flags an obvious leak when L5 pastes the literal expected fixture", () => {
    const expected = {
      clean: [
        { customer_id: "c1", email: "alice@example.com", signup_date: "2026-01-15" },
        { customer_id: "c2", email: "bob@example.com", signup_date: "2026-01-16" },
      ],
    };
    const leakyHint = `Almost done. The output should look exactly like ${JSON.stringify(expected)} — paste that into rejects.csv.`;
    expect(hintLeakSuspected({ hintLevel5: leakyHint }, expected)).toBe(true);
  });

  it("flags a leak in L4 as well as L5", () => {
    const expected = {
      records: [
        { id: "rec-alpha-001", status: "approved", reviewer: "ada-the-quality-engineer" },
        { id: "rec-bravo-002", status: "rejected", reviewer: "bob-the-senior-data-eng" },
      ],
    };
    const leakyHint = `Make sure your output equals ${JSON.stringify(expected)} exactly before submitting.`;
    expect(hintLeakSuspected({ hintLevel4: leakyHint }, expected)).toBe(true);
  });

  it("does NOT flag a non-leaky hint that just discusses the shape", () => {
    const expected = {
      rows: [
        { customer_id: "c1", email: "alice@example.com", signup_date: "2026-01-15" },
        { customer_id: "c2", email: "bob@example.com", signup_date: "2026-01-16" },
      ],
    };
    const safeHint =
      "Your output should be a list of objects keyed by customer_id with the canonical email and ISO date. Use to_csv with index=False so the row count matches.";
    expect(hintLeakSuspected({ hintLevel5: safeHint }, expected)).toBe(false);
  });

  it("does NOT flag a hint just because it shares JSON syntax with the fixture", () => {
    const expected = { rows: [{ id: 1, name: "alice" }, { id: 2, name: "bob" }] };
    const safeHint = `Use json.dumps with sort_keys=True. Your shape will be {"rows": [...]}. Inspect with jq.`;
    expect(hintLeakSuspected({ hintLevel5: safeHint }, expected)).toBe(false);
  });

  it("survives non-serializable expectedOutputs (circular) without throwing", () => {
    const expected: Record<string, unknown> = {};
    expected.self = expected;
    expect(() =>
      hintLeakSuspected({ hintLevel5: "x".repeat(80) }, expected),
    ).not.toThrow();
    expect(hintLeakSuspected({ hintLevel5: "x".repeat(80) }, expected)).toBe(false);
  });
});
