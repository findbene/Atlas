/**
 * Phase 50 — Canary wrapper unit tests for envelopeSubmit.
 *
 * Covers the pure-function surface added in Phase 50:
 *   - parseCanaryPercent — clamps, rejects, defaults
 *   - bucketForUserKind — determinism + per-kind independence + spread
 *   - isEnvelopeEnforcedFor — the four-rule decision tree
 *
 * Route-level coverage (envelope branch wiring, verify success/failure
 * paths, nonce store, fallback logging) lives in
 * `routes/user-submit-envelope.test.ts` and
 * `routes/user-submit-envelope-pilot.test.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  parseCanaryPercent,
  bucketForUserKind,
  isEnvelopeEnforcedFor,
  parseEnvelopeAllowList,
} from "./envelopeSubmit";

describe("parseEnvelopeAllowList (Phase 47 — unchanged baseline)", () => {
  it("returns empty set when unset/empty/whitespace", () => {
    expect(parseEnvelopeAllowList(undefined).size).toBe(0);
    expect(parseEnvelopeAllowList("").size).toBe(0);
    expect(parseEnvelopeAllowList("   ").size).toBe(0);
  });

  it("parses a single kind", () => {
    const s = parseEnvelopeAllowList("json_equal");
    expect(s.has("json_equal")).toBe(true);
    expect(s.size).toBe(1);
  });

  it("parses comma-separated + trims whitespace", () => {
    const s = parseEnvelopeAllowList("json_equal, numeric_tolerance ,csv_set_equal");
    expect([...s].sort()).toEqual(["csv_set_equal", "json_equal", "numeric_tolerance"]);
  });

  it("dedupes repeated kinds", () => {
    expect(parseEnvelopeAllowList("json_equal,json_equal").size).toBe(1);
  });
});

describe("parseCanaryPercent", () => {
  it("defaults to 0 for unset / empty / non-numeric", () => {
    expect(parseCanaryPercent(undefined)).toBe(0);
    expect(parseCanaryPercent("")).toBe(0);
    expect(parseCanaryPercent("  ")).toBe(0);
    expect(parseCanaryPercent("not-a-number")).toBe(0);
    expect(parseCanaryPercent("NaN")).toBe(0);
  });

  it("clamps negative values to 0", () => {
    expect(parseCanaryPercent("-1")).toBe(0);
    expect(parseCanaryPercent("-100")).toBe(0);
  });

  it("clamps >100 to 100", () => {
    expect(parseCanaryPercent("101")).toBe(100);
    expect(parseCanaryPercent("9999")).toBe(100);
  });

  it("accepts integer values in [0, 100]", () => {
    expect(parseCanaryPercent("0")).toBe(0);
    expect(parseCanaryPercent("1")).toBe(1);
    expect(parseCanaryPercent("50")).toBe(50);
    expect(parseCanaryPercent("100")).toBe(100);
  });

  it("parses leading integer of decimals (parseInt semantics)", () => {
    // We intentionally use parseInt — fractional percents are not a
    // meaningful rollout unit, and silently rounding down is safer than
    // accepting "1.9" and surprise-enrolling 1.9% of traffic.
    expect(parseCanaryPercent("1.9")).toBe(1);
    expect(parseCanaryPercent("50.5")).toBe(50);
  });
});

describe("bucketForUserKind", () => {
  it("returns an integer in [0, 99]", () => {
    for (let i = 0; i < 1000; i++) {
      const b = bucketForUserKind(`user-${i}`, "json_equal");
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
      expect(Number.isInteger(b)).toBe(true);
    }
  });

  it("is deterministic across calls", () => {
    const a = bucketForUserKind("user-abc-123", "json_equal");
    const b = bucketForUserKind("user-abc-123", "json_equal");
    const c = bucketForUserKind("user-abc-123", "json_equal");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("is independent per kind for the same user", () => {
    // The whole point of per-kind keying: a user being IN the json_equal
    // canary should not predict their membership in the numeric_tolerance
    // canary. Verify by counting cross-kind agreement across many users.
    let agreements = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const u = `user-${i}`;
      if (bucketForUserKind(u, "json_equal") === bucketForUserKind(u, "numeric_tolerance")) {
        agreements++;
      }
    }
    // Random uniform → ~1% exact-match collisions. Allow a generous band.
    expect(agreements).toBeLessThan(N * 0.05);
  });

  it("spreads users roughly uniformly across 100 buckets", () => {
    const counts = new Array<number>(100).fill(0);
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      counts[bucketForUserKind(`user-${i}`, "json_equal")]!++;
    }
    // Expected per bucket = 100. Allow ±60 (very loose, just catches
    // catastrophic hashing failure / off-by-one in the modulo).
    for (const c of counts) {
      expect(c).toBeGreaterThan(40);
      expect(c).toBeLessThan(160);
    }
  });
});

describe("isEnvelopeEnforcedFor — decision tree", () => {
  it("rule 1: returns false when kind not in allow-list (default behavior)", () => {
    expect(isEnvelopeEnforcedFor("json_equal", "user-1", {})).toBe(false);
    expect(
      isEnvelopeEnforcedFor("json_equal", "user-1", {
        ATLAS_ENVELOPE_REQUIRED_KINDS: "",
      }),
    ).toBe(false);
    expect(
      isEnvelopeEnforcedFor("json_equal", "user-1", {
        ATLAS_ENVELOPE_REQUIRED_KINDS: "numeric_tolerance",
      }),
    ).toBe(false);
  });

  it("rule 1 holds even when canary is fully configured for the kind", () => {
    // No allow-list entry trumps any canary config. Operators cannot
    // accidentally enable enforcement by setting only the canary vars.
    expect(
      isEnvelopeEnforcedFor("json_equal", "user-1", {
        ATLAS_ENVELOPE_REQUIRED_KINDS: "",
        ATLAS_ENVELOPE_CANARY_KINDS: "json_equal",
        ATLAS_ENVELOPE_CANARY_PERCENT: "100",
      }),
    ).toBe(false);
  });

  it("rule 2: allow-list alone gates when canary env is absent (pre-P50 behavior)", () => {
    expect(
      isEnvelopeEnforcedFor("json_equal", "user-1", {
        ATLAS_ENVELOPE_REQUIRED_KINDS: "json_equal",
      }),
    ).toBe(true);
  });

  it("rule 3: kind not in canary-kinds → enforced at 100% (other kinds ramp unaffected)", () => {
    // Operator has json_equal at 100% and is starting numeric_tolerance
    // at 1% — json_equal must still enforce 100% of traffic.
    const env = {
      ATLAS_ENVELOPE_REQUIRED_KINDS: "json_equal,numeric_tolerance",
      ATLAS_ENVELOPE_CANARY_KINDS: "numeric_tolerance",
      ATLAS_ENVELOPE_CANARY_PERCENT: "1",
    };
    expect(isEnvelopeEnforcedFor("json_equal", "user-1", env)).toBe(true);
    expect(isEnvelopeEnforcedFor("json_equal", "user-2", env)).toBe(true);
  });

  it("rule 4: 0% canary → no user enforced", () => {
    const env = {
      ATLAS_ENVELOPE_REQUIRED_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_PERCENT: "0",
    };
    for (let i = 0; i < 200; i++) {
      expect(isEnvelopeEnforcedFor("json_equal", `user-${i}`, env)).toBe(false);
    }
  });

  it("rule 4: 100% canary → all users enforced", () => {
    const env = {
      ATLAS_ENVELOPE_REQUIRED_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_PERCENT: "100",
    };
    for (let i = 0; i < 200; i++) {
      expect(isEnvelopeEnforcedFor("json_equal", `user-${i}`, env)).toBe(true);
    }
  });

  it("rule 4: ~1% canary lands between 0 and 5 of 1000 users", () => {
    const env = {
      ATLAS_ENVELOPE_REQUIRED_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_PERCENT: "1",
    };
    let inCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (isEnvelopeEnforcedFor("json_equal", `user-${i}`, env)) inCount++;
    }
    // True expectation = 10. Loose band — catches "canary lets everyone in"
    // or "canary lets nobody in" bugs without flaking on hash randomness.
    expect(inCount).toBeGreaterThan(0);
    expect(inCount).toBeLessThan(30);
  });

  it("rule 4: 10% canary lands roughly in expected band", () => {
    const env = {
      ATLAS_ENVELOPE_REQUIRED_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_PERCENT: "10",
    };
    let inCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (isEnvelopeEnforcedFor("json_equal", `user-${i}`, env)) inCount++;
    }
    // Expected 100. Loose ±60 band.
    expect(inCount).toBeGreaterThan(40);
    expect(inCount).toBeLessThan(160);
  });

  it("rule 4: a single user's membership is stable across calls", () => {
    const env = {
      ATLAS_ENVELOPE_REQUIRED_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_PERCENT: "1",
    };
    // For each of 50 users, the decision is identical across 5 calls.
    for (let i = 0; i < 50; i++) {
      const u = `user-${i}`;
      const first = isEnvelopeEnforcedFor("json_equal", u, env);
      for (let k = 0; k < 5; k++) {
        expect(isEnvelopeEnforcedFor("json_equal", u, env)).toBe(first);
      }
    }
  });

  it("rule 4: percent only set without canary-kinds → behaves as if canary not configured", () => {
    // Defensive — partial config (one of the two vars set) must NOT
    // silently start bucketing. Either both or neither.
    const env = {
      ATLAS_ENVELOPE_REQUIRED_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_PERCENT: "1",
    };
    // All users enforced (rule 2 path).
    for (let i = 0; i < 50; i++) {
      expect(isEnvelopeEnforcedFor("json_equal", `user-${i}`, env)).toBe(true);
    }
  });

  it("rule 4: negative percent clamps to 0 (no users enforced)", () => {
    const env = {
      ATLAS_ENVELOPE_REQUIRED_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_PERCENT: "-1",
    };
    for (let i = 0; i < 50; i++) {
      expect(isEnvelopeEnforcedFor("json_equal", `user-${i}`, env)).toBe(false);
    }
  });

  it("rule 4: percent > 100 clamps to 100 (all users enforced)", () => {
    const env = {
      ATLAS_ENVELOPE_REQUIRED_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_KINDS: "json_equal",
      ATLAS_ENVELOPE_CANARY_PERCENT: "9999",
    };
    for (let i = 0; i < 50; i++) {
      expect(isEnvelopeEnforcedFor("json_equal", `user-${i}`, env)).toBe(true);
    }
  });
});

describe("canary copy guard — H1/H2 overclaim phrases must NOT appear in module", () => {
  // Belt-and-braces check: this file is the canary control plane. It
  // must not introduce any user-facing copy that elevates the honest
  // claim past H3. Module docstrings are fine but should not promise
  // tamper-proof / cheat-proof / proven-authorship anywhere.
  it("envelopeSubmit.ts source contains no banned phrases", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      new URL("./envelopeSubmit.ts", import.meta.url),
      "utf8",
    );
    const banned = [
      "tamper-proof",
      "tamperproof",
      "cheat-proof",
      "cheatproof",
      "fraud-proof",
      "verified authorship",
      "proven authorship",
      "proves you wrote",
      "guarantees you wrote",
      "anti-cheat",
      "100% verified",
      "independently verified",
    ];
    for (const phrase of banned) {
      expect(source.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
