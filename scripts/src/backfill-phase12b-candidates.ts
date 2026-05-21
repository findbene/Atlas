/**
 * Phase 12B — synthesize `project_candidates` rows for the 3 deferred DE
 * skeleton-rebuild cohort (kafka-streaming-pipeline, ml-feature-store,
 * spark-batch-processing) that the original Phase-11 plan capped out.
 *
 *   pnpm --filter @workspace/scripts run backfill:phase12b-candidates
 *
 * Run AFTER the 3 authored modules are registered in
 * `scripts/src/authored/index.ts` but BEFORE running
 * `author:project promote <slug>` for each. Idempotent.
 *
 * Diverges from `backfill-phase11-candidates.ts` in one critical way:
 * this script does NOT delete the legacy projects row. The legacy
 * rows are preserved and archived (learner_visible=false) by
 * `archive-phase12b-replaced.ts` after the 3 promotes, mirroring
 * the Phase-12A archive-by-hide pattern.
 */
import { db } from "@workspace/db";
import { projects, projectCandidates, type Project } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  REVISE_CANDIDATE_FOR_SLUG_PHASE12B,
  COURSE_FOR_AUTHORED_SLUG,
  PHASE12B_LEGACY_SLUG_MAP,
} from "./authored-lineage";

const PHASE12B_NOTE =
  "Phase-12B completion of the Phase-11 deferred DE cohort — legacy " +
  "1-step skeleton row (entry score 43-49) pre-existed and was capped " +
  "out at planning time when P11 set its 7-promote ceiling. Synthetic " +
  "candidate created during Phase-12B backfill so the rebuilt project " +
  "preserves the same lineage contract as Phase-7/9/10/11 promotes. " +
  "Legacy row is preserved and archived by archive:phase12b-replaced.";

const LEGACY_BY_UPGRADED: Record<string, string> = Object.fromEntries(
  Object.entries(PHASE12B_LEGACY_SLUG_MAP).map(([legacy, upgraded]) => [upgraded, legacy]),
);

async function ensureCandidateFor(upgradedSlug: string, candidateId: string, sourceRow: Project): Promise<"created" | "exists"> {
  const existing = await db.query.projectCandidates.findFirst({
    where: eq(projectCandidates.id, candidateId),
  });
  if (existing) return "exists";

  const course = COURSE_FOR_AUTHORED_SLUG[upgradedSlug];
  await db.insert(projectCandidates).values({
    id: candidateId,
    proposedTitle: sourceRow.title,
    proposedCourse: course,
    targetRoles: [],
    difficulty: sourceRow.difficultyLevel,
    proposedStack: sourceRow.techStack,
    proposal: {
      synthesized: true,
      phase: "phase12b_revise",
      legacySlug: sourceRow.slug,
      upgradedSlug,
      learningObjectives: sourceRow.learningObjectives,
      shortDescription: sourceRow.shortDescription,
    },
    status: "approved",
    reviewerNotes: PHASE12B_NOTE,
    source: "phase12b_revise",
    // promoted_project_id deliberately NULL — populated by `author-project
    // promote` atomically (Phase 9 inverse-lineage contract).
  });
  return "created";
}

async function main(): Promise<void> {
  const slugs = Object.values(PHASE12B_LEGACY_SLUG_MAP);
  if (slugs.length !== 3) {
    throw new Error(`[phase12b-cand] expected exactly 3 upgraded slugs, got ${slugs.length}`);
  }
  let createdCandidates = 0, existingCandidates = 0, legacyPreserved = 0;

  for (const upgradedSlug of slugs) {
    const candidateId = REVISE_CANDIDATE_FOR_SLUG_PHASE12B[upgradedSlug];
    if (!candidateId) {
      console.warn(`[phase12b-cand] ${upgradedSlug}: no candidateId in REVISE_CANDIDATE_FOR_SLUG_PHASE12B — skipping`);
      continue;
    }
    const legacySlug = LEGACY_BY_UPGRADED[upgradedSlug];
    if (!legacySlug) {
      console.warn(`[phase12b-cand] ${upgradedSlug}: no legacy slug mapping — skipping`);
      continue;
    }

    const upgradedRow = await db.query.projects.findFirst({ where: eq(projects.slug, upgradedSlug) });
    const legacyRow = await db.query.projects.findFirst({ where: eq(projects.slug, legacySlug) });
    const sourceRow = upgradedRow ?? legacyRow;
    if (!sourceRow) {
      console.warn(`[phase12b-cand] ${upgradedSlug}: neither legacy '${legacySlug}' nor upgraded row exists — skipping`);
      continue;
    }

    const outcome = await ensureCandidateFor(upgradedSlug, candidateId, sourceRow);
    if (outcome === "created") createdCandidates++; else existingCandidates++;

    if (legacyRow) {
      legacyPreserved++;
      // NO DELETE — archive-phase12b-replaced.ts will flip learner_visible=false.
      console.log(`[phase12b-cand] ${upgradedSlug}: candidate ready; legacy '${legacySlug}' PRESERVED for archive-by-hide.`);
    }
  }

  console.log(
    `[phase12b-cand] candidates: created=${createdCandidates} existing=${existingCandidates}  ` +
    `legacy-preserved=${legacyPreserved}  total=${slugs.length}`,
  );
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
