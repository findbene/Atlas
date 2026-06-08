/**
 * Phase 61B — synthesize the `project_candidates` row for the net-new
 * WASM-native Data-Engineering rowset evidence project (SaaS usage + revenue
 * quality mart). Mirrors the Phase 55 backfill exactly.
 *
 *   pnpm --filter @workspace/scripts run backfill:phase61b-candidates
 *
 * Run AFTER the authored module is registered in `scripts/src/authored/index.ts`
 * but BEFORE `author:project promote <slug>`. Idempotent.
 *
 * Net-new slug, no legacy twin to archive. The candidate proposal is built
 * directly from the authored module's declared metadata via `findAuthored(slug)`.
 */
import { db } from "@workspace/db";
import { projectCandidates } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  NET_NEW_FOR_SLUG_PHASE61B,
  COURSE_FOR_AUTHORED_SLUG,
} from "./authored-lineage";
import { findAuthored } from "./authored";

const PHASE61B_NOTE =
  "Phase-61B Author Next WASM-Native Rowset Evidence Project — one net-new " +
  "intermediate Data-Engineering project (SaaS usage + revenue quality mart) " +
  "authored against the Phase-35 publish-readiness contract with the Phase-49 " +
  "honest-claim boundary. Deterministic + WASM-native (DuckDB over 3 committed " +
  "CSV seeds; zero cloud/credentials/network/randomness). Creates 6 fresh " +
  "rowset candidates (5 sql_resultset + 1 csv_set_equal), ALL shipped DARK " +
  "(serverGrade:false) with columns + expectedRows pre-populated (verified " +
  "against real DuckDB) so a future phase can flip after a real-browser " +
  "DuckDB-WASM byte verification. Addresses the candidate-supply gap Phase 61A " +
  "surfaced. No grader/comparator change, no envelope enforcement. Synthetic " +
  "candidate preserves the AuthoredProject.candidateId lineage contract.";

async function ensureCandidateFor(authoredSlug: string, candidateId: string): Promise<"created" | "exists"> {
  const existing = await db.query.projectCandidates.findFirst({
    where: eq(projectCandidates.id, candidateId),
  });
  if (existing) return "exists";

  const course = COURSE_FOR_AUTHORED_SLUG[authoredSlug];
  if (!course) throw new Error(`[phase61b-cand] no COURSE_FOR_AUTHORED_SLUG entry for '${authoredSlug}'`);
  const authored = findAuthored(authoredSlug);
  if (!authored) throw new Error(`[phase61b-cand] no authored module registered for '${authoredSlug}'`);
  if (authored.candidateId !== candidateId) {
    throw new Error(
      `[phase61b-cand] candidateId mismatch for '${authoredSlug}': ` +
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
      phase: "phase61b_net_new",
      authoredSlug,
      legacySlug: null,
      learningObjectives: authored.learningObjectives,
      shortDescription: authored.shortDescription,
    },
    status: "approved",
    reviewerNotes: PHASE61B_NOTE,
    source: "phase61b_net_new",
  });
  return "created";
}

async function main(): Promise<void> {
  const entries = Object.entries(NET_NEW_FOR_SLUG_PHASE61B);
  if (entries.length !== 1) {
    throw new Error(`[phase61b-cand] expected exactly 1 authored slug, got ${entries.length}`);
  }
  let created = 0, exists = 0;

  for (const [authoredSlug, candidateId] of entries) {
    const outcome = await ensureCandidateFor(authoredSlug, candidateId);
    if (outcome === "created") created++; else exists++;
    console.log(`[phase61b-cand] ${authoredSlug}: ${outcome} (candidate=${candidateId.slice(0, 8)})`);
  }

  console.log(`[phase61b-cand] candidates: created=${created} existing=${exists} total=${entries.length}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
