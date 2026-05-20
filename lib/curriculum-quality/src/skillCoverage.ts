/**
 * Phase 6 — non-rubric skill-coverage helper.
 *
 * Reports which skills from `COURSE_TAXONOMY[course]` a candidate touches
 * and what's missing for the claimed difficulty tier. This is descriptive
 * metadata used by the catalog report and generator self-checks — it is
 * deliberately NOT part of the composite quality score (Phase-5 rubric
 * stays frozen at v1.0.1 per Phase-6 correction C9).
 */
import type { AtlasCourseSlug, Difficulty, StepInput } from "./types";
import { COURSE_TAXONOMY, skillsUpTo } from "./COURSE_TAXONOMY";

export type SkillCoverageReport = {
  course: AtlasCourseSlug;
  difficulty: Difficulty;
  expectedSkillCount: number;
  coveredSkills: string[];
  missingForTier: string[];
  coverageRatio: number;
};

export function scoreSkillCoverage(
  course: AtlasCourseSlug,
  difficulty: Difficulty,
  steps: StepInput[],
  declaredSkills: string[] = [],
): SkillCoverageReport {
  const expected = skillsUpTo(course, difficulty);
  const expectedSet = new Set(expected);
  const claimed = new Set<string>([
    ...declaredSkills,
    ...steps.map(s => (s.requiredSkill ?? "").trim()).filter(Boolean),
  ]);
  const covered = [...claimed].filter(s => expectedSet.has(s));
  const missing = expected.filter(s => !claimed.has(s));
  return {
    course,
    difficulty,
    expectedSkillCount: expected.length,
    coveredSkills: covered,
    missingForTier: missing,
    coverageRatio: expected.length === 0 ? 0 : covered.length / expected.length,
  };
}

/** Sanity check: assert every cloud-tooling token is a tier-1 anchor. */
export function validateTaxonomyCloudTooling(): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  for (const [course, map] of Object.entries(COURSE_TAXONOMY)) {
    for (const tok of map.cloudTooling) {
      if (!tok || tok.length < 2) problems.push(`${course}: empty cloudTooling token`);
    }
  }
  return { ok: problems.length === 0, problems };
}
