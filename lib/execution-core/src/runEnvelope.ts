/**
 * Signed RunResult envelope primitives — Phase 45.
 *
 * Implements the Phase 44 design (docs/signed-run-result-design.md):
 *
 * - `RunCapture`        — neutral shape of what a runtime (Pyodide/DuckDB) emits + the
 *                          raw source the client claims to have executed.
 * - `EnvelopeBinding`   — server-issued, server-verified binding (user/project/step,
 *                          server-derived hashes, timestamps, single-use nonce).
 * - `SignedRunEnvelope` — capture + binding + HMAC-SHA256 signature over the canonical
 *                          serialization.
 * - `signRunEnvelope`   — mints the binding, derives both hashes server-side, signs.
 * - `verifyRunEnvelope` — recomputes hashes, verifies binding, checks expiry, checks
 *                          replay, returns a discriminated `Ok | Err` result.
 *
 * Security invariants this file enforces (and tests assert):
 *
 *  S1. Server is the sole hash authority. `binding.submissionSha256` and
 *      `binding.outputSha256` are always derived from the capture; any
 *      pre-supplied values on the binding input are ignored.
 *  S2. Canonical serialization is deterministic: stable key ordering, NFC
 *      string normalization, explicit number/null handling, frozen against
 *      Date / undefined / NaN / Infinity / functions / symbols.
 *  S3. Signature comparison uses `crypto.timingSafeEqual` — never `===`.
 *  S4. `verifyRunEnvelope` returns a discriminated union; the capture is
 *      ONLY reachable on the `Ok` arm, so callers cannot accidentally
 *      pattern-match into the capture before verification passes.
 *  S5. Caller input is not mutated. `signRunEnvelope` deep-copies; the
 *      returned envelope is the only mutation surface.
 *  S6. No grading / curriculum-quality / route imports. Build break if added.
 *
 * What this does NOT prove (carried verbatim from threat model §7):
 *
 *  - Does not prove the learner wrote the code (H1).
 *  - Does not prove the learner executed THEIR code vs. someone else's (H2 / A2).
 *  - Does not prevent A5 ("forge then sign") — a motivated client can
 *    submit hand-crafted `RunCapture` content to `/sign` and get a valid
 *    signature. The signature proves "Atlas issued this envelope with this
 *    binding"; it does NOT prove execution provenance. Product surface
 *    MUST claim H3 ("verified output match") at most.
 */

import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RunEnvelopeVersion = 1;

export type RunCaptureLanguage = "python" | "sql";

/**
 * Allow-list of validation kinds the envelope path may carry. Mirrors the live
 * `validation_type` enum surface; the *enforcement* allow-list (which kinds
 * actually require an envelope at submit time) is a separate server-side knob.
 *
 * Kept as a wide string type rather than a closed union so the library is
 * usable from Phase 46 onward without churn when the live enum grows.
 */
export type ValidationKindString = string;

/**
 * What a runtime emitted, plus the raw source the client claims to have
 * executed. Server-side `verifyRunEnvelope` recomputes `sha256(code)` and
 * compares it to `binding.submissionSha256` — the client never supplies a
 * pre-computed digest.
 */
export interface RunCapture {
  version: RunEnvelopeVersion;
  language: RunCaptureLanguage;
  /** Raw source the client claims to have executed. */
  code: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  /** Tabular columns (DuckDB-style adapters). Undefined for pure stdout runs. */
  columns?: ReadonlyArray<string>;
  /** Tabular rows aligned to `columns`. */
  rows?: ReadonlyArray<ReadonlyArray<string | number | boolean | null>>;
}

/**
 * Server-issued binding. Every field is verified at submit time. `kid` lets a
 * future signing-key rotation distinguish envelopes signed with different
 * secrets without breaking in-flight envelopes.
 */
export interface EnvelopeBinding {
  version: RunEnvelopeVersion;
  kid: string;
  userId: string;
  projectId: string;
  stepId: string;
  validationKind: ValidationKindString;
  /** sha256(capture.code), hex lowercase. Derived server-side at sign time. */
  submissionSha256: string;
  /** sha256(canonicalized capture output fields), hex lowercase. Audit/forensic aid. */
  outputSha256: string;
  /** ISO-8601 UTC, server clock at signing. */
  issuedAt: string;
  /** ISO-8601 UTC, issuedAt + ttlMs. */
  expiresAt: string;
  /** Single-use replay token within the TTL window. */
  nonce: string;
}

export interface SignedRunEnvelope {
  capture: RunCapture;
  binding: EnvelopeBinding;
  /** HMAC-SHA256 over canonical(capture)||"\n"||canonical(binding), hex lowercase. */
  signature: string;
}

export type VerificationFailureReason =
  | "envelope-malformed"
  | "envelope-unsupported-version"
  | "envelope-bad-signature"
  | "envelope-expired"
  | "envelope-replay"
  | "envelope-binding-mismatch"
  | "envelope-tampered";

export type VerificationResult =
  | {
      ok: true;
      capture: RunCapture;
      binding: EnvelopeBinding;
    }
  | {
      ok: false;
      reason: VerificationFailureReason;
      detail?: string;
    };

/**
 * What the caller wants to bind. Hash fields are intentionally absent from
 * this input shape — the signer derives them. Timestamps and nonce default
 * to server-issued values but are overridable in tests via `now`/`nonce`.
 */
export interface SignBindingInput {
  userId: string;
  projectId: string;
  stepId: string;
  validationKind: ValidationKindString;
  ttlMs: number;
  kid?: string;
  /** Test-only override. Defaults to `crypto.randomUUID()`. */
  nonce?: string;
  /** Test-only override. Defaults to `() => Date.now()`. */
  now?: () => number;
}

export interface VerifyOptions {
  secret: string;
  /** Test-only override. Defaults to `() => Date.now()`. */
  now?: () => number;
  /**
   * Caller-supplied expected binding context. Each provided field must match
   * the envelope's binding exactly. Missing fields are NOT checked here — the
   * caller is responsible for passing everything they want to bind.
   */
  expected?: Partial<
    Pick<
      EnvelopeBinding,
      | "userId"
      | "projectId"
      | "stepId"
      | "validationKind"
      | "kid"
    >
  >;
  /**
   * Replay-protection hook. Return `true` if the nonce has been seen before
   * in the TTL window (i.e. this is a replay). Return `false` for first-use.
   *
   * The hook is invoked AFTER signature + binding + expiry checks pass, so an
   * attacker probing with garbage envelopes cannot use the hook as an oracle.
   *
   * Async to accommodate DB-backed nonce stores in Phase 46+. Sync booleans
   * are also accepted.
   */
  isNonceSeen?: (nonce: string) => Promise<boolean> | boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonicalization
// ─────────────────────────────────────────────────────────────────────────────

type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<CanonicalValue>
  | { readonly [k: string]: CanonicalValue };

/**
 * Deterministic JSON serialization with stable key order, NFC-normalized
 * strings, and explicit rejection of every shape that can introduce
 * ambiguity (undefined, NaN, Infinity, functions, symbols, Date, bigint).
 *
 * The output is the exact byte sequence fed to HMAC. Property-tested for
 * insertion-order stability in `runEnvelope.test.ts`.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value, "$"));
}

function canonicalizeValue(value: unknown, path: string): CanonicalValue {
  if (value === null) return null;
  if (value === undefined) {
    throw new Error(`canonicalize: undefined at ${path}`);
  }
  const t = typeof value;
  if (t === "string") {
    return (value as string).normalize("NFC");
  }
  if (t === "number") {
    const n = value as number;
    if (!Number.isFinite(n)) {
      throw new Error(`canonicalize: non-finite number at ${path}`);
    }
    return n;
  }
  if (t === "boolean") return value as boolean;
  if (t === "bigint" || t === "function" || t === "symbol") {
    throw new Error(`canonicalize: unsupported type ${t} at ${path}`);
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => canonicalizeValue(v, `${path}[${i}]`));
  }
  if (value instanceof Date) {
    throw new Error(
      `canonicalize: Date at ${path} — serialize to ISO string before signing`,
    );
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, CanonicalValue> = {};
    for (const k of sortedKeys) {
      const v = obj[k];
      if (v === undefined) continue; // drop undefined fields rather than fail
      out[k] = canonicalizeValue(v, `${path}.${k}`);
    }
    return out;
  }
  throw new Error(`canonicalize: unknown shape at ${path}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hash helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SHA-256 of a UTF-8 string, lowercase hex. Used for both `submissionSha256`
 * (over `capture.code`) and `outputSha256` (over the canonicalized capture
 * output subset). Hex is chosen over base64url because it is fixed-length,
 * case-insensitive, URL-safe, and aligns with the existing Atlas convention
 * (e.g. `submissionSha256` field naming used in HANDOFF / design docs).
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Stable digest of the *output portion* of a capture (everything except
 * `code`). Used as `binding.outputSha256`. Server-derived; client never
 * sends a pre-computed value.
 */
export function computeOutputSha256(capture: RunCapture): string {
  const outputSubset = {
    version: capture.version,
    language: capture.language,
    stdout: capture.stdout,
    stderr: capture.stderr,
    exitCode: capture.exitCode,
    durationMs: capture.durationMs,
    timedOut: capture.timedOut,
    columns: capture.columns,
    rows: capture.rows,
  };
  return sha256Hex(canonicalize(outputSubset));
}

// ─────────────────────────────────────────────────────────────────────────────
// Signing
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_KID = "v1";

function signaturePayload(
  capture: RunCapture,
  binding: EnvelopeBinding,
): string {
  return `${canonicalize(capture)}\n${canonicalize(binding)}`;
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Deep-copy a RunCapture so the caller's object is not retained / mutated.
 * Cheap; captures are small.
 */
function freezeCapture(input: RunCapture): RunCapture {
  return {
    version: input.version,
    language: input.language,
    code: input.code,
    stdout: input.stdout,
    stderr: input.stderr,
    exitCode: input.exitCode,
    durationMs: input.durationMs,
    timedOut: input.timedOut,
    columns: input.columns ? [...input.columns] : undefined,
    rows: input.rows ? input.rows.map((r) => [...r]) : undefined,
  };
}

/**
 * Mint a signed envelope. The server derives both hashes from the capture;
 * any pre-supplied values on the input binding are ignored. Caller input is
 * not mutated.
 */
export function signRunEnvelope(
  capture: RunCapture,
  bindingInput: SignBindingInput,
  secret: string,
): SignedRunEnvelope {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("signRunEnvelope: secret must be a non-empty string");
  }
  if (capture.version !== 1) {
    throw new Error(
      `signRunEnvelope: unsupported capture.version ${capture.version}`,
    );
  }
  if (bindingInput.ttlMs <= 0) {
    throw new Error("signRunEnvelope: ttlMs must be > 0");
  }

  const frozenCapture = freezeCapture(capture);
  const now = bindingInput.now ?? (() => Date.now());
  const issuedAtMs = now();
  const expiresAtMs = issuedAtMs + bindingInput.ttlMs;

  const binding: EnvelopeBinding = {
    version: 1,
    kid: bindingInput.kid ?? DEFAULT_KID,
    userId: bindingInput.userId,
    projectId: bindingInput.projectId,
    stepId: bindingInput.stepId,
    validationKind: bindingInput.validationKind,
    submissionSha256: sha256Hex(frozenCapture.code),
    outputSha256: computeOutputSha256(frozenCapture),
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    nonce: bindingInput.nonce ?? randomUUID(),
  };

  const signature = hmacHex(secret, signaturePayload(frozenCapture, binding));

  return { capture: frozenCapture, binding, signature };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification
// ─────────────────────────────────────────────────────────────────────────────

function fail(
  reason: VerificationFailureReason,
  detail?: string,
): VerificationResult {
  return detail ? { ok: false, reason, detail } : { ok: false, reason };
}

/**
 * Constant-time signature comparison. Returns false on any length mismatch
 * (which `timingSafeEqual` would throw on) and on any decode error.
 */
function signaturesMatch(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let bufA: Buffer;
  let bufB: Buffer;
  try {
    bufA = Buffer.from(a, "hex");
    bufB = Buffer.from(b, "hex");
  } catch {
    return false;
  }
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isValidIsoTimestamp(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const ms = Date.parse(s);
  return Number.isFinite(ms);
}

function looksLikeCapture(c: unknown): c is RunCapture {
  if (!c || typeof c !== "object") return false;
  const x = c as Record<string, unknown>;
  return (
    typeof x.version === "number" &&
    Number.isFinite(x.version) &&
    (x.language === "python" || x.language === "sql") &&
    typeof x.code === "string" &&
    typeof x.stdout === "string" &&
    typeof x.stderr === "string" &&
    typeof x.exitCode === "number" &&
    Number.isFinite(x.exitCode) &&
    typeof x.durationMs === "number" &&
    Number.isFinite(x.durationMs) &&
    typeof x.timedOut === "boolean"
  );
}

function looksLikeBinding(b: unknown): b is EnvelopeBinding {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  return (
    typeof x.version === "number" &&
    Number.isFinite(x.version) &&
    typeof x.kid === "string" &&
    typeof x.userId === "string" &&
    typeof x.projectId === "string" &&
    typeof x.stepId === "string" &&
    typeof x.validationKind === "string" &&
    typeof x.submissionSha256 === "string" &&
    typeof x.outputSha256 === "string" &&
    isValidIsoTimestamp(x.issuedAt) &&
    isValidIsoTimestamp(x.expiresAt) &&
    typeof x.nonce === "string" &&
    x.nonce.length > 0
  );
}

function looksLikeEnvelope(e: unknown): e is SignedRunEnvelope {
  if (!e || typeof e !== "object") return false;
  const x = e as Record<string, unknown>;
  return (
    looksLikeCapture(x.capture) &&
    looksLikeBinding(x.binding) &&
    typeof x.signature === "string" &&
    x.signature.length > 0
  );
}

/**
 * Verify a signed envelope. Returns a discriminated `Ok | Err` so callers
 * cannot pattern-match into `capture` without proving the verifier returned
 * `Ok` (security invariant S4).
 *
 * Order of checks is deliberate:
 *  1. Shape  →  reject obviously-malformed inputs cheaply.
 *  2. Version  →  reject unknown envelope versions.
 *  3. Signature  →  every later check trusts the binding bytes.
 *  4. Server-derived hash recompute  →  catches A8 stale-after-edit.
 *  5. Caller-expected binding match  →  catches A3 / A4 / A7.
 *  6. Expiry  →  rejects stale envelopes.
 *  7. Nonce  →  last, because the hook may be DB-backed; we don't want to
 *     touch it for trivially-bad envelopes.
 */
export async function verifyRunEnvelope(
  envelope: unknown,
  options: VerifyOptions,
): Promise<VerificationResult> {
  if (!options || typeof options.secret !== "string" || options.secret.length === 0) {
    return fail("envelope-malformed", "secret required");
  }
  if (!looksLikeEnvelope(envelope)) {
    return fail("envelope-malformed");
  }
  const { capture, binding, signature } = envelope;

  if (capture.version !== 1 || binding.version !== 1) {
    return fail("envelope-unsupported-version");
  }

  // Defensive: every later check trusts that canonicalize() won't throw on
  // capture/binding. The shape guards above already enforce the field types
  // canonicalize() requires, but row/column element values are typed as
  // `unknown` at the wire, so wrap in try/catch and return malformed rather
  // than letting a non-canonicalizable value escape as a thrown error.
  let expectedSignature: string;
  let recomputedSubmissionHash: string;
  let recomputedOutputHash: string;
  try {
    expectedSignature = hmacHex(
      options.secret,
      signaturePayload(capture, binding),
    );
    recomputedSubmissionHash = sha256Hex(capture.code);
    recomputedOutputHash = computeOutputSha256(capture);
  } catch (err) {
    return fail(
      "envelope-malformed",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!signaturesMatch(signature, expectedSignature)) {
    return fail("envelope-bad-signature");
  }

  if (recomputedSubmissionHash !== binding.submissionSha256) {
    return fail("envelope-tampered", "submissionSha256 mismatch");
  }
  if (recomputedOutputHash !== binding.outputSha256) {
    return fail("envelope-tampered", "outputSha256 mismatch");
  }

  const expected = options.expected;
  if (expected) {
    if (expected.userId !== undefined && expected.userId !== binding.userId) {
      return fail("envelope-binding-mismatch", "userId");
    }
    if (expected.projectId !== undefined && expected.projectId !== binding.projectId) {
      return fail("envelope-binding-mismatch", "projectId");
    }
    if (expected.stepId !== undefined && expected.stepId !== binding.stepId) {
      return fail("envelope-binding-mismatch", "stepId");
    }
    if (
      expected.validationKind !== undefined &&
      expected.validationKind !== binding.validationKind
    ) {
      return fail("envelope-binding-mismatch", "validationKind");
    }
    if (expected.kid !== undefined && expected.kid !== binding.kid) {
      return fail("envelope-binding-mismatch", "kid");
    }
  }

  const now = (options.now ?? (() => Date.now()))();
  const expiresAtMs = Date.parse(binding.expiresAt);
  if (now > expiresAtMs) {
    return fail("envelope-expired");
  }

  if (options.isNonceSeen) {
    const seen = await options.isNonceSeen(binding.nonce);
    if (seen) {
      return fail("envelope-replay");
    }
  }

  return { ok: true, capture, binding };
}
