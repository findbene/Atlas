/**
 * Phase 4 — Pedagogy coverage audit.
 *
 * Run with: pnpm --filter @workspace/scripts run audit:pedagogy
 *
 * Prints, per project + per step, which of the five pedagogy fields are
 * populated (learning_objective, required_skill, hint ladder 1-5,
 * feedback pair, portfolio relevance), then a global summary.
 *
 * This is a reporting tool only — it does not mutate the database.
 */
import { db } from "@workspace/db";
import { projects, projectSteps } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import type { PedagogyConfig } from "@workspace/execution-core";

type Coverage = {
  hasObjective: boolean;
  hasSkill: boolean;
  ladderFilled: number;
  hasFeedbackPair: boolean;
  hasPortfolio: boolean;
};

function score(cov: Coverage): { passed: number; total: number; fullyEnriched: boolean } {
  const checks = [
    cov.hasObjective,
    cov.hasSkill,
    cov.ladderFilled === 5,
    cov.hasFeedbackPair,
    cov.hasPortfolio,
  ];
  const passed = checks.filter(Boolean).length;
  return { passed, total: checks.length, fullyEnriched: passed === checks.length };
}

async function main() {
  const allProjects = await db.query.projects.findMany({
    orderBy: [asc(projects.orderIndex)],
  });

  let fullyEnrichedProjects = 0;
  const partials: string[] = [];

  for (const project of allProjects) {
    const steps = await db.query.projectSteps.findMany({
      where: eq(projectSteps.projectId, project.id),
      orderBy: [asc(projectSteps.stepNumber)],
    });
    if (steps.length === 0) continue;

    let projectFullyEnriched = true;
    const lines: string[] = [];

    for (const step of steps) {
      const cfg = (step.pedagogyConfig ?? null) as PedagogyConfig | null;
      const ladderFilled = cfg
        ? (["hintLevel1", "hintLevel2", "hintLevel3", "hintLevel4", "hintLevel5"] as const)
            .filter(k => typeof cfg[k] === "string" && (cfg[k] as string).length > 0).length
        : 0;
      const cov: Coverage = {
        hasObjective: !!step.learningObjective,
        hasSkill: !!step.requiredSkill,
        ladderFilled,
        hasFeedbackPair: !!cfg?.successFeedback && !!cfg?.failureFeedback,
        hasPortfolio: !!cfg?.portfolioRelevance,
      };
      const s = score(cov);
      if (!s.fullyEnriched) projectFullyEnriched = false;

      const tick = (b: boolean) => (b ? "✓" : "·");
      lines.push(
        `  Step ${step.stepNumber}: ${tick(cov.hasObjective)} objective  ${tick(cov.hasSkill)} skill  ` +
        `${cov.ladderFilled === 5 ? "✓" : cov.ladderFilled > 0 ? "~" : "·"} ladder(${cov.ladderFilled}/5)  ` +
        `${tick(cov.hasFeedbackPair)} feedback  ${tick(cov.hasPortfolio)} portfolio   ` +
        `[${s.passed}/${s.total}]`,
      );
    }

    if (projectFullyEnriched) fullyEnrichedProjects++;
    else partials.push(project.slug);

    console.log(`\n${project.slug} (${project.language ?? "?"}, ${steps.length} steps)${projectFullyEnriched ? "  ✓ fully enriched" : ""}`);
    for (const l of lines) console.log(l);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`SUMMARY: ${fullyEnrichedProjects} / ${allProjects.length} projects fully enriched`);
  if (partials.length > 0) {
    console.log("Missing or partial:");
    for (const slug of partials) console.log(`  - ${slug}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
