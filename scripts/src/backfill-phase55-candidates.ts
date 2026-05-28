/**
 * Phase 55 — synthesize `project_candidates` row(s) for the net-new
 * Project Production Pilot cohort. Sequential 2-project cohort: C1 (this
 * run) authors the applied-LLM-engineer guardrails project; C2 (a
 * separate later run after explicit user approval) will author the
 * analytics-engineer dbt + DuckDB semantic-layer project.
 *
 *   pnpm --filter @workspace/scripts run backfill:phase55-candidates
 *
 * Run AFTER the authored module is registered in
 * `scripts/src/authored/index.ts` but BEFORE
 * `author:project promote <slug>`. Idempotent.
 *
 * Same pattern as Phase 41 (and Phase 19 / Phase 20): these are NOT
 * upgrades of existing legacy slugs. No source row to copy metadata
 * from — the candidate proposal is built directly from the authored
 * module's declared metadata via `findAuthored(slug)`. No legacy twin,
 * no archive step.
 */
import { db } from "@workspace/db";
import { projectCandidates } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  NET_NEW_FOR_SLUG_PHASE55,
  COURSE_FOR_AUTHORED_SLUG,
} from "./authored-lineage";
import { findAuthored } from "./authored";

const PHASE55_NOTE =
  "Phase-55 Net-New Project Production Pilot — sequential 2-project " +
  "cohort (C1 applied-LLM guardrails / structured-output safety; C2 " +
  "analytics-engineer semantic-layer arrives in a follow-up phase after " +
  "explicit user sign-off). Each module is fully authored against the " +
  "Phase-35 publish-readiness contract with the Phase-49 honest-claim " +
  "boundary, ships deterministic (zero API keys), and shifts the catalog " +
  "validation-kind-classification ratio toward the audit-classified " +
  "'enforced' kinds (`contains` / `exact`) and away from the contract- " +
  "shaped `json_equal` default. The grader's runtime semantics for " +
  "`contains` are unchanged (thin needle check inherited from Phase 7); " +
  "a grader upgrade belongs to its own phase (Phase 55 no-grading-changes " +
  "hard stop). Synthetic candidate created so the new project " +
  "preserves the AuthoredProject.candidateId lineage contract. No legacy " +
  "twin — net-new slug, no archive step.";

async function ensureCandidateFor(authoredSlug: string, candidateId: string): Promise<"created" | "exists"> {
  const existing = await db.query.projectCandidates.findFirst({
    where: eq(projectCandidates.id, candidateId),
  });
  if (existing) return "exists";

  const course = COURSE_FOR_AUTHORED_SLUG[authoredSlug];
  if (!course) throw new Error(`[phase55-cand] no COURSE_FOR_AUTHORED_SLUG entry for '${authoredSlug}'`);
  const authored = findAuthored(authoredSlug);
  if (!authored) throw new Error(`[phase55-cand] no authored module registered for '${authoredSlug}'`);
  if (authored.candidateId !== candidateId) {
    throw new Error(
      `[phase55-cand] candidateId mismatch for '${authoredSlug}': ` +
      `lineage map=${candidateId}, AuthoredProject=${authored.candidateId}`,
    );
  }

  await db.insert(projectCandidates).values({
    id: candidateId,
    proposedTitle: authored.title,
    proposedCourse: course,
    targetRoles: [],
    difficulty: authored.difficulty,
    proposedStack: authored.techStack,
    proposal: {
      synthesized: true,
      phase: "phase55_net_new",
      authoredSlug,
      legacySlug: null,
      learningObjectives: authored.learningObjectives,
      shortDescription: authored.shortDescription,
    },
    status: "approved",
    reviewerNotes: PHASE55_NOTE,
    source: "phase55_net_new",
  });
  return "created";
}

async function main(): Promise<void> {
  const entries = Object.entries(NET_NEW_FOR_SLUG_PHASE55);
  if (entries.length < 1 || entries.length > 2) {
    throw new Error(`[phase55-cand] expected 1 (C1-only) or 2 (C1+C2) authored slugs, got ${entries.length}`);
  }
  let created = 0, exists = 0;

  for (const [authoredSlug, candidateId] of entries) {
    const outcome = await ensureCandidateFor(authoredSlug, candidateId);
    if (outcome === "created") created++; else exists++;
    console.log(`[phase55-cand] ${authoredSlug}: ${outcome} (candidate=${candidateId.slice(0, 8)})`);
  }

  console.log(`[phase55-cand] candidates: created=${created} existing=${exists} total=${entries.length}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
