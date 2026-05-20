import { describe, it, expect } from "vitest";
import { buildCorpus, jaccard, nearestNeighbors, projectFingerprint, tokenize } from "./uniqueness";
import type { ProjectInput, StepInput } from "./types";

const mkProject = (slug: string, title: string, tags: string[], stack: string[]): ProjectInput => ({
  id: slug, slug, title, language: "python", difficulty: "intermediate",
  techStack: stack, tags, totalSteps: 1,
});

const mkStep = (title: string): StepInput => ({
  stepNumber: 1, title, instructionMd: "", validationType: "self_attest", type: "text",
  hasDatasetRefs: false, hasExpectedOutputs: false, pedagogyConfig: null,
});

describe("tokenize", () => {
  it("drops stopwords and normalizes aliases", () => {
    const t = tokenize("Build a PostgreSQL pipeline with K8s");
    expect(t.has("postgres")).toBe(true);
    expect(t.has("kubernetes")).toBe(true);
    expect(t.has("a")).toBe(false);
    expect(t.has("with")).toBe(false);
  });
});

describe("jaccard", () => {
  it("returns 1 for identical sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });
  it("returns 0 for disjoint sets", () => {
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
});

describe("nearestNeighbors", () => {
  it("ranks similar projects above dissimilar ones", () => {
    const items = [
      { project: mkProject("a", "dbt analytics pipeline", ["dbt"], ["snowflake"]), steps: [mkStep("design models")] },
      { project: mkProject("b", "dbt warehouse models", ["dbt"], ["snowflake"]), steps: [mkStep("design models")] },
      { project: mkProject("c", "fastapi rag service", ["rag"], ["fastapi"]), steps: [mkStep("ingest docs")] },
    ];
    const corpus = buildCorpus(items);
    const target = { slug: "a", fingerprint: projectFingerprint(items[0].project, items[0].steps) };
    const nn = nearestNeighbors(target, corpus, 2);
    expect(nn[0].slug).toBe("b");
    expect(nn[0].similarity).toBeGreaterThan(nn[1]?.similarity ?? 0);
  });
});
