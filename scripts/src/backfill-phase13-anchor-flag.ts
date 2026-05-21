/**
 * Phase 13 — flag exactly the two rubric calibration anchors with
 * `projects.is_anchor=true`.
 *
 *   pnpm --filter @workspace/scripts run backfill:phase13-anchor-flag
 *
 * Idempotent. Asserts the invariants T001 requires:
 *   - both target rows exist
 *   - both are learner_visible=true
 *   - after run, EXACTLY 2 rows have is_anchor=true
 *   - no other row is flagged
 *   - no content / steps / candidateId / score / rubric target is touched
 */
import { db, projects } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const ANCHOR_SLUGS = ["csv-to-postgres-pipeline", "dbt-data-models"] as const;

async function main(): Promise<void> {
  const rows = await db.select().from(projects).where(inArray(projects.slug, [...ANCHOR_SLUGS]));
  if (rows.length !== 2) {
    throw new Error(
      `[phase13-anchor] expected exactly 2 anchor rows, got ${rows.length}: ` +
      `${rows.map((r) => r.slug).join(",")}`,
    );
  }
  for (const r of rows) {
    if (r.learnerVisible !== true) {
      throw new Error(`[phase13-anchor] anchor '${r.slug}' must be learner_visible=true (got ${r.learnerVisible})`);
    }
  }

  let flipped = 0, alreadyFlagged = 0;
  for (const slug of ANCHOR_SLUGS) {
    const row = rows.find((r) => r.slug === slug)!;
    if (row.isAnchor === true) {
      alreadyFlagged++;
      console.log(`[phase13-anchor] ${slug}: already is_anchor=true`);
      continue;
    }
    const updated = await db.update(projects)
      .set({ isAnchor: true })
      .where(eq(projects.slug, slug))
      .returning({ id: projects.id, slug: projects.slug });
    if (updated.length !== 1) {
      throw new Error(`[phase13-anchor] ${slug}: expected 1-row update, got ${updated.length}`);
    }
    flipped++;
    console.log(`[phase13-anchor] ${slug}: flipped to is_anchor=true`);
  }

  // Post-condition: EXACTLY 2 rows flagged platform-wide.
  const all = await db.select({ slug: projects.slug, isAnchor: projects.isAnchor }).from(projects);
  const flagged = all.filter((r) => r.isAnchor === true).map((r) => r.slug).sort();
  if (flagged.length !== 2) {
    throw new Error(`[phase13-anchor] post-condition failed: expected 2 is_anchor=true rows, got ${flagged.length}: ${flagged.join(",")}`);
  }
  const expected = [...ANCHOR_SLUGS].sort();
  if (flagged[0] !== expected[0] || flagged[1] !== expected[1]) {
    throw new Error(`[phase13-anchor] post-condition failed: flagged set ${flagged.join(",")} != expected ${expected.join(",")}`);
  }
  console.log(`[phase13-anchor] OK  flipped=${flipped}  alreadyFlagged=${alreadyFlagged}  total=${flagged.length}`);
  console.log(`[phase13-anchor] anchorSlugs: ${flagged.join(",")}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
