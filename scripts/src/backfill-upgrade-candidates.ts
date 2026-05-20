/**
 * Phase 9 — synthesize `project_candidates` rows for the batch-1 upgrade
 * cohort and clean up the legacy rows they replace.
 *
 *   pnpm --filter @workspace/scripts run backfill:upgrade-candidates
 *
 * Run AFTER the 6 authored modules are registered in
 * `scripts/src/authored/index.ts` but BEFORE running
 * `author:project promote <slug>` for each. Idempotent.
 *
 * For each upgrade slug:
 *   1. Insert (or no-op) a synthetic project_candidates row with the pinned
 *      UUID from UPGRADE_CANDIDATE_FOR_SLUG, source='phase9_upgrade'.
 *   2. Delete the legacy project row (looked up via PHASE9_LEGACY_SLUG_MAP)
 *      ONLY if the new upgraded slug doesn't already point at it — once the
 *      promote runs, the candidate will gain a `promoted_project_id`.
 */
import { db } from "@workspace/db";
import { projects, projectCandidates, type Project } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  UPGRADE_CANDIDATE_FOR_SLUG,
  COURSE_FOR_AUTHORED_SLUG,
  PHASE9_LEGACY_SLUG_MAP,
} from "./authored-lineage";

const UPGRADE_NOTE =
  "Phase-9 batch-1 upgrade — strong skeleton (≥4 steps, score ≥50) " +
  "pre-existed in the legacy catalog. Synthetic candidate created during " +
  "Phase-9 backfill so the upgraded project preserves the same lineage " +
  "contract as Phase-7 promotes; not produced by the AI candidate generator.";

const LEGACY_BY_UPGRADED: Record<string, string> = Object.fromEntries(
  Object.entries(PHASE9_LEGACY_SLUG_MAP).map(([legacy, upgraded]) => [upgraded, legacy]),
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
      phase: "phase9_upgrade",
      legacySlug: sourceRow.slug,
      upgradedSlug,
      learningObjectives: sourceRow.learningObjectives,
      shortDescription: sourceRow.shortDescription,
    },
    status: "approved",
    reviewerNotes: UPGRADE_NOTE,
    source: "phase9_upgrade",
    // promoted_project_id deliberately left NULL — populated by the
    // subsequent `author-project promote` call.
  });
  return "created";
}

async function main(): Promise<void> {
  const slugs = Object.keys(UPGRADE_CANDIDATE_FOR_SLUG);
  let createdCandidates = 0, existingCandidates = 0;
  let legacyDeleted = 0, legacyAlreadyGone = 0, legacyKept = 0;

  for (const upgradedSlug of slugs) {
    const candidateId = UPGRADE_CANDIDATE_FOR_SLUG[upgradedSlug];
    const legacySlug = LEGACY_BY_UPGRADED[upgradedSlug];
    if (!legacySlug) {
      console.warn(`[upgrade] ${upgradedSlug}: no legacy slug mapping — skipping`);
      continue;
    }

    // Find the source row (legacy or already-upgraded).
    const upgradedRow = await db.query.projects.findFirst({ where: eq(projects.slug, upgradedSlug) });
    const legacyRow = await db.query.projects.findFirst({ where: eq(projects.slug, legacySlug) });
    const sourceRow = upgradedRow ?? legacyRow;
    if (!sourceRow) {
      console.warn(`[upgrade] ${upgradedSlug}: neither legacy nor upgraded project row exists — skipping`);
      continue;
    }

    const outcome = await ensureCandidateFor(upgradedSlug, candidateId, sourceRow);
    if (outcome === "created") createdCandidates++; else existingCandidates++;

    // If the upgraded row already exists AND the legacy row still exists,
    // the legacy row is obsolete — delete it. If only the legacy row
    // exists, leave it alone (promote hasn't run yet; deleting it would
    // remove the only DB record of the project until promote inserts the
    // upgraded version).
    if (upgradedRow && legacyRow && legacyRow.id !== upgradedRow.id) {
      await db.delete(projects).where(eq(projects.id, legacyRow.id));
      legacyDeleted++;
      console.log(`[upgrade] ${upgradedSlug}: deleted legacy '${legacySlug}' (id=${legacyRow.id})`);
    } else if (!legacyRow) {
      legacyAlreadyGone++;
    } else {
      legacyKept++;
      console.log(`[upgrade] ${upgradedSlug}: candidate ready; promote will replace legacy '${legacySlug}'`);
    }
  }

  console.log(
    `[upgrade] candidates: created=${createdCandidates} existing=${existingCandidates}  ` +
    `legacy: deleted=${legacyDeleted} kept=${legacyKept} already-gone=${legacyAlreadyGone}  ` +
    `total=${slugs.length}`,
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
