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
  ALL_COURSES, mapToCourse, normalizeStackToken, tierOf,
  type AtlasCourseSlug, type Scorecard,
} from "@workspace/curriculum-quality";

const router = Router();

router.get("/api/admin/quality", requireAdmin, async (req, res) => {
  const projectRows = await db.query.projects.findMany({ orderBy: [asc(projects.orderIndex)] });
  const candidateRows = await db.query.projectCandidates.findMany();

  // Build candidateId → proposedTitle lookup so we can show lineage labels
  // without an extra round-trip per project.
  const candidateTitle = new Map(candidateRows.map(c => [c.id, c.proposedTitle]));

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
  };

  for (const p of projectRows) {
    summary.statusFunnel[p.qualityStatus]++;
    // Phase 8 — prefer the native column; only fall back to heuristic for
    // rows that haven't been backfilled yet (should be zero post-backfill).
    const course = (p.course as AtlasCourseSlug | null) ?? mapToCourse({ tags: p.tags, techStack: p.techStack });
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
  }

  const user = (req as { localUser?: { id: string } }).localUser;
  req.log.info({ adminUser: user?.id }, "admin quality summary served");
  return res.json(summary);
});

export default router;
// silence unused-import lint
void normalizeStackToken; void tierOf;
