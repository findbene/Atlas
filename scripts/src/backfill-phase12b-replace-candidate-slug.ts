/**
 * Phase 12B — populate `projects.replace_candidate_slug` for the 3 P12B upgrades.
 *
 *   pnpm --filter @workspace/scripts run backfill:phase12b-replace-candidate-slug
 *
 * Mirrors `backfill-replace-candidate-slug.ts` (Phase 11) — only the map differs.
 * Idempotent: runs an UPDATE per upgraded slug and reports created vs unchanged.
 *
 * Must run AFTER all 3 P12B promotes so the upgraded rows exist, and BEFORE
 * `archive:phase12b-replaced` so the archive script's DB-derived safety
 * cross-check (Source B) sees the new pairs.
 */
import { db, projects } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PHASE12B_LEGACY_SLUG_MAP } from "./authored-lineage";

async function main(): Promise<void> {
  let updated = 0, unchanged = 0, missing = 0;
  for (const [legacySlug, upgradedSlug] of Object.entries(PHASE12B_LEGACY_SLUG_MAP)) {
    const row = await db.query.projects.findFirst({ where: eq(projects.slug, upgradedSlug) });
    if (!row) { console.warn(`[backfill-12b] ${upgradedSlug}: not in DB — skipping`); missing++; continue; }
    const current = (row as { replaceCandidateSlug?: string | null }).replaceCandidateSlug ?? null;
    if (current === legacySlug) { unchanged++; continue; }
    await db.update(projects).set({ replaceCandidateSlug: legacySlug }).where(eq(projects.id, row.id));
    console.log(`[backfill-12b] ${upgradedSlug}.replace_candidate_slug ← '${legacySlug}'`);
    updated++;
  }
  console.log(`[backfill-12b] updated=${updated} unchanged=${unchanged} missing=${missing}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
