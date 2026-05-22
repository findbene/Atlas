import { describe, expect, it } from "vitest";
import { mergeQualityBreakdown } from "./mergeQualityBreakdown";

/**
 * Phase 17 regression coverage.
 *
 * These tests pin the contract that broke during Phase 16:
 * `promote()` writes `qualityBreakdown.portfolioArtifact`, then
 * `audit --commit` (or batch `audit-quality.ts`) used to OVERWRITE
 * `qualityBreakdown` with the Scorecard, stripping `portfolioArtifact`.
 * On the next wave-report read, `projectRowToInput` no longer found
 * `qb.portfolioArtifact`, so `scorePortfolio` fell back to weak keyword
 * inference (30–60) instead of `KIND_BASE['repo'] = 85`. That collapsed
 * 3 beginner projects below the 70 threshold.
 *
 * Every test below would have FAILED before the Phase 17 merge fix
 * (which the helper now centralizes).
 */
describe("mergeQualityBreakdown — Phase 17 regression coverage", () => {
  const authoredFromPromote = {
    authoredMeta: { scenario: "junior DE first day", hiringRelevance2026: "..." },
    portfolioArtifact: {
      kind: "repo" as const,
      deliverable: "GitHub repo containing the cleaned CSV pipeline + README + tests.",
      portfolioRelevance: "Hiring managers can clone and run.",
    },
  };

  const scorecardFromAudit = {
    overall: 73.6,
    rubricVersion: "1.0.1",
    recommendedStatus: "approved" as const,
    dimensions: {
      jobReadiness: { score: 39, gaps: [], signals: [] },
      portfolio: { score: 85, gaps: [], signals: [] },
    },
    duplicateWarning: false,
  };

  it("audit-after-promote: portfolioArtifact survives the merge (the original regression)", () => {
    // Simulates: promote() wrote authored fields, then audit --commit fires.
    // Pre-fix this overwrote and stripped portfolioArtifact.
    const merged = mergeQualityBreakdown(authoredFromPromote, scorecardFromAudit);
    expect(merged.portfolioArtifact).toBeDefined();
    expect((merged.portfolioArtifact as { kind: string }).kind).toBe("repo");
    expect(merged.authoredMeta).toBeDefined();
  });

  it("audit-after-promote: scorecard fields are still applied", () => {
    const merged = mergeQualityBreakdown(authoredFromPromote, scorecardFromAudit);
    expect(merged.overall).toBe(73.6);
    expect(merged.rubricVersion).toBe("1.0.1");
    expect(merged.dimensions).toBeDefined();
  });

  it("promote-after-audit: authored fields layer on top of an existing scorecard without clobbering it", () => {
    // Simulates: audit ran first, then promote re-runs (Phase 17 cycle).
    const merged = mergeQualityBreakdown(scorecardFromAudit, authoredFromPromote);
    expect(merged.overall).toBe(73.6);
    expect(merged.dimensions).toBeDefined();
    expect((merged.portfolioArtifact as { kind: string }).kind).toBe("repo");
    expect(merged.authoredMeta).toBeDefined();
  });

  it("repeated audits do not strip portfolioArtifact across iterations", () => {
    // Simulates the steady-state pipeline: promote → audit → audit → audit.
    let qb: Record<string, unknown> = mergeQualityBreakdown(null, authoredFromPromote);
    for (let i = 0; i < 5; i++) {
      qb = mergeQualityBreakdown(qb, { ...scorecardFromAudit, overall: 73.6 + i * 0.01 });
    }
    expect((qb.portfolioArtifact as { kind: string }).kind).toBe("repo");
    expect(qb.authoredMeta).toBeDefined();
    expect(qb.overall).toBeCloseTo(73.64, 2);
  });

  it("null/undefined existing is treated as empty object", () => {
    expect(mergeQualityBreakdown(null, authoredFromPromote)).toEqual(authoredFromPromote);
    expect(mergeQualityBreakdown(undefined, scorecardFromAudit)).toEqual(scorecardFromAudit);
  });

  it("patch keys win on collision (last-write-wins per top-level key)", () => {
    // If audit and promote both write the same top-level key, patch wins.
    // This matches the prior overwrite semantics for any shared key, while
    // preserving keys that ONLY one side writes.
    const merged = mergeQualityBreakdown(
      { overall: 50, portfolioArtifact: { kind: "repo" } },
      { overall: 73.6 },
    );
    expect(merged.overall).toBe(73.6);
    expect((merged.portfolioArtifact as { kind: string }).kind).toBe("repo");
  });
});
