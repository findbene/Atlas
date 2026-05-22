/**
 * Phase 15A — read-only difficulty-label audit.
 *
 *   pnpm --filter @workspace/scripts run audit:difficulty-labels
 *
 * Walks every `learner_visible=true` project, joins the step count + total
 * estimated minutes + pedagogy-ladder completeness, then computes a CONSERVATIVE
 * `suggested_difficulty` via a PURE local heuristic. Anchors short-circuit
 * to their declared difficulty (never suggested for mutation).
 *
 * NO writes. Writes a report to `.local/phase15-difficulty-audit.json` plus
 * a human-readable table to stdout.
 *
 * Heuristic rules (intentionally conservative — Phase 15A operating principle
 * is "prefer no-change over aggressive relabeling"):
 *
 *   1. ANCHOR  → suggested = declared. Never flagged.
 *   2. ADVANCED-KEYWORD MATCH on slug/title/short → suggested = "advanced"
 *      (kafka, spark, airflow, lakehouse, mlops, kubernetes, canary,
 *       monitoring, distributed, streaming, real-time, snowflake, delta-lake,
 *       feature-store, ci-cd, deployment, orchestration, llm-eval, rag, ...).
 *      Never suggest beginner for these — short-circuit before step/duration math.
 *   3. STEP COUNT + DURATION:
 *      - steps ≤ 2 AND estMinutes ≤ 120 AND no advanced keyword → "beginner"
 *      - steps ≤ 4 AND estMinutes ≤ 300 → "intermediate"
 *      - else → "advanced"
 *   4. NEW-AUTHORED COURSE PATTERN: any slug starting with `<course>-beginner-`
 *      is canonically beginner (the Phase 14 naming convention). Trust it.
 *   5. Tie-break: prefer no-change. Mismatch is reported ONLY when
 *      suggested !== declared.
 */
import { db, projects, projectSteps } from "@workspace/db";
import { eq } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.INIT_CWD || process.cwd();
const OUT = path.join(ROOT, ".local", "phase15-difficulty-audit.json");

type DifficultyKey = "beginner" | "intermediate" | "advanced";

/**
 * Substrings that, if present in slug/title/short, force a suggestion of
 * "advanced" regardless of step count or duration. These are the markers
 * of distributed-systems / streaming / cloud-infra / production-deployment
 * scope that a beginner cannot realistically own.
 */
const ADVANCED_KEYWORDS = [
  "kafka", "spark", "airflow", "lakehouse", "mlops", "kubernetes", "canary",
  "monitoring", "distributed", "streaming", "real-time", "realtime",
  "snowflake", "delta-lake", "feature-store", "ci-cd", "cicd",
  "deployment", "orchestration", "llm-eval", "rag-evaluation",
  "data-mesh", "lakehouse", "feast", "great-expectations", "soda",
  "exactly-once", "eos", "pyspark", "aqe", "skew", "warehouse",
  "data-catalog", "column-store", "flink", "mlops-engineer",
  "applied-llm", "model-serving", "feature-pipeline", "point-in-time",
];

function hasAdvancedKeyword(...fields: Array<string | null | undefined>): string | null {
  for (const f of fields) {
    if (!f) continue;
    const lo = f.toLowerCase();
    for (const kw of ADVANCED_KEYWORDS) {
      if (lo.includes(kw)) return kw;
    }
  }
  return null;
}

function suggestDifficulty(input: {
  slug: string;
  title: string;
  shortDescription: string | null;
  course: string | null;
  steps: number;
  estimatedMinutes: number;
  isAnchor: boolean;
  declared: DifficultyKey;
}): { suggested: DifficultyKey; reason: string } {
  // Rule 1 — anchors short-circuit to declared. Never relabel.
  if (input.isAnchor) {
    return { suggested: input.declared, reason: "anchor — short-circuit to declared (frozen)" };
  }
  // Rule 4 — canonical beginner naming convention (P14 authoring pattern).
  const beginnerNameMatch = input.course && input.slug.startsWith(`${input.course}-beginner-`);
  if (beginnerNameMatch) {
    return { suggested: "beginner", reason: `slug matches '<course>-beginner-*' canonical pattern` };
  }
  // Rule 2 — advanced-keyword guard (must precede step/duration math).
  const kw = hasAdvancedKeyword(input.slug, input.title, input.shortDescription);
  if (kw) {
    return { suggested: "advanced", reason: `advanced-keyword '${kw}' in slug/title/desc` };
  }
  // Rule 3 — step + duration heuristic. Conservative: only call beginner when
  // BOTH step count is ≤2 AND estimated time is ≤120 min.
  if (input.steps <= 2 && input.estimatedMinutes <= 120) {
    return { suggested: "beginner", reason: `steps=${input.steps} estMin=${input.estimatedMinutes} (≤2 / ≤120)` };
  }
  if (input.steps <= 4 && input.estimatedMinutes <= 300) {
    return { suggested: "intermediate", reason: `steps=${input.steps} estMin=${input.estimatedMinutes} (≤4 / ≤300)` };
  }
  return { suggested: "advanced", reason: `steps=${input.steps} estMin=${input.estimatedMinutes} (>4 or >300)` };
}

interface AuditRow {
  slug: string;
  course: string | null;
  declared: DifficultyKey;
  suggested: DifficultyKey;
  reason: string;
  totalSteps: number;
  estimatedMinutes: number;
  authoredStepCount: number;
  isAnchor: boolean;
  mismatch: boolean;
}

async function main(): Promise<void> {
  const projectRows = await db.select().from(projects);
  const visible = projectRows.filter((r) => r.learnerVisible !== false);

  // Single-pass authored-step count per project (some legacy rows have a
  // totalSteps column that doesn't match the actual project_steps row count).
  // Pull all steps once then group in memory — cheaper than N round-trips.
  const allSteps = await db.select({ projectId: projectSteps.projectId }).from(projectSteps);
  const stepsPerProject = new Map<string, number>();
  for (const s of allSteps) {
    stepsPerProject.set(s.projectId, (stepsPerProject.get(s.projectId) ?? 0) + 1);
  }

  const rows: AuditRow[] = [];
  for (const p of visible) {
    const declared = p.difficultyLevel as DifficultyKey;
    if (declared !== "beginner" && declared !== "intermediate" && declared !== "advanced") {
      // Skip rows with unknown difficulty rather than mis-suggesting them.
      // They surface in the snapshot's perDifficultyVisible.unknown bucket.
      continue;
    }
    const authoredStepCount = stepsPerProject.get(p.id) ?? 0;
    const stepsForHeuristic = Math.max(p.totalSteps ?? 0, authoredStepCount);
    const { suggested, reason } = suggestDifficulty({
      slug: p.slug,
      title: p.title ?? p.slug,
      shortDescription: p.shortDescription ?? null,
      course: (p.course as string | null) ?? null,
      steps: stepsForHeuristic,
      estimatedMinutes: p.estimatedMinutes ?? 0,
      isAnchor: p.isAnchor === true,
      declared,
    });
    rows.push({
      slug: p.slug,
      course: (p.course as string | null) ?? null,
      declared,
      suggested,
      reason,
      totalSteps: p.totalSteps ?? 0,
      estimatedMinutes: p.estimatedMinutes ?? 0,
      authoredStepCount,
      isAnchor: p.isAnchor === true,
      mismatch: suggested !== declared,
    });
  }

  const mismatches = rows.filter((r) => r.mismatch);
  // Hard invariant: anchors must never appear in the mismatch list.
  const anchorMismatch = mismatches.find((r) => r.isAnchor);
  if (anchorMismatch) {
    // Defensive — Rule 1 should make this impossible. Crash if it isn't.
    console.error(`[audit:difficulty-labels] HARD FAIL: anchor ${anchorMismatch.slug} appears in mismatch list. Heuristic Rule 1 violated.`);
    process.exit(2);
  }

  const totalsByDeclared: Record<DifficultyKey, number> = { beginner: 0, intermediate: 0, advanced: 0 };
  const totalsBySuggested: Record<DifficultyKey, number> = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const r of rows) {
    totalsByDeclared[r.declared]++;
    totalsBySuggested[r.suggested]++;
  }

  const perCourse: Record<string, Record<DifficultyKey, number>> = {};
  for (const r of rows) {
    const c = r.course ?? "(unset)";
    if (!perCourse[c]) perCourse[c] = { beginner: 0, intermediate: 0, advanced: 0 };
    perCourse[c][r.declared]++;
  }

  // Console report
  console.log("=".repeat(78));
  console.log("Phase 15A — Difficulty-Label Audit (read-only)");
  console.log("=".repeat(78));
  console.log(`Audited visible projects: ${rows.length}`);
  console.log("");
  console.log("Distribution — DECLARED vs SUGGESTED:");
  console.log(`  beginner      declared=${String(totalsByDeclared.beginner).padStart(3)}  suggested=${String(totalsBySuggested.beginner).padStart(3)}`);
  console.log(`  intermediate  declared=${String(totalsByDeclared.intermediate).padStart(3)}  suggested=${String(totalsBySuggested.intermediate).padStart(3)}`);
  console.log(`  advanced      declared=${String(totalsByDeclared.advanced).padStart(3)}  suggested=${String(totalsBySuggested.advanced).padStart(3)}`);
  console.log("");
  console.log(`Mismatches (declared ≠ suggested): ${mismatches.length}`);
  if (mismatches.length > 0) {
    console.log("");
    console.log("  slug                                                          declared      suggested     reason");
    for (const r of mismatches.sort((a, b) => a.slug.localeCompare(b.slug))) {
      console.log(`  ${r.slug.padEnd(60)} ${r.declared.padEnd(13)} ${r.suggested.padEnd(13)} ${r.reason}`);
    }
  }
  console.log("");
  console.log("Per-course DECLARED breakdown:");
  for (const c of Object.keys(perCourse).sort()) {
    const row = perCourse[c];
    console.log(`  ${c.padEnd(24)} beg=${row.beginner}  int=${row.intermediate}  adv=${row.advanced}`);
  }
  console.log("=".repeat(78));
  console.log(`Anchor immutability: ${rows.filter((r) => r.isAnchor).length} anchors audited, 0 mismatches (Rule 1 enforced).`);
  console.log("=".repeat(78));

  // JSON output
  const json = {
    capturedAt: new Date().toISOString(),
    phase: "phase15A_audit",
    auditedVisibleProjects: rows.length,
    totalsByDeclared,
    totalsBySuggested,
    mismatchCount: mismatches.length,
    mismatches: mismatches.sort((a, b) => a.slug.localeCompare(b.slug)),
    perCourseDeclared: perCourse,
    anchorCount: rows.filter((r) => r.isAnchor).length,
    anchorSlugs: rows.filter((r) => r.isAnchor).map((r) => r.slug).sort(),
    heuristicNotes: [
      "Rule 1: anchors short-circuit to declared.",
      "Rule 4: '<course>-beginner-*' slug pattern is canonical beginner.",
      "Rule 2: advanced-keyword match forces 'advanced' (precedes step/duration math).",
      "Rule 3: steps≤2 AND estMin≤120 → beginner; steps≤4 AND estMin≤300 → intermediate; else advanced.",
      "Tie-break: prefer no-change. Mismatches are REPORTED, never auto-applied.",
    ],
  };
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(json, null, 2) + "\n");
  console.log(`[audit:difficulty-labels] wrote ${OUT}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
