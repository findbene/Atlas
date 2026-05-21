/**
 * Phase 14 — read-only difficulty distribution audit.
 *
 *   pnpm --filter @workspace/scripts run audit:difficulty
 *
 * Reports the count of learner-visible projects per difficulty level,
 * per course, with the beginner-tier breakdown surfaced separately so
 * the Phase-14 lift (1 → 6 visible beginner) is grep-able.
 *
 * No writes. No state. Idempotent across runs.
 */
import { db, projects } from "@workspace/db";

type DifficultyKey = "beginner" | "intermediate" | "advanced";
const ORDER: DifficultyKey[] = ["beginner", "intermediate", "advanced"];

async function main(): Promise<void> {
  const allRaw = await db.select().from(projects);
  const visible = allRaw.filter((r) => r.learnerVisible !== false);

  const totalByDifficulty: Record<DifficultyKey, number> = { beginner: 0, intermediate: 0, advanced: 0 };
  const beginnerSlugs: Array<{ slug: string; course: string }> = [];
  const perCourse: Record<string, Record<DifficultyKey, number>> = {};

  for (const r of visible) {
    const d = r.difficultyLevel as DifficultyKey;
    if (!ORDER.includes(d)) continue;
    totalByDifficulty[d]++;
    const c = String(r.course ?? "(unset)");
    if (!perCourse[c]) perCourse[c] = { beginner: 0, intermediate: 0, advanced: 0 };
    perCourse[c][d]++;
    if (d === "beginner") beginnerSlugs.push({ slug: r.slug, course: c });
  }

  console.log("=".repeat(72));
  console.log("Phase 14 — Visible Project Difficulty Distribution");
  console.log("=".repeat(72));
  console.log(`Total learner-visible projects: ${visible.length}`);
  console.log("");
  console.log("By difficulty (visible only):");
  for (const d of ORDER) {
    const pct = visible.length === 0 ? 0 : ((totalByDifficulty[d] / visible.length) * 100).toFixed(1);
    console.log(`  ${d.padEnd(13)} ${String(totalByDifficulty[d]).padStart(3)}  (${pct}%)`);
  }
  console.log("");
  console.log("Per-course breakdown:");
  console.log(`  ${"course".padEnd(24)} ${"beg".padStart(4)} ${"int".padStart(4)} ${"adv".padStart(4)} ${"tot".padStart(4)}`);
  for (const c of Object.keys(perCourse).sort()) {
    const row = perCourse[c];
    const total = row.beginner + row.intermediate + row.advanced;
    console.log(
      `  ${c.padEnd(24)} ${String(row.beginner).padStart(4)} ${String(row.intermediate).padStart(4)} ${String(row.advanced).padStart(4)} ${String(total).padStart(4)}`,
    );
  }
  console.log("");
  console.log("Beginner-tier visible slugs:");
  if (beginnerSlugs.length === 0) {
    console.log("  (none)");
  } else {
    for (const { slug, course } of beginnerSlugs.sort((a, b) => a.slug.localeCompare(b.slug))) {
      console.log(`  - [${course}] ${slug}`);
    }
  }
  console.log("=".repeat(72));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
