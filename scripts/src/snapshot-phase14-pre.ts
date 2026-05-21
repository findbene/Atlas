/**
 * Phase 14 — pre-state snapshot.
 *
 *   pnpm --filter @workspace/scripts run snapshot:phase14-pre
 *
 * Captures `.local/phase14-pre-state.json` as the immutable diff baseline
 * before any T001+ work runs. Also captures per-difficulty counts so the
 * beginner-tier seeding (1 → 6 beginner) can be verified after.
 */
import { db, projects } from "@workspace/db";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.INIT_CWD || process.cwd();
const OUT = path.join(ROOT, ".local", "phase14-pre-state.json");

async function main(): Promise<void> {
  const allRaw = await db.select().from(projects);
  const all = allRaw.map((r) => ({
    slug: r.slug,
    course: r.course,
    courseSource: r.courseSource,
    difficulty: r.difficultyLevel,
    totalSteps: r.totalSteps ?? 0,
    visible: r.learnerVisible !== false,
    isAnchor: r.isAnchor === true,
  }));

  const visible = all.filter((r) => r.visible);
  const hidden = all.filter((r) => !r.visible);

  const perDifficultyVisible: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const r of visible) {
    const d = String(r.difficulty);
    perDifficultyVisible[d] = (perDifficultyVisible[d] ?? 0) + 1;
  }

  const perCourseBeginner: Record<string, number> = {};
  for (const r of visible) {
    if (r.difficulty === "beginner") {
      const c = String(r.course);
      perCourseBeginner[c] = (perCourseBeginner[c] ?? 0) + 1;
    }
  }

  const out = {
    capturedAt: new Date().toISOString(),
    phase: "phase14_pre",
    totalProjects: all.length,
    learnerVisible: visible.length,
    hidden: hidden.length,
    hiddenCount: hidden.length,
    perDifficultyVisible,
    perCourseBeginner,
    anchorCount: all.filter((r) => r.isAnchor && r.visible).length,
    anchorSlugs: all.filter((r) => r.isAnchor && r.visible).map((r) => r.slug),
    expectedPostP14: {
      visible: visible.length + 5,
      hidden: hidden.length,
      beginner: (perDifficultyVisible.beginner ?? 0) + 5,
      anchorCount: 2,
    },
    notes: {
      pedagogyVisible: "47 / 47 (from Phase 13 close)",
      lineageCounters: "0 / 0 / 0 / 0 (from Phase 13 close)",
      anchorTargets: "csv-to-postgres-pipeline=70.5, dbt-data-models=72.7",
    },
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`[snapshot-14-pre] wrote ${OUT}`);
  console.log(`  totalProjects=${out.totalProjects}  visible=${out.learnerVisible}  hidden=${out.hidden}`);
  console.log(`  beginner=${perDifficultyVisible.beginner}  intermediate=${perDifficultyVisible.intermediate}  advanced=${perDifficultyVisible.advanced}`);
  console.log(`  anchorCount=${out.anchorCount}  anchorSlugs=${out.anchorSlugs.join(",")}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
