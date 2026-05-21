/**
 * Phase 12A — Archive replaced Phase 11 legacy twins.
 *
 *   pnpm --filter @workspace/scripts run archive:phase11-replaced
 *
 * Sets `learner_visible = FALSE` on the 7 legacy slugs that the Phase 11
 * batch-3 promotes superseded. Rows stay in the DB — only their learner-facing
 * visibility flips, so the operation is fully reversible with a single UPDATE.
 *
 * Approved Phase 12A deviation from the Phase 10 archive script (which gates
 * on `total_steps = 0 AND enrolled_count = 0`): two of these legacy rows have
 * pre-existing 5-step stub content from earlier phases (ai-eng-llm-eval-harness,
 * mlops-model-serving-canary). The learner-safety invariant is "do not
 * silently archive a project with active learner progress" — so the gate here
 * is `enrolled_count = 0` only. Hard-fails on any violation, no partial apply.
 *
 * Safety chain:
 *   1. Target set derived two ways (PHASE11_LEGACY_SLUG_MAP keys AND
 *      DB-derived `replace_candidate_slug` values); the two MUST match exactly.
 *   2. 7-slug allowlist (length-asserted) hardcoded as a third defense.
 *   3. Every target row must exist.
 *   4. Every target row must have `enrolled_count = 0`.
 *   5. No upgraded P11 slug may be in the target list (cross-check vs
 *      PHASE11_LEGACY_SLUG_MAP values).
 *   6. Every upgraded P11 twin must currently be `learner_visible = TRUE`
 *      (prevents the "we just hid both halves" footgun).
 *
 * Idempotent: rows already at `learner_visible = false` are logged + skipped,
 * not aborted.
 */
import { db } from "@workspace/db";
import { projects } from "@workspace/db";
import { eq, inArray, isNotNull } from "drizzle-orm";
import { PHASE11_LEGACY_SLUG_MAP } from "./authored-lineage";

const LEGACY_SLUGS: readonly string[] = [
  "ai-eng-llm-eval-harness",
  "mlops-model-serving-canary",
  "delta-lake-lakehouse",
  "snowflake-data-warehouse",
  "airflow-etl-dag",
  "api-to-warehouse-ingestion",
  "data-quality-framework",
];

const UPGRADED_SLUGS: readonly string[] = Object.values(PHASE11_LEGACY_SLUG_MAP);

async function main(): Promise<void> {
  // ── Hardcoded allowlist self-check ────────────────────────────────────
  if (LEGACY_SLUGS.length !== 7) {
    throw new Error(`[archive-p11] expected 7 legacy slugs, got ${LEGACY_SLUGS.length}`);
  }
  if (UPGRADED_SLUGS.length !== 7) {
    throw new Error(`[archive-p11] expected 7 upgraded slugs in map, got ${UPGRADED_SLUGS.length}`);
  }

  // ── Source A: code-derived from PHASE11_LEGACY_SLUG_MAP keys ──────────
  const codeSet = new Set(Object.keys(PHASE11_LEGACY_SLUG_MAP));
  const allowSet = new Set(LEGACY_SLUGS);
  if (codeSet.size !== allowSet.size || [...codeSet].some(s => !allowSet.has(s))) {
    throw new Error(
      `[archive-p11] ABORT — PHASE11_LEGACY_SLUG_MAP keys diverge from hardcoded allowlist.\n` +
      `  code: ${[...codeSet].sort().join(", ")}\n` +
      `  allow: ${[...allowSet].sort().join(", ")}`,
    );
  }

  // ── Source B: DB-derived from projects.replace_candidate_slug ────────
  const upgradedRowsWithReplace = await db.query.projects.findMany({
    where: isNotNull(projects.replaceCandidateSlug),
    columns: { slug: true, replaceCandidateSlug: true, learnerVisible: true },
  });
  const dbSet = new Set(upgradedRowsWithReplace.map(r => r.replaceCandidateSlug!).filter(Boolean));
  if (dbSet.size !== allowSet.size || [...dbSet].some(s => !allowSet.has(s))) {
    throw new Error(
      `[archive-p11] ABORT — DB-derived replace_candidate_slug set diverges from allowlist.\n` +
      `  db:    ${[...dbSet].sort().join(", ")}\n` +
      `  allow: ${[...allowSet].sort().join(", ")}`,
    );
  }

  // ── Upgraded-twin liveness check ──────────────────────────────────────
  const upgradedBySlug = new Map(upgradedRowsWithReplace.map(r => [r.slug, r]));
  const upgradedMissing = UPGRADED_SLUGS.filter(s => !upgradedBySlug.has(s));
  if (upgradedMissing.length > 0) {
    throw new Error(
      `[archive-p11] ABORT — ${upgradedMissing.length} upgraded twin(s) missing from DB ` +
      `(or their replace_candidate_slug is null): ${upgradedMissing.join(", ")}`,
    );
  }
  const upgradedHidden = UPGRADED_SLUGS.filter(s => upgradedBySlug.get(s)?.learnerVisible === false);
  if (upgradedHidden.length > 0) {
    throw new Error(
      `[archive-p11] ABORT — ${upgradedHidden.length} upgraded P11 twin(s) are already hidden; ` +
      `refusing to archive their legacy mirrors and leave learners with NO visible version:\n  - ${upgradedHidden.join("\n  - ")}`,
    );
  }

  // ── Cross-check: no upgraded slug may be in the target list ───────────
  const upgradedInTarget = LEGACY_SLUGS.filter(s => UPGRADED_SLUGS.includes(s));
  if (upgradedInTarget.length > 0) {
    throw new Error(
      `[archive-p11] ABORT — upgraded P11 slug(s) found in target list: ${upgradedInTarget.join(", ")}`,
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
    throw new Error(`[archive-p11] ABORT — ${missing.length} target slug(s) not in DB: ${missing.join(", ")}`);
  }

  // ── Learner-safety gate: enrolled_count must be 0 ─────────────────────
  // Approved deviation from Phase-10's `total_steps = 0 AND enrolled_count = 0`.
  const enrolledViolations = LEGACY_SLUGS
    .map(s => ({ slug: s, n: bySlug.get(s)!.enrolledCount }))
    .filter(r => r.n !== 0);
  if (enrolledViolations.length > 0) {
    throw new Error(
      `[archive-p11] ABORT — ${enrolledViolations.length} legacy row(s) have active enrolment; ` +
      `archive would silently strip learners mid-progress:\n  - ` +
      enrolledViolations.map(r => `${r.slug} (enrolled=${r.n})`).join("\n  - "),
    );
  }

  // ── Before snapshot ───────────────────────────────────────────────────
  const allBefore = await db.query.projects.findMany({ columns: { learnerVisible: true } });
  const hiddenBefore = allBefore.filter(r => r.learnerVisible === false).length;

  // ── Flip ──────────────────────────────────────────────────────────────
  let flipped = 0, alreadyHidden = 0;
  console.log(`[archive-p11] target rows (${LEGACY_SLUGS.length}):`);
  for (const slug of LEGACY_SLUGS) {
    const r = bySlug.get(slug)!;
    const upgraded = Object.entries(PHASE11_LEGACY_SLUG_MAP).find(([k]) => k === slug)?.[1] ?? "?";
    console.log(`  - ${slug}  steps=${r.totalSteps}  enrolled=${r.enrolledCount}  learnerVisible=${r.learnerVisible}  → upgraded twin: ${upgraded}`);
  }
  for (const slug of LEGACY_SLUGS) {
    const r = bySlug.get(slug)!;
    if (r.learnerVisible === false) {
      alreadyHidden++;
      console.log(`[archive-p11] ${slug}: already hidden (skip)`);
      continue;
    }
    await db.update(projects).set({ learnerVisible: false }).where(eq(projects.id, r.id));
    flipped++;
    console.log(`[archive-p11] ${slug}: learner_visible TRUE → FALSE`);
  }

  // ── After snapshot ────────────────────────────────────────────────────
  const allAfter = await db.query.projects.findMany({ columns: { learnerVisible: true } });
  const hiddenAfter = allAfter.filter(r => r.learnerVisible === false).length;

  console.log("");
  console.log(`[archive-p11] done — targeted=${LEGACY_SLUGS.length} flipped=${flipped} alreadyHidden=${alreadyHidden}`);
  console.log(`[archive-p11] hiddenCount: before=${hiddenBefore}  after=${hiddenAfter}  delta=+${hiddenAfter - hiddenBefore}`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
