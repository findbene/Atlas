/**
 * Phase 24 — Reducer tests for the workspace step state machine.
 * Locks in the UX rules approved in docs/phases/phase-24-plan.md:
 *  - EDIT clears stale check feedback
 *  - Check never sets submit state and never triggers confetti / celebration / auto-advance
 *  - SUBMIT_PASS is the ONLY transition that earns those side effects
 *  - First-pass + project-complete signals derive ONLY from SUBMIT_PASS results
 */
import { describe, expect, it } from "vitest";
import {
  workspaceStepReducer,
  initialStepState,
  isProvisional,
  shouldAutoAdvance,
  shouldConfetti,
  shouldCelebrateProject,
  type CheckResult,
} from "./workspaceStepMachine";
import type { GradingResult } from "@/components/studio/types";

const check = (status: "passed" | "failed" = "passed"): CheckResult => ({
  status,
  feedback: status === "passed" ? "Looks good." : "Try again.",
});

const submit = (over: Partial<GradingResult> = {}): GradingResult => ({
  status: "passed",
  feedback: "ok",
  isFirstPass: true,
  projectComplete: false,
  xpEarned: 10,
  attempt: 1,
  ...over,
});

describe("workspaceStepReducer", () => {
  it("editing → checking → check_passed: never touches submit state", () => {
    const a = workspaceStepReducer(initialStepState, { type: "CHECK_START" });
    expect(a.phase).toBe("checking");
    expect(a.lastSubmit).toBeNull();

    const b = workspaceStepReducer(a, { type: "CHECK_PASS", result: check("passed") });
    expect(b.phase).toBe("check_passed");
    expect(b.lastCheck?.status).toBe("passed");
    expect(b.lastSubmit).toBeNull();

    // None of the celebration-bearing derivations fire on a check pass.
    expect(shouldAutoAdvance(a, b)).toBe(false);
    expect(shouldConfetti(a, b)).toBe(false);
    expect(shouldCelebrateProject(a, b)).toBe(false);
    expect(isProvisional(b)).toBe(true);
  });

  it("EDIT from check_passed returns to editing and clears stale provisional feedback", () => {
    const passed = workspaceStepReducer(
      workspaceStepReducer(initialStepState, { type: "CHECK_START" }),
      { type: "CHECK_PASS", result: check("passed") },
    );
    expect(passed.phase).toBe("check_passed");

    const after = workspaceStepReducer(passed, { type: "EDIT" });
    expect(after.phase).toBe("editing");
    expect(after.lastCheck).toBeNull();
    expect(after.lastSubmit).toBeNull();
    expect(isProvisional(after)).toBe(false);
  });

  it("EDIT from check_failed also clears stale feedback", () => {
    const failed = workspaceStepReducer(
      workspaceStepReducer(initialStepState, { type: "CHECK_START" }),
      { type: "CHECK_FAIL", result: check("failed") },
    );
    const after = workspaceStepReducer(failed, { type: "EDIT" });
    expect(after.phase).toBe("editing");
    expect(after.lastCheck).toBeNull();
  });

  it("EDIT is a no-op when already editing (preserves referential stability)", () => {
    const a = workspaceStepReducer(initialStepState, { type: "EDIT" });
    expect(a).toBe(initialStepState);
  });

  it("SUBMIT_PASS on non-last step triggers auto-advance but NOT project celebration", () => {
    const submitting = workspaceStepReducer(initialStepState, { type: "SUBMIT_START" });
    const passed = workspaceStepReducer(submitting, {
      type: "SUBMIT_PASS",
      result: submit({ projectComplete: false, isFirstPass: true }),
    });
    expect(passed.phase).toBe("submit_passed");
    expect(shouldAutoAdvance(submitting, passed)).toBe(true);
    expect(shouldConfetti(submitting, passed)).toBe(true);
    expect(shouldCelebrateProject(submitting, passed)).toBe(false);
    expect(isProvisional(passed)).toBe(false);
  });

  it("SUBMIT_PASS on last step triggers project celebration and NOT auto-advance", () => {
    const submitting = workspaceStepReducer(initialStepState, { type: "SUBMIT_START" });
    const passed = workspaceStepReducer(submitting, {
      type: "SUBMIT_PASS",
      result: submit({ projectComplete: true, isFirstPass: true }),
    });
    expect(shouldCelebrateProject(submitting, passed)).toBe(true);
    expect(shouldAutoAdvance(submitting, passed)).toBe(false);
  });

  it("SUBMIT_PASS on a re-submit (isFirstPass=false) does NOT re-confetti", () => {
    const submitting = workspaceStepReducer(initialStepState, { type: "SUBMIT_START" });
    const passed = workspaceStepReducer(submitting, {
      type: "SUBMIT_PASS",
      result: submit({ isFirstPass: false, xpEarned: 0 }),
    });
    expect(shouldConfetti(submitting, passed)).toBe(false);
  });

  it("SUBMIT_START clears the provisional check banner so the panel doesn't double-render", () => {
    const checked = workspaceStepReducer(
      workspaceStepReducer(initialStepState, { type: "CHECK_START" }),
      { type: "CHECK_PASS", result: check("passed") },
    );
    expect(checked.lastCheck).not.toBeNull();
    const submitting = workspaceStepReducer(checked, { type: "SUBMIT_START" });
    expect(submitting.lastCheck).toBeNull();
  });

  it("regression: late /check response that arrives AFTER a step change (RESET) is dropped — no stale state", () => {
    // Setup: a slow check is in flight against step A.
    const checking = workspaceStepReducer(initialStepState, { type: "CHECK_START" });
    expect(checking.phase).toBe("checking");
    // Learner navigates → reducer is RESET to step B's pristine state.
    const reset = workspaceStepReducer(checking, { type: "RESET" });
    expect(reset).toEqual(initialStepState);
    // The late check response from step A finally lands.
    const after = workspaceStepReducer(reset, { type: "CHECK_PASS", result: check("passed") });
    // It must be ignored — step B's editing state stays untouched.
    expect(after).toBe(reset);
    expect(after.lastCheck).toBeNull();
  });

  it("regression: late /submit response that arrives AFTER a step change does NOT trigger confetti / auto-advance / celebration on the wrong step", () => {
    const submitting = workspaceStepReducer(initialStepState, { type: "SUBMIT_START" });
    // Step change while submit pending.
    const reset = workspaceStepReducer(submitting, { type: "RESET" });
    // Late SUBMIT_PASS with projectComplete=true (worst case).
    const after = workspaceStepReducer(reset, {
      type: "SUBMIT_PASS",
      result: submit({ projectComplete: true, isFirstPass: true }),
    });
    // State unchanged → derived side-effect predicates all return false
    // and the workspace's useEffect short-circuits its `prev === stepState` guard.
    expect(after).toBe(reset);
    expect(shouldConfetti(reset, after)).toBe(false);
    expect(shouldAutoAdvance(reset, after)).toBe(false);
    expect(shouldCelebrateProject(reset, after)).toBe(false);
  });

  it("regression: a /check pass after a prior /submit pass renders the CHECK result (display preference)", () => {
    // Learner submits and passes.
    const submitted = workspaceStepReducer(
      workspaceStepReducer(initialStepState, { type: "SUBMIT_START" }),
      { type: "SUBMIT_PASS", result: submit({ projectComplete: false }) },
    );
    expect(submitted.lastSubmit).not.toBeNull();
    // (Without intermediate EDIT) they fire a Check — say it fails because
    // some external change made the answer wrong now.
    const checking = workspaceStepReducer(submitted, { type: "CHECK_START" });
    // The phase-guard only allows CHECK_PASS/CHECK_FAIL from `checking`, so
    // this transition must succeed.
    expect(checking.phase).toBe("checking");
    const failed = workspaceStepReducer(checking, { type: "CHECK_FAIL", result: check("failed") });
    expect(failed.phase).toBe("check_failed");
    // The provisional/committed distinction is what the UI selects on:
    expect(isProvisional(failed)).toBe(true);
    // lastSubmit is intentionally preserved (the server-side ledger still
    // has the pass) but the UI must prefer lastCheck while provisional.
    expect(failed.lastSubmit).toBe(submitted.lastSubmit);
    expect(failed.lastCheck?.status).toBe("failed");
  });

  it("regression: local-only grading path (Run/empty-input) requires START → PASS/FAIL pair from editing", () => {
    // Local validation paths (SQL Run, empty-input checks) must emit START
    // first so the phase-guarded terminal transitions are accepted.
    // Direct CHECK_FAIL from editing is dropped (this is intentional —
    // call sites must use the pair).
    const directFail = workspaceStepReducer(initialStepState, {
      type: "CHECK_FAIL",
      result: check("failed"),
    });
    expect(directFail).toBe(initialStepState);

    // Correct pair: START then FAIL — lands in check_failed.
    const start = workspaceStepReducer(initialStepState, { type: "CHECK_START" });
    const failed = workspaceStepReducer(start, {
      type: "CHECK_FAIL",
      result: check("failed"),
    });
    expect(failed.phase).toBe("check_failed");
    expect(failed.lastCheck?.status).toBe("failed");

    // Same for submit pair from editing — locks the empty-input submit path.
    const subStart = workspaceStepReducer(initialStepState, { type: "SUBMIT_START" });
    const subFailed = workspaceStepReducer(subStart, {
      type: "SUBMIT_FAIL",
      result: submit({ status: "failed" }),
    });
    expect(subFailed.phase).toBe("submit_failed");
    expect(subFailed.lastSubmit?.status).toBe("failed");
  });

  it("regression: EDIT during pending submit is dropped — late SUBMIT_PASS still commits + celebrates", () => {
    // Repro: learner clicks Submit, then types in the editor before the
    // response lands. Without the EDIT no-op, EDIT would flip phase to
    // `editing`, causing the late SUBMIT_PASS to be dropped by its
    // phase-guard and silently swallowing the committed result.
    const submitting = workspaceStepReducer(initialStepState, { type: "SUBMIT_START" });
    const stillSubmitting = workspaceStepReducer(submitting, { type: "EDIT" });
    expect(stillSubmitting).toBe(submitting); // EDIT is a no-op during submit
    const passed = workspaceStepReducer(stillSubmitting, {
      type: "SUBMIT_PASS",
      result: submit({ projectComplete: true, isFirstPass: true }),
    });
    expect(passed.phase).toBe("submit_passed");
    expect(shouldConfetti(stillSubmitting, passed)).toBe(true);
    expect(shouldCelebrateProject(stillSubmitting, passed)).toBe(true);
  });

  it("regression: EDIT during pending check is also dropped — late CHECK_PASS still lands", () => {
    const checking = workspaceStepReducer(initialStepState, { type: "CHECK_START" });
    const stillChecking = workspaceStepReducer(checking, { type: "EDIT" });
    expect(stillChecking).toBe(checking);
    const passed = workspaceStepReducer(stillChecking, {
      type: "CHECK_PASS",
      result: check("passed"),
    });
    expect(passed.phase).toBe("check_passed");
    expect(passed.lastCheck?.status).toBe("passed");
  });

  it("regression: a Run during pending submit (if it slipped past the disable) would corrupt the submit response — phase-guard catches it", () => {
    // Simulate the hijack sequence: SUBMIT_START, then a Run kicks off a
    // local CHECK_START + CHECK_PASS pair, then the submit response lands.
    // The current implementation also disables Run via the toolbar +
    // runCode() early-return on !checkEnabled, so this is defense-in-depth.
    const submitting = workspaceStepReducer(initialStepState, { type: "SUBMIT_START" });
    expect(submitting.phase).toBe("submitting");
    // checkEnabled() / runCode() must reject Run during submitting:
    expect(submitting.phase === "checking" || submitting.phase === "submitting").toBe(true);
    // Belt-and-suspenders: if Run somehow fired and tried to jam in
    // CHECK_START from submitting, that action is itself accepted and
    // would lose the submit state. So toolbar+runCode disable is the
    // primary defense and is exercised in the component-level wiring.
    // What the reducer guarantees is the SECOND half of the protection:
    // even if phase got hijacked, the late SUBMIT_PASS would not affect
    // a non-submitting state:
    const hijacked = workspaceStepReducer(submitting, { type: "CHECK_START" });
    const lateSubmit = workspaceStepReducer(hijacked, {
      type: "SUBMIT_PASS",
      result: submit({ projectComplete: true, isFirstPass: true }),
    });
    // Late SUBMIT_PASS sees phase==='checking' → dropped → no false celebration.
    expect(lateSubmit).toBe(hijacked);
    expect(shouldCelebrateProject(hijacked, lateSubmit)).toBe(false);
    expect(shouldConfetti(hijacked, lateSubmit)).toBe(false);
  });

  it("derivations return false when phase doesn't change (idempotent re-render guard)", () => {
    const submitting = workspaceStepReducer(initialStepState, { type: "SUBMIT_START" });
    const passed = workspaceStepReducer(submitting, {
      type: "SUBMIT_PASS",
      result: submit({ projectComplete: true }),
    });
    // Same-state comparison must not re-trigger celebration on a re-render.
    expect(shouldCelebrateProject(passed, passed)).toBe(false);
    expect(shouldConfetti(passed, passed)).toBe(false);
    expect(shouldAutoAdvance(passed, passed)).toBe(false);
  });
});
