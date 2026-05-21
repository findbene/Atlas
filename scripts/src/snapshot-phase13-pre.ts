/**
 * Phase 13 — pre-state snapshot.
 *
 *   pnpm --filter @workspace/scripts run snapshot:phase13-pre
 *
 * Captures `.local/phase13-pre-state.json` as the immutable diff baseline
 * before any T001+ work runs. Captures per-course visible counts so the
 * underserved-course remediation (2 → 3) can be verified after.
 */
import { db, projects } from "@workspace/db";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.INIT_CWD || process.cwd();
const OUT = path.join(ROOT, ".local", "phase13-pre-state.json");

async function main(): Promise<void> {
  const allRaw = await db.select().from(projects);
  const all = allRaw.map((r) => ({
    slug: r.slug,
    course: r.course,
    courseSource: r.courseSource,
    totalSteps: r.totalSteps ?? 0,
    enrolled: r.enrolledCount ?? 0,
    visible: r.learnerVisible !== false,
    replaceCandidateSlug: r.replaceCandidateSlug ?? null,
  }));

  const visible = all.filter((r) => r.visible);
  const hidden = all.filter((r) => !r.visible);
  const visibleThin = visible.filter((r) => (r.totalSteps ?? 0) < 5);
  const legacyReplacements = all.filter((r) => !!r.replaceCandidateSlug);

  const perCourseVisible: Record<string, { visible: number; authored: number }> = {};
  for (const r of visible) {
    const c = String(r.course);
    if (!perCourseVisible[c]) perCourseVisible[c] = { visible: 0, authored: 0 };
    perCourseVisible[c].visible++;
    if (r.courseSource === "authored") perCourseVisible[c].authored++;
  }

  const out = {
    capturedAt: new Date().toISOString(),
    phase: "phase13_pre",
    totalProjects: all.length,
    learnerVisible: visible.length,
    hidden: hidden.length,
    hiddenCount: hidden.length,
    perCourseVisible,
    underservedCourses: Object.entries(perCourseVisible)
      .filter(([, v]) => v.visible <= 2)
      .map(([c, v]) => ({ course: c, visible: v.visible })),
    visibleThinStubs: {
      count: visibleThin.length,
      slugs: visibleThin.map((r) => ({ slug: r.slug, course: r.course, steps: r.totalSteps })),
    },
    anchorCandidatesBeforeIsAnchor: [
      "csv-to-postgres-pipeline",
      "dbt-data-models",
    ],
    legacyReplacementsCount: legacyReplacements.length,
    expectedWaveReportCount: 41,
    notes: {
      pedagogyVisible: "43 / 43 (from Phase 12B close)",
      lineageCounters: "0 / 0 / 0 / 0 + orphan=0 (from Phase 12B close)",
      anchorTargets: "csv-to-postgres-pipeline=70.5, dbt-data-models=72.7",
    },
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`[snapshot-13-pre] wrote ${OUT}`);
  console.log(`  totalProjects=${out.totalProjects}  visible=${out.learnerVisible}  hidden=${out.hidden}`);
  console.log(`  underservedCourses=${out.underservedCourses.map((u) => u.course).join(",")}`);
  console.log(`  visibleThinStubs=${out.visibleThinStubs.count}  legacyReplacements=${out.legacyReplacementsCount}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
