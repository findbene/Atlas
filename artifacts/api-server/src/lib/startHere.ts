/**
 * Phase 18 — Start Here recommendation helper.
 *
 * Pure, deterministic. Given the learner-visible projects for a course,
 * returns the recommended "first project" for a new learner.
 *
 * Rules (in order):
 *   1. Difficulty ranking: beginner > intermediate > advanced.
 *   2. Within the chosen difficulty tier, prefer projects whose slug/title
 *      signals approachability: "beginner", "foundations", "essentials",
 *      "intro", "getting-started" (case-insensitive substring match on the
 *      slug; mirrored against the title as a secondary signal).
 *   3. Tie-break: lower `estimatedHours` ASC NULLS LAST, then fewer
 *      `stepCount` ASC, then `slug` ASC for full stability.
 *
 * Return shape:
 *   - `project` — the recommended project (full ProjectSummary).
 *   - `kind` — "start_here" if a beginner project exists; otherwise
 *     "most_approachable_available".
 *   - `reasonKey` — "beginner_available" | "no_beginner_available".
 *     The frontend renders human-readable copy from this key so wording can
 *     change without touching server logic.
 *   - `hasBeginner` — convenience flag for the frontend.
 *
 * Out of scope: never reads `is_anchor`, never calls heuristic course
 * inference, never touches the DB. The caller is responsible for passing
 * only `learner_visible = TRUE` rows.
 */

export type StartHereDifficulty = "beginner" | "intermediate" | "advanced";

export interface StartHereCandidate {
  slug: string;
  title: string;
  difficulty: string;
  estimatedHours: number;
  stepCount: number;
}

export interface StartHereResult<T extends StartHereCandidate> {
  project: T;
  kind: "start_here" | "most_approachable_available";
  reasonKey: "beginner_available" | "no_beginner_available";
  hasBeginner: boolean;
}

const DIFFICULTY_RANK: Record<StartHereDifficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const APPROACHABILITY_SIGNALS = [
  "beginner",
  "foundations",
  "essentials",
  "intro",
  "getting-started",
];

function isLearnerDifficulty(d: string): d is StartHereDifficulty {
  return d === "beginner" || d === "intermediate" || d === "advanced";
}

function hasApproachabilitySignal(slug: string, title: string): boolean {
  const haystack = `${slug.toLowerCase()} ${title.toLowerCase()}`;
  return APPROACHABILITY_SIGNALS.some(s => haystack.includes(s));
}

/**
 * Returns the recommended "Start Here" project for a course, or `null` if
 * the course has no learner-visible projects at all.
 *
 * Determinism: every comparator is total. Same input always produces the
 * same output (and the same tie-break).
 */
export function pickStartHere<T extends StartHereCandidate>(
  visibleProjects: readonly T[],
): StartHereResult<T> | null {
  if (visibleProjects.length === 0) return null;

  // Defensive: ignore unknown difficulties (e.g. legacy "expert"). No
  // visible project currently has one, but a future row shouldn't break
  // recommendation.
  const eligible = visibleProjects.filter(p => isLearnerDifficulty(p.difficulty));
  if (eligible.length === 0) return null;

  const hasBeginner = eligible.some(p => p.difficulty === "beginner");
  const minRank = Math.min(...eligible.map(p => DIFFICULTY_RANK[p.difficulty as StartHereDifficulty]));
  const tierSlug = (Object.entries(DIFFICULTY_RANK).find(([, r]) => r === minRank)?.[0]) as StartHereDifficulty;
  const tier = eligible.filter(p => p.difficulty === tierSlug);

  // Sort by: approachability signal first (true before false), then
  // estimatedHours ASC, then stepCount ASC, then slug ASC.
  const sorted = [...tier].sort((a, b) => {
    const aSig = hasApproachabilitySignal(a.slug, a.title);
    const bSig = hasApproachabilitySignal(b.slug, b.title);
    if (aSig !== bSig) return aSig ? -1 : 1;
    if (a.estimatedHours !== b.estimatedHours) return a.estimatedHours - b.estimatedHours;
    if (a.stepCount !== b.stepCount) return a.stepCount - b.stepCount;
    return a.slug.localeCompare(b.slug);
  });

  const chosen = sorted[0];
  return {
    project: chosen,
    kind: hasBeginner ? "start_here" : "most_approachable_available",
    reasonKey: hasBeginner ? "beginner_available" : "no_beginner_available",
    hasBeginner,
  };
}
