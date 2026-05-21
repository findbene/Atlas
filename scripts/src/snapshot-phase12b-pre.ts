/**
 * Phase 12B — pre-state snapshot.
 *
 *   pnpm --filter @workspace/scripts exec tsx ./src/snapshot-phase12b-pre.ts
 *
 * Captures `.local/phase12b-pre-state.json` as the immutable diff baseline.
 */
import { db, projects } from "@workspace/db";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.INIT_CWD || process.cwd();
const OUT = path.join(ROOT, ".local", "phase12b-pre-state.json");

async function main(): Promise<void> {
  const allRaw = await db.select().from(projects);
  const all = allRaw.map((r: any) => ({
    slug: r.slug as string,
    course: r.course as string | null,
    totalSteps: (r.totalSteps ?? 0) as number,
    enrolled: (r.enrolledCount ?? 0) as number,
    visible: r.learnerVisible !== false,
    replaceCandidateSlug: (r.replaceCandidateSlug ?? null) as string | null,
  }));

  const visible = all.filter(r => r.visible);
  const hidden = all.filter(r => !r.visible);
  const visibleThin = visible.filter(r => (r.totalSteps ?? 0) < 5);
  const legacyReplacements = all.filter(r => !!r.replaceCandidateSlug);

  const out = {
    capturedAt: new Date().toISOString(),
    totalProjects: all.length,
    learnerVisible: visible.length,
    hidden: hidden.length,
    hiddenCount: hidden.length,
    visibleThinStubs: {
      count: visibleThin.length,
      slugs: visibleThin.map(r => ({ slug: r.slug, course: r.course, steps: r.totalSteps, enrolled: r.enrolled })),
    },
    legacyReplacementsCount: legacyReplacements.length,
    legacyReplacementsPairs: legacyReplacements.map(r => ({
      upgradedSlug: r.slug,
      legacySlug: r.replaceCandidateSlug,
      legacyHidden: all.find(x => x.slug === r.replaceCandidateSlug)?.visible === false,
    })),
    notes: {
      pedagogyAll: "40 / 72 (verified via audit:pedagogy this turn)",
      pedagogyVisible: "40 / 43 (verified via audit:pedagogy this turn)",
      lineageCounters: "0 / 0 / 0 / 0 + orphan=0 (verified via phase11-final-gates.ts this turn)",
      adminLegacyReplacementsCount: "7 (from Phase 12A admin surface)",
    },
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`[snapshot-12b-pre] wrote ${OUT}`);
  console.log(`  totalProjects=${out.totalProjects}  visible=${out.learnerVisible}  hidden=${out.hidden}`);
  console.log(`  visibleThinStubs=${out.visibleThinStubs.count}  legacyReplacements=${out.legacyReplacementsCount}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
