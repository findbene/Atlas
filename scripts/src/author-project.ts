/**
 * Phase 7 — author-project CLI.
 *
 * Subcommands:
 *   promote <slug>            Upsert an authored module from scripts/src/authored/ into the DB.
 *   audit   <slug>            Score the live DB project against the full rubric (stage=authored).
 *   wave-report               Aggregate audit for every Phase-7 authored slug.
 *   anchor-check              Verify csv-to-postgres-pipeline + dbt-data-models are within ±1 of calibration.
 *
 * All paths resolve against `INIT_CWD || cwd` so `pnpm --filter` from any
 * subdirectory works the same way.
 */
import { db } from "@workspace/db";
import {
  projects, projectSteps, projectCandidates, domains, tracks,
  type Project,
} from "@workspace/db";
import type { AtlasCourseSlug } from "@workspace/curriculum-quality";

type NewProject = typeof projects.$inferInsert;
type NewProjectStep = typeof projectSteps.$inferInsert;
import { and, eq } from "drizzle-orm";
import {
  composeScorecard, buildCorpus, nearestNeighbors, projectFingerprint,
  mapToCourse, assertAuthoredProjectComplete,
  type AuthoredProject, type Scorecard,
} from "@workspace/curriculum-quality";
import { loadAllProjects, projectRowToInput } from "./quality-adapter";
import { AUTHORED_PROJECTS, findAuthored } from "./authored";
import {
  COURSE_FOR_AUTHORED_SLUG,
  COURSE_TO_DOMAIN_SLUG,
  COURSE_TO_TRACK_SLUG,
} from "./authored-lineage";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.INIT_CWD || process.cwd();
const REPORT_DIR = path.join(ROOT, ".local");

// ── helpers ─────────────────────────────────────────────────────────────────

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  return await db.query.projects.findFirst({ where: eq(projects.slug, slug) });
}

async function resolveDomainAndTrack(authoredSlug: string): Promise<{ domainId: string; trackId: string; course: AtlasCourseSlug; domainSlug: string; trackSlug: string }> {
  const course = COURSE_FOR_AUTHORED_SLUG[authoredSlug];
  if (!course) fail(`No COURSE_FOR_AUTHORED_SLUG entry for '${authoredSlug}' — add one in scripts/src/authored-lineage.ts.`);
  const domainSlug = COURSE_TO_DOMAIN_SLUG[course];
  const trackSlug = COURSE_TO_TRACK_SLUG[course];
  const dRow = await db.select({ id: domains.id }).from(domains).where(eq(domains.slug, domainSlug)).limit(1);
  if (!dRow[0]) fail(`Domain '${domainSlug}' not found in DB. Seed domains first.`);
  // Phase 8 — canonical track lookup uses the explicit course→track map.
  // Validates is_primary as a DB backstop but falls back to the slug-only
  // match so we don't break promotes if the backfill hasn't run yet.
  const tRow = await db.select({ id: tracks.id, isPrimary: tracks.isPrimary })
    .from(tracks)
    .where(and(eq(tracks.domainId, dRow[0].id), eq(tracks.slug, trackSlug)))
    .limit(1);
  if (!tRow[0]) fail(`Track '${trackSlug}' not found under domain '${domainSlug}'. Add it to seed or update COURSE_TO_TRACK_SLUG.`);
  return { domainId: dRow[0].id, trackId: tRow[0].id, course, domainSlug, trackSlug };
}

async function auditProjectRow(row: Project): Promise<Scorecard> {
  const loaded = await loadAllProjects(mapToCourse);
  const corpus = buildCorpus(loaded.map(l => ({ project: l.input, steps: l.steps })));
  const me = loaded.find(l => l.raw.id === row.id);
  if (!me) fail(`Project ${row.slug} loaded but missing from loadAllProjects output.`);
  const fp = projectFingerprint(me.input, me.steps);
  const neighbors = nearestNeighbors({ slug: me.input.slug, fingerprint: fp }, corpus, 3);
  return composeScorecard(me.input, { steps: me.steps, neighbors, stage: "authored" });
}

function printScorecard(slug: string, card: Scorecard): void {
  const pass = card.overall >= 70 ? "PASS" : "FAIL";
  console.log(`\n[${pass}]  ${slug}  ${card.overall}  (${card.recommendedStatus})`);
  for (const [k, dim] of Object.entries(card.dimensions)) {
    console.log(`  ${k.padEnd(20)} ${String(dim.score).padStart(3)}   gaps: ${dim.gaps.length}  signals: ${dim.signals.length}`);
  }
  for (const [k, dim] of Object.entries(card.dimensions)) {
    if (dim.gaps.length > 0) {
      console.log(`  GAPS [${k}]`);
      for (const g of dim.gaps) console.log(`    - ${g}`);
    }
  }
}

// ── promote ─────────────────────────────────────────────────────────────────

async function promote(slug: string): Promise<void> {
  const authored = findAuthored(slug);
  if (!authored) fail(`No authored module found for slug '${slug}' in scripts/src/authored/.`);
  assertAuthoredProjectComplete(authored);

  const { domainId, trackId, course, domainSlug } = await resolveDomainAndTrack(slug);
  const existing = await getProjectBySlug(slug);

  const projectFields: NewProject = {
    trackId,
    domainId,
    slug: authored.slug,
    title: authored.title,
    shortDescription: authored.shortDescription,
    fullDescription: authored.fullDescription,
    difficultyLevel: authored.difficulty,
    estimatedMinutes: authored.estimatedMinutes,
    techStack: authored.techStack,
    learningObjectives: authored.learningObjectives,
    prerequisites: [],
    orderIndex: existing?.orderIndex ?? 9999,
    isPremium: false,
    language: authored.language,
    isMultiFile: authored.isMultiFile,
    isWalkthroughOnly: false,
    totalSteps: authored.steps.length,
    tags: authored.tags,
    xpReward: authored.xpReward,
    qualityStatus: existing?.qualityStatus ?? "unreviewed",
    // Phase 17 — merge instead of overwrite. `audit --commit` writes
    // Scorecard fields here; `promote` writes authoredMeta + portfolioArtifact.
    // Both readers (catalog-report / admin route as Scorecard, quality-adapter
    // for portfolioArtifact) must continue to find their respective fields,
    // so we preserve whatever was already there and layer authoring on top.
    qualityBreakdown: {
      ...((existing?.qualityBreakdown as object | null) ?? {}),
      authoredMeta: authored.meta,
      portfolioArtifact: authored.portfolio,
    } as unknown as object,
    // Phase 8 — native taxonomy + lineage stamped on every promote.
    course,
    courseSource: "authored",
    sourceCandidateId: authored.candidateId,
  };

  await db.transaction(async (tx) => {
    let projectId: string;
    if (existing) {
      await tx.update(projects).set(projectFields).where(eq(projects.id, existing.id));
      projectId = existing.id;
      await tx.delete(projectSteps).where(eq(projectSteps.projectId, existing.id));
    } else {
      const inserted = await tx.insert(projects).values(projectFields).returning({ id: projects.id });
      projectId = inserted[0].id;
    }

    // Phase 9 — stamp inverse lineage in the same transaction. Hard-fail
    // (rolls back) if the candidate row doesn't exist OR if more than one
    // matched — silent zero/multi updates would corrupt lineage.
    const stamped = await tx.update(projectCandidates)
      .set({ promotedProjectId: projectId, updatedAt: new Date() })
      .where(eq(projectCandidates.id, authored.candidateId))
      .returning({ id: projectCandidates.id });
    if (stamped.length !== 1) {
      throw new Error(
        `promote: inverse-lineage stamp expected exactly 1 candidate row for ` +
        `candidateId=${authored.candidateId} (slug=${authored.slug}), got ${stamped.length}. ` +
        `Aborting transaction.`,
      );
    }

    const stepRows: NewProjectStep[] = authored.steps.map(s => ({
      projectId,
      stepNumber: s.stepNumber,
      title: s.title,
      instructionMd: s.instructionMd,
      validationType: s.validationType,
      validationConfig: s.validation as unknown as object,
      starterCode: s.starterCode,
      type: s.stepType,
      expectedOutputs: s.expectedOutputs as unknown as object,
      datasetRefs: s.datasetRefs && s.datasetRefs.length > 0
        ? (s.datasetRefs as unknown as object)
        : null,
      learningObjective: s.learningObjective,
      requiredSkill: s.requiredSkill,
      pedagogyConfig: s.pedagogy as unknown as object,
      xpReward: Math.round(authored.xpReward / authored.steps.length),
    }));
    await tx.insert(projectSteps).values(stepRows);
  });

  console.log(`[promote] ${slug}  course=${course}  domain=${domainSlug}  steps=${authored.steps.length}  (${existing ? "updated" : "inserted"})`);
}

// ── audit ───────────────────────────────────────────────────────────────────

async function audit(slug: string, commit: boolean): Promise<Scorecard> {
  const row = await getProjectBySlug(slug);
  if (!row) fail(`Project '${slug}' not in DB. Run 'promote ${slug}' first.`);
  const card = await auditProjectRow(row);
  printScorecard(slug, card);
  if (commit) {
    const newStatus = card.overall >= 70 ? "approved" : row.qualityStatus;
    // Atomic CAS — only flip if still unreviewed.
    const updated = await db.update(projects).set({
      qualityScore: card.overall.toFixed(2),
      // Phase 17 — merge, preserving authoredMeta + portfolioArtifact written
      // by promote(). Overwriting strips those fields and demotes the
      // portfolio scorer back to keyword inference on the next wave-report
      // (this was the root cause of the Phase 16 47/50 regression).
      qualityBreakdown: {
        ...((row.qualityBreakdown as object | null) ?? {}),
        ...(card as unknown as object),
      } as unknown as object,
      lastQualityAuditAt: new Date(),
      qualityStatus: newStatus,
    }).where(and(eq(projects.id, row.id), eq(projects.qualityStatus, row.qualityStatus)))
      .returning({ id: projects.id });
    if (updated.length === 0) {
      fail(`[audit --commit] ${slug}: concurrent status change since read; aborting.`);
    }
    console.log(`[audit --commit] ${slug} qualityScore=${card.overall} status=${newStatus}`);
  }
  return card;
}

// ── anchor-check ────────────────────────────────────────────────────────────

const ANCHOR_TARGETS: Record<string, number> = {
  "csv-to-postgres-pipeline": 70.5,
  "dbt-data-models": 72.7,
};

async function anchorCheck(): Promise<void> {
  let bad = 0;
  for (const [slug, target] of Object.entries(ANCHOR_TARGETS)) {
    const row = await getProjectBySlug(slug);
    if (!row) { console.warn(`[anchor] ${slug}: not in DB, skipping`); continue; }
    const card = await auditProjectRow(row);
    const drift = Math.abs(card.overall - target);
    const ok = drift <= 1.0;
    console.log(`[anchor] ${slug}  scored=${card.overall}  target=${target}  drift=${drift.toFixed(2)}  ${ok ? "OK" : "DRIFT"}`);
    if (!ok) bad++;
  }
  if (bad > 0) fail(`${bad} anchor(s) drifted > ±1.0 — investigate before continuing Phase 7.`);
  console.log("[anchor] all anchors within ±1.0 ✓");
}

// ── wave-report ─────────────────────────────────────────────────────────────

type WaveRow = {
  slug: string;
  /** Authoritative Phase-7 course intent (from COURSE_FOR_AUTHORED_SLUG). */
  intendedCourse: AtlasCourseSlug;
  /** Native `projects.course` value as stamped by promote (Phase 8). */
  dbCourse: AtlasCourseSlug | null;
  courseSource: "authored" | "heuristic_legacy" | null;
  sourceCandidateId: string | null;
  overall: number;
  dimensions: Record<string, number>;
  pedagogyComplete: boolean;
  validationCoverage: number;
  portfolioReady: boolean;
};

async function waveReport(): Promise<void> {
  if (AUTHORED_PROJECTS.length === 0) {
    console.warn("[wave-report] AUTHORED_PROJECTS is empty — no Phase-7 modules registered yet.");
    return;
  }
  const loaded = await loadAllProjects(mapToCourse);
  const corpus = buildCorpus(loaded.map(l => ({ project: l.input, steps: l.steps })));
  const rows: WaveRow[] = [];

  for (const authored of AUTHORED_PROJECTS) {
    const me = loaded.find(l => l.raw.slug === authored.slug);
    if (!me) {
      console.warn(`[wave-report] ${authored.slug}: not in DB — skipping (run promote first).`);
      continue;
    }
    const fp = projectFingerprint(me.input, me.steps);
    const neighbors = nearestNeighbors({ slug: me.input.slug, fingerprint: fp }, corpus, 3);
    const card = composeScorecard(me.input, { steps: me.steps, neighbors, stage: "authored" });
    const validationSteps = me.steps.filter(s => {
      const v = s as { validationType?: string };
      return !!v.validationType && v.validationType !== "self_attest";
    }).length;
    const allPedagogy = me.steps.every(s => {
      const cfg = s.pedagogyConfig;
      return cfg && cfg.hintLevel1 && cfg.hintLevel5 && cfg.successFeedback && cfg.failureFeedback && cfg.portfolioRelevance;
    });
    const intendedCourse = COURSE_FOR_AUTHORED_SLUG[authored.slug];
    rows.push({
      slug: authored.slug,
      intendedCourse,
      dbCourse: (me.raw.course as AtlasCourseSlug | null) ?? null,
      courseSource: me.raw.courseSource ?? null,
      sourceCandidateId: me.raw.sourceCandidateId ?? null,
      overall: card.overall,
      dimensions: Object.fromEntries(Object.entries(card.dimensions).map(([k, d]) => [k, d.score])),
      pedagogyComplete: allPedagogy,
      validationCoverage: me.steps.length === 0 ? 0 : validationSteps / me.steps.length,
      portfolioReady: !!authored.portfolio.portfolioRelevance,
    });
  }

  const passed = rows.filter(r => r.overall >= 70).length;
  const md: string[] = [
    "# Phase 7 — Wave Report (Phase-8 refresh)",
    "",
    `Total authored: ${rows.length}   Passing ≥70: ${passed}/${rows.length}`,
    "",
    "Course is now sourced from `projects.course` (native Phase-8 column).",
    "Lineage column shows the FK back to `project_candidates.id`.",
    "",
    "| Slug | Course | Source | Candidate FK | Overall | Job | Realism | Depth | Pedagogy | Portfolio | Unique | Ped✓ | Val% | Port✓ |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const courseCell = r.dbCourse ?? `${r.intendedCourse} (unset⚠)`;
    const drift = r.dbCourse && r.dbCourse !== r.intendedCourse ? `${courseCell} ⚠intent=${r.intendedCourse}` : courseCell;
    const fk = r.sourceCandidateId ? r.sourceCandidateId.slice(0, 8) : "—";
    md.push(
      `| ${r.slug} | ${drift} | ${r.courseSource ?? "—"} | ${fk} | ${r.overall} | ${r.dimensions.jobReadiness} | ${r.dimensions.productionRealism} | ${r.dimensions.pythonSqlDepth} | ${r.dimensions.pedagogy} | ${r.dimensions.portfolio} | ${r.dimensions.uniqueness} | ${r.pedagogyComplete ? "✓" : "✗"} | ${Math.round(r.validationCoverage * 100)}% | ${r.portfolioReady ? "✓" : "✗"} |`,
    );
  }
  const courses = new Map<string, number>();
  for (const r of rows) courses.set(r.intendedCourse, (courses.get(r.intendedCourse) ?? 0) + 1);
  md.push("", "## Course coverage (intended)", "");
  for (const [c, n] of [...courses.entries()].sort()) md.push(`- ${c}: ${n}`);

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(path.join(REPORT_DIR, "phase7-wave-report.md"), md.join("\n") + "\n");
  writeFileSync(path.join(REPORT_DIR, "phase7-wave-report.json"), JSON.stringify({
    total: rows.length, passed, rows,
  }, null, 2) + "\n");
  console.log(`[wave-report] ${passed}/${rows.length} passing — wrote .local/phase7-wave-report.{md,json}`);
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2).filter(a => a !== "--");
  const [cmd, ...rest] = args;
  switch (cmd) {
    case "promote": {
      const slug = rest[0]; if (!slug) fail("usage: promote <slug>");
      await promote(slug);
      break;
    }
    case "audit": {
      // accept either: audit <slug>  or  audit --commit <slug>
      const commit = rest.includes("--commit");
      const slug = rest.filter(a => !a.startsWith("--"))[0];
      if (!slug) fail("usage: audit [--commit] <slug>");
      await audit(slug, commit);
      break;
    }
    case "anchor-check":
      await anchorCheck();
      break;
    case "wave-report":
      await waveReport();
      break;
    default:
      fail("usage: author-project {promote|audit|anchor-check|wave-report}");
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
