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
 * SAFETY: each slug must have `total_steps = 0` (read from the schema
 * column) AND zero rows in `user_progress` for its project id (live query
 * via `getActualEnrollmentCounts`) BEFORE any UPDATE runs. If any slug
 * fails either check the entire batch aborts — NO partial application.
 *
 * Phase 38 hardening: the enrolment half of the gate previously read
 * `projects.enrolled_count`, which is denormalized with a schema default
 * of 0 and no writer in the enrollment routes (a stale-false-safe gate).
 * It now reads `user_progress` directly through the shared helper.
 *
 * Idempotent: slugs already at `learner_visible = false` are skipped.
 */
import { db } from "@workspace/db";
import { projects } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { getActualEnrollmentCounts } from "./lib/enrollment-check";
import { findProjectsWithCandidates } from "./lib/candidate-check";

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

  // Phase 38: live enrolment counts from user_progress (NOT the denormalized
  // projects.enrolled_count column, which has no writer in enrollment routes).
  const liveCounts = await getActualEnrollmentCounts(rows.map(r => r.id));

  // Safety check — every slug must be zero-exposure before flipping.
  const violations: string[] = [];
  for (const slug of ARCHIVE_SLUGS) {
    const r = bySlug.get(slug)!;
    const liveEnrolled = liveCounts.get(r.id) ?? 0;
    if (r.totalSteps !== 0 || liveEnrolled !== 0) {
      violations.push(`${slug} (steps=${r.totalSteps}, user_progress_rows=${liveEnrolled}, stale_counter=${r.enrolledCount})`);
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `[archive] ABORT — ${violations.length} slug(s) failed the zero-exposure check; ` +
      `NO rows changed. Investigate before hiding:\n  - ${violations.join("\n  - ")}`,
    );
  }

  // Phase 40 — candidate-lineage safety gate.
  // Refuse to hide any project that is the promoted target of a
  // project_candidates row. Hiding it would silently break the bidirectional
  // lineage invariant (see replit.md § Active Invariants / Gates and
  // scripts/src/lib/candidate-check.ts for full rationale).
  const candidateLinks = await findProjectsWithCandidates(rows.map(r => r.id));
  if (candidateLinks.length > 0) {
    const lines = candidateLinks.map(({ projectId, candidateCount }) => {
      const slug = rows.find(r => r.id === projectId)?.slug ?? projectId;
      return `${slug} (candidate_rows=${candidateCount})`;
    });
    throw new Error(
      `[archive] ABORT — ${candidateLinks.length} slug(s) are the promoted target of a project_candidates row; ` +
      `hiding would orphan the lineage:\n  - ${lines.join("\n  - ")}`,
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
