import type { DimensionScore, ProjectInput } from "../types";
import { ROLE_PRIMARY_STACK, tierOf } from "../jobDemand";

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function scoreJobReadiness(project: ProjectInput): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];

  const allTokens = [...(project.techStack ?? []), ...(project.tags ?? [])];
  if (allTokens.length === 0) {
    return { score: 10, signals: [], gaps: ["No tech stack or tags declared."] };
  }

  let tier1 = 0;
  let tier2 = 0;
  let tier3 = 0;
  let legacy = 0;
  let unknown = 0;
  const tier1Hits: string[] = [];
  const legacyHits: string[] = [];

  for (const raw of allTokens) {
    const t = tierOf(raw);
    if (t === "tier1") { tier1++; tier1Hits.push(raw); }
    else if (t === "tier2") tier2++;
    else if (t === "tier3") tier3++;
    else if (t === "legacy") { legacy++; legacyHits.push(raw); }
    else unknown++;
  }

  let score = 25
    + Math.min(60, 12 * tier1)
    + Math.min(20, 4 * tier2)
    + 1 * tier3
    - 15 * legacy;

  // Role coverage bonus — candidates have explicit targetRoles, approved
  // projects can still earn it via stack overlap with a known role.
  const roles = project.targetRoles ?? [];
  if (roles.length > 0) {
    score += 5;
    signals.push(`Targets ${roles.length} role(s): ${roles.join(", ")}`);
  } else {
    // Infer role overlap from stack.
    const stackNorm = new Set(allTokens.map(s => s.toLowerCase().replace(/_/g, "-")));
    const matchedRoles = Object.entries(ROLE_PRIMARY_STACK)
      .filter(([, anchors]) => anchors.some(a => stackNorm.has(a)))
      .map(([r]) => r);
    if (matchedRoles.length > 0) {
      score += Math.min(5, matchedRoles.length);
      signals.push(`Stack overlaps roles: ${matchedRoles.join(", ")}`);
    }
  }

  if (tier1 > 0) signals.push(`Tier-1 (2026 high-demand) tech: ${tier1Hits.slice(0, 5).join(", ")}`);
  if (legacy > 0) gaps.push(`Legacy-only tech detected: ${legacyHits.join(", ")} — score penalized.`);
  if (tier1 === 0) gaps.push("No tier-1 (2026 high-demand) tech in stack/tags.");
  if (unknown > Math.max(2, allTokens.length / 2)) {
    gaps.push(`${unknown} unrecognized stack tokens — consider standardizing names.`);
  }

  return { score: clamp(Math.round(score)), signals, gaps };
}
