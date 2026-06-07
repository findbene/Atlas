/**
 * Phase 58A — backward-compatibility + opt-in-readiness audit for the
 * `sql_resultset` grader.
 *
 * Mirrors `audit-csv-set-equal-bc.ts`. Two guarantees:
 *
 *   1. DARK BC — every visible `sql_resultset` step that does NOT carry
 *      `spec.serverGrade === true` (i.e. all 25 live rows today) must grade
 *      byte-identically to the pre-Phase-58A behavior. Before 58A,
 *      `sql_resultset` had NO case in `gradeSubmission` and fell through to
 *      the generic `{passed:true, feedback:"Step completed."}` default; the
 *      envelope path routed `capture.stdout` through that same default. The
 *      new dark branch must reproduce that exact tuple for both the
 *      bare-string commit path and the envelope path (structured + stdout
 *      captures). Any divergence is a BC violation and blocks merge.
 *
 *   2. OPT-IN READINESS — the comparator's real grading contract is exercised
 *      WITHOUT opting in any DB row:
 *        (a) any DB row that IS opted in (none today) gets positive + negative
 *            verification, identical to the csv audit; and
 *        (b) a SYNTHETIC in-memory opted-in step proves the positive case
 *            passes and every fail-closed path (raw SQL, malformed JSON, empty,
 *            wrong columns, missing row, extra unmatched row) fails closed.
 *
 * Negative tests avoid fragile fixture collisions: the "extra unmatched row"
 * negative appends a guaranteed-novel all-string sentinel row (right width)
 * rather than mutating a cell in place, so it cannot accidentally reproduce an
 * already-expected row and false-green the gate.
 *
 * Read-only against the DB. Exits non-zero on the first violation so CI can
 * gate. NOT a permanent vitest suite (it queries content-specific live rows);
 * the durable unit coverage lives in `grading.test.ts` / `envelopeGrade.test.ts`.
 */
import { db } from "@workspace/db";
import { projects, projectSteps } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { gradeSubmission } from "../../artifacts/api-server/src/lib/grading.js";
import { gradeEnvelopeCapture } from "../../artifacts/api-server/src/lib/envelopeGrade.js";
import type { RunCapture } from "@workspace/execution-core/run-envelope";

type CsvCell = string | number | boolean | null;

// ── Legacy reference: pre-58A sql_resultset fell through to the default. ────
function legacyGradeSqlResultset(): { passed: boolean; feedback: string } {
  return { passed: true, feedback: "Step completed." };
}

// ── Curated synthetic submissions exercised against each DARK row ───────────
function buildSubmissions(): string[] {
  return [
    "",
    " ",
    "select * from t",
    "not json {",
    "{}",
    JSON.stringify({ columns: ["a"], rows: [[1]] }),
    JSON.stringify({ columns: [], rows: [] }),
  ];
}

// ── Synthetic verified captures for the envelope path ──────────────────────
function buildEnvelopeCaptures(): RunCapture[] {
  return [
    // Structured capture — exercises the new dark rows branch.
    {
      version: 1, language: "sql", code: "SELECT 1",
      stdout: "1 row(s) in 1ms", stderr: "", exitCode: 0, durationMs: 1, timedOut: false,
      columns: ["a"], rows: [[1]],
    },
    // Structured capture whose rows would FAIL a real comparison — proves the
    // opt-in gate short-circuits BEFORE comparison for every visible row.
    {
      version: 1, language: "sql", code: "SELECT 1",
      stdout: "", stderr: "", exitCode: 0, durationMs: 1, timedOut: false,
      columns: ["a"], rows: [["unexpected"]],
    },
    // Stdout-only capture — exercises the preserved pre-58A fall-through.
    {
      version: 1, language: "sql", code: "SELECT 1",
      stdout: "5 row(s) in 2ms", stderr: "", exitCode: 0, durationMs: 2, timedOut: false,
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

const isOptedIn = (vc: unknown): boolean =>
  (vc as { spec?: { serverGrade?: unknown } } | null)?.spec?.serverGrade === true;

function runOptInContract(
  tag: string,
  columns: string[],
  expectedRows: CsvCell[][],
  failures: string[],
): number {
  let checks = 0;
  const step = {
    validationType: "sql_resultset",
    validationConfig: { spec: { serverGrade: true, columns, expectedRows } },
    expectedOutput: null,
  };

  // POSITIVE — the exact committed capture must PASS.
  checks++;
  const correct = JSON.stringify({ columns, rows: expectedRows });
  const pos = gradeSubmission(step, correct);
  if (!pos.passed) failures.push(`${tag}: correct {columns,rows} capture did NOT pass — ${pos.feedback}`);

  // NEGATIVES — every one must fail closed (passed === false).
  // Collision-proof "extra unmatched row": append an all-string sentinel row
  // (right width) that cannot appear in any real expected row.
  const sentinelRow: CsvCell[] = columns.map((_, j) => `__atlas_neg_sentinel_${j}__`);
  const extraRow: CsvCell[][] = [...expectedRows.map((r) => [...r]), sentinelRow];
  // "missing row": drop the last expected row (when there is more than one).
  const missingRow: CsvCell[][] = expectedRows.slice(0, Math.max(0, expectedRows.length - 1));
  // "wrong columns": rename the first column.
  const wrongColumns = ["__atlas_wrong_col__", ...columns.slice(1)];

  const negatives: Array<[string, string]> = [
    ["empty", ""],
    ["raw-sql", "select * from mart where customer_id = 'C-100'"],
    ["malformed-json", "not json {"],
    ["wrong-columns", JSON.stringify({ columns: wrongColumns, rows: expectedRows })],
    ["extra-unmatched-row", JSON.stringify({ columns, rows: extraRow })],
  ];
  if (expectedRows.length > 1) {
    negatives.push(["missing-row", JSON.stringify({ columns, rows: missingRow })]);
  }
  for (const [name, sub] of negatives) {
    checks++;
    const r = gradeSubmission(step, sub);
    if (r.passed) failures.push(`${tag}: negative '${name}' unexpectedly PASSED`);
  }
  return checks;
}

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
        eq(projectSteps.validationType, "sql_resultset"),
      ),
    );

  const darkRows = rows.filter((r) => !isOptedIn(r.validationConfig));
  const optedRows = rows.filter((r) => isOptedIn(r.validationConfig));

  console.log(
    `\n=== sql_resultset BC + opt-in audit ===\n` +
      `Visible sql_resultset steps: ${rows.length}  ` +
      `(dark: ${darkRows.length}, opted-in: ${optedRows.length})\n`,
  );

  // ── DARK rows: legacy auto-pass BC (bare-string + envelope) ───────────────
  const mismatches: Mismatch[] = [];
  const envelopeMismatches: Mismatch[] = [];
  let submissionsChecked = 0;
  let envelopeChecks = 0;

  for (const row of darkRows) {
    const step = {
      validationType: row.validationType,
      validationConfig: row.validationConfig,
      expectedOutput: row.expectedOutput,
    };
    for (const sub of buildSubmissions()) {
      submissionsChecked++;
      const legacy = legacyGradeSqlResultset();
      const current = gradeSubmission(step, sub);
      if (legacy.passed !== current.passed || legacy.feedback !== current.feedback) {
        mismatches.push({ slug: row.slug, stepNumber: row.stepNumber, submission: sub, legacy, current });
      }
    }
    for (const cap of buildEnvelopeCaptures()) {
      envelopeChecks++;
      const legacy = legacyGradeSqlResultset();
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

  // ── OPTED-IN DB rows (none today): real grading contract ──────────────────
  const optInFailures: string[] = [];
  let optInChecks = 0;
  for (const row of optedRows) {
    const spec = (row.validationConfig as { spec?: Record<string, unknown> } | null)?.spec ?? {};
    const columns = spec.columns as string[] | undefined;
    const expectedRows = spec.expectedRows as CsvCell[][] | undefined;
    const tag = `${row.slug} step ${row.stepNumber}`;
    if (!Array.isArray(columns) || columns.length === 0 || !Array.isArray(expectedRows)) {
      optInFailures.push(`${tag}: opted-in but missing columns/expectedRows in spec`);
      continue;
    }
    optInChecks += runOptInContract(tag, columns, expectedRows, optInFailures);
  }

  // ── SYNTHETIC opt-in simulation (no DB mutation) ──────────────────────────
  // Proves the comparator's grading contract end-to-end through the dispatch
  // path even though zero DB rows opt in. Uses an arbitrary multi-row,
  // duplicate-bearing rowset unrelated to any real fixture.
  const simFailures: string[] = [];
  const simChecks = runOptInContract(
    "SYNTHETIC sql_resultset opt-in",
    ["audit_k", "audit_v"],
    [
      ["alpha", 1],
      ["beta", 2],
      ["beta", 2],
    ],
    simFailures,
  );

  console.log(`Dark steps checked:        ${darkRows.length}`);
  console.log(`  bare-string subs:        ${submissionsChecked}  (mismatches: ${mismatches.length})`);
  console.log(`  envelope captures:       ${envelopeChecks}  (mismatches: ${envelopeMismatches.length})`);
  console.log(`Opted-in DB steps checked: ${optedRows.length}  (checks: ${optInChecks}, failures: ${optInFailures.length})`);
  console.log(`Synthetic opt-in checks:   ${simChecks}  (failures: ${simFailures.length})`);

  const allMismatches = [...mismatches, ...envelopeMismatches];
  const failed =
    allMismatches.length > 0 || optInFailures.length > 0 || simFailures.length > 0;
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
      console.log("\nOPT-IN CONTRACT FAILURES (DB rows):");
      for (const f of optInFailures) console.log(`  - ${f}`);
    }
    if (simFailures.length > 0) {
      console.log("\nSYNTHETIC OPT-IN SIMULATION FAILURES:");
      for (const f of simFailures) console.log(`  - ${f}`);
    }
    console.log(
      `\nFAIL — ${mismatches.length} dark bare-string + ${envelopeMismatches.length} dark envelope BC mismatches, ` +
        `${optInFailures.length} opt-in DB failures, ${simFailures.length} synthetic-sim failures.`,
    );
    process.exit(1);
  }

  console.log(
    `\nPASS — ${darkRows.length} dark sql_resultset row(s) byte-identical to legacy auto-pass across ` +
      `${submissionsChecked} bare-string + ${envelopeChecks} envelope captures; ` +
      `${optedRows.length} opted-in DB row(s) + the synthetic opt-in simulation grade correctly ` +
      `(correct capture passes; raw SQL / malformed / empty / wrong-columns / missing-row / ` +
      `extra-unmatched-row fail closed).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[audit-sql-resultset-bc] FATAL:", err);
  process.exit(2);
});
