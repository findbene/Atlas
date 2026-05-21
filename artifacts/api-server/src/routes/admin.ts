/**
 * Phase 5 — thin read-only admin endpoint (Phase 8 hardening).
 *
 *   GET /api/admin/quality
 *
 * Returns a JSON summary identical in shape to the `catalog:report` JSON
 * output, computed on demand from the DB. No UI in this phase.
 *
 * Auth: requireAdmin (Phase 8). Anonymous → 401; non-admin → 403.
 */
import { Router } from "express";
import { requireAdmin } from "../lib/auth";
import { db } from "@workspace/db";
import { projects, projectCandidates } from "@workspace/db";
import { asc } from "drizzle-orm";
import {
  ALL_COURSES,
  type AtlasCourseSlug, type Scorecard,
} from "@workspace/curriculum-quality";

const router = Router();

router.get("/api/admin/quality", requireAdmin, async (req, res) => {
  const projectRows = await db.query.projects.findMany({ orderBy: [asc(projects.orderIndex)] });
  const candidateRows = await db.query.projectCandidates.findMany();

  // Build candidateId → proposedTitle lookup so we can show lineage labels
  // without an extra round-trip per project.
  const candidateTitle = new Map(candidateRows.map(c => [c.id, c.proposedTitle]));
  // Phase 9 — inverse lineage: candidate.promotedProjectId → project.slug.
  const projectSlugById = new Map(projectRows.map(p => [p.id, p.slug]));

  const summary = {
    rubricVersion: (projectRows[0]?.qualityBreakdown as Scorecard | null)?.rubricVersion ?? null,
    totals: { projects: projectRows.length, candidates: candidateRows.length },
    statusFunnel: { unreviewed: 0, approved: 0, needs_revision: 0, rejected: 0 },
    candidateStatusFunnel: { candidate: 0, approved: 0, needs_revision: 0, rejected: 0 },
    courseDistribution: Object.fromEntries(ALL_COURSES.map(c => [c, 0])) as Record<AtlasCourseSlug, number>,
    courseSourceFunnel: { authored: 0, heuristic_legacy: 0, unset: 0 },
    duplicateWarnings: [] as Array<{ slug: string; nearest: string; similarity: number }>,
    scoreHistogram: [0, 0, 0, 0, 0],
    weakest: [] as Array<{ slug: string; score: number; status: string }>,
    // Phase 8 — candidate → project lineage.
    lineage: [] as Array<{
      slug: string;
      course: AtlasCourseSlug | null;
      courseSource: "authored" | "heuristic_legacy" | null;
      sourceCandidateId: string | null;
      sourceCandidateTitle: string | null;
    }>,
    // Phase 9 — inverse lineage: candidate → project.
    inverseLineage: [] as Array<{
      candidateId: string;
      candidateTitle: string;
      candidateStatus: string;
      candidateSource: string | null;
      promotedProjectId: string | null;
      promotedProjectSlug: string | null;
    }>,
    // Phase 9 — bidirectional integrity. If any non-zero, run
    // `backfill:inverse-lineage` to repair.
    //   - mismatches: projects whose source_candidate_id points to a candidate
    //     whose promoted_project_id != that project (project→candidate broken).
    //   - inverseMismatches: candidates whose promoted_project_id points to a
    //     project whose source_candidate_id != that candidate (candidate→project broken).
    //   - duplicateCandidatePromotions: distinct candidates that share the same
    //     promoted_project_id (each project must be claimed by at most one candidate).
    lineageIntegrity: {
      promotedProjects: 0,
      candidatesWithInverse: 0,
      mismatches: 0,
      inverseMismatches: 0,
      duplicateCandidatePromotions: 0,
    },
    // Phase 10 — archive visibility. Hidden projects stay in the DB but
    // are filtered from learner-facing routes (`learnerVisible=false`).
    hiddenCount: 0,
    hiddenSlugs: [] as string[],
    // Phase 12A — replace_candidate_slug pairs. For every project row that
    // declares it supersedes a legacy slug (via `replace_candidate_slug`),
    // surface the pair + whether the legacy row is currently hidden. Gives
    // ops a single-glance health view of the upgrade→archive lifecycle.
    legacyReplacements: {
      count: 0,
      pairs: [] as Array<{ upgradedSlug: string; legacySlug: string; legacyHidden: boolean }>,
    },
  };

  // Pre-build slug → learnerVisible lookup for the Phase-12A pairs surface.
  const learnerVisibleBySlug = new Map(projectRows.map(p => [p.slug, p.learnerVisible !== false]));

  for (const p of projectRows) {
    summary.statusFunnel[p.qualityStatus]++;
    // Phase 9 — `projects.course` is NOT NULL post-backfill; read it directly.
    // (Heuristic course inference removed; the runtime caller-allowlist lint
    // `check:no-heuristic-runtime` blocks re-introduction.)
    const course = p.course as AtlasCourseSlug;
    summary.courseDistribution[course]++;
    if (p.courseSource === "authored") summary.courseSourceFunnel.authored++;
    else if (p.courseSource === "heuristic_legacy") summary.courseSourceFunnel.heuristic_legacy++;
    else summary.courseSourceFunnel.unset++;
    const card = p.qualityBreakdown as Scorecard | null;
    if (card?.duplicateWarning && card.nearestNeighbors?.[0]) {
      summary.duplicateWarnings.push({
        slug: p.slug,
        nearest: card.nearestNeighbors[0].slug,
        similarity: card.nearestNeighbors[0].similarity,
      });
    }
    const overall = card?.overall ?? 0;
    summary.scoreHistogram[Math.min(4, Math.floor(overall / 20))]++;
    if (p.learnerVisible === false) {
      summary.hiddenCount++;
      summary.hiddenSlugs.push(p.slug);
    }
    if (p.replaceCandidateSlug) {
      summary.legacyReplacements.count++;
      const legacyHidden = learnerVisibleBySlug.get(p.replaceCandidateSlug) === false;
      summary.legacyReplacements.pairs.push({
        upgradedSlug: p.slug,
        legacySlug: p.replaceCandidateSlug,
        legacyHidden,
      });
    }
    summary.lineage.push({
      slug: p.slug,
      course: (p.course as AtlasCourseSlug | null) ?? null,
      courseSource: p.courseSource ?? null,
      sourceCandidateId: p.sourceCandidateId ?? null,
      sourceCandidateTitle: p.sourceCandidateId ? candidateTitle.get(p.sourceCandidateId) ?? null : null,
    });
  }

  summary.weakest = projectRows
    .map(p => ({ slug: p.slug, score: (p.qualityBreakdown as Scorecard | null)?.overall ?? 0, status: p.qualityStatus }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);

  for (const c of candidateRows) {
    summary.candidateStatusFunnel[c.status]++;
    summary.inverseLineage.push({
      candidateId: c.id,
      candidateTitle: c.proposedTitle,
      candidateStatus: c.status,
      candidateSource: c.source ?? null,
      promotedProjectId: c.promotedProjectId ?? null,
      promotedProjectSlug: c.promotedProjectId ? projectSlugById.get(c.promotedProjectId) ?? null : null,
    });
    if (c.promotedProjectId) summary.lineageIntegrity.candidatesWithInverse++;
  }

  // Bidirectional integrity check — fast (O(N), all in-memory).
  const candidateById = new Map(candidateRows.map(c => [c.id, c]));
  const projectById = new Map(projectRows.map(p => [p.id, p]));
  for (const p of projectRows) {
    if (!p.sourceCandidateId) continue;
    summary.lineageIntegrity.promotedProjects++;
    const c = candidateById.get(p.sourceCandidateId);
    if (!c || c.promotedProjectId !== p.id) summary.lineageIntegrity.mismatches++;
  }
  // Inverse direction: every candidate.promotedProjectId must point at a
  // project whose source_candidate_id is that candidate (1-to-1 invariant).
  const promotionsByProjectId = new Map<string, number>();
  for (const c of candidateRows) {
    if (!c.promotedProjectId) continue;
    promotionsByProjectId.set(c.promotedProjectId, (promotionsByProjectId.get(c.promotedProjectId) ?? 0) + 1);
    const p = projectById.get(c.promotedProjectId);
    if (!p || p.sourceCandidateId !== c.id) summary.lineageIntegrity.inverseMismatches++;
  }
  // Uniqueness: any project claimed by 2+ candidates is a duplicate.
  for (const count of promotionsByProjectId.values()) {
    if (count > 1) summary.lineageIntegrity.duplicateCandidatePromotions += count - 1;
  }

  const user = (req as { localUser?: { id: string } }).localUser;
  req.log.info({ adminUser: user?.id }, "admin quality summary served");
  return res.json(summary);
});

export default router;
