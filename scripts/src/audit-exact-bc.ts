/**
 * Phase 61H — `exact` enforcement audit.
 *
 * The `exact` runtime grades the submission against the DB `expected_output`
 * column. Pre-61H, an exact step with `expected_output` null/empty fell through
 * to the generic auto-pass — a dead gate (the authoring→promote path never
 * populates `expected_output`, so every authored exact step auto-passed; C2 steps
 * 4/6 were exactly this, now converted to `contains`). 61H makes exact fail closed.
 *
 * This audit asserts, via the REAL `gradeSubmission`:
 *   1. NO visible `exact` step has a null/empty `expected_output` (a step that
 *      cannot be graded — either the old auto-pass or the new fail-everyone — must
 *      not ship); for a populated one, the correct submission passes and a wrong
 *      one fails.
 *   2. SYNTHETIC fail-closed proof (DB-independent): a missing/empty expected
 *      FAILS, and a populated expected grades correctly.
 *
 * Read-only. Exits non-zero on the first violation.
 */
import { db } from "@workspace/db";
import { projects, projectSteps } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { gradeSubmission } from "../../artifacts/api-server/src/lib/grading.js";

function grade(validationConfig: unknown, expectedOutput: string | null, submission: string) {
  return gradeSubmission(
    { validationType: "exact", validationConfig, expectedOutput } as Parameters<typeof gradeSubmission>[0],
    submission,
  );
}

async function main() {
  const rows = await db
    .select({
      slug: projects.slug,
      stepNumber: projectSteps.stepNumber,
      validationConfig: projectSteps.validationConfig,
      expectedOutput: projectSteps.expectedOutput,
    })
    .from(projectSteps)
    .innerJoin(projects, eq(projects.id, projectSteps.projectId))
    .where(and(eq(projects.learnerVisible, true), eq(projectSteps.validationType, "exact")));

  console.log(`\n=== Phase 61H — exact enforcement audit ===\nVisible exact steps: ${rows.length}\n`);

  const failures: string[] = [];

  // 1. No dead/unenforceable exact gate among visible steps.
  for (const r of rows) {
    const tag = `${r.slug} step ${r.stepNumber}`;
    if (!r.expectedOutput || r.expectedOutput.length === 0) {
      const res = grade(r.validationConfig, r.expectedOutput, "__atlas_anything__");
      if (res.passed) {
        failures.push(`${tag}: exact step with null/empty expected_output AUTO-PASSED (dead gate).`);
      } else {
        failures.push(
          `${tag}: exact step has null/empty expected_output — it cannot be graded ` +
            `(now fails every learner). Convert to contains/self_attest or populate expected_output.`,
        );
      }
    } else {
      if (!grade(r.validationConfig, r.expectedOutput, r.expectedOutput).passed) {
        failures.push(`${tag}: a correct exact submission did NOT pass.`);
      }
      if (grade(r.validationConfig, r.expectedOutput, `${r.expectedOutput}__wrong__`).passed) {
        failures.push(`${tag}: a wrong exact submission unexpectedly PASSED.`);
      }
    }
  }

  // 2. Synthetic fail-closed proof (DB-independent — always runs).
  const synth: string[] = [];
  if (grade(null, null, "anything").passed) synth.push("null expected auto-passed (NOT fail-closed)");
  if (grade(null, "", "anything").passed) synth.push("empty expected auto-passed (NOT fail-closed)");
  if (!grade(null, "foo", "foo").passed) synth.push("a correct populated expected did not pass");
  if (grade(null, "foo", "bar").passed) synth.push("a wrong populated expected passed");

  console.log(`Visible exact step violations: ${failures.length}`);
  console.log(`Synthetic fail-closed violations: ${synth.length}`);

  if (failures.length > 0 || synth.length > 0) {
    for (const f of failures) console.log(`  - ${f}`);
    for (const s of synth) console.log(`  - SYNTH: ${s}`);
    console.log(`\nFAIL — exact dead-gate / fail-closed violation(s).`);
    process.exit(1);
  }

  console.log(
    `\nPASS — no visible exact dead gates; the runtime fails closed for a missing/empty ` +
      `expected and grades a populated expected correctly.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[audit-exact-bc] FATAL:", err);
  process.exit(2);
});
