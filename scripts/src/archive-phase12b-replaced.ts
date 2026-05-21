/**
 * Phase 12B — Archive replaced Phase 12B legacy twins.
 *
 *   pnpm --filter @workspace/scripts run archive:phase12b-replaced
 *
 * Sets `learner_visible = FALSE` on the 3 legacy slugs that the Phase 12B
 * promotes (Phase-11 deferral completion) superseded. Rows stay in the DB —
 * only their learner-facing visibility flips, so the operation is fully
 * reversible with a single UPDATE.
 *
 * All 3 P12B legacy rows are 1-step skeletons (no real content), so we can
 * use the stricter Phase-10 gate `total_steps <= 1 AND enrolled_count = 0`
 * instead of P11's `enrolled_count = 0` only relaxation.
 *
 * Safety chain (triple-source, mirrors Phase 12A):
 *   1. Target set derived two ways (PHASE12B_LEGACY_SLUG_MAP keys AND
 *      DB-derived `replace_candidate_slug` values for the 3 upgraded
 *      P12B slugs); the two MUST match exactly.
 *   2. 3-slug allowlist (length-asserted) hardcoded as a third defense.
 *   3. Every target row must exist.
 *   4. Every target row must have `total_steps <= 1 AND enrolled_count = 0`.
 *   5. No upgraded P12B slug may be in the target list.
 *   6. Every upgraded P12B twin must currently be `learner_visible = TRUE`
 *      (prevents the "we just hid both halves" footgun).
 *
 * Idempotent: rows already at `learner_visible = false` are logged + skipped.
 */
import { db } from "@workspace/db";
import { projects } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { PHASE12B_LEGACY_SLUG_MAP } from "./authored-lineage";

const LEGACY_SLUGS: readonly string[] = [
  "kafka-streaming-pipeline",
  "ml-feature-store",
  "spark-batch-processing",
];

const UPGRADED_SLUGS: readonly string[] = Object.values(PHASE12B_LEGACY_SLUG_MAP);

async function main(): Promise<void> {
  // ── Hardcoded allowlist self-check ────────────────────────────────────
  if (LEGACY_SLUGS.length !== 3) {
    throw new Error(`[archive-p12b] expected 3 legacy slugs, got ${LEGACY_SLUGS.length}`);
  }
  if (UPGRADED_SLUGS.length !== 3) {
    throw new Error(`[archive-p12b] expected 3 upgraded slugs in map, got ${UPGRADED_SLUGS.length}`);
  }

  // ── Source A: code-derived from PHASE12B_LEGACY_SLUG_MAP keys ─────────
  const codeSet = new Set(Object.keys(PHASE12B_LEGACY_SLUG_MAP));
  const allowSet = new Set(LEGACY_SLUGS);
  if (codeSet.size !== allowSet.size || [...codeSet].some(s => !allowSet.has(s))) {
    throw new Error(
      `[archive-p12b] ABORT — PHASE12B_LEGACY_SLUG_MAP keys diverge from hardcoded allowlist.\n` +
      `  code:  ${[...codeSet].sort().join(", ")}\n` +
      `  allow: ${[...allowSet].sort().join(", ")}`,
    );
  }

  // ── Source B: DB-derived from the 3 upgraded P12B slugs' replace_candidate_slug ──
  // Restrict the DB lookup to just the 3 P12B upgraded slugs so we don't
  // co-mingle with P11's 7 replace_candidate_slug rows.
  const upgradedRows = await db.query.projects.findMany({
    where: inArray(projects.slug, [...UPGRADED_SLUGS]),
    columns: { slug: true, replaceCandidateSlug: true, learnerVisible: true },
  });
  const upgradedBySlug = new Map(upgradedRows.map(r => [r.slug, r]));
  const upgradedMissing = UPGRADED_SLUGS.filter(s => !upgradedBySlug.has(s));
  if (upgradedMissing.length > 0) {
    throw new Error(
      `[archive-p12b] ABORT — ${upgradedMissing.length} upgraded twin(s) missing from DB: ${upgradedMissing.join(", ")}`,
    );
  }
  const dbSet = new Set(
    UPGRADED_SLUGS.map(s => upgradedBySlug.get(s)?.replaceCandidateSlug).filter((s): s is string => !!s),
  );
  if (dbSet.size !== allowSet.size || [...dbSet].some(s => !allowSet.has(s))) {
    throw new Error(
      `[archive-p12b] ABORT — DB-derived replace_candidate_slug set (for the 3 upgraded P12B slugs) diverges from allowlist.\n` +
      `  db:    ${[...dbSet].sort().join(", ")}\n` +
      `  allow: ${[...allowSet].sort().join(", ")}\n` +
      `  hint:  run backfill:phase12b-replace-candidate-slug first.`,
    );
  }

  // ── Upgraded-twin liveness check ──────────────────────────────────────
  const upgradedHidden = UPGRADED_SLUGS.filter(s => upgradedBySlug.get(s)?.learnerVisible === false);
  if (upgradedHidden.length > 0) {
    throw new Error(
      `[archive-p12b] ABORT — ${upgradedHidden.length} upgraded P12B twin(s) are already hidden; ` +
      `refusing to archive their legacy mirrors and leave learners with NO visible version:\n  - ${upgradedHidden.join("\n  - ")}`,
    );
  }

  // ── Cross-check: no upgraded slug may be in the target list ───────────
  const upgradedInTarget = LEGACY_SLUGS.filter(s => UPGRADED_SLUGS.includes(s));
  if (upgradedInTarget.length > 0) {
    throw new Error(
      `[archive-p12b] ABORT — upgraded P12B slug(s) found in target list: ${upgradedInTarget.join(", ")}`,
    );
  }

  // ── Load target rows ───────────────────────────────────────────────────
  const targetRows = await db.query.projects.findMany({
    where: inArray(projects.slug, [...LEGACY_SLUGS]),
    columns: { id: true, slug: true, totalSteps: true, enrolledCount: true, learnerVisible: true },
  });
  const bySlug = new Map(targetRows.map(r => [r.slug, r]));
  const missing = LEGACY_SLUGS.filter(s => !bySlug.has(s));
  if (missing.length > 0) {
    throw new Error(`[archive-p12b] ABORT — ${missing.length} target slug(s) not in DB: ${missing.join(", ")}`);
  }

  // ── Learner-safety gate: total_steps <= 1 AND enrolled_count = 0 ──────
  const safetyViolations = LEGACY_SLUGS
    .map(s => ({ slug: s, steps: bySlug.get(s)!.totalSteps, n: bySlug.get(s)!.enrolledCount }))
    .filter(r => r.steps > 1 || r.n !== 0);
  if (safetyViolations.length > 0) {
    throw new Error(
      `[archive-p12b] ABORT — ${safetyViolations.length} legacy row(s) violate safety gate ` +
      `(total_steps <= 1 AND enrolled_count = 0):\n  - ` +
      safetyViolations.map(r => `${r.slug} (steps=${r.steps}, enrolled=${r.n})`).join("\n  - "),
    );
  }

  // ── Before snapshot ───────────────────────────────────────────────────
  const allBefore = await db.query.projects.findMany({ columns: { learnerVisible: true } });
  const hiddenBefore = allBefore.filter(r => r.learnerVisible === false).length;

  // ── Flip ──────────────────────────────────────────────────────────────
  let flipped = 0, alreadyHidden = 0;
  console.log(`[archive-p12b] target rows (${LEGACY_SLUGS.length}):`);
  for (const slug of LEGACY_SLUGS) {
    const r = bySlug.get(slug)!;
    const upgraded = Object.entries(PHASE12B_LEGACY_SLUG_MAP).find(([k]) => k === slug)?.[1] ?? "?";
    console.log(`  - ${slug}  steps=${r.totalSteps}  enrolled=${r.enrolledCount}  learnerVisible=${r.learnerVisible}  → upgraded twin: ${upgraded}`);
  }
  for (const slug of LEGACY_SLUGS) {
    const r = bySlug.get(slug)!;
    if (r.learnerVisible === false) {
      alreadyHidden++;
      console.log(`[archive-p12b] ${slug}: already hidden (skip)`);
      continue;
    }
    await db.update(projects).set({ learnerVisible: false }).where(eq(projects.id, r.id));
    flipped++;
    console.log(`[archive-p12b] ${slug}: learner_visible TRUE → FALSE`);
  }

  // ── After snapshot ────────────────────────────────────────────────────
  const allAfter = await db.query.projects.findMany({ columns: { learnerVisible: true } });
  const hiddenAfter = allAfter.filter(r => r.learnerVisible === false).length;

  console.log("");
  console.log(`[archive-p12b] done — targeted=${LEGACY_SLUGS.length} flipped=${flipped} alreadyHidden=${alreadyHidden}`);
  console.log(`[archive-p12b] hiddenCount: before=${hiddenBefore}  after=${hiddenAfter}  delta=+${hiddenAfter - hiddenBefore}`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
