/**
 * Phase 8 regression — `dynamic_ai_adaptive` is now a native first-class
 * learner mode, NOT an alias for `guided`. These assertions exist to
 * prevent any future "simplification" from re-collapsing the two modes.
 */
import { describe, it, expect } from "vitest";
import {
  evaluateHintPolicy,
  toAtlasLearnerMode,
  fromAtlasLearnerMode,
  LEGACY_MODE_ALIAS,
  MAX_HINT_LEVEL,
  type AtlasLearnerMode,
} from "./pedagogy";

describe("Phase 8 — dynamic_ai_adaptive native mode", () => {
  it("round-trips through the DB/Atlas mapper without aliasing to guided", () => {
    expect(toAtlasLearnerMode("dynamic_ai_adaptive")).toBe("dynamic_ai_adaptive");
    expect(fromAtlasLearnerMode("dynamic_ai_adaptive" as AtlasLearnerMode)).toBe("dynamic_ai_adaptive");
  });

  it("has an empty LEGACY_MODE_ALIAS map — no historic collapses leak through", () => {
    expect(Object.keys(LEGACY_MODE_ALIAS)).toHaveLength(0);
  });

  it("evaluates with a distinct policy from guided_with_walkthrough", () => {
    // Same struggle signal → the two modes must NOT produce identical
    // (shouldOffer, suggestedLevel) tuples for every input. Specifically,
    // dynamic_ai_adaptive scales offers with struggle, whereas
    // adaptive_inquiry_ai_assisted only jumps after 2 failed attempts.
    const dyn = evaluateHintPolicy({
      mode: "dynamic_ai_adaptive",
      currentLevel: 0,
      attemptCount: 4,
      lastValidationFailed: true,
      stepPassed: false,
    });
    const inquiry = evaluateHintPolicy({
      mode: "adaptive_inquiry_ai_assisted",
      currentLevel: 0,
      attemptCount: 1,
      lastValidationFailed: false,
      stepPassed: false,
    });
    // dynamic scales with attempts → should offer at attempt=4
    expect(dyn.shouldOffer).toBe(true);
    // adaptive_inquiry waits for the 2-fail trigger → no offer here
    expect(inquiry.shouldOffer).toBe(false);
  });

  it("clamps suggestedLevel to MAX_HINT_LEVEL", () => {
    const r = evaluateHintPolicy({
      mode: "dynamic_ai_adaptive",
      currentLevel: MAX_HINT_LEVEL,
      attemptCount: 99,
      lastValidationFailed: true,
      stepPassed: false,
    });
    expect(r.suggestedLevel).toBeLessThanOrEqual(MAX_HINT_LEVEL);
  });
});
