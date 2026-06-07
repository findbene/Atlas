/**
 * H1/H2 honest-claim guard — RE-EXPORT (canonical source moved in Phase 60B).
 *
 * The patterns + `normalize` now live in
 * `@workspace/execution-core/honest-claims` so BOTH the frontend disclosure
 * surfaces (this package) AND the api-server portfolio-artifact generator are
 * checked against ONE source of truth. This file re-exports that module so the
 * existing frontend imports (`./banned-h1h2-phrases`) and tests keep working
 * unchanged.
 *
 * ADD NEW PATTERNS in `lib/execution-core/src/honestClaims.ts`, not here.
 */
export {
  normalize,
  findBannedClaims,
  BANNED_H1H2_PATTERNS,
  BANNED_H1H2_LABELS,
  type BannedPattern,
} from "@workspace/execution-core/honest-claims";
