/**
 * Phase 41 — synthesize `project_candidates` rows for the 2 net-new
 * INTERMEDIATE-tier authored projects (DE + AI) closing the
 * audit-confirmed Intermediate gap in those advanced-skewed courses.
 *
 *   pnpm --filter @workspace/scripts run backfill:phase41-candidates
 *
 * Run AFTER the 2 authored modules are registered in
 * `scripts/src/authored/index.ts` but BEFORE
 * `author:project promote <slug>` for each. Idempotent.
 *
 * Same pattern as Phase 19 + Phase 20: these are NOT upgrades of
 * existing legacy slugs (audit confirmed no legacy twins exist for
 * these slugs after the user-approved pivot). No source row to copy
 * metadata from — the candidate proposal is built directly from the
 * authored module's declared metadata via `findAuthored(slug)`. No
 * legacy twin, no archive step.
 */
import { db } from "@workspace/db";
import { projectCandidates } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  SEED_FACTORY_FOR_SLUG_PHASE41,
  COURSE_FOR_AUTHORED_SLUG,
} from "./authored-lineage";
import { findAuthored } from "./authored";

const PHASE41_NOTE =
  "Phase-41 Seed Factory Pilot — 2 net-new INTERMEDIATE-tier projects " +
  "(DE + AI) authored against the Phase 35 publish-readiness contract " +
  "to close the audit-confirmed Intermediate gap in two advanced-skewed " +
  "courses. Synthetic candidate created during Phase-41 backfill so the " +
  "new project preserves the AuthoredProject.candidateId lineage " +
  "contract. No legacy twin — these are net-new slugs (originals " +
  "collided with active visible projects; alternates approved by user).";

async function ensureCandidateFor(authoredSlug: string, candidateId: string): Promise<"created" | "exists"> {
  const existing = await db.query.projectCandidates.findFirst({
    where: eq(projectCandidates.id, candidateId),
  });
  if (existing) return "exists";

  const course = COURSE_FOR_AUTHORED_SLUG[authoredSlug];
  if (!course) throw new Error(`[phase41-cand] no COURSE_FOR_AUTHORED_SLUG entry for '${authoredSlug}'`);
  const authored = findAuthored(authoredSlug);
  if (!authored) throw new Error(`[phase41-cand] no authored module registered for '${authoredSlug}'`);
  if (authored.candidateId !== candidateId) {
    throw new Error(
      `[phase41-cand] candidateId mismatch for '${authoredSlug}': ` +
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
      phase: "phase41_seed_factory",
      authoredSlug,
      legacySlug: null,
      learningObjectives: authored.learningObjectives,
      shortDescription: authored.shortDescription,
    },
    status: "approved",
    reviewerNotes: PHASE41_NOTE,
    source: "phase41_seed_factory",
  });
  return "created";
}

async function main(): Promise<void> {
  const entries = Object.entries(SEED_FACTORY_FOR_SLUG_PHASE41);
  if (entries.length !== 2) {
    throw new Error(`[phase41-cand] expected exactly 2 authored slugs, got ${entries.length}`);
  }
  let created = 0, exists = 0;

  for (const [authoredSlug, candidateId] of entries) {
    const outcome = await ensureCandidateFor(authoredSlug, candidateId);
    if (outcome === "created") created++; else exists++;
    console.log(`[phase41-cand] ${authoredSlug}: ${outcome} (candidate=${candidateId.slice(0, 8)})`);
  }

  console.log(`[phase41-cand] candidates: created=${created} existing=${exists} total=${entries.length}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
