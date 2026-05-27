import { describe, it, expect } from "vitest";
import {
  buildTutorContract,
  renderTutorContractForPrompt,
  resolveAdaptiveMode,
  type TutorContractInput,
} from "./tutorContract.js";

const baseSignals: Omit<TutorContractInput, "mode"> = {
  attemptCount: 0,
  currentHintLevel: 0,
  lastValidationFailed: false,
  stepPassed: false,
};

describe("buildTutorContract — guided_ai_assisted", () => {
  const contract = buildTutorContract({
    mode: "guided_ai_assisted",
    ...baseSignals,
  });
  it("uses proactive-scaffolded boundary", () => {
    expect(contract.helpBoundary).toBe("proactive-scaffolded");
    expect(contract.effectiveMode).toBe("guided_ai_assisted");
    expect(contract.resolvedFromAdaptive).toBe(false);
  });
  it("allows proactive nudges + worked examples", () => {
    const allText = contract.allowedBehaviors.join(" ").toLowerCase();
    expect(allText).toMatch(/proactive|nudge|example|step-by-step/);
  });
  it("forbids dumping the full final solution", () => {
    const forbText = contract.forbiddenBehaviors.join(" ").toLowerCase();
    expect(forbText).toMatch(/not dump.*complete|final solution|hint ladder/);
  });
});

describe("buildTutorContract — adaptive_inquiry_ai_assisted (hint-based)", () => {
  const contract = buildTutorContract({
    mode: "adaptive_inquiry_ai_assisted",
    ...baseSignals,
  });
  it("uses progressive-hints boundary", () => {
    expect(contract.helpBoundary).toBe("progressive-hints");
  });
  it("references progressive hinting (conceptual → technical → partial)", () => {
    const allText = contract.allowedBehaviors.join(" ").toLowerCase();
    expect(allText).toMatch(/conceptual nudge|diagnostic question/);
    expect(allText).toMatch(/technical clue/);
    expect(allText).toMatch(/partial structure/);
  });
  it("forbids collapsing the hint ladder", () => {
    const forbText = contract.forbiddenBehaviors.join(" ").toLowerCase();
    expect(forbText).toMatch(/collapse the hint ladder|combining multiple levels/);
  });
});

describe("buildTutorContract — mastery_gated_independent_ai_assisted (independent)", () => {
  it("step not passed → diagnostic-only boundary + NO full-solution language", () => {
    const c = buildTutorContract({
      mode: "mastery_gated_independent_ai_assisted",
      ...baseSignals,
    });
    expect(c.helpBoundary).toBe("diagnostic-only");
    const allText = c.allowedBehaviors.join(" ").toLowerCase();
    expect(allText).toMatch(/literally what was asked|debugging|hypothesis/);
    const forbText = c.forbiddenBehaviors.join(" ").toLowerCase();
    // Critical: no solution leak language
    expect(forbText).toMatch(/not reveal the full solution/);
    expect(forbText).toMatch(/portfolio credibility/);
    expect(forbText).toMatch(/the answer is|just write/);
  });
  it("step passed → review-permissive boundary opens up", () => {
    const c = buildTutorContract({
      mode: "mastery_gated_independent_ai_assisted",
      ...baseSignals,
      stepPassed: true,
    });
    expect(c.helpBoundary).toBe("review-permissive");
    const allText = c.allowedBehaviors.join(" ").toLowerCase();
    expect(allText).toMatch(/already passed|trade-offs|alternatives/);
  });
});

describe("buildTutorContract — dynamic_ai_adaptive resolution", () => {
  it("step passed → resolves to independent review", () => {
    const c = buildTutorContract({
      mode: "dynamic_ai_adaptive",
      ...baseSignals,
      stepPassed: true,
    });
    expect(c.resolvedFromAdaptive).toBe(true);
    expect(c.effectiveMode).toBe("mastery_gated_independent_ai_assisted");
    expect(c.helpBoundary).toBe("review-permissive");
  });
  it("repeated failures → resolves to guided rescue", () => {
    const c = buildTutorContract({
      mode: "dynamic_ai_adaptive",
      attemptCount: 3,
      currentHintLevel: 0,
      lastValidationFailed: true,
      stepPassed: false,
    });
    expect(c.effectiveMode).toBe("guided_ai_assisted");
  });
  it("high hint level → resolves to guided rescue", () => {
    const c = buildTutorContract({
      mode: "dynamic_ai_adaptive",
      attemptCount: 0,
      currentHintLevel: 3,
      lastValidationFailed: false,
      stepPassed: false,
    });
    expect(c.effectiveMode).toBe("guided_ai_assisted");
  });
  it("mild engagement → resolves to hint-based", () => {
    const c = buildTutorContract({
      mode: "dynamic_ai_adaptive",
      attemptCount: 1,
      currentHintLevel: 0,
      lastValidationFailed: true,
      stepPassed: false,
    });
    expect(c.effectiveMode).toBe("adaptive_inquiry_ai_assisted");
  });
  it("fresh start → default to hint-based (not vague)", () => {
    const c = buildTutorContract({
      mode: "dynamic_ai_adaptive",
      ...baseSignals,
    });
    expect(c.effectiveMode).toBe("adaptive_inquiry_ai_assisted");
    expect(c.helpBoundary).toBe("progressive-hints");
  });
  it("adaptive resolution is deterministic for a given signal set", () => {
    const sig = {
      attemptCount: 2,
      currentHintLevel: 1,
      lastValidationFailed: true,
      stepPassed: false,
    };
    expect(resolveAdaptiveMode(sig)).toBe(resolveAdaptiveMode(sig));
  });
});

describe("renderTutorContractForPrompt", () => {
  it("includes mode, boundary, allowed, forbidden, validation guidance, style", () => {
    const c = buildTutorContract({
      mode: "guided_ai_assisted",
      ...baseSignals,
    });
    const rendered = renderTutorContractForPrompt(c);
    expect(rendered).toMatch(/TUTOR CONTRACT/);
    expect(rendered).toMatch(/learner_mode: guided_ai_assisted/);
    expect(rendered).toMatch(/help_boundary:/);
    expect(rendered).toMatch(/- allowed:/);
    expect(rendered).toMatch(/- forbidden:/);
    expect(rendered).toMatch(/validation_guidance:/);
    expect(rendered).toMatch(/response_style:/);
  });
  it("annotates effective_mode when resolved from adaptive", () => {
    const c = buildTutorContract({
      mode: "dynamic_ai_adaptive",
      ...baseSignals,
      stepPassed: true,
    });
    const rendered = renderTutorContractForPrompt(c);
    expect(rendered).toMatch(/effective_mode \(adaptive resolution\):/);
  });
  it("does NOT annotate effective_mode for non-adaptive modes", () => {
    const c = buildTutorContract({
      mode: "guided_ai_assisted",
      ...baseSignals,
    });
    const rendered = renderTutorContractForPrompt(c);
    expect(rendered).not.toMatch(/effective_mode/);
  });
});

describe("buildTutorContract — solution-leak invariant for independent mode", () => {
  // Locked: even with extreme signals, the rendered contract for an
  // independent (not-passed) step must NEVER include language that
  // could be read as "reveal the full solution".
  const cases: Array<Partial<TutorContractInput>> = [
    {},
    { attemptCount: 10, lastValidationFailed: true, currentHintLevel: 5 },
    { attemptCount: 0, currentHintLevel: 5 },
  ];
  for (const partial of cases) {
    it(`independent + not passed (${JSON.stringify(partial)}) — no leak language`, () => {
      const c = buildTutorContract({
        mode: "mastery_gated_independent_ai_assisted",
        ...baseSignals,
        ...partial,
        stepPassed: false,
      });
      const rendered = renderTutorContractForPrompt(c).toLowerCase();
      // Should contain explicit prohibitions
      expect(rendered).toMatch(/not reveal the full solution/);
      // Allowed list must NOT contain solution-leak verbs
      const allowedJoined = c.allowedBehaviors.join(" ").toLowerCase();
      expect(allowedJoined).not.toMatch(/full solution|complete answer/);
      expect(allowedJoined).not.toMatch(/write the code for you/);
    });
  }
});
