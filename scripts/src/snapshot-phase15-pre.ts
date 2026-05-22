/**
 * Phase 15A — pre-state snapshot.
 *
 *   pnpm --filter @workspace/scripts run snapshot:phase15-pre
 *
 * Captures `.local/phase15-pre-state.json` as the immutable diff baseline
 * BEFORE the difficulty-label audit or any backfill work. Phase 15A is
 * read-only / dormant — this snapshot exists so Phase 15B (if approved)
 * can prove the catalog state did not drift between the audit and the
 * targeted backfill.
 */
import { db, projects } from "@workspace/db";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.INIT_CWD || process.cwd();
const OUT = path.join(ROOT, ".local", "phase15-pre-state.json");

type DifficultyKey = "beginner" | "intermediate" | "advanced";

async function main(): Promise<void> {
  const allRaw = await db.select().from(projects);
  const all = allRaw.map((r) => ({
    slug: r.slug,
    course: r.course,
    difficulty: r.difficultyLevel,
    totalSteps: r.totalSteps ?? 0,
    estimatedMinutes: r.estimatedMinutes ?? 0,
    visible: r.learnerVisible !== false,
    isAnchor: r.isAnchor === true,
    replaceCandidateSlug: r.replaceCandidateSlug ?? null,
  }));

  const visible = all.filter((r) => r.visible);
  const hidden = all.filter((r) => !r.visible);

  const perDifficultyVisible: Record<DifficultyKey | "unknown", number> = {
    beginner: 0, intermediate: 0, advanced: 0, unknown: 0,
  };
  const perCourseDifficulty: Record<string, Record<DifficultyKey, number>> = {};
  for (const r of visible) {
    const d = r.difficulty as DifficultyKey;
    if (d === "beginner" || d === "intermediate" || d === "advanced") {
      perDifficultyVisible[d]++;
      const c = String(r.course ?? "(unset)");
      if (!perCourseDifficulty[c]) perCourseDifficulty[c] = { beginner: 0, intermediate: 0, advanced: 0 };
      perCourseDifficulty[c][d]++;
    } else {
      perDifficultyVisible.unknown++;
    }
  }

  const anchors = all.filter((r) => r.isAnchor && r.visible);
  const legacyReplacements = all.filter((r) => r.replaceCandidateSlug);

  const out = {
    capturedAt: new Date().toISOString(),
    phase: "phase15A_pre",
    totalProjects: all.length,
    learnerVisible: visible.length,
    hidden: hidden.length,
    perDifficultyVisible,
    perCourseDifficulty,
    anchorCount: anchors.length,
    anchorSlugs: anchors.map((r) => r.slug).sort(),
    legacyReplacementsCount: legacyReplacements.length,
    // Per-slug declared difficulty (the diff key for Phase 15B). Sorted by
    // slug so byte-diff between pre/post snapshots is grep-able.
    perSlugDifficultyVisible: Object.fromEntries(
      visible
        .map((r) => [r.slug, { course: r.course, difficulty: r.difficulty, isAnchor: r.isAnchor }] as const)
        .sort(([a], [b]) => (a as string).localeCompare(b as string)),
    ),
    notes: {
      pedagogyVisible: "52 / 52 (from Phase 14 close)",
      waveReport: "50 / 50 (from Phase 14 close)",
      lineageCounters: "0 / 0 / 0 / 0 (from Phase 14 close)",
      anchorImmutability: "csv-to-postgres-pipeline + dbt-data-models — frozen, never relabel",
      rubricVersion: "1.0.1 (frozen)",
    },
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`[snapshot-15-pre] wrote ${OUT}`);
  console.log(`  totalProjects=${out.totalProjects}  visible=${out.learnerVisible}  hidden=${out.hidden}`);
  console.log(`  beginner=${perDifficultyVisible.beginner}  intermediate=${perDifficultyVisible.intermediate}  advanced=${perDifficultyVisible.advanced}  unknown=${perDifficultyVisible.unknown}`);
  console.log(`  anchorCount=${out.anchorCount}  anchorSlugs=${out.anchorSlugs.join(",")}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
