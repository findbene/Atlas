/**
 * Phase 19 — synthesize `project_candidates` rows for the 2 net-new
 * beginner/foundations authored projects (one each for cloud-data-engineer
 * and applied-llm-engineer — two of the four zero-beginner courses
 * surfaced by Phase 18's Start Here learner path).
 *
 *   pnpm --filter @workspace/scripts run backfill:phase19-candidates
 *
 * Run AFTER the 2 authored modules are registered in
 * `scripts/src/authored/index.ts` but BEFORE
 * `author:project promote <slug>` for each. Idempotent.
 *
 * Same pattern as Phase 13/14: these are NOT upgrades of existing legacy
 * slugs. No source row to copy metadata from — the candidate proposal is
 * built directly from the authored module's declared metadata via
 * `findAuthored(slug)`. No legacy twin, no archive step.
 */
import { db } from "@workspace/db";
import { projectCandidates } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  BEGINNER_CANDIDATE_FOR_SLUG_PHASE19,
  COURSE_FOR_AUTHORED_SLUG,
} from "./authored-lineage";
import { findAuthored } from "./authored";

const PHASE19_NOTE =
  "Phase-19 net-new beginner/foundations pilot — authored to close the " +
  "Start Here gap on 2 of the 4 zero-beginner courses surfaced by Phase " +
  "18 (cloud-data-engineer + applied-llm-engineer). Synthetic candidate " +
  "created during Phase-19 backfill so the new project preserves the " +
  "AuthoredProject.candidateId lineage contract. No legacy twin: this " +
  "slug did not previously exist. ai-engineer + mlops-engineer beginners " +
  "are deferred to Phase 20+.";

async function ensureCandidateFor(authoredSlug: string, candidateId: string): Promise<"created" | "exists"> {
  const existing = await db.query.projectCandidates.findFirst({
    where: eq(projectCandidates.id, candidateId),
  });
  if (existing) return "exists";

  const course = COURSE_FOR_AUTHORED_SLUG[authoredSlug];
  if (!course) throw new Error(`[phase19-cand] no COURSE_FOR_AUTHORED_SLUG entry for '${authoredSlug}'`);
  const authored = findAuthored(authoredSlug);
  if (!authored) throw new Error(`[phase19-cand] no authored module registered for '${authoredSlug}'`);
  if (authored.candidateId !== candidateId) {
    throw new Error(
      `[phase19-cand] candidateId mismatch for '${authoredSlug}': ` +
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
      phase: "phase19_beginner_pilot",
      authoredSlug,
      legacySlug: null,
      learningObjectives: authored.learningObjectives,
      shortDescription: authored.shortDescription,
    },
    status: "approved",
    reviewerNotes: PHASE19_NOTE,
    source: "phase19_beginner_pilot",
  });
  return "created";
}

async function main(): Promise<void> {
  const entries = Object.entries(BEGINNER_CANDIDATE_FOR_SLUG_PHASE19);
  if (entries.length !== 2) {
    throw new Error(`[phase19-cand] expected exactly 2 authored slugs, got ${entries.length}`);
  }
  let created = 0, exists = 0;

  for (const [authoredSlug, candidateId] of entries) {
    const outcome = await ensureCandidateFor(authoredSlug, candidateId);
    if (outcome === "created") created++; else exists++;
    console.log(`[phase19-cand] ${authoredSlug}: ${outcome} (candidate=${candidateId.slice(0, 8)})`);
  }

  console.log(`[phase19-cand] candidates: created=${created} existing=${exists} total=${entries.length}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
