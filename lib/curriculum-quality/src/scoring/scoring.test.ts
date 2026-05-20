import { describe, it, expect } from "vitest";
import {
  composeScorecard,
  scoreJobReadiness,
  scoreProductionRealism,
  scorePythonSqlDepth,
  scorePedagogy,
  scorePortfolio,
  scoreUniqueness,
} from "./index";
import type { ProjectInput, StepInput, PedagogyConfigShape } from "../types";
import { RUBRIC_VERSION, RUBRIC_WEIGHTS } from "../rubric";
import { tierOf, normalizeStackToken } from "../jobDemand";

const fullCfg: PedagogyConfigShape = {
  hintLevel1: "h1", hintLevel2: "h2", hintLevel3: "h3", hintLevel4: "h4", hintLevel5: "h5",
  successFeedback: "good job", failureFeedback: "try again", portfolioRelevance: "this matters",
  finalExplanation: "the answer is...",
};

function richStep(n: number, overrides: Partial<StepInput> = {}): StepInput {
  return {
    stepNumber: n,
    title: `Step ${n} — design schema with windows`,
    instructionMd: "Use a CTE and window function with PARTITION BY to compute running totals. " +
      "Then create an INDEX. ".repeat(8),
    validationType: "sql_resultset",
    type: "code_sql",
    hasDatasetRefs: true,
    hasExpectedOutputs: true,
    pedagogyConfig: fullCfg,
    learningObjective: "Learn window functions",
    requiredSkill: "sql.windows",
    ...overrides,
  };
}

function stubStep(n: number): StepInput {
  return {
    stepNumber: n,
    title: `Step ${n}`,
    instructionMd: "TODO write content",
    validationType: "self_attest",
    type: "text",
    hasDatasetRefs: false,
    hasExpectedOutputs: false,
    pedagogyConfig: null,
  };
}

function baseProject(overrides: Partial<ProjectInput> = {}): ProjectInput {
  return {
    id: "p1",
    slug: "test-project",
    title: "Build a dbt + Snowflake analytics pipeline",
    shortDescription: "Deploy a production dbt project that publishes a Snowflake dashboard.",
    fullDescription: "End-to-end dbt + Snowflake project. Deployed to production with a Streamlit dashboard.",
    language: "sql",
    difficulty: "intermediate",
    techStack: ["dbt", "snowflake", "polars"],
    tags: ["analytics", "warehouse"],
    totalSteps: 5,
    estimatedMinutes: 120,
    isMultiFile: true,
    hasExecutionProfile: true,
    isWalkthroughOnly: false,
    ...overrides,
  };
}

describe("jobDemand", () => {
  it("classifies tier-1 tech", () => {
    expect(tierOf("dbt")).toBe("tier1");
    expect(tierOf("Snowflake")).toBe("tier1");
    expect(tierOf("postgresql")).toBe("tier2");
  });
  it("normalizes common aliases", () => {
    expect(normalizeStackToken("PostgreSQL")).toBe("postgres");
    expect(normalizeStackToken("k8s")).toBe("kubernetes");
    expect(normalizeStackToken("sklearn")).toBe("scikit-learn");
  });
});

describe("rubric", () => {
  it("weights sum to 100", () => {
    const sum = Object.values(RUBRIC_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });
  it("exposes version", () => {
    expect(RUBRIC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("scoreJobReadiness", () => {
  it("rewards tier-1 stacks", () => {
    const s = scoreJobReadiness(baseProject({ techStack: ["dbt", "snowflake", "iceberg"] }));
    expect(s.score).toBeGreaterThanOrEqual(60);
  });
  it("penalizes legacy-only stacks", () => {
    const s = scoreJobReadiness(baseProject({ techStack: ["hadoop", "mapreduce", "hive"], tags: [] }));
    expect(s.score).toBeLessThan(40);
    expect(s.gaps.some(g => /Legacy/i.test(g))).toBe(true);
  });
});

describe("scoreProductionRealism", () => {
  it("penalizes walkthrough-only", () => {
    const s = scoreProductionRealism(baseProject({ isWalkthroughOnly: true }), [richStep(1), richStep(2)]);
    expect(s.score).toBeLessThan(60);
  });
  it("rewards real validation + datasets + multi-file", () => {
    const s = scoreProductionRealism(baseProject(), [richStep(1), richStep(2), richStep(3)]);
    expect(s.score).toBeGreaterThanOrEqual(70);
  });
});

describe("scorePythonSqlDepth", () => {
  it("rewards SQL advanced patterns", () => {
    const s = scorePythonSqlDepth(baseProject({ language: "sql" }), [richStep(1), richStep(2), richStep(3)]);
    expect(s.score).toBeGreaterThanOrEqual(70);
  });
  it("penalizes shallow self_attest stubs", () => {
    const s = scorePythonSqlDepth(baseProject({ language: "sql" }), [stubStep(1)]);
    expect(s.score).toBeLessThan(45);
  });
});

describe("scorePedagogy", () => {
  it("full enrichment → ~100", () => {
    const s = scorePedagogy([richStep(1), richStep(2), richStep(3)]);
    expect(s.score).toBeGreaterThanOrEqual(95);
  });
  it("zero enrichment → low", () => {
    const s = scorePedagogy([stubStep(1), stubStep(2)]);
    expect(s.score).toBeLessThan(15);
  });
});

describe("scorePortfolio", () => {
  it("uses declared artifact kind", () => {
    const s = scorePortfolio(baseProject({
      proposal: { portfolioArtifact: { kind: "service", summary: "Deploy a FastAPI inference service" } },
    }));
    expect(s.score).toBeGreaterThanOrEqual(80);
  });
  it("infers from deploy + dashboard keywords", () => {
    const s = scorePortfolio(baseProject({
      shortDescription: "Build and deploy a Streamlit dashboard.",
      fullDescription: "Publish the dashboard with a live URL.",
    }));
    expect(s.score).toBeGreaterThanOrEqual(60);
  });
  it("walkthrough-only caps low", () => {
    const s = scorePortfolio(baseProject({ isWalkthroughOnly: true, fullDescription: "Watch the video." }));
    expect(s.score).toBeLessThanOrEqual(25);
  });
});

describe("scoreUniqueness", () => {
  it("flags duplicate warning at >= 0.6", () => {
    const { dimension, duplicateWarning } = scoreUniqueness([{ slug: "x", title: "X", similarity: 0.75 }]);
    expect(duplicateWarning).toBe(true);
    expect(dimension.gaps[0]).toMatch(/HARD DUPLICATE/);
  });
  it("clean catalog gets max points", () => {
    const { dimension, duplicateWarning } = scoreUniqueness([]);
    expect(dimension.score).toBe(100);
    expect(duplicateWarning).toBe(false);
  });
});

describe("composeScorecard — calibration pins", () => {
  it("csv-to-postgres-pipeline shape lands in approved band (>=70)", () => {
    // Mirrors the actual Phase 4 reference project: enriched pedagogy,
    // real validation, multi-file Python + Postgres, deployable artifact.
    const project = baseProject({
      slug: "csv-to-postgres-pipeline",
      title: "CSV to PostgreSQL Pipeline",
      shortDescription: "Build a production CSV → Postgres ingestion pipeline.",
      fullDescription: "Deploy a CSV ingestion service to Postgres with COPY and indexes.",
      language: "python",
      difficulty: "intermediate",
      techStack: ["python", "postgres", "polars", "docker"],
      tags: ["etl", "ingestion"],
      totalSteps: 4,
      estimatedMinutes: 90,
      isMultiFile: true,
      hasExecutionProfile: true,
      proposal: { portfolioArtifact: { kind: "repo", summary: "Open-source ingestion repo with COPY pipeline" } },
    });
    const steps = [richStep(1), richStep(2), richStep(3), richStep(4)];
    const card = composeScorecard(project, { steps, neighbors: [] });
    expect(card.overall).toBeGreaterThanOrEqual(70);
    expect(card.recommendedStatus).toBe("approved");
    expect(card.duplicateWarning).toBe(false);
  });

  it("dbt-data-models shape lands in approved band (>=70)", () => {
    const project = baseProject({
      slug: "dbt-data-models",
      title: "Data Modeling with dbt",
      shortDescription: "Ship a dbt project to Snowflake with tested models.",
      fullDescription: "Deploy production dbt models with tests and a dashboard.",
      language: "sql",
      difficulty: "intermediate",
      techStack: ["dbt", "snowflake", "polars"],
      tags: ["analytics", "warehouse"],
      totalSteps: 2,
      estimatedMinutes: 60,
      isMultiFile: true,
      hasExecutionProfile: true,
      proposal: { portfolioArtifact: { kind: "repo", summary: "dbt project repo deployed to Snowflake" } },
    });
    const steps = [richStep(1), richStep(2)];
    const card = composeScorecard(project, { steps, neighbors: [] });
    expect(card.overall).toBeGreaterThanOrEqual(70);
    expect(card.recommendedStatus).toBe("approved");
  });

  it("legacy stub project lands in needs_revision band (<50)", () => {
    const project = baseProject({
      slug: "legacy-stub",
      title: "Hadoop MapReduce intro",
      shortDescription: "Old Hadoop intro.",
      fullDescription: "Watch a video about MapReduce.",
      language: "python",
      difficulty: "beginner",
      techStack: ["hadoop", "mapreduce"],
      tags: ["legacy"],
      totalSteps: 1,
      estimatedMinutes: 15,
      isMultiFile: false,
      hasExecutionProfile: false,
      isWalkthroughOnly: true,
    });
    const card = composeScorecard(project, { steps: [stubStep(1)], neighbors: [] });
    expect(card.overall).toBeLessThan(50);
    expect(card.recommendedStatus).toBe("needs_revision");
  });

  it("strong candidate proposal can score >=70 with stage=candidate (no --force)", () => {
    // A well-researched proposal with rich proposed steps, tier-1 stack,
    // declared portfolio artifact, and >=60min scope. No authored pedagogy
    // yet — `stage:'candidate'` excludes pedagogy and renormalizes weights.
    const proposalSteps = [
      { title: "Set up dbt project", summary: "Init dbt project, configure profile.yml, connect to Snowflake.", requiredSkill: "dbt-init" },
      { title: "Stage raw layer", summary: "Build staging models with ref() and source() macros; add tests.", requiredSkill: "dbt-staging" },
      { title: "Mart layer", summary: "Compose mart models using CTEs and window functions over partitioned data.", requiredSkill: "dbt-marts" },
      { title: "CI pipeline", summary: "GitHub Actions: run dbt build on PR with state:modified for incremental graph.", requiredSkill: "dbt-ci" },
    ];
    const input = baseProject({
      slug: "strong-candidate",
      title: "Production dbt Pipeline with Snowflake",
      shortDescription: "Build a production dbt pipeline on Snowflake with staging/mart layers and CI.",
      fullDescription: "Repository-grade dbt project deployed to Snowflake covering medallion architecture, model tests, CI with GitHub Actions, and observability.",
      techStack: ["dbt", "snowflake", "github-actions", "sql"],
      tags: ["dbt", "snowflake", "ci"],
      language: "sql",
      estimatedMinutes: 240,
      isMultiFile: true,
      proposal: { portfolioArtifact: { kind: "repo", summary: "Open-source dbt+Snowflake repo with CI on GitHub" } },
    });
    const steps: StepInput[] = proposalSteps.map((s, i) => ({
      stepNumber: i + 1, title: s.title, instructionMd: s.summary,
      validationType: "self_attest", type: "code_sql",
      hasDatasetRefs: false, hasExpectedOutputs: false, pedagogyConfig: null,
      learningObjective: s.summary, requiredSkill: s.requiredSkill,
    }));
    const card = composeScorecard(input, { steps, neighbors: [], stage: "candidate" });
    expect(card.overall).toBeGreaterThanOrEqual(70);
    expect(card.recommendedStatus).toBe("approved");
  });
});
