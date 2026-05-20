import { z } from "zod/v4";

export const proposalRoleSchema = z.enum([
  "data_engineer",
  "ai_engineer",
  "mlops_engineer",
  "data_scientist",
  "analytics_engineer",
  "applied_llm_engineer",
  "cloud_data_engineer",
]);

export const portfolioArtifactSchema = z.object({
  kind: z.enum(["repo", "dashboard", "report", "service", "notebook"]),
  summary: z.string().min(8),
});

export const proposedStepSchema = z.object({
  title: z.string().min(4),
  summary: z.string().min(8),
  requiredSkill: z.string().min(2),
});

export const researchSourceSchema = z.object({
  title: z.string().min(2),
  url: z.string().url(),
});

export const proposalSchema = z.object({
  rationale: z.string().min(20),
  targetRole: proposalRoleSchema,
  primaryStack: z.array(z.string().min(1)).min(2),
  learningObjectives: z.array(z.string().min(4)).min(1),
  portfolioArtifact: portfolioArtifactSchema,
  estimatedHours: z.number().int().min(1).max(80),
  jobReadinessSignals: z.array(z.string().min(4)).default([]),
  proposedSteps: z.array(proposedStepSchema).min(2).max(12),
  researchSources: z.array(researchSourceSchema).default([]),
});

export type ProposalSchema = z.infer<typeof proposalSchema>;

// ─── Phase 6: strict proposal schema ─────────────────────────────────────
// Additive ONLY — historical candidates created in Phase 5 must still
// validate against `proposalSchema`. `proposalStrictSchema` is used by the
// Phase-6 batch generator + import path and enforces the 11 fields the
// human curriculum review needs to act on a candidate:
//
//   1. course                     7. cloudToolingExpectations
//   2. targetRoles (on candidate) 8. portfolioArtifact (existing)
//   3. difficulty (on candidate)  9. validationIdea
//   4. jobReadinessSignals (≥1)  10. executionMode
//   5. pythonDepth               11. estimatedLearnerOutcome
//   6. sqlDepth
//
// Items #2 and #3 live on the `project_candidates` row itself (not in the
// JSON proposal), so this schema only covers the 9 in-proposal fields.

export const courseSlugSchema = z.enum([
  "data-engineering",
  "ai-engineer",
  "mlops-engineer",
  "data-scientist",
  "analytics-engineer",
  "applied-llm-engineer",
  "cloud-data-engineer",
  "python-libraries",
  "sql",
]);

export const difficultyTierSchema = z.enum(["beginner", "intermediate", "advanced"]);

export const executionModeSchema = z.enum([
  "pyodide",
  "sandboxed-node",
  "external-runner",
  "self-attest",
  "sql-runner",
]);

export const proposalStrictSchema = proposalSchema.extend({
  course: courseSlugSchema,
  pythonDepth: difficultyTierSchema,
  sqlDepth: difficultyTierSchema,
  cloudToolingExpectations: z.array(z.string().min(2)).min(1),
  validationIdea: z.string().min(20),
  executionMode: executionModeSchema,
  estimatedLearnerOutcome: z.string().min(20),
  // Phase 6 requires ≥1 explicit hireability signal (overrides loose default).
  jobReadinessSignals: z.array(z.string().min(4)).min(1),
  // Optional traceability — set by the generator, never required by humans.
  batchId: z.string().optional(),
  skillCoverage: z.array(z.string().min(2)).default([]),
});

export type ProposalStrictSchema = z.infer<typeof proposalStrictSchema>;
