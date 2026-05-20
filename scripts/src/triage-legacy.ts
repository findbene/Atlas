/**
 * Phase 9 + Phase 10 — deterministic triage of all
 * `course_source='heuristic_legacy'` projects. Writes
 * `docs/phase9/legacy-triage.md`.
 *
 * Decision rules (committed in code, not editorialized):
 *
 *   score >= 70 AND fully pedagogy-enriched → grandfather
 *   score >= 50 AND total_steps  >= 4       → upgrade
 *   30 <= score < 50 AND total_steps > 0    → revise
 *   score < 30 AND total_steps == 0         → archive
 *   else                                    → revise (catch-all)
 *
 * Reads `projects.course` directly (Phase 8 native column) — no
 * `mapToCourse` heuristic. The `check:no-heuristic-runtime` lint guard
 * already blocks regression at the canonical `typecheck` gate.
 *
 * Phase 10 additions:
 *   - `learnerVisible` column surfaced per-row (`hidden ✓` / `visible`).
 *   - `replaceCandidate` column (default false) — reserved for Phase 11+
 *     when authored replacements exist for archived slugs.
 *   - 9-course inventory header (all 9 courses, even ones with no
 *     legacy rows).
 *
 *   pnpm --filter @workspace/scripts run triage:legacy
 */
import { db } from "@workspace/db";
import { projects, projectSteps } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ALL_COURSES, type AtlasCourseSlug } from "@workspace/curriculum-quality";

type TriageAction = "grandfather" | "upgrade" | "revise" | "archive";

interface TriageRow {
  slug: string;
  course: string;
  score: number;
  totalSteps: number;
  enrichedSteps: number;
  pedagogyComplete: boolean;
  learnerVisible: boolean;
  /** Phase 10 — reserved for Phase 11+; populated when an authored replacement exists. */
  replaceCandidate: boolean;
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
      learnerVisible: p.learnerVisible,
      replaceCandidate: false,
      action,
      rationale,
    });
  }

  // Phase 10 — 9-course-native inventory: read authored counts directly
  // from `projects.course` + `projects.course_source` so the header
  // matches DB truth (not a derived heuristic).
  const allProjectRows = await db.query.projects.findMany({
    columns: { course: true, courseSource: true },
  });
  const courseTotals = new Map<AtlasCourseSlug, { authored: number; legacy: number }>();
  for (const c of ALL_COURSES) courseTotals.set(c, { authored: 0, legacy: 0 });
  for (const p of allProjectRows) {
    const course = p.course as AtlasCourseSlug | null;
    if (!course || !courseTotals.has(course)) continue;
    const bucket = courseTotals.get(course)!;
    if (p.courseSource === "authored") bucket.authored++;
    else bucket.legacy++;
  }

  const byAction: Record<TriageAction, TriageRow[]> = { grandfather: [], upgrade: [], revise: [], archive: [] };
  for (const r of rows) byAction[r.action].push(r);

  const byCourse = new Map<string, Record<TriageAction, number>>();
  for (const r of rows) {
    if (!byCourse.has(r.course)) byCourse.set(r.course, { grandfather: 0, upgrade: 0, revise: 0, archive: 0 });
    byCourse.get(r.course)![r.action]++;
  }

  const hiddenCount = rows.filter(r => !r.learnerVisible).length;

  const md: string[] = [
    "# Legacy Catalog Triage Manifest (Phase 9 + Phase 10)",
    "",
    `> **Phase 10 outcome:** 7 revise candidates promoted to authored ≥70 (batch 2). ${hiddenCount} archive stubs flipped to \`learner_visible=false\` — they remain in the DB but no longer appear in the learner catalog. Run \`pnpm --filter @workspace/scripts run archive:thin-stubs\` to re-apply (idempotent).`,
    "",
    `Generated from \`scripts/src/triage-legacy.ts\` against ${rows.length} projects with \`course_source='heuristic_legacy'\`.`,
    "Decision rules are deterministic and live in code — see the file header for the exact thresholds. Atlas is a 9-course platform; this manifest reads `projects.course` directly (no `mapToCourse` heuristic).",
    "",
    "## 9-course inventory (DB truth)",
    "",
    "| Course | Authored | Legacy | Total |",
    "|---|---|---|---|",
  ];
  let totA = 0, totL = 0;
  for (const c of ALL_COURSES) {
    const { authored, legacy } = courseTotals.get(c)!;
    totA += authored; totL += legacy;
    md.push(`| ${c} | ${authored} | ${legacy} | ${authored + legacy} |`);
  }
  md.push(`| **TOTAL** | **${totA}** | **${totL}** | **${totA + totL}** |`);
  md.push(
    "",
    "## Action totals",
    "",
    `| Action | Count |`,
    `|---|---|`,
    `| grandfather | ${byAction.grandfather.length} |`,
    `| upgrade | ${byAction.upgrade.length} |`,
    `| revise | ${byAction.revise.length} |`,
    `| archive | ${byAction.archive.length} |`,
    `| _(hidden via learner_visible=false)_ | ${hiddenCount} |`,
    "",
    "## By course (legacy only)",
    "",
    "| Course | grandfather | upgrade | revise | archive | total |",
    "|---|---|---|---|---|---|",
  );
  for (const [course, counts] of [...byCourse.entries()].sort()) {
    const total = counts.grandfather + counts.upgrade + counts.revise + counts.archive;
    md.push(`| ${course} | ${counts.grandfather} | ${counts.upgrade} | ${counts.revise} | ${counts.archive} | ${total} |`);
  }

  for (const action of ["grandfather", "upgrade", "revise", "archive"] as const) {
    md.push("", `## ${action.toUpperCase()} — ${byAction[action].length} projects`, "");
    if (byAction[action].length === 0) { md.push("_(none)_"); continue; }
    md.push("| Slug | Course | Score | Steps | Enriched | Hidden | Replace candidate | Rationale |");
    md.push("|---|---|---|---|---|---|---|---|");
    for (const r of byAction[action]) {
      const hidden = r.learnerVisible ? "" : "hidden ✓";
      const replace = r.replaceCandidate ? "✓" : "";
      md.push(`| ${r.slug} | ${r.course} | ${r.score} | ${r.totalSteps} | ${r.enrichedSteps}/${r.totalSteps} | ${hidden} | ${replace} | ${r.rationale} |`);
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
