/**
 * Phase 10 — Archive cohort visibility flip.
 *
 *   pnpm --filter @workspace/scripts run archive:thin-stubs
 *
 * Sets `learner_visible = FALSE` on the 22 thin-stub legacy slugs identified
 * by Phase-9 triage (`docs/phase9/legacy-triage.md`). Rows stay in the DB —
 * only their learner-facing visibility flips, so the operation is fully
 * reversible with a single UPDATE.
 *
 * SAFETY: each slug is asserted to have `total_steps = 0` AND
 * `enrolled_count = 0` BEFORE any UPDATE runs. If any slug fails the check
 * (e.g. a learner enrolled between manifest generation and this run, or a
 * step skeleton was added), the entire batch aborts with a clear error —
 * NO partial application.
 *
 * Idempotent: slugs already at `learner_visible = false` are skipped.
 */
import { db } from "@workspace/db";
import { projects } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const ARCHIVE_SLUGS: readonly string[] = [
  // data-engineering (16)
  "advanced-partitioning",
  "capstone-streaming",
  "data-access-governance",
  "data-contracts",
  "data-freshness-monitoring",
  "data-lineage-graph",
  "data-platform-api",
  "geospatial-data-pipeline",
  "graph-data-pipeline",
  "llm-data-pipeline",
  "log-analytics-pipeline",
  "multi-cloud-platform",
  "reverse-etl-pipeline",
  "streaming-joins-windows",
  "time-series-pipeline",
  "trino-federated-queries",
  // mlops-engineer (3)
  "dbt-testing-ci",
  "kubernetes-data-platform",
  "mlflow-pipeline",
  // analytics-engineer (1)
  "dbt-advanced-patterns",
  // cloud-data-engineer (2)
  "capstone-lakehouse",
  "warehouse-cost-optimization",
];

async function main(): Promise<void> {
  if (ARCHIVE_SLUGS.length !== 22) {
    throw new Error(`[archive] expected 22 archive slugs, got ${ARCHIVE_SLUGS.length}`);
  }

  const rows = await db.query.projects.findMany({
    where: inArray(projects.slug, [...ARCHIVE_SLUGS]),
    columns: {
      id: true, slug: true, totalSteps: true, enrolledCount: true, learnerVisible: true,
    },
  });
  const bySlug = new Map(rows.map(r => [r.slug, r]));
  const missing = ARCHIVE_SLUGS.filter(s => !bySlug.has(s));
  if (missing.length > 0) {
    throw new Error(`[archive] ABORT — ${missing.length} slug(s) not present in DB: ${missing.join(", ")}`);
  }

  // Safety check — every slug must be zero-exposure before flipping.
  const violations: string[] = [];
  for (const slug of ARCHIVE_SLUGS) {
    const r = bySlug.get(slug)!;
    if (r.totalSteps !== 0 || r.enrolledCount !== 0) {
      violations.push(`${slug} (steps=${r.totalSteps}, enrolled=${r.enrolledCount})`);
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `[archive] ABORT — ${violations.length} slug(s) failed the zero-exposure check; ` +
      `NO rows changed. Investigate before hiding:\n  - ${violations.join("\n  - ")}`,
    );
  }

  let flipped = 0, alreadyHidden = 0;
  for (const slug of ARCHIVE_SLUGS) {
    const r = bySlug.get(slug)!;
    if (r.learnerVisible === false) {
      alreadyHidden++;
      continue;
    }
    await db.update(projects).set({ learnerVisible: false }).where(eq(projects.id, r.id));
    flipped++;
    console.log(`[archive] ${slug}: learner_visible TRUE → FALSE`);
  }

  console.log(
    `[archive] done — flipped=${flipped} alreadyHidden=${alreadyHidden} total=${ARCHIVE_SLUGS.length}`,
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
