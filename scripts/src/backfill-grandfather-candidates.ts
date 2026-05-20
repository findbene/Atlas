/**
 * Phase 9 — synthesize `project_candidates` rows for Phase-4 originals that
 * predate the candidate pipeline, then stamp `projects.source_candidate_id`
 * + flip `course_source='authored'`. Idempotent (uses pinned UUIDs).
 *
 *   pnpm --filter @workspace/scripts run backfill:grandfather-candidates
 *
 * Preserves the Phase-8 invariant that `AuthoredProject.candidateId` is
 * required — the grandfather slugs are simply granted real (synthetic)
 * candidate IDs instead of being given a special-case escape hatch.
 */
import { db } from "@workspace/db";
import { projects, projectCandidates, type Project } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GRANDFATHERED_CANDIDATE_FOR_SLUG,
  COURSE_FOR_AUTHORED_SLUG,
} from "./authored-lineage";

const GRANDFATHER_NOTE =
  "Phase-4 original — fully pedagogy-enriched before the Phase-5 candidate " +
  "pipeline existed. Synthetic candidate created during Phase-9 backfill so " +
  "lineage is preserved; not produced by the AI candidate generator.";

async function ensureCandidateFor(slug: string, candidateId: string, project: Project): Promise<"created" | "exists"> {
  const existing = await db.query.projectCandidates.findFirst({
    where: eq(projectCandidates.id, candidateId),
  });
  if (existing) return "exists";

  const course = COURSE_FOR_AUTHORED_SLUG[slug] ?? project.course;
  await db.insert(projectCandidates).values({
    id: candidateId,
    proposedTitle: project.title,
    proposedCourse: course,
    targetRoles: [],
    difficulty: project.difficultyLevel,
    proposedStack: project.techStack,
    proposal: {
      synthesized: true,
      originSlug: project.slug,
      learningObjectives: project.learningObjectives,
      shortDescription: project.shortDescription,
    },
    status: "approved",
    reviewerNotes: GRANDFATHER_NOTE,
    source: "grandfathered_phase4",
    promotedProjectId: project.id,
  });
  return "created";
}

async function main(): Promise<void> {
  const slugs = Object.keys(GRANDFATHERED_CANDIDATE_FOR_SLUG);
  let createdCandidates = 0, existingCandidates = 0, stampedProjects = 0, alreadyStamped = 0;

  for (const slug of slugs) {
    const candidateId = GRANDFATHERED_CANDIDATE_FOR_SLUG[slug];
    const project = await db.query.projects.findFirst({ where: eq(projects.slug, slug) });
    if (!project) {
      console.warn(`[grandfather] ${slug}: project not in DB — skipping`);
      continue;
    }

    const outcome = await ensureCandidateFor(slug, candidateId, project);
    if (outcome === "created") createdCandidates++; else existingCandidates++;

    const needsStamp =
      project.sourceCandidateId !== candidateId || project.courseSource !== "authored";
    if (!needsStamp) { alreadyStamped++; continue; }

    await db.update(projects).set({
      sourceCandidateId: candidateId,
      courseSource: "authored",
    }).where(eq(projects.id, project.id));

    // Make sure the inverse pointer is also right (it should be from the
    // insert above, but a pre-existing candidate row may have had a stale
    // value).
    await db.update(projectCandidates).set({
      promotedProjectId: project.id,
      updatedAt: new Date(),
    }).where(eq(projectCandidates.id, candidateId));

    stampedProjects++;
    console.log(`[grandfather] ${slug}: stamped sourceCandidateId + courseSource='authored'`);
  }

  console.log(
    `[grandfather] candidates: created=${createdCandidates} existing=${existingCandidates}  ` +
    `projects: stamped=${stampedProjects} already=${alreadyStamped}  total=${slugs.length}`,
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
