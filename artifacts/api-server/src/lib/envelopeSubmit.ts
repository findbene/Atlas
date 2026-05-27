/**
 * Phase 47 — Submit-side signed-envelope verification helper.
 *
 * Wraps `verifyRunEnvelope` from `@workspace/execution-core/run-envelope`
 * (Phase 45) with an atomic INSERT-on-first-verify nonce hook against the
 * `run_envelope_nonces` table (Phase 46). Called only from the new
 * envelope branch of `POST /user/projects/:projectId/steps/:stepId/submit`;
 * the legacy bare-string `submission` path is preserved verbatim.
 *
 * Honest-claim ceiling H3 only — see `docs/runtime-validation-threat-model.md`.
 *
 * Allow-list (`ATLAS_ENVELOPE_REQUIRED_KINDS`) is EMPTY by default in
 * Phase 47, which means: signed envelopes are detected on the wire but
 * are NOT enabled for any kind. A client that submits an envelope for a
 * non-allow-listed kind gets a clean 400 (`envelope_kind_not_enabled`) —
 * we never silently fall through to legacy grading when the caller has
 * signaled intent to use the signed path. Behavior is therefore identical
 * to pre-Phase-47 unless an operator explicitly opts in via env var.
 *
 * Failure mapping (verifier reason → HTTP):
 *   envelope-malformed          → 400 envelope_malformed
 *   envelope-unsupported-version→ 400 envelope_unsupported_version
 *   envelope-bad-signature      → 400 envelope_bad_signature
 *   envelope-tampered           → 400 envelope_tampered
 *   envelope-binding-mismatch   → 400 envelope_binding_mismatch
 *   envelope-expired            → 400 envelope_expired
 *   envelope-replay             → 400 envelope_replay
 *
 * No verifier `detail` is forwarded to the client (oracle hygiene); the
 * detail string is logged server-side via `req.log.warn` at the call site.
 */
import { db, runEnvelopeNonces } from "@workspace/db";
import {
  verifyRunEnvelope,
  type SignedRunEnvelope,
  type VerificationResult,
} from "@workspace/execution-core/run-envelope";

/** Allow-list of validation kinds for which the server REQUIRES + VERIFIES
 *  a signed envelope. Parsed from `ATLAS_ENVELOPE_REQUIRED_KINDS`
 *  (comma-separated). Empty by default in Phase 47. */
export function parseEnvelopeAllowList(
  raw: string | undefined = process.env["ATLAS_ENVELOPE_REQUIRED_KINDS"],
): ReadonlySet<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export type EnvelopeExpected = {
  userId: string;
  projectId: string;
  stepId: string;
  validationKind: string;
};

export type EnvelopeSubmitOk = {
  ok: true;
  capture: Extract<VerificationResult, { ok: true }>["capture"];
  binding: Extract<VerificationResult, { ok: true }>["binding"];
};

export type EnvelopeSubmitErr = {
  ok: false;
  status: number;
  error: string;
  /** Internal-only detail; safe to log, never sent to client. */
  detail?: string;
};

export type EnvelopeSubmitResult = EnvelopeSubmitOk | EnvelopeSubmitErr;

/**
 * Atomic INSERT-on-first-verify against `run_envelope_nonces`.
 *
 * The hook is invoked by `verifyRunEnvelope` LAST (after sig + binding +
 * expiry pass), so the envelope is authentic by the time we touch the
 * table — no unsigned-INSERT amplification vector. Uses
 * `ON CONFLICT DO NOTHING RETURNING` so a returning-row count of 0
 * means "nonce already present in TTL window" (replay).
 *
 * `expiresAt` comes from the envelope binding (authenticated). The janitor
 * (`scripts/src/cleanup-run-envelope-nonces.ts`, Phase 46) sweeps expired
 * rows out of band — no per-verify cleanup.
 */
async function makeNonceHook(envelope: SignedRunEnvelope) {
  const expiresAt = new Date(envelope.binding.expiresAt);
  return async (nonce: string): Promise<boolean> => {
    const inserted = await db
      .insert(runEnvelopeNonces)
      .values({ nonce, expiresAt })
      .onConflictDoNothing()
      .returning({ nonce: runEnvelopeNonces.nonce });
    // No row returned ⇒ this nonce was already present ⇒ replay.
    return inserted.length === 0;
  };
}

const REASON_TO_HTTP: Record<string, { status: number; error: string }> = {
  "envelope-malformed":           { status: 400, error: "envelope_malformed" },
  "envelope-unsupported-version": { status: 400, error: "envelope_unsupported_version" },
  "envelope-bad-signature":       { status: 400, error: "envelope_bad_signature" },
  "envelope-tampered":            { status: 400, error: "envelope_tampered" },
  "envelope-binding-mismatch":    { status: 400, error: "envelope_binding_mismatch" },
  "envelope-expired":             { status: 400, error: "envelope_expired" },
  "envelope-replay":              { status: 400, error: "envelope_replay" },
};

/**
 * Verify a submitted signed envelope for /submit.
 *
 * Preconditions enforced by caller (route handler):
 *  - User authenticated, enrollment present, step belongs to project.
 *  - `expected.validationKind` IS in `parseEnvelopeAllowList()`.
 *  - Secret has been checked present at boot (`assertRunEnvelopeSigningSecret`),
 *    but we re-read it here so a runtime-unset secret degrades to 503 rather
 *    than throwing.
 *
 * The envelope arg is `unknown` so the function can be the single trust
 * boundary for wire data.
 */
export async function verifyEnvelopeForSubmit(
  envelope: unknown,
  expected: EnvelopeExpected,
): Promise<EnvelopeSubmitResult> {
  const secret = process.env["RUN_ENVELOPE_SIGNING_SECRET"];
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "envelope_signing_unavailable",
      detail: "RUN_ENVELOPE_SIGNING_SECRET unset",
    };
  }

  // We need the binding's `expiresAt` for the nonce hook, but only AFTER
  // the verifier has authenticated the envelope. The hook is built from
  // the envelope passed in — if the envelope is malformed the verifier
  // rejects BEFORE invoking the hook, so the hook's use of binding fields
  // never reads unauthenticated data.
  const isNonceSeen = looksLikeEnvelopeShape(envelope)
    ? await makeNonceHook(envelope as SignedRunEnvelope)
    : undefined;

  const result = await verifyRunEnvelope(envelope, {
    secret,
    expected: {
      userId: expected.userId,
      projectId: expected.projectId,
      stepId: expected.stepId,
      validationKind: expected.validationKind,
    },
    isNonceSeen,
  });

  if (result.ok) {
    return { ok: true, capture: result.capture, binding: result.binding };
  }

  const mapped = REASON_TO_HTTP[result.reason];
  if (!mapped) {
    // Defensive: unknown verifier reason should never happen — collapse
    // to a generic 400 without leaking the reason string.
    return { ok: false, status: 400, error: "envelope_malformed", detail: result.reason };
  }
  return { ok: false, status: mapped.status, error: mapped.error, detail: result.detail };
}

/** Cheap structural pre-check so we can attach the nonce hook only when
 *  the wire payload at least looks like an envelope. The real validation
 *  still happens inside `verifyRunEnvelope`. */
function looksLikeEnvelopeShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!v["binding"] || typeof v["binding"] !== "object") return false;
  const b = v["binding"] as Record<string, unknown>;
  return typeof b["expiresAt"] === "string" && typeof b["nonce"] === "string";
}
