/**
 * Phase 13 — synthesize `project_candidates` rows for the 4 net-new
 * course-seed projects (one each for mlops-engineer, applied-llm-engineer,
 * python-libraries, sql).
 *
 *   pnpm --filter @workspace/scripts run backfill:phase13-candidates
 *
 * Run AFTER the 4 authored modules are registered in
 * `scripts/src/authored/index.ts` but BEFORE `author:project promote
 * <slug>` for each. Idempotent.
 *
 * Diverges from Phase 12B in one critical way: these are NOT upgrades of
 * existing legacy slugs. There is no source row to copy metadata from, so
 * the candidate proposal is built directly from the authored module's
 * declared metadata via `findAuthored(slug)`.
 *
 * No legacy row to preserve, no archive step.
 */
import { db } from "@workspace/db";
import { projectCandidates } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  NEW_COURSE_SEED_FOR_SLUG_PHASE13,
  COURSE_FOR_AUTHORED_SLUG,
} from "./authored-lineage";
import { findAuthored } from "./authored";

const PHASE13_NOTE =
  "Phase-13 net-new course-seed — authored to lift an underserved course " +
  "(2 visible projects post-P12B) to 3. Synthetic candidate created during " +
  "Phase-13 backfill so the new project preserves the AuthoredProject.candidateId " +
  "lineage contract. No legacy twin: this slug did not previously exist.";

async function ensureCandidateFor(authoredSlug: string, candidateId: string): Promise<"created" | "exists"> {
  const existing = await db.query.projectCandidates.findFirst({
    where: eq(projectCandidates.id, candidateId),
  });
  if (existing) return "exists";

  const course = COURSE_FOR_AUTHORED_SLUG[authoredSlug];
  if (!course) throw new Error(`[phase13-cand] no COURSE_FOR_AUTHORED_SLUG entry for '${authoredSlug}'`);
  const authored = findAuthored(authoredSlug);
  if (!authored) throw new Error(`[phase13-cand] no authored module registered for '${authoredSlug}'`);
  if (authored.candidateId !== candidateId) {
    throw new Error(
      `[phase13-cand] candidateId mismatch for '${authoredSlug}': ` +
      `lineage map=${candidateId}, AuthoredProject=${authored.candidateId}`,
    );
  }

  await db.insert(projectCandidates).values({
    id: candidateId,
    proposedTitle: authored.title,
    proposedCourse: course,
    targetRoles: [],
    difficulty: authored.difficulty,
    proposedStack: authored.techStack,
    proposal: {
      synthesized: true,
      phase: "phase13_course_seed",
      authoredSlug,
      legacySlug: null,
      learningObjectives: authored.learningObjectives,
      shortDescription: authored.shortDescription,
    },
    status: "approved",
    reviewerNotes: PHASE13_NOTE,
    source: "phase13_course_seed",
    // promoted_project_id deliberately NULL — populated by `author-project
    // promote` atomically (Phase 9 inverse-lineage contract).
  });
  return "created";
}

async function main(): Promise<void> {
  const entries = Object.entries(NEW_COURSE_SEED_FOR_SLUG_PHASE13);
  if (entries.length !== 4) {
    throw new Error(`[phase13-cand] expected exactly 4 authored slugs, got ${entries.length}`);
  }
  let created = 0, exists = 0;

  for (const [authoredSlug, candidateId] of entries) {
    const outcome = await ensureCandidateFor(authoredSlug, candidateId);
    if (outcome === "created") created++; else exists++;
    console.log(`[phase13-cand] ${authoredSlug}: ${outcome} (candidate=${candidateId.slice(0, 8)})`);
  }

  console.log(`[phase13-cand] candidates: created=${created} existing=${exists} total=${entries.length}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
