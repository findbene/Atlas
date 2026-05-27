/**
 * Phase 40 — Candidate-row archive safety helper.
 *
 * Returns the project_candidates rows whose `promoted_project_id` points at
 * each archive-target project id. The lineage is bidirectional (see
 * `lib/db/src/schema/quality.ts` — `projectCandidates.promotedProjectId →
 * projects.id` AND `projects.sourceCandidateId → projectCandidates.id`),
 * AND a Phase-11+ invariant requires `learner_visible=true` AND zero
 * inverse-mismatches across that bidirectional lineage (see
 * `replit.md § Active Invariants / Gates`). Hiding a project that is the
 * promoted target of a non-archived candidate would silently break that
 * invariant: the candidate row keeps pointing at the now-hidden project,
 * `audit:quality` would catch it on the next run, but the archive script
 * should refuse rather than landing the inconsistency in the first place.
 *
 * Empty input → empty Map (no DB roundtrip).
 *
 * Notes:
 *   - Only the `promoted_project_id` direction is checked. The inverse
 *     direction (`projects.source_candidate_id`) is not a blocker for
 *     archiving a project: hiding a target whose own `source_candidate_id`
 *     still resolves is fine — the candidate row still exists and still
 *     points back.
 *   - We deliberately do NOT filter by `project_candidates.status`. Even a
 *     `promoted` candidate row that points at a project we're about to
 *     archive is a problem, because the lineage assertion does not care
 *     about candidate status.
 *
 * @see lib/db/src/schema/quality.ts
 * @see lib/db/src/schema/domains.ts (sourceCandidateId)
 * @see replit.md (lineageIntegrity invariant)
 */
import { db, projectCandidates } from "@workspace/db";
import { inArray, isNotNull } from "drizzle-orm";

/**
 * Returns a Map<projectId, candidateRowCount> for every requested project id
 * that has at least one project_candidates row whose `promoted_project_id`
 * matches. Project ids with zero such rows are omitted from the Map (use
 * `m.get(id) ?? 0` at call sites).
 */
export async function getCandidateRowCountsByPromotedProject(
  projectIds: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (projectIds.length === 0) return out;

  const rows = await db
    .select({ promotedProjectId: projectCandidates.promotedProjectId })
    .from(projectCandidates)
    .where(inArray(projectCandidates.promotedProjectId, [...projectIds]));

  for (const r of rows) {
    if (!r.promotedProjectId) continue;
    out.set(r.promotedProjectId, (out.get(r.promotedProjectId) ?? 0) + 1);
  }
  return out;
}

/**
 * Convenience: returns the subset of `projectIds` that have at least one
 * candidate row pointing at them. Suitable for direct use in archive
 * safety-gate violation messages.
 */
export async function findProjectsWithCandidates(
  projectIds: readonly string[],
): Promise<{ projectId: string; candidateCount: number }[]> {
  const m = await getCandidateRowCountsByPromotedProject(projectIds);
  return [...m.entries()].map(([projectId, candidateCount]) => ({ projectId, candidateCount }));
}

// Re-export to keep tree-shaking-friendly named import surface clean even
// when callers only want the marker.
export { isNotNull };
