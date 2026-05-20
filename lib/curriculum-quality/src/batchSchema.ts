/**
 * Phase 6 — batch file schema.
 *
 * The batch file format on disk (`.local/candidate-batches/...json`) needs
 * full Zod validation BEFORE rows are inserted, so we keep the schema in
 * the lib (which already depends on zod) and re-use the strict proposal
 * schema for each candidate's `proposal` field.
 */
import { z } from "zod/v4";
import { proposalStrictSchema, courseSlugSchema, difficultyTierSchema } from "./proposal";

export const batchCandidateSchema = z.object({
  archId: z.string().min(1).optional(),
  proposedTitle: z.string().min(4),
  proposedCourse: courseSlugSchema,
  difficulty: difficultyTierSchema,
  targetRoles: z.array(z.string().min(2)).min(1),
  proposedStack: z.array(z.string().min(1)).min(2),
  proposal: proposalStrictSchema,
});

export const batchFileSchema = z.object({
  batchId: z.string().min(8),
  course: courseSlugSchema,
  rubricVersion: z.string().min(3),
  taxonomyVersion: z.string().min(3).optional(),
  generatedAt: z.string().optional(),
  generatedBy: z.string().min(3),
  difficultyMix: z.record(difficultyTierSchema, z.number().int().min(0)).optional(),
  candidates: z.array(batchCandidateSchema).min(1),
});

export type BatchCandidate = z.infer<typeof batchCandidateSchema>;
export type BatchFile = z.infer<typeof batchFileSchema>;

/** Parse + cross-check that every candidate.course matches the batch.course. */
export function parseBatchFile(json: unknown): BatchFile {
  const parsed = batchFileSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Batch validation failed:\n${issues}`);
  }
  for (let i = 0; i < parsed.data.candidates.length; i++) {
    const c = parsed.data.candidates[i];
    if (c.proposedCourse !== parsed.data.course) {
      throw new Error(
        `candidate[${i}] proposedCourse=${c.proposedCourse} does not match batch.course=${parsed.data.course}`,
      );
    }
    if (c.proposal.course !== parsed.data.course) {
      throw new Error(
        `candidate[${i}] proposal.course=${c.proposal.course} does not match batch.course=${parsed.data.course}`,
      );
    }
  }
  return parsed.data;
}
