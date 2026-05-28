/**
 * Phase 51 — envelopeMetrics unit tests.
 *
 * Pure module — no DB, no Express, no env. Just counters + percentiles.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordVerifyOk,
  recordVerifyFailed,
  recordFallback,
  getMetricsSnapshot,
  __resetMetricsForTests,
  VERIFY_FAILURE_REASONS,
} from "./envelopeMetrics";

beforeEach(() => __resetMetricsForTests());

describe("freshly reset snapshot", () => {
  it("returns zeros everywhere", () => {
    const s = getMetricsSnapshot();
    expect(s.verify.ok).toBe(0);
    expect(s.verify.total).toBe(0);
    expect(s.verify.successRate).toBe(0);
    expect(s.verify.durationMs.p50).toBe(0);
    expect(s.verify.durationMs.p95).toBe(0);
    expect(s.verify.durationMs.samples).toBe(0);
    expect(s.fallback.kind_not_enabled).toBe(0);
    expect(s.fallback.canary_bucket_skip).toBe(0);
    expect(s.envelopesObserved).toBe(0);
    expect(s.fallbackRate).toBe(0);
  });

  it("uptimeMs is non-negative", () => {
    expect(getMetricsSnapshot().uptimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe("recordVerifyOk", () => {
  it("increments verify.ok and total", () => {
    recordVerifyOk(10);
    recordVerifyOk(20);
    const s = getMetricsSnapshot();
    expect(s.verify.ok).toBe(2);
    expect(s.verify.total).toBe(2);
    expect(s.verify.successRate).toBe(1);
  });

  it("records duration sample for percentile calc", () => {
    recordVerifyOk(50);
    expect(getMetricsSnapshot().verify.durationMs.samples).toBe(1);
  });

  it("ignores NaN / negative duration but still increments ok", () => {
    recordVerifyOk(Number.NaN);
    recordVerifyOk(-5);
    recordVerifyOk(10);
    const s = getMetricsSnapshot();
    expect(s.verify.ok).toBe(3);
    expect(s.verify.durationMs.samples).toBe(1);
  });
});

describe("recordVerifyFailed", () => {
  it("buckets by reason and counts toward verify.total", () => {
    recordVerifyFailed("envelope_replay", 5);
    recordVerifyFailed("envelope_replay", 6);
    recordVerifyFailed("envelope_bad_signature", 7);
    const s = getMetricsSnapshot();
    expect(s.verify.failed["envelope_replay"]).toBe(2);
    expect(s.verify.failed["envelope_bad_signature"]).toBe(1);
    expect(s.verify.ok).toBe(0);
    expect(s.verify.total).toBe(3);
    expect(s.verify.successRate).toBe(0);
  });

  it("accepts unknown reason strings without throwing", () => {
    recordVerifyFailed("future_reason_we_didnt_anticipate", 1);
    expect(
      getMetricsSnapshot().verify.failed["future_reason_we_didnt_anticipate"],
    ).toBe(1);
  });

  it("computes success rate as ok / (ok + failed)", () => {
    for (let i = 0; i < 99; i++) recordVerifyOk(10);
    recordVerifyFailed("envelope_replay", 5);
    const s = getMetricsSnapshot();
    expect(s.verify.successRate).toBeCloseTo(0.99, 4);
  });

  it("covers every documented failure reason without error", () => {
    for (const reason of VERIFY_FAILURE_REASONS) {
      recordVerifyFailed(reason, 1);
    }
    const s = getMetricsSnapshot();
    for (const reason of VERIFY_FAILURE_REASONS) {
      expect(s.verify.failed[reason]).toBe(1);
    }
  });
});

describe("recordFallback", () => {
  it("increments the matching reason counter", () => {
    recordFallback("kind_not_enabled");
    recordFallback("kind_not_enabled");
    recordFallback("canary_bucket_skip");
    const s = getMetricsSnapshot();
    expect(s.fallback.kind_not_enabled).toBe(2);
    expect(s.fallback.canary_bucket_skip).toBe(1);
  });

  it("counts toward envelopesObserved + fallbackRate", () => {
    recordVerifyOk(10);
    recordFallback("canary_bucket_skip");
    recordFallback("canary_bucket_skip");
    recordFallback("canary_bucket_skip");
    const s = getMetricsSnapshot();
    expect(s.envelopesObserved).toBe(4);
    expect(s.fallbackRate).toBeCloseTo(0.75, 4);
  });
});

describe("durationMs percentiles", () => {
  it("computes p50/p95/p99 on a known fixture", () => {
    // 100 samples: 1..100. Nearest-rank quantiles.
    for (let i = 1; i <= 100; i++) recordVerifyOk(i);
    const p = getMetricsSnapshot().verify.durationMs;
    expect(p.samples).toBe(100);
    expect(p.p50).toBe(50);
    expect(p.p95).toBe(95);
    expect(p.p99).toBe(99);
  });

  it("handles a single-sample reservoir", () => {
    recordVerifyOk(42);
    const p = getMetricsSnapshot().verify.durationMs;
    expect(p.samples).toBe(1);
    expect(p.p50).toBe(42);
    expect(p.p95).toBe(42);
    expect(p.p99).toBe(42);
  });

  it("reservoir caps at 1000 samples even after 5000 records", () => {
    for (let i = 1; i <= 5000; i++) recordVerifyOk(i);
    const p = getMetricsSnapshot().verify.durationMs;
    expect(p.samples).toBe(1000);
  });
});

describe("snapshot immutability", () => {
  it("mutating returned objects does not affect future snapshots", () => {
    recordVerifyOk(10);
    recordFallback("kind_not_enabled");
    const a = getMetricsSnapshot();
    a.verify.ok = 9999;
    a.fallback.kind_not_enabled = 9999;
    a.verify.failed["fake"] = 9999;
    const b = getMetricsSnapshot();
    expect(b.verify.ok).toBe(1);
    expect(b.fallback.kind_not_enabled).toBe(1);
    expect(b.verify.failed["fake"]).toBeUndefined();
  });
});

describe("__resetMetricsForTests", () => {
  it("returns state to zero", () => {
    recordVerifyOk(10);
    recordVerifyFailed("envelope_replay", 5);
    recordFallback("canary_bucket_skip");
    __resetMetricsForTests();
    const s = getMetricsSnapshot();
    expect(s.verify.ok).toBe(0);
    expect(s.verify.total).toBe(0);
    expect(s.fallback.canary_bucket_skip).toBe(0);
    expect(s.envelopesObserved).toBe(0);
  });
});

describe("module-source banned-phrase guard", () => {
  it("envelopeMetrics.ts contains no H1/H2 overclaim phrases", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      new URL("./envelopeMetrics.ts", import.meta.url),
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
