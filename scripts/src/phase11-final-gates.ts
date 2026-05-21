import { db, projects, projectCandidates } from "@workspace/db";

async function main() {
  const allProj = await db.query.projects.findMany();
  const allCand = await db.query.projectCandidates.findMany();

  const promoted = allProj.filter(p => p.sourceCandidateId);
  const candWithInverse = allCand.filter(c => c.promotedProjectId);
  const mismatches = promoted.filter(p => {
    const c = allCand.find(x => x.id === p.sourceCandidateId);
    return !c || c.promotedProjectId !== p.id;
  }).length;
  const inverseMismatches = candWithInverse.filter(c => {
    const p = allProj.find(x => x.id === c.promotedProjectId);
    return !p || p.sourceCandidateId !== c.id;
  }).length;
  const dupCounts: Record<string, number> = {};
  for (const p of promoted) {
    const k = p.sourceCandidateId!;
    dupCounts[k] = (dupCounts[k] || 0) + 1;
  }
  const duplicateCandidatePromotions = Object.values(dupCounts).filter(n => n > 1).reduce((a, b) => a + (b - 1), 0);

  const hidden = allProj.filter(p => p.learnerVisible === false);

  const phase11LegacySlugs = ["ai-eng-llm-eval-harness", "mlops-model-serving-canary", "delta-lake-lakehouse", "snowflake-data-warehouse", "airflow-etl-dag", "api-to-warehouse-ingestion", "data-quality-framework"];
  const phase11LegacyState = phase11LegacySlugs.map(s => {
    const r = allProj.find(p => p.slug === s);
    return { slug: s, exists: !!r, learnerVisible: r?.learnerVisible, totalSteps: r?.totalSteps, enrolledCount: r?.enrolledCount };
  });

  const phase11UpgradedSlugs = ["ai-engineer-llm-eval-harness", "ai-engineer-model-serving-canary", "cloud-data-engineer-delta-lake-lakehouse", "cloud-data-engineer-snowflake-data-warehouse", "data-engineering-airflow-etl-dag", "data-engineering-api-to-warehouse-ingestion", "data-engineering-data-quality-framework"];
  const phase11UpgradedState = phase11UpgradedSlugs.map(s => {
    const r = allProj.find(p => p.slug === s);
    return { slug: s, exists: !!r, learnerVisible: r?.learnerVisible, totalSteps: r?.totalSteps, course: r?.course, sourceCandidateId: r?.sourceCandidateId, replaceCandidateSlug: (r as { replaceCandidateSlug?: string | null } | undefined)?.replaceCandidateSlug };
  });

  const orphanCandidates = allCand.filter(c => c.status === "approved" && !c.promotedProjectId && !allProj.find(p => p.sourceCandidateId === c.id));

  console.log(JSON.stringify({
    totalProjects: allProj.length,
    totalCandidates: allCand.length,
    lineageIntegrity: { promotedProjects: promoted.length, candidatesWithInverse: candWithInverse.length, mismatches, inverseMismatches, duplicateCandidatePromotions },
    hiddenCount: hidden.length,
    phase11UpgradedState,
    phase11LegacyState,
    orphanCandidates: orphanCandidates.length,
  }, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
