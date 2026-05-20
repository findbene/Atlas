/**
 * Phase 10 — synthesize `project_candidates` rows for the batch-2 revise
 * upgrade cohort and clean up the legacy rows they replace.
 *
 *   pnpm --filter @workspace/scripts run backfill:revise-candidates
 *
 * Run AFTER the 7 authored modules are registered in
 * `scripts/src/authored/index.ts` but BEFORE running
 * `author:project promote <slug>` for each. Idempotent.
 *
 * Mirrors `backfill-upgrade-candidates.ts` (Phase 9 batch-1) exactly — only
 * the cohort, the source tag (`'phase10_revise'`), and the reviewer note
 * differ. Keeping the two scripts parallel makes the per-phase audit trail
 * easy to follow.
 */
import { db } from "@workspace/db";
import { projects, projectCandidates, type Project } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  REVISE_CANDIDATE_FOR_SLUG,
  COURSE_FOR_AUTHORED_SLUG,
  PHASE10_LEGACY_SLUG_MAP,
} from "./authored-lineage";

const REVISE_NOTE =
  "Phase-10 batch-2 revise upgrade — legacy revise-cohort project with a " +
  "5-step skeleton pre-existed in the catalog. Synthetic candidate created " +
  "during Phase-10 backfill so the upgraded project preserves the same " +
  "lineage contract as Phase-7/9 promotes; not produced by the AI " +
  "candidate generator.";

const LEGACY_BY_UPGRADED: Record<string, string> = Object.fromEntries(
  Object.entries(PHASE10_LEGACY_SLUG_MAP).map(([legacy, upgraded]) => [upgraded, legacy]),
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
      phase: "phase10_revise",
      legacySlug: sourceRow.slug,
      upgradedSlug,
      learningObjectives: sourceRow.learningObjectives,
      shortDescription: sourceRow.shortDescription,
    },
    status: "approved",
    reviewerNotes: REVISE_NOTE,
    source: "phase10_revise",
    // promoted_project_id deliberately left NULL — populated by the
    // subsequent `author-project promote` call (atomic + invariant-checked
    // in `promote()` per Phase 9 contract).
  });
  return "created";
}

async function main(): Promise<void> {
  const slugs = Object.keys(REVISE_CANDIDATE_FOR_SLUG);
  let createdCandidates = 0, existingCandidates = 0;
  let legacyDeleted = 0, legacyAlreadyGone = 0, legacyKept = 0;

  for (const upgradedSlug of slugs) {
    const candidateId = REVISE_CANDIDATE_FOR_SLUG[upgradedSlug];
    const legacySlug = LEGACY_BY_UPGRADED[upgradedSlug];
    if (!legacySlug) {
      console.warn(`[revise] ${upgradedSlug}: no legacy slug mapping — skipping`);
      continue;
    }

    const upgradedRow = await db.query.projects.findFirst({ where: eq(projects.slug, upgradedSlug) });
    const legacyRow = await db.query.projects.findFirst({ where: eq(projects.slug, legacySlug) });
    const sourceRow = upgradedRow ?? legacyRow;
    if (!sourceRow) {
      console.warn(`[revise] ${upgradedSlug}: neither legacy '${legacySlug}' nor upgraded row exists — skipping`);
      continue;
    }

    const outcome = await ensureCandidateFor(upgradedSlug, candidateId, sourceRow);
    if (outcome === "created") createdCandidates++; else existingCandidates++;

    if (upgradedRow && legacyRow && legacyRow.id !== upgradedRow.id) {
      await db.delete(projects).where(eq(projects.id, legacyRow.id));
      legacyDeleted++;
      console.log(`[revise] ${upgradedSlug}: deleted legacy '${legacySlug}' (id=${legacyRow.id})`);
    } else if (!legacyRow) {
      legacyAlreadyGone++;
    } else {
      legacyKept++;
      console.log(`[revise] ${upgradedSlug}: candidate ready; promote will replace legacy '${legacySlug}'`);
    }
  }

  console.log(
    `[revise] candidates: created=${createdCandidates} existing=${existingCandidates}  ` +
    `legacy: deleted=${legacyDeleted} kept=${legacyKept} already-gone=${legacyAlreadyGone}  ` +
    `total=${slugs.length}`,
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
