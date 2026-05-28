/**
 * Phase 56 — one-shot backward-compatibility audit for the `contains` grader.
 *
 * Reads every visible step with `validation_type = 'contains'` from the live
 * DB and asserts that `matchContains` (the new structured matcher) returns
 * the SAME `{passed, feedback}` as the legacy pre-Phase-56 grader for a
 * curated set of synthetic submissions.
 *
 * This script is NOT a permanent vitest suite. It runs against real DB rows
 * (which are project-content-specific and not stable across seed runs), and
 * exists solely to gate the Phase 56 merge. Architect review references this
 * script's "29 / 29 byte-identical" output as the BC proof. Delete or update
 * if `contains`-using projects change shape.
 *
 * Read-only. Exits non-zero on the first BC violation so CI can gate.
 */
import { db } from "@workspace/db";
import { projects, projectSteps } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { matchContains } from "../../artifacts/api-server/src/lib/grading.js";

// ── Legacy reference implementation ────────────────────────────────────────
// Verbatim copy of the pre-Phase-56 `contains` branch from
// `artifacts/api-server/src/lib/grading.ts:62-72`. Kept inlined so this
// script is self-contained and never drifts even if the production file
// changes again.
function legacyMatchContains(
  config: unknown,
  submission: string | null | undefined,
  expectedOutput: string | undefined,
): { passed: boolean; feedback: string } {
  const c = (config ?? {}) as { needle?: string };
  const needle = c.needle ?? expectedOutput ?? "";
  const passed = submission?.includes(needle) ?? false;
  return {
    passed,
    feedback: passed ? "Correct!" : `Your output should contain: ${needle}`,
  };
}

// ── Curated synthetic submissions per row ──────────────────────────────────
function buildSubmissions(
  config: unknown,
  expectedOutput: string | undefined,
): string[] {
  const c = (config ?? {}) as { needle?: string };
  const needle = c.needle ?? expectedOutput ?? "";
  return [
    "", // empty submission
    " ", // whitespace
    needle, // exact-needle
    `prefix ${needle} suffix`, // sandwiched
    `${needle}${needle}`, // doubled
    "zzz totally unrelated yyy", // miss
    needle.toUpperCase(), // case-shift (legacy is case-sensitive)
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
      validationConfig: projectSteps.validationConfig,
      expectedOutput: projectSteps.expectedOutput,
    })
    .from(projectSteps)
    .innerJoin(projects, eq(projects.id, projectSteps.projectId))
    .where(
      and(
        eq(projects.learnerVisible, true),
        eq(projectSteps.validationType, "contains"),
      ),
    );

  console.log(
    `\n=== Phase 56 — contains BC audit ===\nVisible contains-using steps: ${rows.length}\n`,
  );

  const mismatches: Mismatch[] = [];
  let stepsChecked = 0;
  let submissionsChecked = 0;

  for (const row of rows) {
    stepsChecked++;
    const expected = row.expectedOutput ?? undefined;
    const submissions = buildSubmissions(row.validationConfig, expected);

    for (const sub of submissions) {
      submissionsChecked++;
      const legacy = legacyMatchContains(row.validationConfig, sub, expected);
      const current = matchContains(row.validationConfig, sub, expected);
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
      `\nBC FAIL — ${mismatches.length} legacy-vs-Phase-56 mismatches. Do NOT merge until matchContains returns byte-identical outcomes for all rows.`,
    );
    process.exit(1);
  }

  console.log(
    `\nBC PASS — ${stepsChecked} / ${stepsChecked} visible contains steps produce byte-identical legacy outcomes across ${submissionsChecked} synthetic submissions.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[audit-contains-bc] FATAL:", err);
  process.exit(2);
});
