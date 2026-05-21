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
import { db, projectCandidates } from "@workspace/db";
import { loadAllProjects } from "./quality-adapter";

const INCLUDE_CANDIDATES = process.argv.includes("--include-candidates");

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
  // Phase 12A — visibility-aware denominators. `rows` still represents ALL
  // projects (preserves all historical sections); `visibleRows` is the
  // learner-facing subset for the new dual-denominator summary block.
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
  const visibilityBySlug = new Map(loaded.map(l => [l.input.slug, l.raw.learnerVisible !== false]));
  const visibleSlugs = new Set([...visibilityBySlug.entries()].filter(([, v]) => v).map(([s]) => s));
  const totalCount = rows.length;
  const visibleCount = rows.filter(r => visibleSlugs.has(r.slug)).length;
  const hiddenCount = totalCount - visibleCount;
  const approvedAll = rows.filter(r => r.status === "approved").length;
  const approvedVisible = rows.filter(r => r.status === "approved" && visibleSlugs.has(r.slug)).length;

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

  // Phase 12A — dual-denominator summary block. The all-projects ratio
  // remains for historical continuity + internal cleanup visibility; the
  // learner-visible ratio is the learner-facing KPI going forward.
  lines.push(`## Visibility-aware summary (Phase 12A)\n`);
  lines.push(`| Metric | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Total projects | ${totalCount} |`);
  lines.push(`| Learner-visible projects | ${visibleCount} |`);
  lines.push(`| Archived / hidden projects | ${hiddenCount} |`);
  lines.push(`| Approved (all projects) | ${approvedAll} / ${totalCount} |`);
  lines.push(`| Approved (learner-visible only, learner-facing KPI) | ${approvedVisible} / ${visibleCount} |\n`);

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

  // ─── Phase 6 §7: candidate sections (gated on --include-candidates) ──
  // Extra sections appended after the project-only report so existing
  // tooling that scrapes the project sections keeps working.
  type CandSummary = {
    totals: number;
    perCourseDifficulty: Record<string, Record<string, number>>;
    perCoursePortfolio: Record<string, Record<string, number>>;
    perCoursePyDepth: Record<string, Record<string, number>>;
    perCourseSqlDepth: Record<string, Record<string, number>>;
    perCourseStack: Record<string, Record<string, number>>;
    perCourseRole: Record<string, Record<string, number>>;
    scoreDist: Record<string, { median: number; p25: number; p75: number; min: number; max: number; ge60: number; ge70: number; count: number }>;
    duplicateWarnings: { total: number; perCourse: Record<string, number> };
    gridGaps: Array<{ course: string; difficulty: string; portfolio: string }>;
    weakest10: Array<{ id: string; title: string; course: string; score: number }>;
    strongest10: Array<{ id: string; title: string; course: string; score: number }>;
  };
  let candidateSummary: CandSummary | null = null;
  if (INCLUDE_CANDIDATES) {
    const candRows = await db.select().from(projectCandidates);
    type CRow = {
      id: string; title: string; course: string; difficulty: string; score: number;
      portfolio: string; py: string; sql: string; stack: string[]; roles: string[]; dup: boolean;
    };
    const crows: CRow[] = candRows.map(r => {
      const prop = (r.proposal as Record<string, unknown> | null) ?? {};
      const portfolioArtifact = prop.portfolioArtifact as { kind?: string } | undefined;
      const card = r.qualityBreakdown as Scorecard | null;
      return {
        id: r.id,
        title: r.proposedTitle,
        course: r.proposedCourse,
        difficulty: r.difficulty,
        score: (() => { const n = Number(r.qualityScore); return Number.isFinite(n) ? n : 0; })(),
        portfolio: portfolioArtifact?.kind ?? "—",
        py: (prop.pythonDepth as string | undefined) ?? "—",
        sql: (prop.sqlDepth as string | undefined) ?? "—",
        stack: (r.proposedStack ?? []).map(normalizeStackToken),
        roles: r.targetRoles ?? [],
        dup: !!card?.duplicateWarning,
      };
    });

    const blankCourse = <V>(v: () => V) => Object.fromEntries(ALL_COURSES.map(c => [c, v()]));
    const inc = (m: Record<string, Record<string, number>>, c: string, k: string) => {
      m[c] = m[c] ?? {}; m[c][k] = (m[c][k] ?? 0) + 1;
    };
    const perCD: Record<string, Record<string, number>> = blankCourse(() => ({ beginner: 0, intermediate: 0, advanced: 0 } as Record<string, number>));
    const perCP: Record<string, Record<string, number>> = blankCourse(() => ({} as Record<string, number>));
    const perCPy: Record<string, Record<string, number>> = blankCourse(() => ({} as Record<string, number>));
    const perCSql: Record<string, Record<string, number>> = blankCourse(() => ({} as Record<string, number>));
    const perCStack: Record<string, Record<string, number>> = blankCourse(() => ({} as Record<string, number>));
    const perCRole: Record<string, Record<string, number>> = blankCourse(() => ({} as Record<string, number>));
    for (const r of crows) {
      inc(perCD, r.course, r.difficulty);
      inc(perCP, r.course, r.portfolio);
      inc(perCPy, r.course, r.py);
      inc(perCSql, r.course, r.sql);
      for (const tok of new Set(r.stack)) inc(perCStack, r.course, tok);
      for (const role of new Set(r.roles)) inc(perCRole, r.course, role);
    }

    // Score distribution per course. Linear-interpolated percentiles (R-7 /
    // numpy default): handles even-sized sets correctly (median = midpoint
    // of the two central values). Non-finite values are filtered out.
    const dist = (raw: number[]) => {
      const xs = raw.filter(Number.isFinite);
      if (xs.length === 0) return { median: 0, p25: 0, p75: 0, min: 0, max: 0, ge60: 0, ge70: 0, count: 0 };
      const s = [...xs].sort((a, b) => a - b);
      const q = (p: number) => {
        if (s.length === 1) return s[0];
        const idx = p * (s.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        if (lo === hi) return s[lo];
        return s[lo] + (s[hi] - s[lo]) * (idx - lo);
      };
      const round1 = (n: number) => Math.round(n * 10) / 10;
      return {
        median: round1(q(0.5)), p25: round1(q(0.25)), p75: round1(q(0.75)),
        min: s[0], max: s[s.length - 1],
        ge60: xs.filter(x => x >= 60).length,
        ge70: xs.filter(x => x >= 70).length,
        count: xs.length,
      };
    };
    const scoreDist: Record<string, ReturnType<typeof dist>> = {};
    for (const c of ALL_COURSES) scoreDist[c] = dist(crows.filter(r => r.course === c).map(r => r.score));

    // Duplicate warnings
    const dupTotal = crows.filter(r => r.dup).length;
    const dupPerCourse: Record<string, number> = Object.fromEntries(ALL_COURSES.map(c => [c, 0]));
    for (const r of crows) if (r.dup) dupPerCourse[r.course]++;

    // Gap detection: course × {difficulty × portfolio-kind} cells with 0 candidates
    const allKinds = ["repo", "service", "notebook", "report", "dashboard"];
    const gridGaps: Array<{ course: string; difficulty: string; portfolio: string }> = [];
    for (const c of ALL_COURSES) {
      for (const d of ["beginner", "intermediate", "advanced"]) {
        for (const k of allKinds) {
          const n = crows.filter(r => r.course === c && r.difficulty === d && r.portfolio === k).length;
          if (n === 0) gridGaps.push({ course: c, difficulty: d, portfolio: k });
        }
      }
    }

    const byScore = [...crows].sort((a, b) => b.score - a.score);
    const strongest10 = byScore.slice(0, 10).map(r => ({ id: r.id, title: r.title, course: r.course, score: r.score }));
    const weakest10 = byScore.slice(-10).reverse().map(r => ({ id: r.id, title: r.title, course: r.course, score: r.score }));

    candidateSummary = {
      totals: crows.length,
      perCourseDifficulty: perCD,
      perCoursePortfolio: perCP,
      perCoursePyDepth: perCPy,
      perCourseSqlDepth: perCSql,
      perCourseStack: perCStack,
      perCourseRole: perCRole,
      scoreDist,
      duplicateWarnings: { total: dupTotal, perCourse: dupPerCourse },
      gridGaps,
      weakest10, strongest10,
    };

    // ── Markdown rendering for candidate sections ──
    lines.push("\n---\n");
    lines.push(`# Candidate report (Phase 6)\n`);
    lines.push(`**Total candidates:** ${crows.length}\n`);

    lines.push(`## Candidate × course × difficulty\n`);
    lines.push(`| Course | beginner | intermediate | advanced |`);
    lines.push(`|---|---|---|---|`);
    for (const c of ALL_COURSES) {
      const x = perCD[c];
      lines.push(`| ${c} | ${x.beginner ?? 0} | ${x.intermediate ?? 0} | ${x.advanced ?? 0} |`);
    }

    lines.push(`\n## Candidate × course × portfolio artifact kind\n`);
    const kindCols = Array.from(new Set(crows.map(r => r.portfolio))).sort();
    lines.push(`| Course | ${kindCols.join(" | ")} |`);
    lines.push(`|---|${kindCols.map(() => "---").join("|")}|`);
    for (const c of ALL_COURSES) {
      lines.push(`| ${c} | ${kindCols.map(k => perCP[c][k] ?? 0).join(" | ")} |`);
    }

    lines.push(`\n## Candidate × course × Python depth\n`);
    lines.push(`| Course | beginner | intermediate | advanced | (other) |`);
    lines.push(`|---|---|---|---|---|`);
    for (const c of ALL_COURSES) {
      const x = perCPy[c];
      const other = Object.entries(x).filter(([k]) => !["beginner", "intermediate", "advanced"].includes(k)).reduce((s, [, n]) => s + n, 0);
      lines.push(`| ${c} | ${x.beginner ?? 0} | ${x.intermediate ?? 0} | ${x.advanced ?? 0} | ${other} |`);
    }

    lines.push(`\n## Candidate × course × SQL depth\n`);
    lines.push(`| Course | beginner | intermediate | advanced | (other) |`);
    lines.push(`|---|---|---|---|---|`);
    for (const c of ALL_COURSES) {
      const x = perCSql[c];
      const other = Object.entries(x).filter(([k]) => !["beginner", "intermediate", "advanced"].includes(k)).reduce((s, [, n]) => s + n, 0);
      lines.push(`| ${c} | ${x.beginner ?? 0} | ${x.intermediate ?? 0} | ${x.advanced ?? 0} | ${other} |`);
    }

    lines.push(`\n## Candidate × course × top stack anchors (top 5)\n`);
    lines.push(`| Course | Top stack tokens |`);
    lines.push(`|---|---|`);
    for (const c of ALL_COURSES) {
      const top = Object.entries(perCStack[c]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k}(${n})`).join(", ") || "—";
      lines.push(`| ${c} | ${top} |`);
    }

    lines.push(`\n## Candidate × course × role overlap\n`);
    lines.push(`| Course | Roles (count) |`);
    lines.push(`|---|---|`);
    for (const c of ALL_COURSES) {
      const top = Object.entries(perCRole[c]).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}(${n})`).join(", ") || "—";
      lines.push(`| ${c} | ${top} |`);
    }

    lines.push(`\n## Candidate quality score distribution per course\n`);
    lines.push(`| Course | count | median | p25 | p75 | min | max | ≥60 | ≥70 |`);
    lines.push(`|---|---|---|---|---|---|---|---|---|`);
    for (const c of ALL_COURSES) {
      const d = scoreDist[c];
      lines.push(`| ${c} | ${d.count} | ${d.median} | ${d.p25} | ${d.p75} | ${d.min} | ${d.max} | ${d.ge60} | ${d.ge70} |`);
    }

    // Side-by-side projects vs candidates (overall)
    const projectScores = rows.map(r => r.score).filter(s => s > 0);
    const projOverall = dist(projectScores);
    const candOverall = dist(crows.map(r => r.score));
    lines.push(`\n## Projects vs Candidates (overall quality)\n`);
    lines.push(`| Source | count | median | p25 | p75 | ≥60 | ≥70 |`);
    lines.push(`|---|---|---|---|---|---|---|`);
    lines.push(`| projects | ${projOverall.count} | ${projOverall.median} | ${projOverall.p25} | ${projOverall.p75} | ${projOverall.ge60} | ${projOverall.ge70} |`);
    lines.push(`| candidates | ${candOverall.count} | ${candOverall.median} | ${candOverall.p25} | ${candOverall.p75} | ${candOverall.ge60} | ${candOverall.ge70} |`);

    lines.push(`\n## Candidate duplicate warnings\n`);
    lines.push(`**Total:** ${dupTotal} (${((dupTotal / crows.length) * 100).toFixed(1)}%)\n`);
    lines.push(`| Course | dup-flagged |`);
    lines.push(`|---|---|`);
    for (const c of ALL_COURSES) lines.push(`| ${c} | ${dupPerCourse[c]} |`);

    lines.push(`\n## Candidate gap detection: course × difficulty × portfolio-kind (0 candidates)\n`);
    if (gridGaps.length === 0) lines.push(`_None._`);
    else {
      lines.push(`Found **${gridGaps.length}** empty cells. First 20:\n`);
      lines.push(`| Course | Difficulty | Portfolio kind |`);
      lines.push(`|---|---|---|`);
      for (const g of gridGaps.slice(0, 20)) lines.push(`| ${g.course} | ${g.difficulty} | ${g.portfolio} |`);
    }

    lines.push(`\n## Strongest 10 candidates\n`);
    lines.push(`| Score | Course | Title |`);
    lines.push(`|---|---|---|`);
    for (const s of strongest10) lines.push(`| ${s.score} | ${s.course} | ${s.title} |`);

    lines.push(`\n## Weakest 10 candidates\n`);
    lines.push(`| Score | Course | Title |`);
    lines.push(`|---|---|---|`);
    for (const s of weakest10) lines.push(`| ${s.score} | ${s.course} | ${s.title} |`);
  }

  // Write outputs
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, lines.join("\n") + "\n");
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals: { projects: rows.length, candidates: candidateSummary?.totals ?? 0 },
    visibility: {
      totalCount, visibleCount, hiddenCount,
      approvedAll, approvedVisible,
    },
    statusFunnel: funnel,
    diffDist,
    depthDist,
    courseDiff: Object.fromEntries(courseDiff),
    courseStack: Object.fromEntries([...courseStack].map(([c, v]) => [c, v])),
    gaps,
    candidates: candidateSummary,
  }, null, 2));

  console.log(lines.join("\n"));
  console.log(`\nWrote ${OUT_MD}`);
  console.log(`Wrote ${OUT_JSON}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
