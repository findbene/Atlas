/**
 * Phase 5 — candidates CLI dispatcher.
 *
 *   pnpm --filter @workspace/scripts run candidates -- list [--status=...]
 *   pnpm --filter @workspace/scripts run candidates -- show <id>
 *   pnpm --filter @workspace/scripts run candidates -- score <id>
 *   pnpm --filter @workspace/scripts run candidates -- approve <id> [--actor=...] [--force]
 *   pnpm --filter @workspace/scripts run candidates -- reject  <id>  --reason="..."
 *   pnpm --filter @workspace/scripts run candidates -- revise  <id>  --reason="..."
 *
 * Approval below score 70 requires --force.
 * Every transition writes a `project_status_history` row.
 */
import { db } from "@workspace/db";
import { projectCandidates, projectStatusHistory, type ProjectCandidate } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  composeScorecard, buildCorpus, nearestNeighbors, projectFingerprint,
  mapToCourse, proposalSchema, RUBRIC_VERSION,
} from "@workspace/curriculum-quality";
import { loadAllProjects, candidateRowToContext } from "./quality-adapter";

type ParsedArgs = { positional: string[]; flags: Record<string, string | boolean> };

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, ...vs] = a.slice(2).split("=");
      flags[k] = vs.length > 0 ? vs.join("=") : true;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function findCandidate(idOrTitle: string): Promise<ProjectCandidate | null> {
  const all = await db.query.projectCandidates.findMany();
  return all.find(c => c.id === idOrTitle || c.proposedTitle === idOrTitle) ?? null;
}

async function cmdList(flags: Record<string, string | boolean>) {
  const all = await db.query.projectCandidates.findMany();
  const filtered = all.filter(c =>
    (!flags.status || c.status === flags.status) &&
    (!flags.course || c.proposedCourse === flags.course),
  );
  console.log(`\n${filtered.length} candidate(s)`);
  console.log("=".repeat(80));
  for (const c of filtered) {
    console.log(`${c.id}  [${c.status.padEnd(15)}]  ${c.proposedCourse.padEnd(20)}  score=${c.qualityScore ?? "?"}  ${c.proposedTitle}`);
  }
}

async function cmdShow(id: string) {
  const c = await findCandidate(id);
  if (!c) { console.error(`Not found: ${id}`); process.exit(1); }
  console.log(JSON.stringify(c, null, 2));
}

async function cmdScore(id: string) {
  const c = await findCandidate(id);
  if (!c) { console.error(`Not found: ${id}`); process.exit(1); }
  const loaded = await loadAllProjects(mapToCourse);
  const corpus = buildCorpus(loaded.map(l => ({ project: l.input, steps: l.steps })));
  const ctx = candidateRowToContext(c);
  const fp = projectFingerprint(ctx.input, ctx.steps);
  const neighbors = nearestNeighbors({ slug: ctx.input.slug, fingerprint: fp }, corpus, 3);
  const card = composeScorecard(ctx.input, { steps: ctx.steps, neighbors, stage: "candidate" });
  await db.update(projectCandidates).set({
    qualityScore: card.overall.toFixed(2),
    qualityBreakdown: card as unknown as object,
    duplicateCandidates: neighbors as unknown as object,
    updatedAt: new Date(),
  }).where(eq(projectCandidates.id, c.id));
  console.log(`Scored: ${card.overall}  recommended=${card.recommendedStatus}  duplicateWarning=${card.duplicateWarning}`);
  for (const [dim, d] of Object.entries(card.dimensions)) {
    console.log(`  ${dim.padEnd(20)} ${String(d.score).padStart(5)}  gaps=${d.gaps.length}`);
  }
}

async function cmdTransition(args: ParsedArgs, to: "approved" | "needs_revision" | "rejected") {
  const id = args.positional[0];
  if (!id) { console.error("Usage: candidates <approve|reject|revise> <id> [--reason=...] [--actor=...] [--force]"); process.exit(1); }
  const c = await findCandidate(id);
  if (!c) { console.error(`Not found: ${id}`); process.exit(1); }
  const reason = typeof args.flags.reason === "string" ? args.flags.reason : undefined;
  const actor = typeof args.flags.actor === "string" ? args.flags.actor : "cli";
  const force = args.flags.force === true;
  if (to === "approved") {
    const score = c.qualityScore ? parseFloat(c.qualityScore) : null;
    if ((score == null || score < 70) && !force) {
      console.error(`Refusing to approve: score=${score ?? "unscored"} < 70. Pass --force to override.`);
      process.exit(1);
    }
  }
  if ((to === "rejected" || to === "needs_revision") && !reason) {
    console.error("--reason is required for reject/revise");
    process.exit(1);
  }
  // Atomic: a single transaction wraps the compare-and-swap update and the
  // history insert so an audit row is never written without a state change
  // (and vice versa). The CAS predicate (`status = c.status`) prevents two
  // concurrent reviewers from clobbering each other with stale `from`
  // values.
  const result = await db.transaction(async (tx) => {
    const updated = await tx.update(projectCandidates).set({
      status: to,
      reviewerNotes: reason ? `[${new Date().toISOString()}] ${actor}: ${reason}\n${c.reviewerNotes ?? ""}` : c.reviewerNotes,
      updatedAt: new Date(),
    }).where(and(eq(projectCandidates.id, c.id), eq(projectCandidates.status, c.status))).returning({ id: projectCandidates.id });
    if (updated.length === 0) {
      throw new Error(`CONCURRENT_UPDATE: candidate ${c.id} status changed since read (was ${c.status}); refusing transition.`);
    }
    await tx.insert(projectStatusHistory).values({
      scope: "candidate",
      refId: c.id,
      fromStatus: c.status,
      toStatus: to,
      reason: reason ?? null,
      actor,
      rubricVersion: RUBRIC_VERSION,
      qualityScore: c.qualityScore ?? null,
    });
    return updated[0];
  });
  console.log(`Candidate ${result.id} → ${to}`);
}

async function main() {
  const [, , sub, ...rest] = process.argv;
  const args = parseArgs(rest);
  switch (sub) {
    case "list": await cmdList(args.flags); break;
    case "show": await cmdShow(args.positional[0]); break;
    case "score": await cmdScore(args.positional[0]); break;
    case "approve": await cmdTransition(args, "approved"); break;
    case "reject": await cmdTransition(args, "rejected"); break;
    case "revise": await cmdTransition(args, "needs_revision"); break;
    case "validate": {
      // Hidden helper: validate a JSON file against the proposal schema.
      const file = args.positional[0];
      const raw = JSON.parse(await (await import("node:fs/promises")).readFile(file, "utf8"));
      const parsed = proposalSchema.safeParse(raw);
      if (!parsed.success) { console.error(parsed.error.message); process.exit(1); }
      console.log("OK");
      break;
    }
    default:
      console.log("Usage: candidates <list|show|score|approve|reject|revise|validate> [args]");
      process.exit(1);
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
