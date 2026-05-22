/**
 * Phase 17 — merge helper for `projects.qualityBreakdown` JSONB.
 *
 * Two write paths populate this column with different shapes:
 *   - `promote(slug)` writes `{ authoredMeta, portfolioArtifact }`.
 *   - `audit --commit <slug>` (and the batch `audit-quality.ts`) write a
 *     full `Scorecard` (`{ overall, rubricVersion, dimensions, ... }`).
 *
 * Before Phase 17, every write was an OVERWRITE, which meant whichever
 * path ran last stripped the other path's fields. The Phase 16 47/50
 * wave-report regression traced to this: an `audit --commit` blew away
 * `portfolioArtifact`, demoting the portfolio scorer to keyword inference.
 *
 * This helper is the single canonical merge so neither path can strip
 * the other's fields again. It is intentionally a tiny, pure object spread —
 * shallow merge, last-write-wins per top-level key. Both reader contracts
 * (catalog-report / admin route casting to `Scorecard`; quality-adapter
 * reading `qb.portfolioArtifact`) continue to work because the extra keys
 * are ignored on the reader side.
 */
export function mergeQualityBreakdown<
  T extends Record<string, unknown>,
  P extends Record<string, unknown>,
>(existing: T | null | undefined, patch: P): Record<string, unknown> {
  return { ...((existing as Record<string, unknown> | null) ?? {}), ...patch };
}
