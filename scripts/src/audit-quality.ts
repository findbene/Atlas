/**
 * Phase 5 — audit:quality
 *
 * Scores every project (and every candidate) against the rubric, writes the
 * scores back to the DB, and prints a per-row scorecard + summary.
 */
import { db } from "@workspace/db";
import { projects, projectCandidates } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  composeScorecard, buildCorpus, nearestNeighbors, projectFingerprint,
  mapToCourse, RUBRIC_VERSION, mergeQualityBreakdown,
} from "@workspace/curriculum-quality";
import { loadAllProjects, loadAllCandidates, candidateRowToContext } from "./quality-adapter";

async function main() {
  const loaded = await loadAllProjects(mapToCourse);
  const corpus = buildCorpus(loaded.map(l => ({ project: l.input, steps: l.steps })));
  const candidates = await loadAllCandidates();

  console.log(`\nAtlas Quality Audit — rubric v${RUBRIC_VERSION}`);
  console.log(`Projects: ${loaded.length}   Candidates: ${candidates.length}`);
  console.log("=".repeat(72));

  const projectScores: Array<{ slug: string; overall: number; status: string; warn: boolean }> = [];

  for (const l of loaded) {
    const fp = projectFingerprint(l.input, l.steps);
    const neighbors = nearestNeighbors({ slug: l.input.slug, fingerprint: fp }, corpus, 3);
    const card = composeScorecard(l.input, { steps: l.steps, neighbors });

    // Phase 17 — merge via the canonical helper so we never strip
    // authoredMeta + portfolioArtifact (written by promote()).
    await db.update(projects).set({
      qualityScore: card.overall.toFixed(2),
      qualityBreakdown: mergeQualityBreakdown(
        l.raw.qualityBreakdown as Record<string, unknown> | null,
        card as unknown as Record<string, unknown>,
      ) as unknown as object,
      lastQualityAuditAt: new Date(),
    }).where(eq(projects.id, l.raw.id));

    projectScores.push({ slug: l.input.slug, overall: card.overall, status: card.recommendedStatus, warn: card.duplicateWarning });
    const flag = card.duplicateWarning ? " !DUP" : "";
    console.log(`${l.input.slug.padEnd(40)} ${String(card.overall).padStart(5)}  ${card.recommendedStatus.padEnd(15)}${flag}`);
  }

  if (candidates.length > 0) {
    console.log("\nCandidates:");
    for (const c of candidates) {
      const ctx = candidateRowToContext(c);
      const fp = projectFingerprint(ctx.input, ctx.steps);
      const neighbors = nearestNeighbors({ slug: ctx.input.slug, fingerprint: fp }, corpus, 3);
      const card = composeScorecard(ctx.input, { steps: ctx.steps, neighbors, stage: "candidate" });
      await db.update(projectCandidates).set({
        qualityScore: card.overall.toFixed(2),
        qualityBreakdown: card as unknown as object,
        duplicateCandidates: neighbors as unknown as object,
        updatedAt: new Date(),
      }).where(eq(projectCandidates.id, c.id));
      console.log(`${c.proposedTitle.padEnd(40)} ${String(card.overall).padStart(5)}  ${card.recommendedStatus}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log("SUMMARY");
  const buckets = { approved: 0, candidate: 0, needs_revision: 0 };
  for (const s of projectScores) buckets[s.status as keyof typeof buckets]++;
  console.log(`  By recommended status: approved=${buckets.approved}  candidate=${buckets.candidate}  needs_revision=${buckets.needs_revision}`);
  const histogram = [0, 0, 0, 0, 0];
  for (const s of projectScores) {
    const idx = Math.min(4, Math.floor(s.overall / 20));
    histogram[idx]++;
  }
  console.log(`  Score histogram: 0-20:${histogram[0]}  20-40:${histogram[1]}  40-60:${histogram[2]}  60-80:${histogram[3]}  80-100:${histogram[4]}`);

  const weakest = [...projectScores].sort((a, b) => a.overall - b.overall).slice(0, 10);
  console.log("\n  Top 10 weakest:");
  for (const w of weakest) console.log(`    ${String(w.overall).padStart(5)}  ${w.slug}`);

  const dupes = projectScores.filter(s => s.warn);
  if (dupes.length > 0) {
    console.log(`\n  Duplicate warnings (${dupes.length}):`);
    for (const d of dupes) console.log(`    !DUP  ${d.slug}`);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
