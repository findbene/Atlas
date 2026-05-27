/**
 * Phase 49 — Client-side helpers for the signed RunResult envelope flow.
 *
 *   Run code in editor
 *     → capture stdout/code/language/validationKind
 *     → POST /api/runs/sign            (this module)
 *     → store signed envelope client-side  (this module)
 *     → Submit envelope                (this module's signature wired into
 *                                       project-workspace.tsx's submitStep)
 *     → /submit verifies + grades      (server, Phase 47–48)
 *     → UI shows pass/fail/remediation (existing reducer)
 *
 * Soft-fail contract (load-bearing safety invariant for Phase 49):
 *
 *   Any failure on the sign path — network error, 4xx/5xx response (especially
 *   503 = signing secret unset, 422 = unsignable kind, 403 = not enrolled,
 *   413 = capture oversize) — MUST silently fall back to the legacy
 *   bare-string submit path. Phase 49 must not be able to break a learner's
 *   ability to submit by introducing a new failure mode.
 *
 * Honest-claim ceiling H3: any user-facing copy in this module deliberately
 * avoids "verified", "tamper-proof", "proven", "independently". The signature
 * proves only that Atlas issued the envelope.
 */
import type { ExecResult } from "./pyodideRunner";
import type { RunResult } from "@workspace/execution-core";
import type {
  RunCapture,
  SignedRunEnvelope,
} from "@workspace/api-client-react";

export type { RunCapture, SignedRunEnvelope };

/**
 * Build a Phase 45 `RunCapture` from a Pyodide `ExecResult`. Code/language
 * are passed in by the caller because `ExecResult` is runtime-only.
 */
export function buildPythonCapture(code: string, result: ExecResult): RunCapture {
  return {
    version: 1,
    language: "python",
    code,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
  };
}

/**
 * Build a Phase 45 `RunCapture` from a `RunResult` produced by
 * `runViaRegistry` (SQL / DuckDB-WASM today). For tabular results we
 * normalize `cell` to `string | number | boolean | null` because that's what
 * the envelope schema allows.
 *
 * Note: the Phase 48 pilot grader (`json_equal`) does not consume `rows`/
 * `columns` directly; it parses `stdout` as JSON. SQL captures still ride
 * along through the envelope so future kinds (`sql_resultset`, `csv_*`) can
 * grade against tabular fields without another wire change.
 */
export function buildSqlCapture(code: string, result: RunResult): RunCapture {
  // SQL `stdout` is the short "N row(s) in Tms" summary we already render
  // in the output panel. For json_equal SQL steps (rare), the learner would
  // need to print a JSON literal — which Atlas's pilot doesn't target.
  const stdout = result.ok
    ? `${result.rows?.length ?? 0} row(s) in ${result.durationMs}ms`
    : "";
  const stderr = result.ok ? "" : (result.error ?? "Query failed.");
  // Normalize: undefined cells → null; non-finite numbers → null (the
  // envelope schema rejects NaN/Infinity, and the server rejects them too).
  const rows = result.rows?.map((row) =>
    row.map((cell): string | number | boolean | null => {
      if (cell === null || cell === undefined) return null;
      if (typeof cell === "number" && !Number.isFinite(cell)) return null;
      if (
        typeof cell === "string" ||
        typeof cell === "number" ||
        typeof cell === "boolean"
      ) {
        return cell;
      }
      // Fallback for unexpected cell types — preserve via toString so the
      // signed envelope is at least well-shaped. This is best-effort only.
      return String(cell);
    }),
  );
  return {
    version: 1,
    language: "sql",
    code,
    stdout,
    stderr,
    exitCode: result.ok ? 0 : 1,
    // Phase 49 — Sanitize against NaN / Infinity (which Math.round
    // would propagate, then `?? 0` would NOT catch because they're not
    // null/undefined). Server-side Zod requires a finite non-negative
    // integer, so leaking NaN here would cause a 400 on /runs/sign.
    durationMs:
      typeof result.durationMs === "number" && Number.isFinite(result.durationMs)
        ? Math.max(0, Math.round(result.durationMs))
        : 0,
    timedOut: false,
    ...(result.columns ? { columns: [...result.columns] } : {}),
    ...(rows ? { rows } : {}),
  };
}

/**
 * Server-side capture caps from `runs-sign.ts`. Mirrored client-side so we
 * skip the round-trip + 413 entirely on obviously-oversize captures (e.g.
 * a learner who prints a 1MB CSV). Slightly under the server cap to leave
 * headroom for the JSON wrapper.
 */
const CLIENT_MAX_CODE_BYTES = 30_000;
const CLIENT_MAX_STREAM_BYTES = 60_000;

function utf8ByteLength(s: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(s).length;
  }
  // Fallback: rough estimate. We only use this in JSDOM-test environments
  // where TextEncoder is present anyway.
  return s.length;
}

export function isCaptureLikelyOversize(capture: RunCapture): boolean {
  return (
    utf8ByteLength(capture.code) > CLIENT_MAX_CODE_BYTES ||
    utf8ByteLength(capture.stdout) > CLIENT_MAX_STREAM_BYTES ||
    utf8ByteLength(capture.stderr) > CLIENT_MAX_STREAM_BYTES
  );
}

/**
 * Reasons we declined to attempt signing, or signing failed. Surfaced only
 * to the console (best-effort log) — never to the learner UI, by design:
 * the legacy bare-string submit always works, so a signing failure is
 * invisible to learners on the pilot path.
 */
export type SignSkipReason =
  | "no-code"
  | "non-zero-exit"
  | "timed-out"
  | "capture-oversize"
  | "unsignable-kind" // server returned 422
  | "signing-unavailable" // server returned 503 (secret unset)
  | "not-enrolled" // server returned 403
  | "step-or-project-not-found" // server returned 404
  | "invalid-request" // server returned 400
  | "sign-network-error"
  | "sign-unknown-error";

/**
 * `null` envelope + a reason. Returned when we decide NOT to attempt signing
 * (gates) OR when signing fails for any reason. The reason is for telemetry
 * / debugging only; the caller falls back to bare-string submit either way.
 */
export interface SignSkipped {
  envelope: null;
  reason: SignSkipReason;
}

export interface SignOk {
  envelope: SignedRunEnvelope;
  reason: null;
}

export type SignOutcome = SignOk | SignSkipped;

/**
 * Local pre-gates before we even POST to /runs/sign. None of these are
 * security-critical (server enforces all of them) — they exist purely to
 * avoid wasted round-trips for obviously-unsignable captures.
 */
export function preCheckCapture(capture: RunCapture): SignSkipReason | null {
  if (!capture.code || !capture.code.trim()) return "no-code";
  if (capture.timedOut) return "timed-out";
  // A failed run isn't ungradable per se (json_equal can still compare
  // empty stdout vs expected → "Output didn't match"), but a learner who
  // saw red error output almost certainly wants to fix the bug before
  // submitting. Skipping the sign here saves a round-trip in the common
  // case and avoids spending the 10-minute envelope TTL on a dead run.
  if (capture.exitCode !== 0) return "non-zero-exit";
  if (isCaptureLikelyOversize(capture)) return "capture-oversize";
  return null;
}

/**
 * Map a /runs/sign HTTP failure to a SignSkipReason. The orval-generated
 * `customFetch` throws on non-2xx with `Error("Request failed: <status>")`,
 * but we also defensively inspect a `status` property when present.
 */
export function classifySignError(err: unknown): SignSkipReason {
  const e = err as { status?: number; message?: string } | null | undefined;
  const status = e?.status ?? parseHttpStatusFromMessage(e?.message);
  if (status === 422) return "unsignable-kind";
  if (status === 503) return "signing-unavailable";
  if (status === 403) return "not-enrolled";
  if (status === 404) return "step-or-project-not-found";
  if (status === 400 || status === 413) return "invalid-request";
  if (status === undefined) return "sign-network-error";
  return "sign-unknown-error";
}

function parseHttpStatusFromMessage(msg: string | undefined): number | undefined {
  if (!msg) return undefined;
  const m = msg.match(/\b(4\d\d|5\d\d)\b/);
  return m ? Number(m[1]) : undefined;
}
