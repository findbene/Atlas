/**
 * Phase 57A — one-shot backward-compatibility audit for the `csv_set_equal`
 * grader.
 *
 * Reads every visible step with `validation_type = 'csv_set_equal'` from the
 * live DB and asserts that the new dispatch path (`gradeSubmission` →
 * `gradeCsvSetEqual` when present) returns the SAME `{passed, feedback}` as
 * the pre-Phase-57A grader for a curated set of synthetic submissions.
 *
 * Phase 57A is DARK: no live row carries `spec.serverGrade: true`, so the
 * new comparator must return the legacy auto-pass tuple for every visible
 * row. Any divergence is a BC violation and blocks merge.
 *
 * This script is NOT a permanent vitest suite — it queries real DB rows
 * (which are content-specific and not stable across seed runs) and exists
 * solely to gate the Phase 57A merge. Architect review references this
 * script's "15 / 15 byte-identical" output as the BC proof. Delete or
 * update if `csv_set_equal`-using projects change shape.
 *
 * Read-only. Exits non-zero on the first BC violation so CI can gate.
 */
import { db } from "@workspace/db";
import { projects, projectSteps } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { gradeSubmission } from "../../artifacts/api-server/src/lib/grading.js";

// ── Legacy reference implementation ────────────────────────────────────────
// Verbatim copy of the pre-Phase-57A behavior: `csv_set_equal` had no case
// in `gradeSubmission` and fell through to the default
// `{passed:true, feedback:"Step completed."}`. Kept inlined so this script
// is self-contained and never drifts.
function legacyGradeCsvSetEqual(): { passed: boolean; feedback: string } {
  return { passed: true, feedback: "Step completed." };
}

// ── Curated synthetic submissions per row ──────────────────────────────────
// Even though no row opts in to server grading today, we exercise each row
// with a variety of submission shapes (empty, garbage, valid-shape, etc.)
// to prove the BC auto-pass branch is reached BEFORE any parsing happens.
function buildSubmissions(): string[] {
  return [
    "",
    " ",
    "anything",
    "not json {",
    "{}",
    JSON.stringify({ columns: ["a"], rows: [[1]] }),
    JSON.stringify({ columns: [], rows: [] }),
  ];
}

type Mismatch = {
  slug: string;
  stepNumber: number;
  submission: string;
  legacy: { passed: boolean; feedback: string };
  current: { passed: boolean; feedback: string };
};

async function main() {
  const rows = await db
    .select({
      slug: projects.slug,
      stepNumber: projectSteps.stepNumber,
      validationType: projectSteps.validationType,
      validationConfig: projectSteps.validationConfig,
      expectedOutput: projectSteps.expectedOutput,
    })
    .from(projectSteps)
    .innerJoin(projects, eq(projects.id, projectSteps.projectId))
    .where(
      and(
        eq(projects.learnerVisible, true),
        eq(projectSteps.validationType, "csv_set_equal"),
      ),
    );

  console.log(
    `\n=== Phase 57A — csv_set_equal BC audit ===\nVisible csv_set_equal steps: ${rows.length}\n`,
  );

  const mismatches: Mismatch[] = [];
  let stepsChecked = 0;
  let submissionsChecked = 0;

  for (const row of rows) {
    stepsChecked++;
    // Defensive: detect any row that has accidentally opted into server
    // grading. Phase 57A intentionally has zero opt-ins; flag loudly if
    // an authored project lands one before the operator is ready.
    const cfg = (row.validationConfig ?? {}) as { spec?: { serverGrade?: unknown } };
    if (cfg?.spec?.serverGrade === true) {
      console.log(
        `  WARN — ${row.slug} step ${row.stepNumber} has spec.serverGrade=true. ` +
          `Phase 57A expects ZERO opt-ins; this row will be graded for real. ` +
          `Verify deliberate before merging.`,
      );
    }

    const submissions = buildSubmissions();

    for (const sub of submissions) {
      submissionsChecked++;
      const legacy = legacyGradeCsvSetEqual();
      const current = gradeSubmission(
        {
          validationType: row.validationType,
          validationConfig: row.validationConfig,
          expectedOutput: row.expectedOutput,
        },
        sub,
      );
      if (
        legacy.passed !== current.passed ||
        legacy.feedback !== current.feedback
      ) {
        mismatches.push({
          slug: row.slug,
          stepNumber: row.stepNumber,
          submission: sub,
          legacy,
          current,
        });
      }
    }
  }

  console.log(`Steps checked:        ${stepsChecked}`);
  console.log(`Submissions checked:  ${submissionsChecked}`);
  console.log(`BC mismatches:        ${mismatches.length}`);

  if (mismatches.length > 0) {
    console.log("\nMISMATCHES:");
    for (const m of mismatches) {
      console.log(
        `  ${m.slug} step ${m.stepNumber} submission=${JSON.stringify(m.submission)}\n` +
          `    legacy:  ${JSON.stringify(m.legacy)}\n` +
          `    current: ${JSON.stringify(m.current)}`,
      );
    }
    console.log(
      `\nBC FAIL — ${mismatches.length} legacy-vs-Phase-57A mismatches. Do NOT merge until gradeCsvSetEqual returns byte-identical outcomes for all visible rows under the BC (no-opt-in) path.`,
    );
    process.exit(1);
  }

  console.log(
    `\nBC PASS — ${stepsChecked} / ${stepsChecked} visible csv_set_equal steps produce byte-identical legacy outcomes across ${submissionsChecked} synthetic submissions.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[audit-csv-set-equal-bc] FATAL:", err);
  process.exit(2);
});
