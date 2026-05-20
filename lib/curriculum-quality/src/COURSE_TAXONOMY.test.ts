import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  COURSE_TAXONOMY,
  COURSE_TAXONOMY_VERSION,
  skillsUpTo,
  ALL_COURSES,
  COURSE_TIER1_ANCHORS,
  proposalSchema,
  proposalStrictSchema,
} from "./index";
import { validateTaxonomyCloudTooling, scoreSkillCoverage } from "./skillCoverage";

describe("COURSE_TAXONOMY (Phase 6 source-of-truth)", () => {
  it("covers all 9 courses", () => {
    for (const c of ALL_COURSES) expect(COURSE_TAXONOMY[c]).toBeDefined();
  });

  it("version string matches .local/course-skill-maps.md header", () => {
    const md = fs.readFileSync(path.resolve(__dirname, "../../../.local/course-skill-maps.md"), "utf8");
    const m = md.match(/\*\*Version:\*\*\s+(\S+)/);
    expect(m).toBeTruthy();
    expect(m![1]).toBe(COURSE_TAXONOMY_VERSION);
  });

  it("every course has non-empty skills + valid depth + cloud tooling", () => {
    for (const c of ALL_COURSES) {
      const m = COURSE_TAXONOMY[c];
      expect(m.skills.beginner.length).toBeGreaterThanOrEqual(5);
      expect(m.skills.intermediate.length).toBeGreaterThanOrEqual(5);
      expect(m.skills.advanced.length).toBeGreaterThanOrEqual(5);
      expect(["beginner", "intermediate", "advanced"]).toContain(m.pythonDepth);
      expect(["beginner", "intermediate", "advanced"]).toContain(m.sqlDepth);
      expect(m.cloudTooling.length).toBeGreaterThanOrEqual(3);
      expect(m.portfolioOutcomes.length).toBeGreaterThanOrEqual(2);
      for (const s of [...m.skills.beginner, ...m.skills.intermediate, ...m.skills.advanced]) {
        expect(s.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("cloud-tooling tokens mirror the course tier-1 anchors", () => {
    for (const c of ALL_COURSES) {
      expect(COURSE_TAXONOMY[c].cloudTooling).toEqual(COURSE_TIER1_ANCHORS[c]);
    }
    expect(validateTaxonomyCloudTooling().ok).toBe(true);
  });

  it("skillsUpTo() includes lower tiers", () => {
    const m = COURSE_TAXONOMY["data-engineering"];
    expect(skillsUpTo("data-engineering", "beginner")).toEqual(m.skills.beginner);
    expect(skillsUpTo("data-engineering", "intermediate"))
      .toEqual([...m.skills.beginner, ...m.skills.intermediate]);
    expect(skillsUpTo("data-engineering", "advanced").length)
      .toBe(m.skills.beginner.length + m.skills.intermediate.length + m.skills.advanced.length);
  });
});

describe("proposalStrictSchema (Phase 6)", () => {
  const validBase = {
    rationale: "this is a sufficiently long rationale string for testing.",
    targetRole: "data_engineer" as const,
    primaryStack: ["airflow", "dbt"],
    learningObjectives: ["learn dbt staging models"],
    portfolioArtifact: { kind: "repo" as const, summary: "demo repo summary" },
    estimatedHours: 8,
    jobReadinessSignals: ["mid-level DE signal"],
    proposedSteps: [
      { title: "Step A", summary: "summary text", requiredSkill: "airflow-dag" },
      { title: "Step B", summary: "summary text", requiredSkill: "dbt-staging" },
    ],
    course: "data-engineering" as const,
    pythonDepth: "intermediate" as const,
    sqlDepth: "advanced" as const,
    cloudToolingExpectations: ["airflow", "dbt"],
    validationIdea: "Pipeline runs end-to-end on sample data and tests pass.",
    executionMode: "external-runner" as const,
    estimatedLearnerOutcome: "Learner can ship a daily ETL with tests.",
  };

  it("accepts a fully-populated proposal", () => {
    const r = proposalStrictSchema.safeParse(validBase);
    expect(r.success).toBe(true);
  });

  it("rejects when validationIdea is too short", () => {
    const r = proposalStrictSchema.safeParse({ ...validBase, validationIdea: "too short" });
    expect(r.success).toBe(false);
  });

  it("rejects when jobReadinessSignals is empty", () => {
    const r = proposalStrictSchema.safeParse({ ...validBase, jobReadinessSignals: [] });
    expect(r.success).toBe(false);
  });

  it("loose proposalSchema still accepts a pre-Phase-6 row without the new fields", () => {
    const oldShape = {
      rationale: "this is a sufficiently long rationale string for testing.",
      targetRole: "data_engineer" as const,
      primaryStack: ["airflow", "dbt"],
      learningObjectives: ["learn it"],
      portfolioArtifact: { kind: "repo" as const, summary: "demo repo" },
      estimatedHours: 8,
      proposedSteps: [
        { title: "Step A", summary: "summary text", requiredSkill: "airflow-dag" },
        { title: "Step B", summary: "summary text", requiredSkill: "dbt-staging" },
      ],
    };
    const r = proposalSchema.safeParse(oldShape);
    expect(r.success).toBe(true);
  });
});

describe("scoreSkillCoverage()", () => {
  it("reports covered + missing skills relative to the claimed tier", () => {
    const steps = [
      { stepNumber: 1, title: "x", instructionMd: "", validationType: "code", type: "code_python", hasDatasetRefs: false, hasExpectedOutputs: false, pedagogyConfig: null, requiredSkill: "csv-ingest" },
    ];
    const report = scoreSkillCoverage("data-engineering", "beginner", steps);
    expect(report.coveredSkills).toContain("csv-ingest");
    expect(report.missingForTier.length).toBeGreaterThan(0);
    expect(report.coverageRatio).toBeGreaterThan(0);
    expect(report.coverageRatio).toBeLessThanOrEqual(1);
  });
});
