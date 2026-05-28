/**
 * Phase 51 — In-process canary observability counters.
 *
 * Read-only metrics aggregated from the same log call-sites that
 * Phase 50 emits structured events from. Process-local — counters
 * reset on every API restart/deploy. This is deliberate:
 *
 *   - No new DB schema (hard stop for Phase 51).
 *   - Operators MUST rely on the durable log aggregator for
 *     historical / cross-deploy metrics; this endpoint is for
 *     live-traffic spot-checks during a canary flip when the
 *     dashboard lag matters.
 *   - Multi-instance deployments will see per-instance counters
 *     only. The runbook calls this out explicitly so an operator
 *     looking at "verify count: 12" on one instance doesn't
 *     conclude the canary is dead.
 *
 * Honest-claim ceiling unchanged: H3. Nothing in this module
 * elevates any product claim — it just makes the existing path
 * measurable.
 */

/** Bounded reservoir for `verifyDurationMs` percentile estimation.
 *  At 1000 samples and typical p95s in the tens of ms, the bias
 *  vs a true t-digest is < 1 ms — fine for canary go/no-go calls. */
const DURATION_RESERVOIR_CAP = 1000;

export type FallbackReason = "kind_not_enabled" | "canary_bucket_skip";

/** Verifier failure reasons mirror the wire-stable error strings
 *  from `envelopeSubmit.ts`. Keep this list in sync — a new
 *  reason added to `REASON_TO_HTTP` should also add a counter here. */
export const VERIFY_FAILURE_REASONS = [
  "envelope_malformed",
  "envelope_unsupported_version",
  "envelope_bad_signature",
  "envelope_tampered",
  "envelope_binding_mismatch",
  "envelope_expired",
  "envelope_replay",
  "envelope_signing_unavailable",
] as const;

export type VerifyFailureReason = (typeof VERIFY_FAILURE_REASONS)[number];

interface EnvelopeMetricsState {
  startedAtMs: number;
  verifyOk: number;
  verifyFailed: Record<string, number>;
  fallback: Record<FallbackReason, number>;
  /** Bounded ring buffer of recent verify durations (ms). */
  durations: number[];
  /** Total verify timings observed (sample size for sanity-check
   *  against `verifyOk + sum(verifyFailed)`). */
  durationsObserved: number;
}

let state: EnvelopeMetricsState = freshState();

function freshState(): EnvelopeMetricsState {
  return {
    startedAtMs: Date.now(),
    verifyOk: 0,
    verifyFailed: {},
    fallback: { kind_not_enabled: 0, canary_bucket_skip: 0 },
    durations: [],
    durationsObserved: 0,
  };
}

/** Record a successful verify. `durationMs` should be the same
 *  value emitted on the `envelope.verify.ok` log line. */
export function recordVerifyOk(durationMs: number): void {
  state.verifyOk++;
  pushDuration(durationMs);
}

/** Record a failed verify. `reason` should be the wire-stable
 *  error string (e.g. `envelope_replay`). Unknown reasons are
 *  bucketed under their literal string so dashboard drift is
 *  visible rather than silently dropped. */
export function recordVerifyFailed(reason: string, durationMs: number): void {
  state.verifyFailed[reason] = (state.verifyFailed[reason] ?? 0) + 1;
  pushDuration(durationMs);
}

/** Record a fallback (envelope arrived but path was not enforced
 *  for this user/kind). Discriminated by `reason` exactly as the
 *  `envelope.submit.kind_not_enabled.fallback` log line. */
export function recordFallback(reason: FallbackReason): void {
  state.fallback[reason]++;
}

function pushDuration(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  state.durationsObserved++;
  if (state.durations.length < DURATION_RESERVOIR_CAP) {
    state.durations.push(ms);
    return;
  }
  // Reservoir sampling: with probability k/n, replace a random
  // existing sample. Keeps the buffer representative of the full
  // stream rather than just the first 1000.
  const i = Math.floor(Math.random() * state.durationsObserved);
  if (i < DURATION_RESERVOIR_CAP) {
    state.durations[i] = ms;
  }
}

export interface EnvelopeMetricsSnapshot {
  /** Process uptime in ms since metrics were first initialized. */
  uptimeMs: number;
  /** Wall-clock ms since the LAST reset. Equal to uptimeMs for
   *  long-lived processes that never reset. */
  windowMs: number;
  verify: {
    ok: number;
    failed: Record<string, number>;
    /** Sum of `ok + sum(failed)`. The denominator for success rate. */
    total: number;
    /** ok / total. 0 when total === 0. */
    successRate: number;
    /** Estimated percentiles over the bounded reservoir. */
    durationMs: { p50: number; p95: number; p99: number; samples: number };
  };
  fallback: Record<FallbackReason, number>;
  /** ok + sum(failed) + sum(fallback). Denominator for the
   *  "what fraction of envelopes actually verified" view. */
  envelopesObserved: number;
  /** Total fallback events as a fraction of envelopesObserved.
   *  At 1% canary on a fully-eligible kind this should be ~99%. */
  fallbackRate: number;
}

export function getMetricsSnapshot(): EnvelopeMetricsSnapshot {
  const verifyTotal = state.verifyOk + sumValues(state.verifyFailed);
  const fallbackTotal = state.fallback.kind_not_enabled + state.fallback.canary_bucket_skip;
  const envelopesObserved = verifyTotal + fallbackTotal;
  return {
    uptimeMs: Date.now() - state.startedAtMs,
    windowMs: Date.now() - state.startedAtMs,
    verify: {
      ok: state.verifyOk,
      failed: { ...state.verifyFailed },
      total: verifyTotal,
      successRate: verifyTotal === 0 ? 0 : state.verifyOk / verifyTotal,
      durationMs: percentiles(state.durations),
    },
    fallback: { ...state.fallback },
    envelopesObserved,
    fallbackRate: envelopesObserved === 0 ? 0 : fallbackTotal / envelopesObserved,
  };
}

/** Test-only: wipe counters back to a fresh state. Not exported
 *  from any production code path. */
export function __resetMetricsForTests(): void {
  state = freshState();
}

function sumValues(rec: Record<string, number>): number {
  let s = 0;
  for (const v of Object.values(rec)) s += v;
  return s;
}

function percentiles(samples: readonly number[]): {
  p50: number;
  p95: number;
  p99: number;
  samples: number;
} {
  const n = samples.length;
  if (n === 0) return { p50: 0, p95: 0, p99: 0, samples: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    samples: n,
  };
}

/** Nearest-rank quantile over a pre-sorted array. q ∈ [0, 1]. */
function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  // Use ceil(q * n) - 1 (nearest-rank) so q=1.0 hits the max.
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(q * sorted.length) - 1),
  );
  return sorted[idx]!;
}
