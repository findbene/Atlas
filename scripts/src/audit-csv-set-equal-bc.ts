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
import { gradeEnvelopeCapture } from "../../artifacts/api-server/src/lib/envelopeGrade.js";
import type { RunCapture } from "@workspace/execution-core/run-envelope";

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

// ── Synthetic verified captures for the envelope path (Phase 57B-prereq) ────
// 57B-prereq added a DARK `csv_set_equal` branch to `gradeEnvelopeCapture`.
// For every visible (non-opted) row it must return the SAME legacy auto-pass
// tuple as before — whether the capture carries tabular columns/rows (the new
// structured branch) or only stdout (the preserved pre-57B fall-through).
function buildEnvelopeCaptures(): RunCapture[] {
  return [
    // Structured capture — exercises the new rows branch.
    {
      version: 1,
      language: "sql",
      code: "SELECT 1",
      stdout: "1 row(s) in 1ms",
      stderr: "",
      exitCode: 0,
      durationMs: 1,
      timedOut: false,
      columns: ["a"],
      rows: [[1]],
    },
    // Structured capture whose rows would FAIL a real comparison — proves the
    // opt-in gate short-circuits BEFORE comparison for every visible row.
    {
      version: 1,
      language: "sql",
      code: "SELECT 1",
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 1,
      timedOut: false,
      columns: ["a"],
      rows: [["unexpected"]],
    },
    // Stdout-only capture — exercises the preserved pre-57B fall-through.
    {
      version: 1,
      language: "sql",
      code: "SELECT 1",
      stdout: "5 row(s) in 2ms",
      stderr: "",
      exitCode: 0,
      durationMs: 2,
      timedOut: false,
    },
  ];
}

type Mismatch = {
  slug: string;
  stepNumber: number;
  submission: string;
  legacy: { passed: boolean; feedback: string };
  current: { passed: boolean; feedback: string };
};

type CsvCell = string | number | boolean | null;

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

  // Phase 57B-flip — partition: DARK rows must stay byte-identical to the
  // legacy auto-pass; OPTED-IN rows (spec.serverGrade===true) are intentionally
  // NOT BC and instead get positive (correct capture passes) + negative
  // (raw SQL / malformed / wrong-rows / empty all fail closed) verification.
  const isOptedIn = (vc: unknown): boolean =>
    (vc as { spec?: { serverGrade?: unknown } } | null)?.spec?.serverGrade === true;
  const darkRows = rows.filter((r) => !isOptedIn(r.validationConfig));
  const optedRows = rows.filter((r) => isOptedIn(r.validationConfig));

  console.log(
    `\n=== csv_set_equal BC + opt-in audit ===\n` +
      `Visible csv_set_equal steps: ${rows.length}  ` +
      `(dark: ${darkRows.length}, opted-in: ${optedRows.length})\n`,
  );

  // ── DARK rows: legacy auto-pass BC (bare-string + envelope) ────────────────
  const mismatches: Mismatch[] = [];
  const envelopeMismatches: Mismatch[] = [];
  let stepsChecked = 0;
  let submissionsChecked = 0;
  let envelopeChecks = 0;

  for (const row of darkRows) {
    stepsChecked++;
    const step = {
      validationType: row.validationType,
      validationConfig: row.validationConfig,
      expectedOutput: row.expectedOutput,
    };
    for (const sub of buildSubmissions()) {
      submissionsChecked++;
      const legacy = legacyGradeCsvSetEqual();
      const current = gradeSubmission(step, sub);
      if (legacy.passed !== current.passed || legacy.feedback !== current.feedback) {
        mismatches.push({ slug: row.slug, stepNumber: row.stepNumber, submission: sub, legacy, current });
      }
    }
    for (const cap of buildEnvelopeCaptures()) {
      envelopeChecks++;
      const legacy = legacyGradeCsvSetEqual();
      const current = gradeEnvelopeCapture(step, cap);
      if (legacy.passed !== current.passed || legacy.feedback !== current.feedback) {
        envelopeMismatches.push({
          slug: row.slug,
          stepNumber: row.stepNumber,
          submission: `envelope:${cap.columns ? "structured" : "stdout"}`,
          legacy,
          current,
        });
      }
    }
  }

  // ── OPTED-IN rows: real grading contract ───────────────────────────────────
  const optInFailures: string[] = [];
  let optInChecks = 0;

  for (const row of optedRows) {
    const spec = (row.validationConfig as { spec?: Record<string, unknown> } | null)?.spec ?? {};
    const columns = spec.columns as string[] | undefined;
    const expectedRows = spec.expectedRows as CsvCell[][] | undefined;
    const tag = `${row.slug} step ${row.stepNumber}`;
    const step = {
      validationType: row.validationType,
      validationConfig: row.validationConfig,
      expectedOutput: row.expectedOutput,
    };

    if (!Array.isArray(columns) || columns.length === 0 || !Array.isArray(expectedRows)) {
      optInFailures.push(`${tag}: opted-in but missing columns/expectedRows in spec`);
      continue;
    }

    // POSITIVE — the exact committed capture must PASS.
    optInChecks++;
    const correct = JSON.stringify({ columns, rows: expectedRows });
    const pos = gradeSubmission(step, correct);
    if (!pos.passed) {
      optInFailures.push(`${tag}: correct {columns,rows} capture did NOT pass — ${pos.feedback}`);
    }

    // NEGATIVE — each must fail closed (passed === false).
    const mutated: CsvCell[][] = expectedRows.map((r) => [...r]);
    if (mutated[0] && mutated[0].length > 1) {
      const c = mutated[0][1];
      mutated[0][1] = typeof c === "number" ? c + 1 : typeof c === "boolean" ? !c : "X";
    } else if (mutated[0]) {
      mutated[0][0] = "X";
    }
    const negatives: Array<[string, string]> = [
      ["empty", ""],
      ["raw-sql", "select * from mart_subscription_monthly where customer_id = 'C-100'"],
      ["malformed-json", "not json {"],
      ["wrong-rows", JSON.stringify({ columns, rows: mutated })],
    ];
    for (const [name, sub] of negatives) {
      optInChecks++;
      const r = gradeSubmission(step, sub);
      if (r.passed) optInFailures.push(`${tag}: negative '${name}' unexpectedly PASSED`);
    }
  }

  console.log(`Dark steps checked:     ${stepsChecked}`);
  console.log(`  bare-string subs:     ${submissionsChecked}  (mismatches: ${mismatches.length})`);
  console.log(`  envelope captures:    ${envelopeChecks}  (mismatches: ${envelopeMismatches.length})`);
  console.log(`Opted-in steps checked: ${optedRows.length}`);
  console.log(`  opt-in grading checks:${optInChecks}  (failures: ${optInFailures.length})`);

  const allMismatches = [...mismatches, ...envelopeMismatches];
  const failed = allMismatches.length > 0 || optInFailures.length > 0;
  if (failed) {
    if (allMismatches.length > 0) {
      console.log("\nDARK BC MISMATCHES:");
      for (const m of allMismatches) {
        console.log(
          `  ${m.slug} step ${m.stepNumber} submission=${JSON.stringify(m.submission)}\n` +
            `    legacy:  ${JSON.stringify(m.legacy)}\n` +
            `    current: ${JSON.stringify(m.current)}`,
        );
      }
    }
    if (optInFailures.length > 0) {
      console.log("\nOPT-IN CONTRACT FAILURES:");
      for (const f of optInFailures) console.log(`  - ${f}`);
    }
    console.log(
      `\nFAIL — ${mismatches.length} dark bare-string + ${envelopeMismatches.length} dark envelope BC mismatches, ` +
        `${optInFailures.length} opt-in contract failures.`,
    );
    process.exit(1);
  }

  console.log(
    `\nPASS — ${darkRows.length} dark row(s) byte-identical to legacy auto-pass across ` +
      `${submissionsChecked} bare-string + ${envelopeChecks} envelope captures; ` +
      `${optedRows.length} opted-in row(s) grade correctly (correct capture passes; ` +
      `raw SQL / malformed / wrong-rows / empty fail closed).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[audit-csv-set-equal-bc] FATAL:", err);
  process.exit(2);
});
