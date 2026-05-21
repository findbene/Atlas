/**
 * Phase 11 — populate `projects.replace_candidate_slug` for the 7 P11 upgrades.
 *
 *   pnpm --filter @workspace/scripts run backfill:replace-candidate-slug
 *
 * The column was added in T001 with a CHECK constraint forbidding self-reference.
 * It records the legacy slug that each upgraded P11 project supersedes, so the
 * admin /api/admin/quality surface can later flag legacy rows for archive.
 * Idempotent — runs an UPDATE per upgraded slug and reports created vs unchanged.
 */
import { db, projects } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PHASE11_LEGACY_SLUG_MAP } from "./authored-lineage";

async function main(): Promise<void> {
  let updated = 0, unchanged = 0, missing = 0;
  for (const [legacySlug, upgradedSlug] of Object.entries(PHASE11_LEGACY_SLUG_MAP)) {
    const row = await db.query.projects.findFirst({ where: eq(projects.slug, upgradedSlug) });
    if (!row) { console.warn(`[backfill] ${upgradedSlug}: not in DB — skipping`); missing++; continue; }
    const current = (row as { replaceCandidateSlug?: string | null }).replaceCandidateSlug ?? null;
    if (current === legacySlug) { unchanged++; continue; }
    await db.update(projects).set({ replaceCandidateSlug: legacySlug }).where(eq(projects.id, row.id));
    console.log(`[backfill] ${upgradedSlug}.replace_candidate_slug ← '${legacySlug}'`);
    updated++;
  }
  console.log(`[backfill] updated=${updated} unchanged=${unchanged} missing=${missing}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
