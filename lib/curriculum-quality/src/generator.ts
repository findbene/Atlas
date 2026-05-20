/**
 * Phase 6 — deterministic candidate generator.
 *
 * Takes a course slug + count + optional offset and returns a fully-formed
 * candidate batch: each item is a strict-proposal payload plus the top-level
 * row fields the `project_candidates` table expects.
 *
 * NO LLM call. NO randomness. Generation is purely a slice over the
 * archetypes table — `generate(course, 10)` is byte-identical across runs
 * given the same `COURSE_TAXONOMY_VERSION` and archetype list. Phase-6
 * correction C2 explicitly mandates deterministic + research-shaped.
 */
import type { AtlasCourseSlug } from "./types";
import { ARCHETYPES, inflate, type Archetype } from "./archetypes";
import { proposalStrictSchema, type ProposalStrictSchema } from "./proposal";

export type GeneratedCandidate = {
  /** Stable id within a batch (course + archetype id). */
  archId: string;
  proposedTitle: string;
  proposedCourse: AtlasCourseSlug;
  difficulty: "beginner" | "intermediate" | "advanced";
  targetRoles: string[];
  proposedStack: string[];
  proposal: ProposalStrictSchema;
};

export type GeneratedBatch = {
  batchId: string;
  course: AtlasCourseSlug;
  rubricVersion: string;
  taxonomyVersion: string;
  generatedAt: string;
  generatedBy: "deterministic-archetype-generator";
  difficultyMix: Record<"beginner" | "intermediate" | "advanced", number>;
  candidates: GeneratedCandidate[];
};

const REQUIRED_MIX: Record<"beginner" | "intermediate" | "advanced", number> = {
  beginner: 2,
  intermediate: 3,
  advanced: 5,
};

function archToCandidate(
  course: AtlasCourseSlug,
  a: Archetype,
  batchId: string,
): GeneratedCandidate {
  const inflated = inflate(course, a);
  const { __title, __difficulty, __targetRoles, __stack, ...proposalCore } = inflated;
  const proposal: ProposalStrictSchema = proposalStrictSchema.parse({
    ...proposalCore,
    batchId,
  });
  return {
    archId: `${course}/${a.id}`,
    proposedTitle: __title,
    proposedCourse: course,
    difficulty: __difficulty,
    targetRoles: __targetRoles,
    proposedStack: __stack,
    proposal,
  };
}

/**
 * Generate a single-course batch of `count` candidates honoring the
 * 2 / 3 / 5 beginner / intermediate / advanced mix when `count` is 10.
 * For other counts, scales proportionally and rounds.
 */
export function generateBatch(opts: {
  course: AtlasCourseSlug;
  count?: number;
  rubricVersion: string;
  taxonomyVersion: string;
  now?: Date;
}): GeneratedBatch {
  const count = opts.count ?? 10;
  const now = opts.now ?? new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const batchId = `${dateStr}-${opts.course}-v1`;

  const pool = ARCHETYPES[opts.course];
  if (!pool) throw new Error(`No archetypes registered for course ${opts.course}`);

  // Required mix for count=10. For smaller/larger counts, scale.
  const scale = count / 10;
  const mix: Record<"beginner" | "intermediate" | "advanced", number> = {
    beginner: Math.max(1, Math.round(REQUIRED_MIX.beginner * scale)),
    intermediate: Math.max(1, Math.round(REQUIRED_MIX.intermediate * scale)),
    advanced: Math.max(1, Math.round(REQUIRED_MIX.advanced * scale)),
  };
  // Trim/pad so sum equals count.
  let total = mix.beginner + mix.intermediate + mix.advanced;
  while (total > count) { mix.advanced--; total--; }
  while (total < count) { mix.advanced++; total++; }

  const picked: Archetype[] = [];
  const take = (tier: "beginner" | "intermediate" | "advanced", n: number) => {
    const sub = pool.filter(a => a.difficulty === tier);
    if (sub.length < n) {
      throw new Error(
        `Course ${opts.course}: archetype pool has only ${sub.length} ${tier} entries, need ${n}.`,
      );
    }
    picked.push(...sub.slice(0, n));
  };
  take("beginner", mix.beginner);
  take("intermediate", mix.intermediate);
  take("advanced", mix.advanced);

  return {
    batchId,
    course: opts.course,
    rubricVersion: opts.rubricVersion,
    taxonomyVersion: opts.taxonomyVersion,
    generatedAt: now.toISOString(),
    generatedBy: "deterministic-archetype-generator",
    difficultyMix: mix,
    candidates: picked.map(a => archToCandidate(opts.course, a, batchId)),
  };
}

/** Convenience: generate one 10-candidate batch for every course. */
export function generateAllCourses(opts: {
  rubricVersion: string;
  taxonomyVersion: string;
  now?: Date;
}): GeneratedBatch[] {
  const allCourses: AtlasCourseSlug[] = [
    "data-engineering", "ai-engineer", "mlops-engineer", "data-scientist",
    "analytics-engineer", "applied-llm-engineer", "cloud-data-engineer",
    "python-libraries", "sql",
  ];
  return allCourses.map(course => generateBatch({ course, count: 10, ...opts }));
}
