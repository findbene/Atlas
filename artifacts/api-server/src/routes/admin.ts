/**
 * Phase 5 — thin read-only admin endpoint.
 *
 *   GET /api/admin/quality
 *
 * Returns a JSON summary identical in shape to the `catalog:report` JSON
 * output, computed on demand from the DB. No UI in this phase.
 *
 * Auth: requireAuth + role === 'admin'.
 */
import { Router } from "express";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { db } from "@workspace/db";
import { projects, projectCandidates } from "@workspace/db";
import { asc } from "drizzle-orm";
import {
  ALL_COURSES, mapToCourse, normalizeStackToken, tierOf,
  type AtlasCourseSlug, type Scorecard,
} from "@workspace/curriculum-quality";

const router = Router();

router.get("/api/admin/quality", requireAuth, async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "admin role required" });
  }

  const projectRows = await db.query.projects.findMany({ orderBy: [asc(projects.orderIndex)] });
  const candidateRows = await db.query.projectCandidates.findMany();

  // We don't need full step loading for the summary; map course from project metadata.
  const summary = {
    rubricVersion: (projectRows[0]?.qualityBreakdown as Scorecard | null)?.rubricVersion ?? null,
    totals: { projects: projectRows.length, candidates: candidateRows.length },
    statusFunnel: { unreviewed: 0, approved: 0, needs_revision: 0, rejected: 0 },
    candidateStatusFunnel: { candidate: 0, approved: 0, needs_revision: 0, rejected: 0 },
    courseDistribution: Object.fromEntries(ALL_COURSES.map(c => [c, 0])) as Record<AtlasCourseSlug, number>,
    duplicateWarnings: [] as Array<{ slug: string; nearest: string; similarity: number }>,
    scoreHistogram: [0, 0, 0, 0, 0],
    weakest: [] as Array<{ slug: string; score: number; status: string }>,
  };

  for (const p of projectRows) {
    summary.statusFunnel[p.qualityStatus]++;
    const course = mapToCourse({ tags: p.tags, techStack: p.techStack });
    summary.courseDistribution[course]++;
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
  }

  summary.weakest = projectRows
    .map(p => ({ slug: p.slug, score: (p.qualityBreakdown as Scorecard | null)?.overall ?? 0, status: p.qualityStatus }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);

  for (const c of candidateRows) {
    summary.candidateStatusFunnel[c.status]++;
  }

  req.log.info({ adminUser: user.id }, "admin quality summary served");
  return res.json(summary);
});

export default router;
// silence unused-import lint
void normalizeStackToken; void tierOf;
