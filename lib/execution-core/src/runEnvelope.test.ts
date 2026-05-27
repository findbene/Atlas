import { describe, expect, it } from "vitest";
import {
  canonicalize,
  computeOutputSha256,
  sha256Hex,
  signRunEnvelope,
  verifyRunEnvelope,
  type RunCapture,
  type SignBindingInput,
  type SignedRunEnvelope,
} from "./runEnvelope.js";

const SECRET = "test-secret-do-not-use-in-prod";
const ALT_SECRET = "another-secret";

const FIXED_NOW = 1_700_000_000_000;
const TTL_MS = 10 * 60 * 1000;

function makeCapture(overrides: Partial<RunCapture> = {}): RunCapture {
  return {
    version: 1,
    language: "python",
    code: "print(1 + 1)",
    stdout: "2\n",
    stderr: "",
    exitCode: 0,
    durationMs: 42,
    timedOut: false,
    ...overrides,
  };
}

function makeBindingInput(
  overrides: Partial<SignBindingInput> = {},
): SignBindingInput {
  return {
    userId: "user_abc",
    projectId: "proj_xyz",
    stepId: "step_001",
    validationKind: "json_equal",
    ttlMs: TTL_MS,
    nonce: "nonce-fixed-1",
    now: () => FIXED_NOW,
    ...overrides,
  };
}

function sign(
  captureOverrides: Partial<RunCapture> = {},
  bindingOverrides: Partial<SignBindingInput> = {},
): SignedRunEnvelope {
  return signRunEnvelope(
    makeCapture(captureOverrides),
    makeBindingInput(bindingOverrides),
    SECRET,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonicalization
// ─────────────────────────────────────────────────────────────────────────────

describe("canonicalize", () => {
  it("is stable across object key insertion order", () => {
    const a = canonicalize({ a: 1, b: 2, c: 3 });
    const b = canonicalize({ c: 3, a: 1, b: 2 });
    const c = canonicalize({ b: 2, c: 3, a: 1 });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("recurses into nested objects with stable order", () => {
    const a = canonicalize({ x: { p: 1, q: 2 }, y: 3 });
    const b = canonicalize({ y: 3, x: { q: 2, p: 1 } });
    expect(a).toBe(b);
  });

  it("preserves array order (no sorting)", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
    expect(canonicalize([3, 1, 2])).not.toBe(canonicalize([1, 2, 3]));
  });

  it("NFC-normalizes strings so visually-identical inputs collapse", () => {
    const composed = "é"; // U+00E9
    const decomposed = "e\u0301"; // U+0065 U+0301
    expect(composed).not.toBe(decomposed);
    expect(canonicalize({ s: composed })).toBe(canonicalize({ s: decomposed }));
  });

  it("drops undefined object fields rather than failing", () => {
    expect(canonicalize({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
  });

  it("throws on undefined values directly", () => {
    expect(() => canonicalize(undefined)).toThrow(/undefined/);
  });

  it("throws on NaN / Infinity", () => {
    expect(() => canonicalize({ x: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalize({ x: Number.POSITIVE_INFINITY })).toThrow(
      /non-finite/,
    );
  });

  it("throws on Date so callers must pre-serialize to ISO", () => {
    expect(() => canonicalize({ at: new Date() })).toThrow(/Date/);
  });

  it("throws on bigint / function / symbol", () => {
    expect(() => canonicalize({ x: 1n })).toThrow(/bigint/);
    expect(() => canonicalize({ x: () => 0 })).toThrow(/function/);
    expect(() => canonicalize({ x: Symbol("s") })).toThrow(/symbol/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hash helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("sha256Hex", () => {
  it("is deterministic", () => {
    expect(sha256Hex("hello")).toBe(sha256Hex("hello"));
  });

  it("produces lowercase hex of length 64", () => {
    const h = sha256Hex("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs across different inputs", () => {
    expect(sha256Hex("hello")).not.toBe(sha256Hex("hellp"));
  });
});

describe("computeOutputSha256", () => {
  it("is deterministic for the same output content", () => {
    const c1 = makeCapture();
    const c2 = makeCapture();
    expect(computeOutputSha256(c1)).toBe(computeOutputSha256(c2));
  });

  it("does NOT depend on code (only output fields)", () => {
    const a = computeOutputSha256(makeCapture({ code: "A" }));
    const b = computeOutputSha256(makeCapture({ code: "B" }));
    expect(a).toBe(b);
  });

  it("changes when stdout changes", () => {
    const a = computeOutputSha256(makeCapture({ stdout: "1\n" }));
    const b = computeOutputSha256(makeCapture({ stdout: "2\n" }));
    expect(a).not.toBe(b);
  });

  it("changes when row order changes (arrays are order-sensitive)", () => {
    const a = computeOutputSha256(
      makeCapture({ columns: ["x"], rows: [[1], [2]] }),
    );
    const b = computeOutputSha256(
      makeCapture({ columns: ["x"], rows: [[2], [1]] }),
    );
    expect(a).not.toBe(b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sign / verify round-trip
// ─────────────────────────────────────────────────────────────────────────────

describe("signRunEnvelope + verifyRunEnvelope round trip", () => {
  it("round-trips and exposes capture only on the Ok arm", async () => {
    const env = sign();
    const result = await verifyRunEnvelope(env, { secret: SECRET, now: () => FIXED_NOW + 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capture.code).toBe("print(1 + 1)");
      expect(result.binding.userId).toBe("user_abc");
      expect(result.binding.kid).toBe("v1");
    }
  });

  it("derives submissionSha256 server-side (matches sha256 of code)", () => {
    const env = sign({ code: "X" });
    expect(env.binding.submissionSha256).toBe(sha256Hex("X"));
  });

  it("derives outputSha256 server-side (matches computeOutputSha256)", () => {
    const env = sign();
    expect(env.binding.outputSha256).toBe(computeOutputSha256(env.capture));
  });

  it("sets issuedAt and expiresAt = issuedAt + ttlMs", () => {
    const env = sign();
    expect(env.binding.issuedAt).toBe(new Date(FIXED_NOW).toISOString());
    expect(env.binding.expiresAt).toBe(
      new Date(FIXED_NOW + TTL_MS).toISOString(),
    );
  });

  it("does NOT mutate the caller's capture object", () => {
    const original = makeCapture({ columns: ["a"], rows: [[1]] });
    const snapshot = JSON.parse(JSON.stringify(original)) as RunCapture;
    signRunEnvelope(original, makeBindingInput(), SECRET);
    expect(original).toEqual(snapshot);
  });

  it("returns malformed when secret is missing or empty", async () => {
    const env = sign();
    const r = await verifyRunEnvelope(env, { secret: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-malformed");
  });

  it("throws on signing with an empty secret", () => {
    expect(() => signRunEnvelope(makeCapture(), makeBindingInput(), "")).toThrow();
  });

  it("throws on signing with a non-positive TTL", () => {
    expect(() =>
      signRunEnvelope(makeCapture(), makeBindingInput({ ttlMs: 0 }), SECRET),
    ).toThrow(/ttlMs/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tamper detection
// ─────────────────────────────────────────────────────────────────────────────

describe("verifyRunEnvelope tamper detection", () => {
  it("rejects when stdout is mutated post-sign", async () => {
    const env = sign();
    const tampered: SignedRunEnvelope = {
      ...env,
      capture: { ...env.capture, stdout: "999\n" },
    };
    const r = await verifyRunEnvelope(tampered, { secret: SECRET, now: () => FIXED_NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-bad-signature");
  });

  it("rejects when code is mutated post-sign", async () => {
    const env = sign();
    const tampered: SignedRunEnvelope = {
      ...env,
      capture: { ...env.capture, code: "evil()" },
    };
    const r = await verifyRunEnvelope(tampered, { secret: SECRET, now: () => FIXED_NOW });
    expect(r.ok).toBe(false);
    // either bad-signature (likely) or tampered if signature happened to align
    if (!r.ok) expect(["envelope-bad-signature", "envelope-tampered"]).toContain(r.reason);
  });

  it("rejects when projectId / stepId / userId in binding is mutated", async () => {
    for (const field of ["projectId", "stepId", "userId"] as const) {
      const env = sign();
      const tampered: SignedRunEnvelope = {
        ...env,
        binding: { ...env.binding, [field]: "EVIL" },
      };
      const r = await verifyRunEnvelope(tampered, { secret: SECRET, now: () => FIXED_NOW });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("envelope-bad-signature");
    }
  });

  it("rejects when signature is wrong secret (constant-time path)", async () => {
    const env = sign();
    const r = await verifyRunEnvelope(env, { secret: ALT_SECRET, now: () => FIXED_NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-bad-signature");
  });

  it("rejects when signature length differs (no plain-equality fallback)", async () => {
    const env = sign();
    const tampered: SignedRunEnvelope = { ...env, signature: env.signature.slice(0, -2) };
    const r = await verifyRunEnvelope(tampered, { secret: SECRET, now: () => FIXED_NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-bad-signature");
  });

  it("rejects when submissionSha256 disagrees with code (forged binding hash)", async () => {
    // Construct a hand-signed envelope where binding lies about submissionSha256.
    // We bypass signRunEnvelope's server-derived hash by re-signing manually.
    const capture = makeCapture();
    const goodEnv = sign();
    const liedBinding = { ...goodEnv.binding, submissionSha256: sha256Hex("not-the-code") };
    // Re-sign so the signature *matches* the lying binding, isolating the
    // tamper check (not the signature check).
    const { createHmac } = await import("node:crypto");
    const payload = `${canonicalize(capture)}\n${canonicalize(liedBinding)}`;
    const sig = createHmac("sha256", SECRET).update(payload, "utf8").digest("hex");
    const r = await verifyRunEnvelope(
      { capture, binding: liedBinding, signature: sig },
      { secret: SECRET, now: () => FIXED_NOW },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("envelope-tampered");
      expect(r.detail).toContain("submissionSha256");
    }
  });

  it("rejects when outputSha256 disagrees with capture output", async () => {
    const capture = makeCapture();
    const goodEnv = sign();
    const liedBinding = { ...goodEnv.binding, outputSha256: sha256Hex("nope") };
    const { createHmac } = await import("node:crypto");
    const payload = `${canonicalize(capture)}\n${canonicalize(liedBinding)}`;
    const sig = createHmac("sha256", SECRET).update(payload, "utf8").digest("hex");
    const r = await verifyRunEnvelope(
      { capture, binding: liedBinding, signature: sig },
      { secret: SECRET, now: () => FIXED_NOW },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("envelope-tampered");
      expect(r.detail).toContain("outputSha256");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Expiry + binding + replay
// ─────────────────────────────────────────────────────────────────────────────

describe("verifyRunEnvelope expiry + binding + replay", () => {
  it("rejects expired envelopes", async () => {
    const env = sign();
    const r = await verifyRunEnvelope(env, {
      secret: SECRET,
      now: () => FIXED_NOW + TTL_MS + 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-expired");
  });

  it("accepts envelopes exactly at expiresAt", async () => {
    const env = sign();
    const r = await verifyRunEnvelope(env, {
      secret: SECRET,
      now: () => FIXED_NOW + TTL_MS,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects mismatched expected.userId before touching nonce hook", async () => {
    const env = sign();
    let nonceCalled = false;
    const r = await verifyRunEnvelope(env, {
      secret: SECRET,
      now: () => FIXED_NOW,
      expected: { userId: "different_user" },
      isNonceSeen: () => {
        nonceCalled = true;
        return false;
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("envelope-binding-mismatch");
      expect(r.detail).toBe("userId");
    }
    expect(nonceCalled).toBe(false);
  });

  it("rejects mismatched expected.projectId / stepId / validationKind / kid", async () => {
    const env = sign();
    for (const [field, value] of [
      ["projectId", "wrong_proj"],
      ["stepId", "wrong_step"],
      ["validationKind", "exact"],
      ["kid", "v2"],
    ] as const) {
      const r = await verifyRunEnvelope(env, {
        secret: SECRET,
        now: () => FIXED_NOW,
        expected: { [field]: value },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe("envelope-binding-mismatch");
        expect(r.detail).toBe(field);
      }
    }
  });

  it("accepts when all expected fields match", async () => {
    const env = sign();
    const r = await verifyRunEnvelope(env, {
      secret: SECRET,
      now: () => FIXED_NOW,
      expected: {
        userId: "user_abc",
        projectId: "proj_xyz",
        stepId: "step_001",
        validationKind: "json_equal",
        kid: "v1",
      },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects when nonce hook reports replay", async () => {
    const env = sign();
    const r = await verifyRunEnvelope(env, {
      secret: SECRET,
      now: () => FIXED_NOW,
      isNonceSeen: () => true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-replay");
  });

  it("supports an async nonce hook", async () => {
    const env = sign();
    const r = await verifyRunEnvelope(env, {
      secret: SECRET,
      now: () => FIXED_NOW,
      isNonceSeen: async () => Promise.resolve(true),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-replay");
  });

  it("does NOT invoke the nonce hook on bad-signature envelopes (avoids DB oracle)", async () => {
    const env = sign();
    let called = false;
    const r = await verifyRunEnvelope(
      { ...env, signature: "0".repeat(env.signature.length) },
      {
        secret: SECRET,
        now: () => FIXED_NOW,
        isNonceSeen: () => {
          called = true;
          return false;
        },
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-bad-signature");
    expect(called).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Malformed inputs fail safely (no throws)
// ─────────────────────────────────────────────────────────────────────────────

describe("verifyRunEnvelope safety against malformed inputs", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["string", "envelope"],
    ["number", 42],
    ["empty object", {}],
    ["partial envelope", { capture: { version: 1 } }],
    ["missing signature", { capture: makeCapture(), binding: { version: 1 } }],
  ])("rejects %s without throwing", async (_label, input) => {
    const r = await verifyRunEnvelope(input as unknown, { secret: SECRET });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-malformed");
  });

  it("rejects an envelope whose capture.version is unsupported (not 1)", async () => {
    const env = sign();
    const evil = {
      ...env,
      capture: { ...env.capture, version: 2 as unknown as 1 },
    };
    const r = await verifyRunEnvelope(evil, { secret: SECRET, now: () => FIXED_NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-unsupported-version");
  });

  it("rejects an envelope whose binding.version is unsupported (not 1)", async () => {
    const env = sign();
    const evil = {
      ...env,
      binding: { ...env.binding, version: 2 as unknown as 1 },
    };
    const r = await verifyRunEnvelope(evil, { secret: SECRET, now: () => FIXED_NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-unsupported-version");
  });

  it("rejects an envelope whose capture.version is a non-numeric string as malformed", async () => {
    const env = sign();
    const evil = {
      ...env,
      capture: { ...env.capture, version: "1" as unknown as 1 },
    };
    const r = await verifyRunEnvelope(evil, { secret: SECRET, now: () => FIXED_NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envelope-malformed");
  });
});
