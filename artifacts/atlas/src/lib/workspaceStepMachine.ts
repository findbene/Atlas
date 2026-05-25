/**
 * Phase 24 — Workspace per-step state machine.
 *
 * Encodes the Check vs Submit separation as a pure reducer. Lives in a
 * standalone module so it's 100% unit-testable without rendering the
 * workspace.
 *
 * States:
 *   - editing         — learner typing / no fresh grading result
 *   - checking        — /check request in flight
 *   - check_passed    — /check returned passed (provisional; NOT committed)
 *   - check_failed    — /check returned failed (provisional)
 *   - submitting      — /submit request in flight
 *   - submit_passed   — /submit returned passed (committed)
 *   - submit_failed   — /submit returned failed (committed attempt; bumps
 *                       attemptCount on the server)
 *
 * Invariants (asserted in tests):
 *   - Any `EDIT` action from a `check_*` state returns to `editing` so
 *     stale provisional feedback can't mislead.
 *   - `EDIT` from a `submit_*` state ALSO returns to `editing` — but the
 *     server-side commit is already persisted; we just clear the panel
 *     so a fresh edit gets fresh feedback on the next action.
 *   - Confetti / celebration / auto-advance side effects are derived
 *     ONLY from `SUBMIT_PASS` transitions and only fire once per step
 *     (the workspace's `celebratedRef` enforces project-level idempotency
 *     across remounts).
 */

import type { GradingResult } from "@/components/studio/types";

/** Step types that have no useful "Check" affordance — the grading is
 *  binary self-declaration or non-textual. The Check button is hidden
 *  for these and only Submit is rendered. Mirrors the server-side set
 *  in `artifacts/api-server/src/lib/grading.ts` (NO_CHECK_STEP_TYPES). */
export const NO_CHECK_STEP_TYPES = new Set<string>([
  "self_attest",
  "reflection",
  "concept_check",
  "file_upload",
]);

/** Subset of the GradingResult shape that the /check endpoint may set.
 *  Notably MISSING: xpEarned, attempt, isFirstPass, projectComplete —
 *  this omission is the on-the-wire guarantee that nothing was committed. */
export type CheckResult = {
  status: "passed" | "failed";
  feedback: string;
  stdout?: string;
  stderr?: string;
  executionTimeMs?: number;
};

export type Phase =
  | "editing"
  | "checking"
  | "check_passed"
  | "check_failed"
  | "submitting"
  | "submit_passed"
  | "submit_failed";

export type WorkspaceStepState = {
  phase: Phase;
  /** Last /check result (provisional). Cleared on EDIT/RESET/SUBMIT_START. */
  lastCheck: CheckResult | null;
  /** Last /submit result (committed). Persists across edits so a learner
   *  can see "you already passed this step" until they explicitly resubmit. */
  lastSubmit: GradingResult | null;
};

export const initialStepState: WorkspaceStepState = {
  phase: "editing",
  lastCheck: null,
  lastSubmit: null,
};

export type Action =
  | { type: "EDIT" }
  | { type: "CHECK_START" }
  | { type: "CHECK_PASS"; result: CheckResult }
  | { type: "CHECK_FAIL"; result: CheckResult }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_PASS"; result: GradingResult }
  | { type: "SUBMIT_FAIL"; result: GradingResult }
  | { type: "RESET" };

export function workspaceStepReducer(
  state: WorkspaceStepState,
  action: Action,
): WorkspaceStepState {
  switch (action.type) {
    case "EDIT":
      // Editing clears stale provisional check feedback so the panel
      // doesn't show "Passed!" against code the learner has since
      // modified. Committed submit state is also cleared from the UI
      // (the server-side ledger still has it).
      //
      // BUT: EDIT must NOT fire while a /check or /submit is in flight.
      // If the learner types in the editor during a pending submit,
      // an EDIT → editing transition would cause the subsequent
      // phase-guarded SUBMIT_PASS/SUBMIT_FAIL to be dropped, silently
      // swallowing a committed grading result (and its XP / confetti /
      // auto-advance side effects). The fix is to no-op EDIT during
      // in-flight phases — the start actions already cleared lastCheck,
      // so there's no stale provisional feedback to clear in those
      // states anyway.
      if (
        state.phase === "editing" ||
        state.phase === "checking" ||
        state.phase === "submitting"
      ) {
        return state;
      }
      return { phase: "editing", lastCheck: null, lastSubmit: null };

    case "CHECK_START":
      // Clear stale check feedback as soon as the new request fires, so
      // the panel doesn't briefly show old "Passed" while we wait.
      return { ...state, phase: "checking", lastCheck: null };

    case "CHECK_PASS":
    case "CHECK_FAIL":
      // Phase-guarded: ignore late /check responses that arrive after the
      // learner has navigated to another step (which triggered RESET), or
      // after they kicked off a /submit. Without this guard, an in-flight
      // check could overwrite a committed submit result or hijack the
      // freshly-RESET state of a different step.
      if (state.phase !== "checking") return state;
      return {
        ...state,
        phase: action.type === "CHECK_PASS" ? "check_passed" : "check_failed",
        lastCheck: action.result,
      };

    case "SUBMIT_START":
      // Submitting clears the provisional check banner — the next render
      // will show the committed submit result instead.
      return { ...state, phase: "submitting", lastCheck: null };

    case "SUBMIT_PASS":
    case "SUBMIT_FAIL":
      // Phase-guarded: ignore late /submit responses that arrive after a
      // step change (RESET) or any other terminal transition. Without
      // this, a slow submit response can trigger confetti / auto-advance
      // / project celebration against the WRONG step the learner has
      // since navigated to. The matching mutation onSuccess in
      // project-workspace.tsx fires this action; the guard makes the
      // workspace robust to that race even without per-mutation stepId
      // tagging.
      if (state.phase !== "submitting") return state;
      return {
        ...state,
        phase: action.type === "SUBMIT_PASS" ? "submit_passed" : "submit_failed",
        lastSubmit: action.result,
      };

    case "RESET":
      return initialStepState;
  }
}

/** Whether the Check button should be enabled for the current phase. */
export function checkEnabled(state: WorkspaceStepState): boolean {
  return state.phase !== "checking" && state.phase !== "submitting";
}

/** Whether the Submit button should be enabled for the current phase.
 *  We don't gate Submit on a prior passing Check — the learner is always
 *  allowed to commit. We only block it while a request is in flight. */
export function submitEnabled(state: WorkspaceStepState): boolean {
  return state.phase !== "checking" && state.phase !== "submitting";
}

/** Whether the validation panel should render its current grading result
 *  as PROVISIONAL (a check) rather than COMMITTED (a submit).
 *
 *  True when the most recent action was a /check (passed or failed) and
 *  no /submit has overwritten it. False after any /submit. */
export function isProvisional(state: WorkspaceStepState): boolean {
  return state.phase === "check_passed" || state.phase === "check_failed";
}

/** Whether the workspace should auto-advance to the next step. Only true
 *  exactly on the SUBMIT_PASS transition for a non-final, non-already-
 *  complete step. Callers must combine this with their own
 *  `currentStepIdx < steps.length - 1` guard. */
export function shouldAutoAdvance(
  prev: WorkspaceStepState,
  next: WorkspaceStepState,
): boolean {
  if (prev.phase === next.phase) return false;
  if (next.phase !== "submit_passed") return false;
  const r = next.lastSubmit;
  return !!r && r.status === "passed" && !r.projectComplete;
}

/** Whether the workspace should fire the per-step "first pass" confetti.
 *  Only on the SUBMIT_PASS transition AND only when the server reported
 *  this was the learner's first passing attempt (so re-submits don't
 *  re-confetti). */
export function shouldConfetti(
  prev: WorkspaceStepState,
  next: WorkspaceStepState,
): boolean {
  if (prev.phase === next.phase) return false;
  if (next.phase !== "submit_passed") return false;
  const r = next.lastSubmit;
  return !!r && r.status === "passed" && r.isFirstPass === true;
}

/** Whether the workspace should fire the project-completion celebration.
 *  Only on the SUBMIT_PASS transition AND only when the server reported
 *  the project as complete. The caller's `celebratedRef` enforces
 *  cross-remount idempotency. */
export function shouldCelebrateProject(
  prev: WorkspaceStepState,
  next: WorkspaceStepState,
): boolean {
  if (prev.phase === next.phase) return false;
  if (next.phase !== "submit_passed") return false;
  const r = next.lastSubmit;
  return !!r && r.status === "passed" && r.projectComplete === true;
}
