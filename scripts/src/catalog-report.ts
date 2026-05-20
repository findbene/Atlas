/**
 * Phase 5 — catalog:report
 *
 * Course × difficulty / course × role / course × stack matrices,
 * beg/int/adv distribution, Py/SQL depth distribution, status funnel,
 * gap detection. Writes Markdown + JSON for future dashboards.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  ALL_COURSES, ALL_ROLES, COURSE_TIER1_ANCHORS, ROLE_PRIMARY_STACK,
  mapToCourse, normalizeStackToken, tierOf,
  type AtlasCourseSlug, type Scorecard,
} from "@workspace/curriculum-quality";
import { loadAllProjects } from "./quality-adapter";

const OUT_MD = path.resolve(process.cwd(), "../.local/catalog-quality-report.md");
const OUT_JSON = path.resolve(process.cwd(), "../.local/catalog-quality-report.json");

type Row = { slug: string; course: AtlasCourseSlug; difficulty: string; status: string; score: number; stack: string[]; pyDepth: boolean; sqlDepth: boolean };

function countMatrix<R, C extends string>(rows: R[], rowKey: (r: R) => string, colKey: (r: R) => C, cols: readonly C[]): Map<string, Record<C, number>> {
  const m = new Map<string, Record<C, number>>();
  for (const r of rows) {
    const rk = rowKey(r);
    if (!m.has(rk)) {
      const blank = Object.fromEntries(cols.map(c => [c, 0])) as Record<C, number>;
      m.set(rk, blank);
    }
    m.get(rk)![colKey(r)] = (m.get(rk)![colKey(r)] ?? 0) + 1;
  }
  return m;
}

async function main() {
  const loaded = await loadAllProjects(mapToCourse);
  const rows: Row[] = loaded.map(l => {
    const card = (l.raw.qualityBreakdown as Scorecard | null);
    return {
      slug: l.input.slug,
      course: l.course as AtlasCourseSlug,
      difficulty: l.input.difficulty,
      status: l.raw.qualityStatus,
      score: card?.overall ?? 0,
      stack: (l.input.techStack ?? []).map(normalizeStackToken),
      pyDepth: l.input.language === "python" || l.input.language === "both",
      sqlDepth: l.input.language === "sql" || l.input.language === "both",
    };
  });

  const courseDiff = countMatrix(rows, r => r.course, r => r.difficulty as "beginner" | "intermediate" | "advanced", ["beginner", "intermediate", "advanced"] as const);
  const statusFunnel = countMatrix(rows, () => "all", r => r.status as "unreviewed" | "approved" | "needs_revision" | "rejected", ["unreviewed", "approved", "needs_revision", "rejected"] as const);

  // course × stack-tier-1 anchor coverage
  const courseStack = new Map<AtlasCourseSlug, { hits: number; anchors: Record<string, number> }>();
  for (const c of ALL_COURSES) {
    courseStack.set(c, { hits: 0, anchors: Object.fromEntries(COURSE_TIER1_ANCHORS[c].map(a => [a, 0])) });
  }
  for (const r of rows) {
    const entry = courseStack.get(r.course);
    if (!entry) continue;
    let any = false;
    for (const a of Object.keys(entry.anchors)) {
      if (r.stack.includes(a)) { entry.anchors[a]++; any = true; }
    }
    if (any) entry.hits++;
  }

  // course × role coverage: a project counts toward a role only if its
  // (normalized) stack overlaps that role's primary anchors. Previously
  // this incremented every role whenever any tier-1 token was present,
  // which produced uniform meaningless numbers.
  const courseRole = new Map<AtlasCourseSlug, Record<string, number>>();
  for (const c of ALL_COURSES) courseRole.set(c, Object.fromEntries(ALL_ROLES.map(r => [r, 0])));
  for (const r of rows) {
    const cr = courseRole.get(r.course)!;
    const stackSet = new Set(r.stack);
    for (const role of ALL_ROLES) {
      const anchors = ROLE_PRIMARY_STACK[role];
      if (anchors.some(a => stackSet.has(a))) cr[role]++;
    }
  }

  const diffDist = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const r of rows) diffDist[r.difficulty as keyof typeof diffDist]++;

  const depthDist = { python: rows.filter(r => r.pyDepth).length, sql: rows.filter(r => r.sqlDepth).length };

  // Gaps: course×difficulty cells with 0 approved projects.
  const approved = rows.filter(r => r.status === "approved");
  const gaps: Array<{ course: string; difficulty: string; priority: "high" | "med" }> = [];
  for (const c of ALL_COURSES) {
    for (const d of ["beginner", "intermediate", "advanced"] as const) {
      const count = approved.filter(r => r.course === c && r.difficulty === d).length;
      if (count === 0) {
        const anchors = courseStack.get(c)!;
        gaps.push({ course: c, difficulty: d, priority: anchors.hits === 0 ? "high" : "med" });
      }
    }
  }

  // Markdown rendering
  const lines: string[] = [];
  lines.push(`# Atlas Catalog Quality Report`);
  lines.push(`\n**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Total projects:** ${rows.length}\n`);

  lines.push(`## Quality status funnel\n`);
  const funnel = statusFunnel.get("all")!;
  lines.push(`| unreviewed | approved | needs_revision | rejected |`);
  lines.push(`|---|---|---|---|`);
  lines.push(`| ${funnel.unreviewed} | ${funnel.approved} | ${funnel.needs_revision} | ${funnel.rejected} |\n`);

  lines.push(`## Difficulty distribution\n`);
  lines.push(`| beginner | intermediate | advanced |`);
  lines.push(`|---|---|---|`);
  lines.push(`| ${diffDist.beginner} | ${diffDist.intermediate} | ${diffDist.advanced} |\n`);

  lines.push(`## Language depth coverage\n`);
  lines.push(`| Python-capable | SQL-capable |`);
  lines.push(`|---|---|`);
  lines.push(`| ${depthDist.python} | ${depthDist.sql} |\n`);

  lines.push(`## Course × difficulty\n`);
  lines.push(`| Course | beginner | intermediate | advanced |`);
  lines.push(`|---|---|---|---|`);
  for (const c of ALL_COURSES) {
    const cells = courseDiff.get(c) ?? { beginner: 0, intermediate: 0, advanced: 0 };
    lines.push(`| ${c} | ${cells.beginner} | ${cells.intermediate} | ${cells.advanced} |`);
  }

  lines.push(`\n## Course × tier-1 anchor coverage\n`);
  lines.push(`| Course | Projects w/ ≥1 anchor | Anchor hit-count (top) |`);
  lines.push(`|---|---|---|`);
  for (const c of ALL_COURSES) {
    const entry = courseStack.get(c)!;
    const topAnchors = Object.entries(entry.anchors).filter(([, n]) => n > 0).map(([a, n]) => `${a}(${n})`).join(", ") || "—";
    lines.push(`| ${c} | ${entry.hits} | ${topAnchors} |`);
  }

  lines.push(`\n## Gaps (cells with 0 approved projects)\n`);
  if (gaps.length === 0) {
    lines.push(`_None._`);
  } else {
    lines.push(`| Course | Difficulty | Priority |`);
    lines.push(`|---|---|---|`);
    for (const g of gaps) lines.push(`| ${g.course} | ${g.difficulty} | ${g.priority} |`);
  }

  // Write outputs
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, lines.join("\n") + "\n");
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals: { projects: rows.length },
    statusFunnel: funnel,
    diffDist,
    depthDist,
    courseDiff: Object.fromEntries(courseDiff),
    courseStack: Object.fromEntries([...courseStack].map(([c, v]) => [c, v])),
    gaps,
  }, null, 2));

  console.log(lines.join("\n"));
  console.log(`\nWrote ${OUT_MD}`);
  console.log(`Wrote ${OUT_JSON}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
