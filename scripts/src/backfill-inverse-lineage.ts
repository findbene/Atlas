/**
 * Phase 9 — one-shot backfill for `project_candidates.promoted_project_id`.
 *
 * For every project that has `source_candidate_id` set, stamp the inverse
 * pointer on the matching candidate row. Idempotent.
 *
 *   pnpm --filter @workspace/scripts run backfill:inverse-lineage
 */
import { db } from "@workspace/db";
import { projects, projectCandidates } from "@workspace/db";
import { and, eq, isNotNull } from "drizzle-orm";

async function main(): Promise<void> {
  const promoted = await db
    .select({ id: projects.id, slug: projects.slug, candidateId: projects.sourceCandidateId })
    .from(projects)
    .where(isNotNull(projects.sourceCandidateId));

  let stamped = 0, skipped = 0, missing = 0;
  for (const p of promoted) {
    if (!p.candidateId) continue;
    const candRow = await db
      .select({ id: projectCandidates.id, promotedProjectId: projectCandidates.promotedProjectId })
      .from(projectCandidates)
      .where(eq(projectCandidates.id, p.candidateId))
      .limit(1);
    if (!candRow[0]) {
      console.warn(`[inverse] ${p.slug}: candidate ${p.candidateId} not found — skipping`);
      missing++;
      continue;
    }
    if (candRow[0].promotedProjectId === p.id) { skipped++; continue; }
    await db
      .update(projectCandidates)
      .set({ promotedProjectId: p.id, updatedAt: new Date() })
      .where(eq(projectCandidates.id, p.candidateId));
    stamped++;
  }
  console.log(`[inverse] stamped=${stamped} already-set=${skipped} missing-candidate=${missing} total-promoted=${promoted.length}`);

  // Bidirectional invariant: every project.sourceCandidateId must round-trip.
  const broken = await db
    .select({ slug: projects.slug, projectId: projects.id, candidateId: projects.sourceCandidateId })
    .from(projects)
    .innerJoin(projectCandidates, eq(projectCandidates.id, projects.sourceCandidateId))
    .where(and(isNotNull(projects.sourceCandidateId)));
  let bad = 0;
  for (const row of broken) {
    const c = await db.query.projectCandidates.findFirst({ where: eq(projectCandidates.id, row.candidateId!) });
    if (!c || c.promotedProjectId !== row.projectId) {
      console.error(`[inverse] BROKEN ${row.slug}: project.candidate=${row.candidateId} but candidate.promoted=${c?.promotedProjectId ?? 'NULL'}`);
      bad++;
    }
  }
  if (bad > 0) { console.error(`[inverse] ${bad} bidirectional violations`); process.exit(1); }
  console.log(`[inverse] bidirectional invariant OK for ${broken.length} rows ✓`);
}

main().catch((err) => { console.error(err); process.exit(1); });
