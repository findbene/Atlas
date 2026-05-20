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
  projects, projectSteps, domains, tracks,
  type Project,
} from "@workspace/db";

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

async function defaultDomainAndTrack(): Promise<{ domainId: string; trackId: string }> {
  const dRow = await db.select({ id: domains.id }).from(domains).limit(1);
  const tRow = await db.select({ id: tracks.id }).from(tracks).limit(1);
  if (!dRow[0] || !tRow[0]) fail("Need at least one domain + track row in DB before promote.");
  return { domainId: dRow[0].id, trackId: tRow[0].id };
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

  const { domainId, trackId } = await defaultDomainAndTrack();
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
    qualityBreakdown: {
      authoredMeta: authored.meta,
      portfolioArtifact: authored.portfolio,
    } as unknown as object,
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

  console.log(`[promote] ${slug}  steps=${authored.steps.length}  (${existing ? "updated" : "inserted"})`);
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
      qualityBreakdown: card as unknown as object,
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
  course: string | null;
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
    rows.push({
      slug: authored.slug,
      course: me.course,
      overall: card.overall,
      dimensions: Object.fromEntries(Object.entries(card.dimensions).map(([k, d]) => [k, d.score])),
      pedagogyComplete: allPedagogy,
      validationCoverage: me.steps.length === 0 ? 0 : validationSteps / me.steps.length,
      portfolioReady: !!authored.portfolio.portfolioRelevance,
    });
  }

  const passed = rows.filter(r => r.overall >= 70).length;
  const md: string[] = [
    "# Phase 7 — Wave Report",
    "",
    `Total authored: ${rows.length}   Passing ≥70: ${passed}/${rows.length}`,
    "",
    "| Slug | Course | Overall | Job | Realism | Depth | Pedagogy | Portfolio | Unique | Ped✓ | Val% | Port✓ |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    md.push(
      `| ${r.slug} | ${r.course ?? "?"} | ${r.overall} | ${r.dimensions.jobReadiness} | ${r.dimensions.productionRealism} | ${r.dimensions.pythonSqlDepth} | ${r.dimensions.pedagogy} | ${r.dimensions.portfolio} | ${r.dimensions.uniqueness} | ${r.pedagogyComplete ? "✓" : "✗"} | ${Math.round(r.validationCoverage * 100)}% | ${r.portfolioReady ? "✓" : "✗"} |`,
    );
  }
  const courses = new Map<string, number>();
  for (const r of rows) courses.set(r.course ?? "?", (courses.get(r.course ?? "?") ?? 0) + 1);
  md.push("", "## Course coverage", "");
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
