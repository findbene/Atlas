import { describe, it, expect } from "vitest";
import { recommendLearnerMode, type LearnerModeSignals } from "./learnerMode.js";

const base: LearnerModeSignals = {
  priorCompletedProjects: 0,
  currentProjectAttempts: 0,
  currentProjectStepsCompleted: 0,
  currentProjectHintLevelMax: 0,
  currentMode: "guided",
};

describe("recommendLearnerMode", () => {
  it("fresh learner with zero history → guided / fresh-start", () => {
    const r = recommendLearnerMode(base);
    expect(r.recommendedMode).toBe("guided");
    expect(r.reasonCode).toBe("fresh-start");
    expect(r.reason.length).toBeGreaterThan(0);
    expect(r.signals).toEqual(base);
  });

  it("3+ completions, low friction, low hint usage → independent / demonstrated-mastery", () => {
    const r = recommendLearnerMode({
      ...base,
      priorCompletedProjects: 5,
      currentProjectAttempts: 4,
      currentProjectStepsCompleted: 3,
      currentProjectHintLevelMax: 1,
      currentMode: "hint",
    });
    expect(r.recommendedMode).toBe("independent");
    expect(r.reasonCode).toBe("demonstrated-mastery");
  });

  it("guided + 1 prior + smooth → hint / ready-to-level-up", () => {
    const r = recommendLearnerMode({
      ...base,
      priorCompletedProjects: 1,
      currentProjectAttempts: 4,
      currentProjectStepsCompleted: 3,
      currentProjectHintLevelMax: 0,
      currentMode: "guided",
    });
    expect(r.recommendedMode).toBe("hint");
    expect(r.reasonCode).toBe("ready-to-level-up");
  });

  it("moderate experience + moderate friction → hint / ready-for-challenge", () => {
    const r = recommendLearnerMode({
      ...base,
      priorCompletedProjects: 2,
      currentProjectAttempts: 5,
      currentProjectStepsCompleted: 2,
      currentProjectHintLevelMax: 2,
      currentMode: "hint",
    });
    expect(r.recommendedMode).toBe("hint");
    expect(r.reasonCode).toBe("ready-for-challenge");
  });

  it("independent + high attempts → hint / struggling-step-back", () => {
    const r = recommendLearnerMode({
      ...base,
      priorCompletedProjects: 4,
      currentProjectAttempts: 20,
      currentProjectStepsCompleted: 3,
      currentProjectHintLevelMax: 0,
      currentMode: "independent",
    });
    expect(r.recommendedMode).toBe("hint");
    expect(r.reasonCode).toBe("struggling-step-back");
  });

  it("independent + high hint usage → hint / struggling-step-back", () => {
    const r = recommendLearnerMode({
      ...base,
      priorCompletedProjects: 4,
      currentProjectAttempts: 2,
      currentProjectStepsCompleted: 2,
      currentProjectHintLevelMax: 4,
      currentMode: "independent",
    });
    expect(r.recommendedMode).toBe("hint");
    expect(r.reasonCode).toBe("struggling-step-back");
  });

  it("no useful trigger → stay-the-course preserves current mode", () => {
    const r = recommendLearnerMode({
      ...base,
      priorCompletedProjects: 0,
      currentProjectAttempts: 5,
      currentProjectStepsCompleted: 3,
      currentProjectHintLevelMax: 1,
      currentMode: "dynamic_ai_adaptive",
    });
    expect(r.recommendedMode).toBe("dynamic_ai_adaptive");
    expect(r.reasonCode).toBe("stay-the-course");
  });

  it("zero steps completed never divides by zero", () => {
    const r = recommendLearnerMode({
      ...base,
      priorCompletedProjects: 5,
      currentProjectAttempts: 100,
      currentProjectStepsCompleted: 0,
      currentProjectHintLevelMax: 0,
      currentMode: "guided",
    });
    expect(["guided", "hint", "independent"]).toContain(r.recommendedMode);
    expect(r.signals.currentProjectStepsCompleted).toBe(0);
  });

  it("deterministic — identical inputs give identical outputs", () => {
    const a = recommendLearnerMode({ ...base, priorCompletedProjects: 2, currentMode: "hint" });
    const b = recommendLearnerMode({ ...base, priorCompletedProjects: 2, currentMode: "hint" });
    expect(a).toEqual(b);
  });

  it("signals are echoed back verbatim", () => {
    const input: LearnerModeSignals = {
      priorCompletedProjects: 7,
      currentProjectAttempts: 3,
      currentProjectStepsCompleted: 2,
      currentProjectHintLevelMax: 1,
      currentMode: "guided",
    };
    expect(recommendLearnerMode(input).signals).toEqual(input);
  });
});
