/**
 * Phase 9 — deterministic triage of all `course_source='heuristic_legacy'`
 * projects. Writes `docs/phase9/legacy-triage.md`.
 *
 * Decision rules (committed in code, not editorialized):
 *
 *   score >= 70 AND fully pedagogy-enriched → grandfather
 *   score >= 50 AND total_steps  >= 4       → upgrade
 *   30 <= score < 50 AND total_steps > 0    → revise
 *   score < 30 AND total_steps == 0         → archive
 *   else                                    → revise (catch-all)
 *
 *   pnpm --filter @workspace/scripts run triage:legacy
 */
import { db } from "@workspace/db";
import { projects, projectSteps } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

type TriageAction = "grandfather" | "upgrade" | "revise" | "archive";

interface TriageRow {
  slug: string;
  course: string;
  score: number;
  totalSteps: number;
  enrichedSteps: number;
  pedagogyComplete: boolean;
  action: TriageAction;
  rationale: string;
}

function decide(score: number, totalSteps: number, pedagogyComplete: boolean): { action: TriageAction; rationale: string } {
  if (score >= 70 && pedagogyComplete) {
    return { action: "grandfather", rationale: "Phase-4-grade quality predates candidate pipeline" };
  }
  if (score >= 50 && totalSteps >= 4) {
    return { action: "upgrade", rationale: "Strong skeleton — small lift to reach ≥70" };
  }
  if (score >= 30 && score < 50 && totalSteps > 0) {
    return { action: "revise", rationale: "Mid-quality, has step skeleton — needs substantive rewrite" };
  }
  if (score < 30 && totalSteps === 0) {
    return { action: "archive", rationale: "Thin stub, no learner-facing content" };
  }
  return { action: "revise", rationale: "Edge case (review individually)" };
}

async function main(): Promise<void> {
  const legacyProjects = await db.query.projects.findMany({
    where: eq(projects.courseSource, "heuristic_legacy"),
    orderBy: [asc(projects.course), asc(projects.slug)],
  });

  const rows: TriageRow[] = [];
  for (const p of legacyProjects) {
    const steps = await db.query.projectSteps.findMany({
      where: eq(projectSteps.projectId, p.id),
    });
    const totalSteps = steps.length;
    const enrichedSteps = steps.filter(s => {
      const cfg = s.pedagogyConfig as { hintLevel1?: string; hintLevel5?: string; successFeedback?: string; failureFeedback?: string; portfolioRelevance?: string } | null;
      return !!(cfg && cfg.hintLevel1 && cfg.hintLevel5 && cfg.successFeedback && cfg.failureFeedback && cfg.portfolioRelevance);
    }).length;
    const pedagogyComplete = totalSteps > 0 && enrichedSteps === totalSteps;
    const score = p.qualityScore ? Number(p.qualityScore) : 0;
    const { action, rationale } = decide(score, totalSteps, pedagogyComplete);
    rows.push({
      slug: p.slug,
      course: p.course ?? "(unset)",
      score: Math.round(score * 10) / 10,
      totalSteps,
      enrichedSteps,
      pedagogyComplete,
      action,
      rationale,
    });
  }

  const byAction: Record<TriageAction, TriageRow[]> = { grandfather: [], upgrade: [], revise: [], archive: [] };
  for (const r of rows) byAction[r.action].push(r);

  const byCourse = new Map<string, Record<TriageAction, number>>();
  for (const r of rows) {
    if (!byCourse.has(r.course)) byCourse.set(r.course, { grandfather: 0, upgrade: 0, revise: 0, archive: 0 });
    byCourse.get(r.course)![r.action]++;
  }

  const md: string[] = [
    "# Phase 9 — Legacy Catalog Triage Manifest",
    "",
    `Generated from \`scripts/src/triage-legacy.ts\` against ${rows.length} projects with \`course_source='heuristic_legacy'\`.`,
    "Decision rules are deterministic and live in code — see the file header for the exact thresholds.",
    "",
    "## Action totals",
    "",
    `| Action | Count |`,
    `|---|---|`,
    `| grandfather | ${byAction.grandfather.length} |`,
    `| upgrade | ${byAction.upgrade.length} |`,
    `| revise | ${byAction.revise.length} |`,
    `| archive | ${byAction.archive.length} |`,
    "",
    "## By course",
    "",
    "| Course | grandfather | upgrade | revise | archive | total |",
    "|---|---|---|---|---|---|",
  ];
  for (const [course, counts] of [...byCourse.entries()].sort()) {
    const total = counts.grandfather + counts.upgrade + counts.revise + counts.archive;
    md.push(`| ${course} | ${counts.grandfather} | ${counts.upgrade} | ${counts.revise} | ${counts.archive} | ${total} |`);
  }

  for (const action of ["grandfather", "upgrade", "revise", "archive"] as const) {
    md.push("", `## ${action.toUpperCase()} — ${byAction[action].length} projects`, "");
    if (byAction[action].length === 0) { md.push("_(none)_"); continue; }
    md.push("| Slug | Course | Score | Steps | Enriched | Rationale |");
    md.push("|---|---|---|---|---|---|");
    for (const r of byAction[action]) {
      md.push(`| ${r.slug} | ${r.course} | ${r.score} | ${r.totalSteps} | ${r.enrichedSteps}/${r.totalSteps} | ${r.rationale} |`);
    }
  }

  const ROOT = process.env.INIT_CWD || process.cwd();
  const outDir = path.join(ROOT, "docs/phase9");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "legacy-triage.md"), md.join("\n") + "\n");
  writeFileSync(
    path.join(outDir, "legacy-triage.json"),
    JSON.stringify({ totals: { grandfather: byAction.grandfather.length, upgrade: byAction.upgrade.length, revise: byAction.revise.length, archive: byAction.archive.length }, rows }, null, 2) + "\n",
  );

  console.log(`[triage] grandfather=${byAction.grandfather.length} upgrade=${byAction.upgrade.length} revise=${byAction.revise.length} archive=${byAction.archive.length} total=${rows.length}`);
  console.log(`[triage] wrote docs/phase9/legacy-triage.{md,json}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
