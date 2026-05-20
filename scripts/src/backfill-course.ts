/**
 * Phase 8 — one-shot backfill for the new native taxonomy columns:
 *   - tracks.is_primary           : flip the first track per domain
 *   - projects.course             : enum
 *   - projects.course_source      : 'authored' | 'heuristic_legacy'
 *   - projects.source_candidate_id: FK → project_candidates.id
 *
 * Idempotent: re-running won't change rows that already have the right
 * values. Safe to invoke before flipping the columns to NOT NULL.
 *
 *   pnpm --filter @workspace/scripts run backfill:course
 */
import { db } from "@workspace/db";
import { projects, tracks, domains } from "@workspace/db";
import { asc, eq, and, isNull } from "drizzle-orm";
import { mapToCourse, type AtlasCourseSlug } from "@workspace/curriculum-quality";
import { COURSE_FOR_AUTHORED_SLUG, CANDIDATE_FOR_AUTHORED_SLUG } from "./authored-lineage";

async function backfillPrimaryTracks(): Promise<void> {
  const domainRows = await db.select().from(domains);
  for (const d of domainRows) {
    const existing = await db.select().from(tracks)
      .where(and(eq(tracks.domainId, d.id), eq(tracks.isPrimary, true)));
    if (existing.length > 0) {
      console.log(`[tracks] domain=${d.slug}: primary already set (${existing.length})`);
      continue;
    }
    const candidate = await db.select().from(tracks)
      .where(eq(tracks.domainId, d.id))
      .orderBy(asc(tracks.orderIndex))
      .limit(1);
    if (candidate.length === 0) {
      console.warn(`[tracks] domain=${d.slug}: no tracks — skipping`);
      continue;
    }
    await db.update(tracks).set({ isPrimary: true }).where(eq(tracks.id, candidate[0].id));
    console.log(`[tracks] domain=${d.slug}: marked primary track=${candidate[0].slug}`);
  }
}

async function backfillCourse(): Promise<void> {
  const domainRows = await db.select({ id: domains.id, slug: domains.slug }).from(domains);
  const domainSlug = new Map(domainRows.map(d => [d.id, d.slug]));
  const trackRows = await db.select({ id: tracks.id, slug: tracks.slug }).from(tracks);
  const trackSlug = new Map(trackRows.map(t => [t.id, t.slug]));

  const projectRows = await db.query.projects.findMany();
  let authoredCount = 0, legacyCount = 0, skipped = 0;

  for (const p of projectRows) {
    const authoredCourse = COURSE_FOR_AUTHORED_SLUG[p.slug] as AtlasCourseSlug | undefined;
    const candidateId = CANDIDATE_FOR_AUTHORED_SLUG[p.slug] ?? null;

    let course: AtlasCourseSlug;
    let courseSource: "authored" | "heuristic_legacy";
    let sourceCandidateId: string | null = p.sourceCandidateId ?? null;

    if (authoredCourse) {
      course = authoredCourse;
      courseSource = "authored";
      if (candidateId && !sourceCandidateId) sourceCandidateId = candidateId;
    } else {
      course = mapToCourse({
        domainSlug: domainSlug.get(p.domainId) ?? null,
        trackSlug: trackSlug.get(p.trackId) ?? null,
        tags: p.tags,
        techStack: p.techStack,
      });
      courseSource = "heuristic_legacy";
    }

    const noChange = p.course === course
      && p.courseSource === courseSource
      && (p.sourceCandidateId ?? null) === sourceCandidateId;
    if (noChange) { skipped++; continue; }

    await db.update(projects).set({
      course,
      courseSource,
      sourceCandidateId,
    }).where(eq(projects.id, p.id));

    if (courseSource === "authored") authoredCount++; else legacyCount++;
  }
  console.log(`[course] updated authored=${authoredCount} legacy=${legacyCount} skipped=${skipped} total=${projectRows.length}`);

  // Verify no nulls remain — required before pushing NOT NULL.
  const nullsRemaining = await db.select({ id: projects.id, slug: projects.slug }).from(projects).where(isNull(projects.course));
  if (nullsRemaining.length > 0) {
    console.error(`[course] ${nullsRemaining.length} rows still have NULL course:`, nullsRemaining.map(r => r.slug));
    process.exit(1);
  }
  console.log(`[course] all ${projectRows.length} rows have non-null course ✓`);
}

async function main(): Promise<void> {
  await backfillPrimaryTracks();
  await backfillCourse();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
