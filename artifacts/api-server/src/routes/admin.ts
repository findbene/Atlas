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
import { projects, projectCandidates, userProgress } from "@workspace/db";
import { asc, sql } from "drizzle-orm";
import {
  ALL_COURSES,
  type AtlasCourseSlug, type Scorecard,
} from "@workspace/curriculum-quality";
import { pickStartHere, type StartHereCandidate } from "../lib/startHere";

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
    // Phase 13 — rubric calibration anchors. Flagged via `projects.is_anchor`
    // (see `backfill:phase13-anchor-flag`). Anchors are intentionally not
    // remediated and are excluded from `visibleThinStubs` so the headline
    // thin-stub metric reflects genuine remediation work only. The list is
    // expected to stay at exactly 2 (csv-to-postgres-pipeline + dbt-data-models)
    // for the lifetime of `RUBRIC_VERSION='1.0.1'`.
    anchorCount: 0,
    anchorSlugs: [] as string[],
    // Visible projects with <5 authored steps AND not flagged as an anchor.
    // This is the actionable thin-stub backlog; anchors are excluded above.
    visibleThinStubs: {
      count: 0,
      slugs: [] as Array<{ slug: string; course: AtlasCourseSlug; steps: number }>,
    },
    // Phase 12A — replace_candidate_slug pairs. For every project row that
    // declares it supersedes a legacy slug (via `replace_candidate_slug`),
    // surface the pair + whether the legacy row is currently hidden. Gives
    // ops a single-glance health view of the upgrade→archive lifecycle.
    legacyReplacements: {
      count: 0,
      pairs: [] as Array<{ upgradedSlug: string; legacySlug: string; legacyHidden: boolean }>,
    },
    // Phase 14 — read-only difficulty distribution across learner-visible
    // projects. Surfaces the beginner-tier lift (1 → 6 after P14) plus
    // per-course counts so a future underserved-tier review has a single
    // place to look. Counts include ONLY learner-visible rows.
    difficultyDistribution: {
      visible: {
        beginner: 0,
        intermediate: 0,
        advanced: 0,
      },
      visibleBeginnerSlugs: [] as Array<{ slug: string; course: AtlasCourseSlug }>,
      // Phase 15A — per-course difficulty grid across learner-visible rows.
      // Lets ops see at a glance which courses are advanced-heavy without
      // re-running `audit:difficulty`. Counts ONLY learner-visible rows.
      visibleByCourse: Object.fromEntries(
        ALL_COURSES.map(c => [c, { beginner: 0, intermediate: 0, advanced: 0 }]),
      ) as Record<AtlasCourseSlug, { beginner: number; intermediate: number; advanced: number }>,
      // Phase 15A — beginner-coverage-by-course: count of visible beginner
      // rows per course (zero-beginner courses are the Phase-15 follow-up
      // candidates per the Phase 14 close brief).
      beginnerCoverageByCourse: Object.fromEntries(
        ALL_COURSES.map(c => [c, 0]),
      ) as Record<AtlasCourseSlug, number>,
      // Phase 15A — read-only mismatch surface populated by the
      // `audit:difficulty-labels` heuristic. The admin route DOES NOT
      // re-run the audit; it surfaces the count + slug list when present
      // in `qualityBreakdown.difficultyAuditNote` (Phase 15B will wire a
      // live source). For Phase 15A the count is always 0 — the audit
      // report itself lives at `.local/phase15-difficulty-audit.json`.
      mismatchCount: 0,
      mismatchSlugs: [] as Array<{
        slug: string;
        course: AtlasCourseSlug | null;
        declared: "beginner" | "intermediate" | "advanced";
        suggested: "beginner" | "intermediate" | "advanced";
        reason: string;
      }>,
    },
    // Phase 20 — read-only Start Here coverage rider. Mirrors the same
    // `pickStartHere` rule the learner-facing `GET /api/courses/:slug`
    // route applies, but evaluated per course across all 9 courses so ops
    // can see in one glance which courses currently surface a true
    // beginner ("start_here") vs which still fall back to
    // "most_approachable_available". Computed in-process from the same
    // visible-row set used by `difficultyDistribution`. NEVER reads
    // `is_anchor`, never re-runs the audit, never calls heuristic course
    // inference. The frontend does NOT consume this surface — the
    // learner-facing `startHere` payload is computed inside the courses
    // route. This rider is for admin reporting only.
    startHereCoverage: {
      totalCourses: ALL_COURSES.length,
      withBeginner: 0,
      withFallback: 0,
      zeroBeginnerCourses: [] as AtlasCourseSlug[],
      startHereByCourse: Object.fromEntries(
        ALL_COURSES.map(c => [c, null]),
      ) as Record<
        AtlasCourseSlug,
        { kind: "start_here" | "most_approachable_available"; slug: string; reasonKey: "beginner_available" | "no_beginner_available" } | null
      >,
    },
  };

  // Phase-20 helper buckets: collect StartHereCandidate-shaped rows per
  // course as we iterate. Populated inside the main project loop below.
  const startHereCandidatesByCourse = Object.fromEntries(
    ALL_COURSES.map(c => [c, [] as StartHereCandidate[]]),
  ) as Record<AtlasCourseSlug, StartHereCandidate[]>;

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
    if (p.isAnchor === true) {
      summary.anchorCount++;
      summary.anchorSlugs.push(p.slug);
    }
    // Visible-thin-stubs surface: a learner-visible row with <5 authored
    // steps that is NOT a calibration anchor. Anchors are deliberately
    // 1-step demo content; excluding them prevents the metric from
    // permanently bottoming out at 2.
    if (p.learnerVisible !== false && p.isAnchor !== true && (p.totalSteps ?? 0) < 5) {
      summary.visibleThinStubs.count++;
      summary.visibleThinStubs.slugs.push({
        slug: p.slug,
        course,
        steps: p.totalSteps ?? 0,
      });
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
    // Phase 14 — difficulty distribution across visible rows only.
    // Phase 15A — also accrue per-course grid + beginner-coverage-by-course.
    if (p.learnerVisible !== false) {
      const d = p.difficultyLevel;
      if (d === "beginner" || d === "intermediate" || d === "advanced") {
        summary.difficultyDistribution.visible[d]++;
        // Defensive: course may be NULL on extremely-legacy rows. The
        // ALL_COURSES bucket pre-seed means we only accrue into known keys.
        if (course && course in summary.difficultyDistribution.visibleByCourse) {
          summary.difficultyDistribution.visibleByCourse[course][d]++;
        }
        if (d === "beginner") {
          summary.difficultyDistribution.visibleBeginnerSlugs.push({ slug: p.slug, course });
          if (course && course in summary.difficultyDistribution.beginnerCoverageByCourse) {
            summary.difficultyDistribution.beginnerCoverageByCourse[course]++;
          }
        }
      }
    }
    summary.lineage.push({
      slug: p.slug,
      course: (p.course as AtlasCourseSlug | null) ?? null,
      courseSource: p.courseSource ?? null,
      sourceCandidateId: p.sourceCandidateId ?? null,
      sourceCandidateTitle: p.sourceCandidateId ? candidateTitle.get(p.sourceCandidateId) ?? null : null,
    });
    // Phase 20 — accrue Start Here candidate rows. Same gate as the
    // courses route: learner_visible=true only. Anchors are NOT excluded
    // (the courses route doesn't exclude them either; pickStartHere is
    // purely a sort-and-rank helper over visible rows).
    if (p.learnerVisible !== false && course && course in startHereCandidatesByCourse) {
      startHereCandidatesByCourse[course].push({
        slug: p.slug,
        title: p.title ?? p.slug,
        difficulty: p.difficultyLevel ?? "intermediate",
        estimatedHours: (p.estimatedMinutes ?? 0) / 60,
        stepCount: p.totalSteps ?? 0,
      });
    }
  }

  // Phase 20 — fold per-course buckets through pickStartHere once each.
  for (const course of ALL_COURSES) {
    const bucket = startHereCandidatesByCourse[course];
    const result = pickStartHere(bucket);
    if (!result) continue;
    summary.startHereCoverage.startHereByCourse[course] = {
      kind: result.kind,
      slug: result.project.slug,
      reasonKey: result.reasonKey,
    };
    if (result.kind === "start_here") summary.startHereCoverage.withBeginner++;
    else {
      summary.startHereCoverage.withFallback++;
      summary.startHereCoverage.zeroBeginnerCourses.push(course);
    }
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

/**
 * Phase 34 — read-only mode-usage aggregate.
 *
 * Returns counts of `user_progress.learning_mode` across ALL enrollments
 * (so a single learner with 3 enrolled projects contributes 3 rows). The
 * payload is intentionally a flat aggregate with NO per-learner detail:
 *   - no user ids
 *   - no project ids/slugs
 *   - no joins to other tables
 *
 * Schema-free (reads an existing enum column). Admin-only.
 */
router.get("/api/admin/mode-usage", requireAdmin, async (req, res) => {
  type Row = { learning_mode: string; n: string | number };
  const result = await db.execute(sql`
    SELECT learning_mode, COUNT(*)::int AS n
    FROM ${userProgress}
    GROUP BY learning_mode
  `);
  const rows = result.rows as Row[];

  const byMode: Record<"guided" | "hint" | "independent" | "dynamic_ai_adaptive", number> = {
    guided: 0,
    hint: 0,
    independent: 0,
    dynamic_ai_adaptive: 0,
  };
  for (const row of rows) {
    const m = row.learning_mode as keyof typeof byMode;
    if (m in byMode) byMode[m] = Number(row.n);
  }
  const totalEnrollments = byMode.guided + byMode.hint + byMode.independent + byMode.dynamic_ai_adaptive;
  const pct = (n: number) =>
    totalEnrollments === 0 ? 0 : Math.round((n / totalEnrollments) * 1000) / 10;

  const adminUser = (req as { localUser?: { id: string } }).localUser;
  req.log.info({ adminUser: adminUser?.id, totalEnrollments }, "admin mode-usage served");

  return res.json({
    totalEnrollments,
    byMode,
    percentByMode: {
      guided: pct(byMode.guided),
      hint: pct(byMode.hint),
      independent: pct(byMode.independent),
      dynamic_ai_adaptive: pct(byMode.dynamic_ai_adaptive),
    },
  });
});

export default router;
