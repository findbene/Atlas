/**
 * Phase 14 — synthesize `project_candidates` rows for the 5 net-new
 * beginner-tier authored projects (one each for sql, python-libraries,
 * data-engineering, analytics-engineer, data-scientist).
 *
 *   pnpm --filter @workspace/scripts run backfill:phase14-candidates
 *
 * Run AFTER the 5 authored modules are registered in
 * `scripts/src/authored/index.ts` but BEFORE `author:project promote
 * <slug>` for each. Idempotent.
 *
 * Same pattern as Phase 13: these are NOT upgrades of existing legacy
 * slugs. No source row to copy metadata from — the candidate proposal is
 * built directly from the authored module's declared metadata via
 * `findAuthored(slug)`. No legacy twin, no archive step.
 */
import { db } from "@workspace/db";
import { projectCandidates } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  BEGINNER_CANDIDATE_FOR_SLUG_PHASE14,
  COURSE_FOR_AUTHORED_SLUG,
} from "./authored-lineage";
import { findAuthored } from "./authored";

const PHASE14_NOTE =
  "Phase-14 net-new beginner-tier seed — authored to lift the beginner " +
  "count (1 → 6) across the 5 entry-tier-suitable courses (sql, " +
  "python-libraries, data-engineering, analytics-engineer, data-scientist). " +
  "Synthetic candidate created during Phase-14 backfill so the new project " +
  "preserves the AuthoredProject.candidateId lineage contract. No legacy " +
  "twin: this slug did not previously exist.";

async function ensureCandidateFor(authoredSlug: string, candidateId: string): Promise<"created" | "exists"> {
  const existing = await db.query.projectCandidates.findFirst({
    where: eq(projectCandidates.id, candidateId),
  });
  if (existing) return "exists";

  const course = COURSE_FOR_AUTHORED_SLUG[authoredSlug];
  if (!course) throw new Error(`[phase14-cand] no COURSE_FOR_AUTHORED_SLUG entry for '${authoredSlug}'`);
  const authored = findAuthored(authoredSlug);
  if (!authored) throw new Error(`[phase14-cand] no authored module registered for '${authoredSlug}'`);
  if (authored.candidateId !== candidateId) {
    throw new Error(
      `[phase14-cand] candidateId mismatch for '${authoredSlug}': ` +
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
      phase: "phase14_beginner",
      authoredSlug,
      legacySlug: null,
      learningObjectives: authored.learningObjectives,
      shortDescription: authored.shortDescription,
    },
    status: "approved",
    reviewerNotes: PHASE14_NOTE,
    source: "phase14_beginner",
  });
  return "created";
}

async function main(): Promise<void> {
  const entries = Object.entries(BEGINNER_CANDIDATE_FOR_SLUG_PHASE14);
  if (entries.length !== 5) {
    throw new Error(`[phase14-cand] expected exactly 5 authored slugs, got ${entries.length}`);
  }
  let created = 0, exists = 0;

  for (const [authoredSlug, candidateId] of entries) {
    const outcome = await ensureCandidateFor(authoredSlug, candidateId);
    if (outcome === "created") created++; else exists++;
    console.log(`[phase14-cand] ${authoredSlug}: ${outcome} (candidate=${candidateId.slice(0, 8)})`);
  }

  console.log(`[phase14-cand] candidates: created=${created} existing=${exists} total=${entries.length}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
