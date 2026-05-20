import { describe, it, expect } from "vitest";
import {
  generateBatch, generateAllCourses,
  proposalStrictSchema, RUBRIC_VERSION,
  COURSE_TAXONOMY_VERSION,
  ALL_COURSES,
  buildCorpus, nearestNeighbors, projectFingerprint,
  composeScorecard,
  type AtlasCourseSlug,
  type StepInput,
} from "./index";

const fixedNow = new Date("2026-05-20T00:00:00Z");

/**
 * Mirror of scripts/src/quality-adapter.ts `candidateRowToContext` so the
 * test predicts the same score the real `score-batch` CLI will produce.
 * If you change this translation, update both call sites.
 */
function inferLang(stack: string[]): "python" | "sql" | "both" {
  const s = stack.map(t => t.toLowerCase());
  const hasPy = s.some(t => /python|pandas|polars|fastapi|django|pyodide|pyarrow|numpy|sklearn|scikit/.test(t));
  const hasSql = s.some(t => /sql|postgres|mysql|snowflake|bigquery|duckdb|dbt/.test(t));
  return hasPy && hasSql ? "both" : hasSql ? "sql" : "python";
}
function stepsFromCandidate(c: {
  proposal: { proposedSteps: Array<{ title: string; summary: string; requiredSkill: string }> };
  proposedStack: string[];
}): StepInput[] {
  const lang = inferLang(c.proposedStack);
  const stepType = lang === "sql" ? "code_sql" : "code_python";
  return c.proposal.proposedSteps.map((s, i) => ({
    stepNumber: i + 1,
    title: s.title,
    instructionMd: s.summary,
    validationType: "self_attest",
    type: stepType,
    hasDatasetRefs: false,
    hasExpectedOutputs: false,
    pedagogyConfig: null,
    requiredSkill: s.requiredSkill,
  }));
}

describe("generator (Phase 6 deterministic candidate pipeline)", () => {
  it("generates 10 candidates per course with the 2 / 3 / 5 mix", () => {
    for (const course of ALL_COURSES) {
      const batch = generateBatch({ course, count: 10, rubricVersion: RUBRIC_VERSION, taxonomyVersion: COURSE_TAXONOMY_VERSION, now: fixedNow });
      expect(batch.candidates.length).toBe(10);
      expect(batch.difficultyMix).toEqual({ beginner: 2, intermediate: 3, advanced: 5 });
      const tally = { beginner: 0, intermediate: 0, advanced: 0 };
      for (const c of batch.candidates) tally[c.difficulty]++;
      expect(tally).toEqual({ beginner: 2, intermediate: 3, advanced: 5 });
    }
  });

  it("every generated proposal passes proposalStrictSchema", () => {
    const batches = generateAllCourses({ rubricVersion: RUBRIC_VERSION, taxonomyVersion: COURSE_TAXONOMY_VERSION, now: fixedNow });
    let zodFailures = 0;
    for (const b of batches) {
      for (const c of b.candidates) {
        const r = proposalStrictSchema.safeParse(c.proposal);
        if (!r.success) {
          // eslint-disable-next-line no-console
          console.error(`zod fail for ${c.archId}:`, r.error.message);
          zodFailures++;
        }
      }
    }
    expect(zodFailures).toBe(0);
  });

  it("is deterministic — two runs produce identical batchIds + candidate archIds", () => {
    const a = generateAllCourses({ rubricVersion: RUBRIC_VERSION, taxonomyVersion: COURSE_TAXONOMY_VERSION, now: fixedNow });
    const b = generateAllCourses({ rubricVersion: RUBRIC_VERSION, taxonomyVersion: COURSE_TAXONOMY_VERSION, now: fixedNow });
    expect(a.map(x => x.batchId)).toEqual(b.map(x => x.batchId));
    expect(a.flatMap(x => x.candidates.map(c => c.archId)))
      .toEqual(b.flatMap(x => x.candidates.map(c => c.archId)));
  });

  it("duplicate-flag rate < 20% per batch (Phase-6 gate)", () => {
    const batches = generateAllCourses({ rubricVersion: RUBRIC_VERSION, taxonomyVersion: COURSE_TAXONOMY_VERSION, now: fixedNow });
    for (const b of batches) {
      const corpusInputs = b.candidates.map(c => ({
        project: {
          id: c.archId, slug: c.archId, title: c.proposedTitle,
          language: "python" as const, difficulty: c.difficulty,
          techStack: c.proposedStack, tags: c.proposedStack, totalSteps: c.proposal.proposedSteps.length,
        },
        steps: stepsFromCandidate(c),
      }));
      const corpus = buildCorpus(corpusInputs);
      let flagged = 0;
      for (const c of b.candidates) {
        const fp = projectFingerprint(
          corpusInputs.find(x => x.project.slug === c.archId)!.project,
          stepsFromCandidate(c),
        );
        const neighbors = nearestNeighbors({ slug: c.archId, fingerprint: fp }, corpus, 3);
        if (neighbors.some(n => n.similarity > 0.6)) flagged++;
      }
      const rate = flagged / b.candidates.length;
      // eslint-disable-next-line no-console
      if (rate >= 0.2) console.warn(`duplicate rate ${rate} for ${b.course}`);
      expect(rate).toBeLessThan(0.2);
    }
  });

  it("score floors: ≥45/90 ≥60 and ≥18/90 ≥70 (Phase-6 gate C3)", () => {
    const batches = generateAllCourses({ rubricVersion: RUBRIC_VERSION, taxonomyVersion: COURSE_TAXONOMY_VERSION, now: fixedNow });
    let ge60 = 0, ge70 = 0;
    const perCourse60: Record<AtlasCourseSlug, number> = {} as never;
    for (const b of batches) {
      perCourse60[b.course] = 0;
      // Build a corpus across siblings in the same batch so uniqueness is realistic.
      const inputs = b.candidates.map(c => ({
        project: {
          id: c.archId, slug: c.archId, title: c.proposedTitle,
          language: ((c.proposal.cloudToolingExpectations.includes("dbt") || c.proposedStack.includes("sql")) ? "both" : "python") as "python" | "sql" | "both",
          difficulty: c.difficulty, techStack: c.proposedStack, tags: c.proposedStack,
          totalSteps: c.proposal.proposedSteps.length,
          targetRoles: c.targetRoles as never,
          proposal: c.proposal as never,
        },
        steps: stepsFromCandidate(c),
      }));
      const corpus = buildCorpus(inputs);
      for (const c of b.candidates) {
        const me = inputs.find(x => x.project.slug === c.archId)!;
        const fp = projectFingerprint(me.project, me.steps);
        const neighbors = nearestNeighbors({ slug: c.archId, fingerprint: fp }, corpus, 3);
        const card = composeScorecard(me.project, { steps: me.steps, neighbors, stage: "candidate" });
        if (card.overall >= 60) { ge60++; perCourse60[b.course]++; }
        if (card.overall >= 70) ge70++;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`generator score gates: ge60=${ge60}/90 ge70=${ge70}/90 perCourse60=`, perCourse60);
    expect(ge60).toBeGreaterThanOrEqual(45);
    expect(ge70).toBeGreaterThanOrEqual(18);
    for (const c of ALL_COURSES) expect(perCourse60[c]).toBeGreaterThanOrEqual(2);
  });
});
