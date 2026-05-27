/**
 * Phase 46 — POST /api/runs/sign
 *
 * Mints a server-signed `SignedRunEnvelope` (see Phase 45 library at
 * `@workspace/execution-core/run-envelope`) for a learner's runtime capture.
 * Signing happens at the moment of capture — right after a successful local
 * Pyodide / DuckDB run — and persists across the gap between Run and Submit
 * so the learner can read remediation / look at the diff / re-Run without
 * losing the signed proof.
 *
 * What this phase intentionally does NOT do:
 *  - Does NOT wire `/submit` or `/check` to require / verify envelopes.
 *  - Does NOT enforce signed envelopes for grading. The envelope library is
 *    minted-but-unused until Phase 47+.
 *  - Does NOT INSERT into `run_envelope_nonces` at sign time. The design
 *    (docs/signed-run-result-design.md §"Nonce store") uses the nonce table
 *    as a replay registry at verify time — first-touch INSERT inside
 *    `verifyRunEnvelope.isNonceSeen` (Phase 47). Phase 46 only creates the
 *    table + janitor scaffolding.
 *
 * Trust model: this route can mint a signature for any well-formed capture
 * the learner sends. The signature proves "Atlas issued this envelope with
 * this binding"; it does NOT prove the learner actually executed THIS code
 * (residual A5 in the threat model). Honest claim ceiling remains H3.
 *
 * Auth + ownership gates (defense in depth):
 *  1. requireAuth — Clerk session.
 *  2. Step belongs to project (cross-project FK forge defense).
 *  3. Project is learner-visible (hidden / archived → 404, no existence leak).
 *  4. Premium gate (isPremium → user.subscriptionTier === 'pro').
 *  5. Enrollment exists in `user_progress` for (user, project).
 *  6. Validation kind is on the SIGNABLE_KINDS allow-list. Steps outside the
 *     allow-list (e.g. `self_attest`, `exact`, `regex`, `contains`) return
 *     422 — no envelope, by design.
 *
 * Secret: `RUN_ENVELOPE_SIGNING_SECRET`. Read lazily per request so a missing
 * secret degrades to 503 instead of crashing the route module at import time.
 * Boot-time hard-fail in production lives in `src/index.ts` so deploys with
 * an unset secret fail fast.
 */
import { Router } from "express";
import { db, projects, projectSteps, userProgress } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  signRunEnvelope,
  type RunCapture,
  type SignedRunEnvelope,
} from "@workspace/execution-core/run-envelope";
import { requireAuth, getCurrentUser } from "../lib/auth";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 10-minute envelope TTL matches docs/signed-run-result-design.md.
const ENVELOPE_TTL_MS = 10 * 60 * 1000;

// Allow-list of `validation_type` enum values that may carry a signed
// envelope. Kept narrow to runtime-output-comparing kinds; self-attest /
// regex / exact / contains are unsignable by design (no runtime output to
// hash) and return 422.
const SIGNABLE_KINDS: ReadonlySet<string> = new Set([
  "json_equal",
  "numeric_tolerance",
  "sql_resultset",
  "csv_set_equal",
  "csv_ordered",
]);

// Server-side hard caps on capture payload sizes. The signer accepts
// arbitrary strings; we cap before signing so a runaway client can't make us
// hash 100MB of stdout. Numbers are generous for normal pandas/DuckDB output
// but tight enough to keep p99 sign latency under a few ms.
const MAX_CODE_BYTES = 32_000;
const MAX_STREAM_BYTES = 64_000;
const MAX_ROWS = 5_000;
const MAX_COLUMNS = 256;

function rejectIfOversized(capture: RunCapture): string | null {
  // Byte-length (UTF-8) not string.length (code units): a single emoji like
  // "𝕏" is 1 code point but 4 UTF-8 bytes, and the caps are about wire-cost
  // and hash-cost which are paid in bytes.
  if (Buffer.byteLength(capture.code, "utf8") > MAX_CODE_BYTES) return `code exceeds ${MAX_CODE_BYTES} bytes`;
  if (Buffer.byteLength(capture.stdout, "utf8") > MAX_STREAM_BYTES) return `stdout exceeds ${MAX_STREAM_BYTES} bytes`;
  if (Buffer.byteLength(capture.stderr, "utf8") > MAX_STREAM_BYTES) return `stderr exceeds ${MAX_STREAM_BYTES} bytes`;
  if (capture.columns && capture.columns.length > MAX_COLUMNS) return `columns exceeds ${MAX_COLUMNS}`;
  if (capture.rows && capture.rows.length > MAX_ROWS) return `rows exceeds ${MAX_ROWS}`;
  return null;
}

/**
 * Best-effort shape coercion from the wire body to a `RunCapture`. Returns
 * an error string if the shape is unusable; otherwise the strict capture
 * object. Field types here mirror the library's `looksLikeCapture` guard so
 * `signRunEnvelope`'s internal validation is reached only on well-shaped
 * inputs.
 */
function parseCapture(raw: unknown): { capture: RunCapture } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "capture must be an object" };
  const c = raw as Record<string, unknown>;
  if (c.version !== 1) return { error: "capture.version must be 1" };
  if (c.language !== "python" && c.language !== "sql") {
    return { error: "capture.language must be 'python' or 'sql'" };
  }
  if (typeof c.code !== "string") return { error: "capture.code must be a string" };
  if (typeof c.stdout !== "string") return { error: "capture.stdout must be a string" };
  if (typeof c.stderr !== "string") return { error: "capture.stderr must be a string" };
  if (typeof c.exitCode !== "number" || !Number.isFinite(c.exitCode)) {
    return { error: "capture.exitCode must be a finite number" };
  }
  if (typeof c.durationMs !== "number" || !Number.isFinite(c.durationMs) || c.durationMs < 0) {
    return { error: "capture.durationMs must be a non-negative finite number" };
  }
  if (typeof c.timedOut !== "boolean") return { error: "capture.timedOut must be a boolean" };

  let columns: readonly string[] | undefined;
  if (c.columns !== undefined) {
    if (!Array.isArray(c.columns) || !c.columns.every((x) => typeof x === "string")) {
      return { error: "capture.columns must be an array of strings" };
    }
    columns = c.columns as string[];
  }

  let rows: readonly (readonly (string | number | boolean | null)[])[] | undefined;
  if (c.rows !== undefined) {
    if (!Array.isArray(c.rows)) return { error: "capture.rows must be an array" };
    for (const row of c.rows) {
      if (!Array.isArray(row)) return { error: "capture.rows[*] must be arrays" };
      for (const cell of row) {
        if (
          cell !== null &&
          typeof cell !== "string" &&
          typeof cell !== "number" &&
          typeof cell !== "boolean"
        ) {
          return { error: "capture.rows[*][*] must be string|number|boolean|null" };
        }
        if (typeof cell === "number" && !Number.isFinite(cell)) {
          return { error: "capture.rows[*][*] numeric cells must be finite" };
        }
      }
    }
    rows = c.rows as (string | number | boolean | null)[][];
  }

  const capture: RunCapture = {
    version: 1,
    language: c.language,
    code: c.code,
    stdout: c.stdout,
    stderr: c.stderr,
    exitCode: c.exitCode,
    durationMs: c.durationMs,
    timedOut: c.timedOut,
    columns,
    rows,
  };
  return { capture };
}

router.post("/runs/sign", requireAuth, async (req, res) => {
  try {
    const secret = process.env["RUN_ENVELOPE_SIGNING_SECRET"];
    if (!secret) {
      req.log.warn({ evt: "runs.sign.secret_unset", phase: "P46" }, "RUN_ENVELOPE_SIGNING_SECRET unset");
      res.status(503).json({ error: "signing_unavailable" });
      return;
    }

    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const projectId = body["projectId"];
    const stepId = body["stepId"];
    if (typeof projectId !== "string" || !UUID_RE.test(projectId)) {
      res.status(400).json({ error: "invalid_projectId" });
      return;
    }
    if (typeof stepId !== "string" || !UUID_RE.test(stepId)) {
      res.status(400).json({ error: "invalid_stepId" });
      return;
    }

    const parsed = parseCapture(body["capture"]);
    if ("error" in parsed) {
      res.status(400).json({ error: "invalid_capture", message: parsed.error });
      return;
    }
    const oversizeReason = rejectIfOversized(parsed.capture);
    if (oversizeReason) {
      res.status(413).json({ error: "capture_too_large", message: oversizeReason });
      return;
    }

    // Step + project ownership check. The `(id, projectId)` predicate
    // rejects an attempt to sign for a step that belongs to another project.
    const step = await db.query.projectSteps.findFirst({
      where: and(eq(projectSteps.id, stepId), eq(projectSteps.projectId, projectId)),
      columns: { id: true, validationType: true },
    });
    if (!step) {
      res.status(404).json({ error: "step_not_found" });
      return;
    }

    // Project visibility + premium gate. Hidden / archived projects look like
    // 404 to learners (no existence leak), matching the rest of the API.
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true, isPremium: true, learnerVisible: true },
    });
    if (!project || project.learnerVisible !== true) {
      res.status(404).json({ error: "project_not_found" });
      return;
    }
    if (project.isPremium && user.subscriptionTier !== "pro") {
      res.status(403).json({ error: "pro_required" });
      return;
    }

    // Enrollment check — `user_progress` row must exist. Defense in depth:
    // the learner has to have explicitly enrolled before they can mint
    // envelopes for the project.
    const enrollment = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, user.id), eq(userProgress.projectId, projectId)),
      columns: { id: true },
    });
    if (!enrollment) {
      res.status(403).json({ error: "not_enrolled" });
      return;
    }

    if (!SIGNABLE_KINDS.has(step.validationType)) {
      res.status(422).json({
        error: "validation_kind_not_signable",
        validationKind: step.validationType,
      });
      return;
    }

    let envelope: SignedRunEnvelope;
    try {
      envelope = signRunEnvelope(
        parsed.capture,
        {
          userId: user.id,
          projectId,
          stepId,
          validationKind: step.validationType,
          ttlMs: ENVELOPE_TTL_MS,
        },
        secret,
      );
    } catch (err) {
      req.log.warn(
        { err, evt: "runs.sign.signer_threw", phase: "P46", userId: user.id, projectId, stepId },
        "signRunEnvelope threw",
      );
      res.status(400).json({ error: "sign_failed", message: (err as Error).message });
      return;
    }

    res.status(200).json({ envelope });
  } catch (err) {
    req.log.error({ err, evt: "runs.sign.unhandled", phase: "P46" }, "Unhandled error in /runs/sign");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
