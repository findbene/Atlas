/**
 * Phase 11 — synthesize `project_candidates` rows for the batch-3 revise
 * upgrade cohort (7 picks) and clean up the legacy rows they replace.
 *
 *   pnpm --filter @workspace/scripts run backfill:phase11-candidates
 *
 * Run AFTER the 7 authored modules are registered in
 * `scripts/src/authored/index.ts` but BEFORE running
 * `author:project promote <slug>` for each. Idempotent.
 *
 * Mirrors `backfill-revise-candidates.ts` (Phase 10 batch-2) exactly — only
 * the cohort, the source tag (`'phase11_revise'`), and the reviewer note differ.
 * Keeping the two scripts parallel makes the per-phase audit trail easy to follow.
 */
import { db } from "@workspace/db";
import { projects, projectCandidates, type Project } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  REVISE_CANDIDATE_FOR_SLUG,
  COURSE_FOR_AUTHORED_SLUG,
  PHASE11_LEGACY_SLUG_MAP,
} from "./authored-lineage";

const PHASE11_NOTE =
  "Phase-11 batch-3 revise upgrade — legacy thin-skeleton (1–2 step) row " +
  "pre-existed in the catalog with score 44–52 and was visible in /courses " +
  "with effectively no content. Synthetic candidate created during Phase-11 " +
  "backfill so the rebuilt project preserves the same lineage contract as " +
  "Phase-7/9/10 promotes; not produced by the AI candidate generator.";

/** Restrict the backfill to ONLY the 7 P11 picks (REVISE_CANDIDATE_FOR_SLUG
 *  contains P10 entries too). The intersection with PHASE11_LEGACY_SLUG_MAP's
 *  values is the authoritative P11 cohort. */
const PHASE11_UPGRADED_SLUGS = new Set(Object.values(PHASE11_LEGACY_SLUG_MAP));

const LEGACY_BY_UPGRADED: Record<string, string> = Object.fromEntries(
  Object.entries(PHASE11_LEGACY_SLUG_MAP).map(([legacy, upgraded]) => [upgraded, legacy]),
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
      phase: "phase11_revise",
      legacySlug: sourceRow.slug,
      upgradedSlug,
      learningObjectives: sourceRow.learningObjectives,
      shortDescription: sourceRow.shortDescription,
    },
    status: "approved",
    reviewerNotes: PHASE11_NOTE,
    source: "phase11_revise",
    // promoted_project_id deliberately left NULL — populated by the
    // subsequent `author-project promote` call (atomic + invariant-checked
    // in `promote()` per Phase 9 contract).
  });
  return "created";
}

async function main(): Promise<void> {
  const slugs = [...PHASE11_UPGRADED_SLUGS];
  let createdCandidates = 0, existingCandidates = 0;
  let legacyDeleted = 0, legacyAlreadyGone = 0, legacyKept = 0;

  for (const upgradedSlug of slugs) {
    const candidateId = REVISE_CANDIDATE_FOR_SLUG[upgradedSlug];
    if (!candidateId) {
      console.warn(`[phase11] ${upgradedSlug}: no candidateId in REVISE_CANDIDATE_FOR_SLUG — skipping`);
      continue;
    }
    const legacySlug = LEGACY_BY_UPGRADED[upgradedSlug];
    if (!legacySlug) {
      console.warn(`[phase11] ${upgradedSlug}: no legacy slug mapping — skipping`);
      continue;
    }

    const upgradedRow = await db.query.projects.findFirst({ where: eq(projects.slug, upgradedSlug) });
    const legacyRow = await db.query.projects.findFirst({ where: eq(projects.slug, legacySlug) });
    const sourceRow = upgradedRow ?? legacyRow;
    if (!sourceRow) {
      console.warn(`[phase11] ${upgradedSlug}: neither legacy '${legacySlug}' nor upgraded row exists — skipping`);
      continue;
    }

    const outcome = await ensureCandidateFor(upgradedSlug, candidateId, sourceRow);
    if (outcome === "created") createdCandidates++; else existingCandidates++;

    if (upgradedRow && legacyRow && legacyRow.id !== upgradedRow.id) {
      await db.delete(projects).where(eq(projects.id, legacyRow.id));
      legacyDeleted++;
      console.log(`[phase11] ${upgradedSlug}: deleted legacy '${legacySlug}' (id=${legacyRow.id})`);
    } else if (!legacyRow) {
      legacyAlreadyGone++;
    } else {
      legacyKept++;
      console.log(`[phase11] ${upgradedSlug}: candidate ready; promote will replace legacy '${legacySlug}'`);
    }
  }

  console.log(
    `[phase11] candidates: created=${createdCandidates} existing=${existingCandidates}  ` +
    `legacy: deleted=${legacyDeleted} kept=${legacyKept} already-gone=${legacyAlreadyGone}  ` +
    `total=${slugs.length}`,
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
