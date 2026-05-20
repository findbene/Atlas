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
