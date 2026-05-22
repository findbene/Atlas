/**
 * Phase 15B — TARGETED difficulty-label backfill (DORMANT in Phase 15A).
 *
 *   pnpm --filter @workspace/scripts run backfill:phase15-difficulty -- --apply
 *
 * Phase 15A intentionally ships this script with an EMPTY allowlist. Running
 * it is a no-op. Phase 15B will populate the allowlist after the audit is
 * reviewed and explicit per-row approval is granted by the user.
 *
 * Hard invariants (enforced before any UPDATE):
 *   - No anchor slug may appear in the allowlist (csv-to-postgres-pipeline,
 *     dbt-data-models). Build-time assertion.
 *   - Every targeted row must currently have the expected `from` difficulty.
 *     If the live row drifted, the script halts WITHOUT touching that row.
 *   - Every targeted row must be `learner_visible=true`.
 *   - Every `to` value must be one of beginner/intermediate/advanced.
 *   - Idempotent: re-running after a successful apply is a no-op.
 *   - Dry-run by default. Use `--apply` to actually mutate.
 */
import { db, projects } from "@workspace/db";
import { eq } from "drizzle-orm";

type DifficultyKey = "beginner" | "intermediate" | "advanced";
const VALID: ReadonlySet<DifficultyKey> = new Set(["beginner", "intermediate", "advanced"]);

interface AllowlistEntry {
  slug: string;
  from: DifficultyKey;
  to: DifficultyKey;
  reason: string;
}

/**
 * Phase 15A SHIPS THIS LIST EMPTY. Phase 15B populates it AFTER user approval
 * of the audit report. Every entry must have a one-line reason naming the
 * audit-mismatch row it corresponds to.
 */
const ALLOWLIST: ReadonlyArray<AllowlistEntry> = [
  // (Phase 15A: intentionally empty — audit-then-approve gate.)
];

/** Forbidden slugs. Anchors must NEVER be relabeled (P14 invariant). */
const FORBIDDEN_SLUGS: ReadonlySet<string> = new Set([
  "csv-to-postgres-pipeline",
  "dbt-data-models",
]);

function assertAllowlistShape(): void {
  const seen = new Set<string>();
  for (const e of ALLOWLIST) {
    if (FORBIDDEN_SLUGS.has(e.slug)) {
      throw new Error(`[backfill-phase15] HARD FAIL: anchor slug '${e.slug}' is forbidden from the allowlist.`);
    }
    if (!VALID.has(e.from) || !VALID.has(e.to)) {
      throw new Error(`[backfill-phase15] HARD FAIL: '${e.slug}' has invalid from/to (${e.from} → ${e.to}).`);
    }
    if (e.from === e.to) {
      throw new Error(`[backfill-phase15] HARD FAIL: '${e.slug}' has from === to (${e.from}). No-op entry.`);
    }
    if (seen.has(e.slug)) {
      throw new Error(`[backfill-phase15] HARD FAIL: duplicate slug '${e.slug}' in allowlist.`);
    }
    seen.add(e.slug);
    if (!e.reason || e.reason.trim().length < 5) {
      throw new Error(`[backfill-phase15] HARD FAIL: '${e.slug}' is missing a reason.`);
    }
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  assertAllowlistShape();

  if (ALLOWLIST.length === 0) {
    console.log("[backfill-phase15] allowlist is EMPTY — Phase 15A dormant. No DB read, no DB write.");
    console.log("[backfill-phase15] Populate ALLOWLIST and re-run with --apply after Phase 15B approval.");
    return;
  }

  // Pre-flight: load live state for every targeted slug + verify expected `from`.
  const allRows = await db.select().from(projects);
  const bySlug = new Map(allRows.map((r) => [r.slug, r]));

  const plan: Array<{ entry: AllowlistEntry; status: "ok" | "missing" | "from-mismatch" | "hidden" | "already-applied" }> = [];
  for (const e of ALLOWLIST) {
    const row = bySlug.get(e.slug);
    if (!row) { plan.push({ entry: e, status: "missing" }); continue; }
    if (row.learnerVisible === false) { plan.push({ entry: e, status: "hidden" }); continue; }
    if (row.isAnchor === true) {
      // Defensive: should be unreachable thanks to FORBIDDEN_SLUGS, but
      // anchors flagged after the file was authored must still hard-fail.
      throw new Error(`[backfill-phase15] HARD FAIL: '${e.slug}' is flagged is_anchor=true. Refusing.`);
    }
    if (row.difficultyLevel === e.to) { plan.push({ entry: e, status: "already-applied" }); continue; }
    if (row.difficultyLevel !== e.from) { plan.push({ entry: e, status: "from-mismatch" }); continue; }
    plan.push({ entry: e, status: "ok" });
  }

  // Distribution preview (before vs after applying ONLY the `ok` entries).
  const visible = allRows.filter((r) => r.learnerVisible !== false);
  const before: Record<DifficultyKey, number> = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const r of visible) {
    const d = r.difficultyLevel as DifficultyKey;
    if (VALID.has(d)) before[d]++;
  }
  const after = { ...before };
  for (const p of plan) {
    if (p.status !== "ok") continue;
    after[p.entry.from]--;
    after[p.entry.to]++;
  }

  console.log(`[backfill-phase15] allowlist size=${ALLOWLIST.length}  apply=${apply}`);
  console.log(`[backfill-phase15] plan:`);
  for (const p of plan) {
    console.log(`  [${p.status.padEnd(15)}] ${p.entry.slug.padEnd(60)} ${p.entry.from} → ${p.entry.to}  — ${p.entry.reason}`);
  }
  console.log(`[backfill-phase15] visible distribution: BEFORE beg=${before.beginner} int=${before.intermediate} adv=${before.advanced}`);
  console.log(`[backfill-phase15] visible distribution: AFTER  beg=${after.beginner} int=${after.intermediate} adv=${after.advanced}`);

  // Halt if any non-{ok, already-applied} status exists. We do NOT silently
  // skip drift — the user must reconcile the allowlist before re-running.
  const blocking = plan.filter((p) => p.status !== "ok" && p.status !== "already-applied");
  if (blocking.length > 0) {
    console.error(`[backfill-phase15] HARD FAIL: ${blocking.length} blocking entries (missing/hidden/from-mismatch). Refusing to apply.`);
    process.exit(2);
  }

  if (!apply) {
    console.log("[backfill-phase15] DRY-RUN. Re-run with --apply to mutate.");
    return;
  }

  let updated = 0;
  for (const p of plan) {
    if (p.status !== "ok") continue;
    await db.update(projects).set({ difficultyLevel: p.entry.to }).where(eq(projects.slug, p.entry.slug));
    updated++;
  }
  console.log(`[backfill-phase15] applied ${updated} difficulty updates. ALLOWLIST size=${ALLOWLIST.length}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
