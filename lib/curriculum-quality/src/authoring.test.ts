import { describe, it, expect } from "vitest";
import {
  pedagogyConfig,
  validationConfig,
  portfolioArtifact,
  projectMeta,
  assertAuthoredProjectComplete,
  type AuthoredProject,
  type AuthoredStep,
} from "./authoring";
import { composeScorecard } from "./scoring";
import type { ProjectInput, StepInput } from "./types";

function buildStep(n: number): AuthoredStep {
  return {
    stepNumber: n,
    title: `Step ${n}`,
    instructionMd: `Body for step ${n} — work through the production scenario.`,
    learningObjective: `Master concept ${n} as it appears in a real pipeline.`,
    requiredSkill: `skill-${n}`,
    starterCode: `-- starter sql for step ${n}\nSELECT 1;`,
    validationType: "sql_resultset",
    stepType: "code_sql",
    validation: validationConfig("sql_resultset", `Match expected result for step ${n}`, {
      query: `SELECT ${n} AS n`,
      expectedRows: [{ n }],
    }),
    expectedOutputs: { rows: [{ n }] },
    datasetRefs: [`fixtures/step${n}.csv`],
    pedagogy: pedagogyConfig({
      hints: [
        `L1 nudge for step ${n}`,
        `L2 nudge for step ${n}`,
        `L3 nudge for step ${n}`,
        `L4 starter snippet for step ${n}`,
        `L5 full solution for step ${n}`,
      ],
      successFeedback: `Nice work on step ${n}.`,
      failureFeedback: `Common slip on step ${n}: check ordering.`,
      portfolioRelevance: `Step ${n} maps to interview question about ordering.`,
      finalExplanation: `Full explanation of step ${n} mechanics.`,
      misconceptionToWatchFor: `Common misconception around step ${n}.`,
    }),
  };
}

function buildAuthoredFixture(): AuthoredProject {
  return {
    slug: "fixture-project",
    candidateId: "00000000-0000-0000-0000-000000000001",
    title: "Fixture Project",
    shortDescription: "A production-ready ETL pipeline fixture for tests.",
    fullDescription: "Walks through deploying a production ETL pipeline to PostgreSQL with bulk loaders, dbt models, and a published GitHub repo.",
    language: "sql",
    difficulty: "advanced",
    techStack: ["PostgreSQL", "SQL", "dbt"],
    tags: ["sql", "etl", "pipeline"],
    learningObjectives: ["A", "B", "C", "D"],
    estimatedMinutes: 120,
    xpReward: 400,
    isMultiFile: true,
    meta: projectMeta({
      scenario: "You're the lead analytics engineer at a B2B SaaS company.",
      hiringRelevance2026: "2026 hiring stacks expect deployed dbt + warehouse ownership.",
      readmeOutline: ["Overview", "Setup", "Steps", "Validation", "Portfolio Hand-off"],
    }),
    portfolio: portfolioArtifact({
      kind: "repo",
      deliverable: "Public GitHub repo with the deployed pipeline + README.",
      portfolioRelevance: "Recruiters can clone, run, and see deterministic output — strongest 2026 signal.",
    }),
    steps: [buildStep(1), buildStep(2), buildStep(3), buildStep(4)],
  };
}

describe("authoring helpers", () => {
  it("pedagogyConfig produces all 10 fields scorePedagogy checks", () => {
    const cfg = pedagogyConfig({
      hints: ["a", "b", "c", "d", "e"],
      successFeedback: "ok",
      failureFeedback: "fix it",
      portfolioRelevance: "matters",
      finalExplanation: "because",
      misconceptionToWatchFor: "thing",
    });
    expect(cfg.hintLevel1).toBe("a");
    expect(cfg.hintLevel5).toBe("e");
    expect(cfg.successFeedback).toBe("ok");
    expect(cfg.failureFeedback).toBe("fix it");
    expect(cfg.portfolioRelevance).toBe("matters");
    expect(cfg.finalExplanation).toBe("because");
    expect(cfg.misconceptionToWatchFor).toBe("thing");
  });

  it("projectMeta rejects too-short README outlines", () => {
    expect(() => projectMeta({
      scenario: "x", hiringRelevance2026: "y", readmeOutline: ["only-one"],
    })).toThrow(/at least 4/);
  });

  it("assertAuthoredProjectComplete passes on a well-formed fixture", () => {
    const p = buildAuthoredFixture();
    expect(() => assertAuthoredProjectComplete(p)).not.toThrow();
  });

  it("assertAuthoredProjectComplete rejects <4 steps", () => {
    const p = buildAuthoredFixture();
    p.steps = p.steps.slice(0, 3);
    expect(() => assertAuthoredProjectComplete(p)).toThrow(/≥4 steps/);
  });

  it("assertAuthoredProjectComplete rejects empty validation.spec", () => {
    const p = buildAuthoredFixture();
    p.steps[0].validation.spec = {};
    expect(() => assertAuthoredProjectComplete(p)).toThrow(/validation\.spec is empty/);
  });

  it("authored fixture scores ≥70 under the full rubric", () => {
    const p = buildAuthoredFixture();
    // Translate to ProjectInput / StepInput exactly the way the DB adapter does.
    const projectInput: ProjectInput = {
      id: p.slug,
      slug: p.slug,
      title: p.title,
      shortDescription: p.shortDescription,
      fullDescription: p.fullDescription,
      language: p.language,
      difficulty: p.difficulty,
      techStack: p.techStack,
      tags: p.tags,
      totalSteps: p.steps.length,
      estimatedMinutes: p.estimatedMinutes,
      isMultiFile: p.isMultiFile,
      isWalkthroughOnly: false,
      hasExecutionProfile: false,
      proposal: { portfolioArtifact: { kind: p.portfolio.kind, summary: p.portfolio.deliverable } },
    };
    const steps: StepInput[] = p.steps.map(s => ({
      stepNumber: s.stepNumber,
      title: s.title,
      instructionMd: s.instructionMd,
      validationType: s.validation.kind, // use the in-spec kind (e.g. sql_resultset)
      type: s.stepType,
      hasDatasetRefs: !!s.datasetRefs && s.datasetRefs.length > 0,
      hasExpectedOutputs: Object.keys(s.expectedOutputs).length > 0,
      pedagogyConfig: s.pedagogy,
      learningObjective: s.learningObjective,
      requiredSkill: s.requiredSkill,
    }));
    const card = composeScorecard(projectInput, { steps, neighbors: [] });
    expect(card.overall).toBeGreaterThanOrEqual(70);
  });
});


// ── Phase 56 — `contains` structured-spec validator ────────────────────────
describe("validationConfig(contains) — Phase 56 structured-spec validator", () => {
  const ok = (spec: Record<string, unknown>) =>
    expect(() => validationConfig("contains", "desc", spec)).not.toThrow();
  const bad = (spec: Record<string, unknown>, match: RegExp) =>
    expect(() => validationConfig("contains", "desc", spec)).toThrow(match);

  it("accepts legacy { needle }", () => ok({ needle: "foo" }));
  it("accepts legacy {} (expectedOutput fallback)", () => ok({}));
  it("accepts new full shape", () =>
    ok({ needles: ["a", "b"], match: "any", caseInsensitive: true }));
  it("accepts needles + match:'all'", () => ok({ needles: ["a"], match: "all" }));
  it("accepts needle + caseInsensitive", () => ok({ needle: "FOO", caseInsensitive: true }));

  it("rejects needle of non-string type", () =>
    bad({ needle: 5 as unknown as string }, /'needle' must be a string/));
  it("rejects empty needles[]", () =>
    bad({ needles: [] }, /at least one entry/));
  it("rejects needles[] over the 16-entry cap", () =>
    bad({ needles: Array.from({ length: 17 }, (_, i) => `n${i}`) }, /at most 16 entries/));
  it("rejects non-string entry inside needles[]", () =>
    bad({ needles: ["a", 5 as unknown as string] }, /non-empty string/));
  it("rejects empty-string entry inside needles[]", () =>
    bad({ needles: ["a", ""] }, /non-empty string/));
  it("rejects invalid match value", () =>
    bad({ needles: ["a"], match: "weird" as unknown as "all" }, /'match' must be "all" or "any"/));
  it("rejects non-boolean caseInsensitive", () =>
    bad({ needle: "x", caseInsensitive: "yes" as unknown as boolean }, /'caseInsensitive' must be a boolean/));

  it("does NOT reject needle + needles together (runtime: needles wins; audit advisory only)", () =>
    ok({ needle: "x", needles: ["y"] }));
  it("does NOT reject match without needles (runtime: match silently ignored; audit advisory only)", () =>
    ok({ needle: "x", match: "any" }));
  it("does NOT reject match:'any' (runtime: looser combinator; audit advisory only)", () =>
    ok({ needles: ["a"], match: "any" }));
});
