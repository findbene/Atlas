/**
 * Phase 61G — `contains` ENFORCEMENT audit.
 *
 * Replaces the Phase-56 BC-vs-auto-pass audit, whose premise (every visible
 * contains step grades byte-identically to the legacy auto-pass) was invalidated
 * when 61G fixed the dead-gate runtime: `grading.ts`'s contains branch now
 * extracts the inner `spec` (the `validationConfig()` wrapped shape) before
 * calling `matchContains`, so authored `{spec:{needles}}` steps actually enforce.
 *
 * For every visible `contains` step this audit extracts the matcher spec exactly
 * as the runtime does (inner `spec` when present, else the top-level config),
 * derives the required markers, and asserts — via the REAL `gradeSubmission` — that:
 *   1. a GOOD submission containing every marker PASSES;
 *   2. an EMPTY submission FAILS;
 *   3. dropping ANY single required marker FAILS (the known-bad case — proves no
 *      needle is ignored / the gate is not dead).
 * A step with no marker spec that auto-passes a garbage submission (and has no
 * `expected_output` fallback) is itself flagged as a dead gate.
 *
 * Read-only. Exits non-zero on the first violation so CI / the phase ritual gates.
 */
import { db } from "@workspace/db";
import { projects, projectSteps } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { gradeSubmission } from "../../artifacts/api-server/src/lib/grading.js";

type Row = {
  slug: string;
  stepNumber: number;
  validationType: string;
  validationConfig: unknown;
  expectedOutput: string | null;
};

/** Mirror the production runtime: inner `spec` when present, else the config. */
function extractMarkers(cfg: unknown): string[] | null {
  const c = (cfg ?? {}) as Record<string, unknown>;
  const inner = (c.spec && typeof c.spec === "object" ? c.spec : c) as Record<string, unknown>;
  if (Array.isArray(inner.needles)) {
    return (inner.needles as unknown[]).filter((n): n is string => typeof n === "string" && n.length > 0);
  }
  if (typeof inner.needle === "string" && inner.needle.length > 0) return [inner.needle];
  return null; // empty / expectedOutput-fallback shape — no inline markers
}

function grade(row: Row, submission: string) {
  return gradeSubmission(
    {
      validationType: row.validationType,
      validationConfig: row.validationConfig,
      expectedOutput: row.expectedOutput,
    } as Parameters<typeof gradeSubmission>[0],
    submission,
  );
}

async function main() {
  const rows = (await db
    .select({
      slug: projects.slug,
      stepNumber: projectSteps.stepNumber,
      validationType: projectSteps.validationType,
      validationConfig: projectSteps.validationConfig,
      expectedOutput: projectSteps.expectedOutput,
    })
    .from(projectSteps)
    .innerJoin(projects, eq(projects.id, projectSteps.projectId))
    .where(and(eq(projects.learnerVisible, true), eq(projectSteps.validationType, "contains")))) as Row[];

  console.log(`\n=== Phase 61G — contains ENFORCEMENT audit ===\nVisible contains steps: ${rows.length}\n`);

  const failures: string[] = [];
  let enforcing = 0;
  let checks = 0;

  for (const row of rows) {
    const tag = `${row.slug} step ${row.stepNumber}`;
    const markers = extractMarkers(row.validationConfig);

    if (!markers || markers.length === 0) {
      // No inline markers. Acceptable only if an expected_output fallback drives a
      // real check; otherwise a garbage submission must not pass (dead gate).
      checks++;
      const bad = grade(row, "__atlas_marker_definitely_absent__");
      if (bad.passed && !row.expectedOutput) {
        failures.push(`${tag}: no marker spec and no expected_output, yet a garbage submission PASSED (dead gate).`);
      }
      continue;
    }

    enforcing++;
    const good = markers.join("\n");

    // 1. GOOD → pass
    checks++;
    const pos = grade(row, good);
    if (!pos.passed) failures.push(`${tag}: GOOD submission (all ${markers.length} markers) did NOT pass — ${pos.feedback}`);

    // 2. EMPTY → fail
    checks++;
    if (grade(row, "").passed) failures.push(`${tag}: EMPTY submission unexpectedly PASSED (dead gate).`);

    // 3. KNOWN-BAD: drop each required marker in turn → must fail
    for (let i = 0; i < markers.length; i++) {
      checks++;
      const missing = markers.filter((_, j) => j !== i).join("\n");
      if (grade(row, missing).passed) {
        failures.push(`${tag}: dropping required marker '${markers[i]}' still PASSED (needle ignored).`);
      }
    }
  }

  console.log(`Marker-enforcing steps: ${enforcing} / ${rows.length}`);
  console.log(`Assertions checked:     ${checks}`);
  console.log(`Failures:               ${failures.length}`);

  if (failures.length > 0) {
    console.log("\nCONTAINS ENFORCEMENT FAILURES:");
    for (const f of failures) console.log(`  - ${f}`);
    console.log(`\nFAIL — ${failures.length} contains enforcement violation(s).`);
    process.exit(1);
  }

  console.log(
    `\nPASS — every marker-bearing contains step enforces: a complete submission passes; ` +
      `an empty submission and dropping ANY single required marker fail closed.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[audit-contains-bc] FATAL:", err);
  process.exit(2);
});
