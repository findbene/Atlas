/**
 * Phase 6 — candidate batch dispatcher.
 *
 *   candidates-batch generate [--course=<slug>] [--count=10] [--all]
 *   candidates-batch import   <path-or-batchId> [--dry-run]
 *   candidates-batch score-batch <path-or-batchId>
 *   candidates-batch report   <path-or-batchId>
 *
 * - `generate` is deterministic (NO LLM call). It writes batch files to
 *   `.local/candidate-batches/` for human review BEFORE import.
 * - `import` validates with `proposalStrictSchema` and inserts rows with
 *   `status='candidate'`. Idempotent on `(proposed_title, proposed_course)`.
 * - `score-batch` scores every imported row from a batch via the same
 *   `composeScorecard(stage='candidate')` path used by `candidates score`.
 * - `report` emits a per-batch coverage + gate summary markdown.
 *
 * All approve/reject/revise transitions still go through the Phase-5
 * `candidates` dispatcher.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@workspace/db";
import { projectCandidates, type ProjectCandidate } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  composeScorecard, buildCorpus, nearestNeighbors, projectFingerprint,
  mapToCourse, generateBatch, generateAllCourses,
  RUBRIC_VERSION, COURSE_TAXONOMY_VERSION, ALL_COURSES,
  type AtlasCourseSlug,
} from "@workspace/curriculum-quality";
import { loadAllProjects, candidateRowToContext } from "./quality-adapter";
import {
  loadBatch, findBatchByIdOrPath, batchToJsonString, BATCH_DIR,
  type ValidatedBatch,
} from "./lib/batch";

type Args = { positional: string[]; flags: Record<string, string | boolean> };

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, ...vs] = a.slice(2).split("=");
      flags[k] = vs.length > 0 ? vs.join("=") : true;
    } else positional.push(a);
  }
  return { positional, flags };
}

async function ensureDir(d: string) {
  await fs.mkdir(d, { recursive: true });
}

// ─── generate ─────────────────────────────────────────────────────────────
async function cmdGenerate(args: Args) {
  await ensureDir(BATCH_DIR);
  const all = args.flags.all === true;
  const courseFlag = typeof args.flags.course === "string" ? args.flags.course : null;
  const count = typeof args.flags.count === "string" ? parseInt(args.flags.count, 10) : 10;

  const courses: AtlasCourseSlug[] = all
    ? [...ALL_COURSES]
    : courseFlag ? [courseFlag as AtlasCourseSlug] : [];

  if (courses.length === 0) {
    console.error("Usage: candidates-batch generate (--all | --course=<slug>) [--count=10]");
    process.exit(1);
  }
  for (const c of courses) {
    if (!(ALL_COURSES as readonly string[]).includes(c)) {
      console.error(`Unknown course: ${c}. Known: ${ALL_COURSES.join(", ")}`);
      process.exit(1);
    }
  }

  const batches = all
    ? generateAllCourses({ rubricVersion: RUBRIC_VERSION, taxonomyVersion: COURSE_TAXONOMY_VERSION })
    : courses.map(course => generateBatch({
        course, count, rubricVersion: RUBRIC_VERSION, taxonomyVersion: COURSE_TAXONOMY_VERSION,
      }));

  for (const b of batches) {
    const file = path.join(BATCH_DIR, `${b.batchId}.json`);
    await fs.writeFile(file, batchToJsonString(b), "utf8");
    console.log(`wrote ${file}  (${b.candidates.length} candidates, mix=${JSON.stringify(b.difficultyMix)})`);
  }
}

// ─── import ───────────────────────────────────────────────────────────────
async function cmdImport(args: Args) {
  const target = args.positional[0];
  if (!target) { console.error("Usage: candidates-batch import <path-or-batchId> [--dry-run]"); process.exit(1); }
  const dryRun = args.flags["dry-run"] === true;

  const filePath = await findBatchByIdOrPath(target);
  const batch = await loadBatch(filePath);
  console.log(`Loaded ${batch.candidates.length} candidates from ${filePath} (batchId=${batch.batchId})`);

  if (dryRun) {
    for (const c of batch.candidates) {
      console.log(`  [dry-run] ${c.difficulty.padEnd(12)} ${c.proposedTitle}`);
    }
    console.log(`dry-run OK — ${batch.candidates.length} candidates would be inserted.`);
    return;
  }

  // Single transaction per batch (≤10 rows). Idempotent on (title, course):
  // re-importing the same batch does not duplicate rows. We use a raw
  // pre-check because there's no unique constraint we want to add at the
  // schema level — different batches may legitimately ship variants of the
  // same title in the future.
  const inserted: string[] = [];
  const skipped: string[] = [];
  await db.transaction(async (tx) => {
    for (const c of batch.candidates) {
      const existing = await tx.select({ id: projectCandidates.id })
        .from(projectCandidates)
        .where(and(
          eq(projectCandidates.proposedTitle, c.proposedTitle),
          eq(projectCandidates.proposedCourse, c.proposedCourse),
        ));
      if (existing.length > 0) {
        skipped.push(c.proposedTitle);
        continue;
      }
      const [row] = await tx.insert(projectCandidates).values({
        proposedTitle: c.proposedTitle,
        proposedCourse: c.proposedCourse,
        targetRoles: c.targetRoles,
        difficulty: c.difficulty,
        proposedStack: c.proposedStack,
        proposal: c.proposal as unknown as object,
        status: "candidate",
      }).returning({ id: projectCandidates.id });
      inserted.push(row.id);
    }
  });
  console.log(`Imported ${inserted.length} new, skipped ${skipped.length} duplicate(s).`);
  if (skipped.length > 0) {
    for (const s of skipped) console.log(`  • skipped (already present): ${s}`);
  }
}

// ─── score-batch ──────────────────────────────────────────────────────────
type ScoreResult = {
  id: string;
  title: string;
  course: AtlasCourseSlug;
  difficulty: string;
  overall: number;
  duplicateWarning: boolean;
  recommendedStatus: string;
};

async function scoreBatchCore(batch: ValidatedBatch): Promise<ScoreResult[]> {
  // Load production-project corpus once so all batch rows score against the
  // same neighbor set (otherwise per-row scoring would re-load the entire
  // projects table N times for a 10-row batch).
  const loaded = await loadAllProjects(mapToCourse);
  const corpus = buildCorpus(loaded.map(l => ({ project: l.input, steps: l.steps })));

  const titles = batch.candidates.map((c: { proposedTitle: string }) => c.proposedTitle);
  const rows = await db.select().from(projectCandidates).where(
    eq(projectCandidates.proposedCourse, batch.course),
  );
  const byTitle = new Map(rows.filter(r => titles.includes(r.proposedTitle)).map(r => [r.proposedTitle, r]));
  const out: ScoreResult[] = [];

  // Single transaction so all writes succeed atomically.
  await db.transaction(async (tx) => {
    for (const c of batch.candidates) {
      const row = byTitle.get(c.proposedTitle);
      if (!row) {
        console.warn(`  ⚠ skipping unimported candidate: ${c.proposedTitle}`);
        continue;
      }
      const ctx = candidateRowToContext(row as ProjectCandidate);
      const fp = projectFingerprint(ctx.input, ctx.steps);
      const neighbors = nearestNeighbors({ slug: ctx.input.slug, fingerprint: fp }, corpus, 3);
      const card = composeScorecard(ctx.input, { steps: ctx.steps, neighbors, stage: "candidate" });
      await tx.update(projectCandidates).set({
        qualityScore: card.overall.toFixed(2),
        qualityBreakdown: card as unknown as object,
        duplicateCandidates: neighbors as unknown as object,
        updatedAt: new Date(),
      }).where(eq(projectCandidates.id, row.id));
      out.push({
        id: row.id,
        title: row.proposedTitle,
        course: row.proposedCourse as AtlasCourseSlug,
        difficulty: row.difficulty,
        overall: card.overall,
        duplicateWarning: card.duplicateWarning,
        recommendedStatus: card.recommendedStatus,
      });
    }
  });
  return out;
}

function summariseScores(results: ScoreResult[]) {
  if (results.length === 0) {
    console.log("(no rows scored)");
    return;
  }
  const sorted = [...results].sort((a, b) => b.overall - a.overall);
  const median = sorted[Math.floor(sorted.length / 2)].overall;
  const ge60 = results.filter(r => r.overall >= 60).length;
  const ge70 = results.filter(r => r.overall >= 70).length;
  const dup = results.filter(r => r.duplicateWarning).length;
  console.log("");
  console.log("=".repeat(72));
  console.log(`Scored ${results.length}  median=${median}  ≥60=${ge60}  ≥70=${ge70}  dup-flag=${dup} (${((dup / results.length) * 100).toFixed(0)}%)`);
  console.log("Top 3:");
  for (const r of sorted.slice(0, 3))
    console.log(`  ${String(r.overall).padStart(5)}  ${r.title}`);
  console.log("Bottom 3:");
  for (const r of sorted.slice(-3))
    console.log(`  ${String(r.overall).padStart(5)}  ${r.title}`);
}

async function cmdScoreBatch(args: Args) {
  const target = args.positional[0];
  if (!target) { console.error("Usage: candidates-batch score-batch <path-or-batchId>"); process.exit(1); }
  const filePath = await findBatchByIdOrPath(target);
  const batch = await loadBatch(filePath);
  const results = await scoreBatchCore(batch);
  summariseScores(results);
}

// ─── report ───────────────────────────────────────────────────────────────
async function cmdReport(args: Args) {
  const target = args.positional[0];
  if (!target) { console.error("Usage: candidates-batch report <path-or-batchId>"); process.exit(1); }
  const filePath = await findBatchByIdOrPath(target);
  const batch = await loadBatch(filePath);

  // Pull current DB rows for this batch (titles + course) to read live scores.
  const titles = batch.candidates.map((c: { proposedTitle: string }) => c.proposedTitle);
  const rows = await db.select().from(projectCandidates).where(
    eq(projectCandidates.proposedCourse, batch.course),
  );
  const live = rows.filter(r => titles.includes(r.proposedTitle));

  const lines: string[] = [];
  lines.push(`# Batch report: ${batch.batchId}`);
  lines.push("");
  lines.push(`- Course: \`${batch.course}\``);
  lines.push(`- Rubric: \`${batch.rubricVersion}\``);
  lines.push(`- Generated by: \`${batch.generatedBy}\``);
  lines.push(`- Candidates declared in batch: ${batch.candidates.length}`);
  lines.push(`- Candidates currently in DB: ${live.length}`);
  lines.push("");
  lines.push("## Difficulty mix");
  const mix: Record<string, number> = {};
  for (const c of batch.candidates) mix[c.difficulty] = (mix[c.difficulty] ?? 0) + 1;
  for (const [k, v] of Object.entries(mix)) lines.push(`- ${k}: ${v}`);
  lines.push("");
  lines.push("## Per-candidate status");
  lines.push("");
  lines.push("| difficulty | score | dup? | title |");
  lines.push("|------------|-------|------|-------|");
  for (const c of batch.candidates) {
    const r = live.find(x => x.proposedTitle === c.proposedTitle);
    const score = r?.qualityScore ?? "—";
    const dup = (r?.duplicateCandidates as unknown[] | null)?.length ?? 0;
    lines.push(`| ${c.difficulty} | ${score} | ${dup > 0 ? "⚠ " + dup : "—"} | ${c.proposedTitle} |`);
  }
  lines.push("");

  const reportFile = `.local/catalog-batch-report-${batch.batchId}.md`;
  await fs.writeFile(reportFile, lines.join("\n") + "\n", "utf8");
  console.log(`wrote ${reportFile}`);
}

// ─── main ─────────────────────────────────────────────────────────────────
async function main() {
  // pnpm forwards `-- generate --all` literally, so strip a leading `--`.
  const argv = process.argv.slice(2).filter((a, i) => !(i === 0 && a === "--"));
  const [sub, ...rest] = argv;
  const args = parseArgs(rest);
  switch (sub) {
    case "generate": await cmdGenerate(args); break;
    case "import": await cmdImport(args); break;
    case "score-batch": await cmdScoreBatch(args); break;
    case "report": await cmdReport(args); break;
    default:
      console.log("Usage: candidates-batch <generate|import|score-batch|report> [args]");
      process.exit(1);
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
