/**
 * Phase 35 — Project Authoring contract audit.
 *
 * Run with: pnpm --filter @workspace/scripts run audit:authoring
 *
 * READ-ONLY. Does NOT mutate the database. Does NOT auto-fix anything.
 *
 * Reports, per visible project, whether it satisfies the authoring spec
 * codified in `docs/project-authoring-spec.md`. Distinct from
 * `audit-pedagogy.ts` (which checks the per-step 5/5 pedagogy enrichment)
 * — this audit checks the PROJECT-LEVEL authoring contract:
 *
 *   1. Required project fields populated (title, descriptions, learning
 *      objectives, tech stack, course, course_source = 'authored', etc.).
 *   2. Step structure (>= 4 steps, unique step numbers, step numbers form
 *      a 1..N sequence, every step has a validation_type, expected_outputs,
 *      and a non-empty instruction).
 *   3. Validation: at least one step is machine-verifiable
 *      (validation_type != 'self_attest').
 *   4. A simple hint-leak heuristic: highest-level hint (L4/L5) should not
 *      contain a literal substring of the expected output. Best-effort; the
 *      real anti-leak guarantee lives in the publish-readiness checklist +
 *      human review.
 *
 * NOT checked here (deferred to human review / the publish-readiness
 * checklist): per-step pedagogy density (that's `audit:pedagogy`'s job),
 * candidate-row lineage (covered by `/api/admin/quality` →
 * `lineageIntegrity`), portfolio artifact rendering, and any cross-project
 * uniqueness checks.
 *
 * Exits 0 always — this is a reporting tool, not a CI gate. Use the per-slug
 * status in scripts that decide whether to flip `learner_visible`.
 */
import { db } from "@workspace/db";
import { projects, projectSteps } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import type { PedagogyConfig } from "@workspace/execution-core";
import {
  hintLeakSuspected,
  classifyValidationKind,
  describeEnforcement,
  tallyValidationKinds,
  type EnforcementStatus,
} from "@workspace/curriculum-quality";

type ProjectFinding =
  | "missing-title"
  | "missing-short-description"
  | "missing-full-description"
  | "missing-difficulty"
  | "missing-course"
  | "course-source-legacy"
  | "missing-tech-stack"
  | "missing-learning-objectives"
  | "estimated-minutes-too-low"
  | "no-steps"
  | "fewer-than-four-steps"
  | "duplicate-step-numbers"
  | "non-sequential-step-numbers"
  | "step-missing-validation-type"
  | "step-missing-expected-outputs"
  | "all-steps-self-attest"
  | "step-missing-instruction"
  | "hint-leak-suspected";

type ProjectReport = {
  slug: string;
  title: string;
  course: string | null;
  visible: boolean;
  stepCount: number;
  findings: ProjectFinding[];
  publishReady: boolean;
  /** Phase 42 — every step's validation_type in declared order, for the
   * enforcement-breakdown section of the audit summary. NOT used in any
   * publish-ready finding; reported as informational metadata only. */
  validationTypes: Array<string | null>;
};

const MIN_STEPS = 4;
const MIN_ESTIMATED_MINUTES = 60;

async function auditProject(
  project: typeof projects.$inferSelect,
): Promise<ProjectReport> {
  const findings: ProjectFinding[] = [];
  if (!project.title || project.title.trim().length === 0)
    findings.push("missing-title");
  if (!project.shortDescription || project.shortDescription.trim().length === 0)
    findings.push("missing-short-description");
  if (!project.fullDescription || project.fullDescription.trim().length === 0)
    findings.push("missing-full-description");
  if (!project.difficultyLevel) findings.push("missing-difficulty");
  if (!project.course) findings.push("missing-course");
  if (project.courseSource === "heuristic_legacy")
    findings.push("course-source-legacy");
  if (!Array.isArray(project.techStack) || project.techStack.length === 0)
    findings.push("missing-tech-stack");
  if (
    !Array.isArray(project.learningObjectives) ||
    project.learningObjectives.length === 0
  )
    findings.push("missing-learning-objectives");
  if (
    typeof project.estimatedMinutes === "number" &&
    project.estimatedMinutes < MIN_ESTIMATED_MINUTES
  )
    findings.push("estimated-minutes-too-low");

  const steps = await db.query.projectSteps.findMany({
    where: eq(projectSteps.projectId, project.id),
    orderBy: [asc(projectSteps.stepNumber)],
  });

  if (steps.length === 0) {
    findings.push("no-steps");
    return {
      slug: project.slug,
      title: project.title ?? "",
      course: project.course ?? null,
      visible: project.learnerVisible !== false,
      stepCount: 0,
      findings,
      publishReady: false,
      validationTypes: [],
    };
  }

  if (steps.length < MIN_STEPS) findings.push("fewer-than-four-steps");

  const stepNumbers = steps.map((s) => s.stepNumber);
  const uniqueStepNumbers = new Set(stepNumbers);
  if (uniqueStepNumbers.size !== stepNumbers.length)
    findings.push("duplicate-step-numbers");
  const expectedSequence = Array.from(
    { length: stepNumbers.length },
    (_, i) => i + 1,
  );
  if (
    [...stepNumbers].sort((a, b) => a - b).join(",") !==
    expectedSequence.join(",")
  ) {
    findings.push("non-sequential-step-numbers");
  }

  let allSelfAttest = true;
  for (const step of steps) {
    if (!step.validationType) findings.push("step-missing-validation-type");
    if (step.validationType !== "self_attest") allSelfAttest = false;
    if (
      step.expectedOutputs === null ||
      step.expectedOutputs === undefined ||
      (typeof step.expectedOutputs === "object" &&
        Object.keys(step.expectedOutputs as Record<string, unknown>).length === 0 &&
        step.validationType !== "self_attest")
    ) {
      findings.push("step-missing-expected-outputs");
    }
    if (!step.instructionMd || step.instructionMd.trim().length === 0) {
      findings.push("step-missing-instruction");
    }
    const cfg = (step.pedagogyConfig ?? null) as PedagogyConfig | null;
    if (hintLeakSuspected(cfg, step.expectedOutputs)) {
      findings.push("hint-leak-suspected");
    }
  }
  if (allSelfAttest && steps.length > 0) findings.push("all-steps-self-attest");

  // Deduplicate findings (a step-level finding may fire multiple times).
  const dedupedFindings = Array.from(new Set(findings));

  return {
    slug: project.slug,
    title: project.title ?? "",
    course: project.course ?? null,
    visible: project.learnerVisible !== false,
    stepCount: steps.length,
    findings: dedupedFindings,
    publishReady: dedupedFindings.length === 0,
    validationTypes: steps.map((s) => s.validationType ?? null),
  };
}

function formatReport(report: ProjectReport): string {
  const visTag = report.visible ? "visible" : "hidden ";
  const status = report.publishReady ? "✓ publish-ready" : "✗ gaps";
  const head = `${visTag} ${report.course ?? "?".padEnd(20)} ${report.slug} (${report.stepCount} steps)  ${status}`;
  if (report.findings.length === 0) return head;
  const lines = [head, ...report.findings.map((f) => `    - ${f}`)];
  return lines.join("\n");
}

async function main() {
  const allProjects = await db.query.projects.findMany({
    orderBy: [asc(projects.orderIndex)],
  });

  const reports: ProjectReport[] = [];
  for (const project of allProjects) {
    reports.push(await auditProject(project));
  }

  const visible = reports.filter((r) => r.visible);
  const hidden = reports.filter((r) => !r.visible);
  const visibleReady = visible.filter((r) => r.publishReady);
  const visibleGaps = visible.filter((r) => !r.publishReady);

  console.log("\n=== Atlas Project Authoring Audit (Phase 35) ===\n");
  for (const r of reports) console.log(formatReport(r));

  console.log("");
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log(`  Total projects:                  ${reports.length}`);
  console.log(`  Visible projects:                ${visible.length}`);
  console.log(`  Hidden / archived projects:      ${hidden.length}`);
  console.log(
    `  Visible publish-ready (this audit): ${visibleReady.length} / ${visible.length}`,
  );

  // Per-finding histogram (visible only).
  const findingCounts = new Map<ProjectFinding, number>();
  for (const r of visible) {
    for (const f of r.findings) {
      findingCounts.set(f, (findingCounts.get(f) ?? 0) + 1);
    }
  }
  if (findingCounts.size > 0) {
    console.log("\n  Finding histogram (visible projects):");
    const sorted = [...findingCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [finding, count] of sorted) {
      console.log(`    ${count.toString().padStart(3)} × ${finding}`);
    }
  }

  if (visibleGaps.length > 0) {
    console.log("\n  Visible projects with gaps:");
    for (const r of visibleGaps) {
      console.log(`    - ${r.slug}  (${r.findings.length} findings)`);
    }
  }

  // --- Phase 42 — Validation enforcement breakdown (informational only) ---
  //
  // Aggregates validation_type values across every step of every visible
  // project and groups them by `classifyValidationKind`. NOT a finding; this
  // section never affects publish-ready counts. It exists so the operator
  // can see, at a glance, how much of the catalog the server commit-grader
  // actually evaluates vs. how much is contract-shaped metadata.
  //
  // See `docs/validation-kind-matrix.md` for the full enforcement contract.
  const allVisibleStepKinds: Array<string | null> = [];
  for (const r of visible) allVisibleStepKinds.push(...r.validationTypes);
  const kindTally = tallyValidationKinds(allVisibleStepKinds);
  const byStatus = new Map<EnforcementStatus, number>();
  for (const { count, status } of kindTally.values()) {
    byStatus.set(status, (byStatus.get(status) ?? 0) + count);
  }
  const totalSteps = allVisibleStepKinds.length;
  const projectsWithAnyEnforced = visible.filter((r) =>
    r.validationTypes.some((k) => classifyValidationKind(k) === "enforced"),
  ).length;

  console.log("\n  Validation enforcement breakdown (visible projects, all steps):");
  console.log(
    `    Total steps across visible projects: ${totalSteps}`,
  );
  for (const status of ["enforced", "client-provisional", "contract-shaped", "unknown"] as const) {
    const n = byStatus.get(status) ?? 0;
    const pct = totalSteps > 0 ? Math.round((n / totalSteps) * 100) : 0;
    console.log(
      `      ${n.toString().padStart(3)} (${pct.toString().padStart(2)}%) ${status.padEnd(20)} — ${describeEnforcement(status)}`,
    );
  }
  console.log(
    `    Visible projects with ≥1 server-enforced step: ${projectsWithAnyEnforced} / ${visible.length}  (informational — spec §5.1's actual floor is "not all self_attest", caught by the existing 'all-steps-self-attest' finding)`,
  );

  if (kindTally.size > 0) {
    console.log("\n    Per-kind histogram (visible projects, sorted by count):");
    const sortedKinds = [...kindTally.entries()].sort((a, b) => b[1].count - a[1].count);
    for (const [kind, { count, status }] of sortedKinds) {
      console.log(
        `      ${count.toString().padStart(3)} × ${kind.padEnd(20)} [${status}]`,
      );
    }
  }

  const unknownKinds = [...kindTally.entries()].filter(([, v]) => v.status === "unknown");
  if (unknownKinds.length > 0) {
    console.log(
      "\n    WARNING — unknown validation kinds (typo? not in enum?):",
    );
    for (const [kind, { count }] of unknownKinds) {
      console.log(`      ${count} × ${kind}`);
    }
  }

  console.log(
    "\nNote: read-only audit. No data was modified. See `docs/project-authoring-spec.md` for the contract this report checks against, and `docs/validation-kind-matrix.md` for the Phase 42 enforcement contract behind the breakdown section above.\n",
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
