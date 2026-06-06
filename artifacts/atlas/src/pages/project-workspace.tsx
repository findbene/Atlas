import { useState, useRef, useEffect, useReducer } from "react";
import { useParams, Link } from "wouter";
import {
  useGetProject,
  useGetUserProjectProgress,
  getGetUserProjectProgressQueryKey,
  useEnrollProject,
  useSubmitStep,
  useCheckStep,
  useGetUserProfile,
  useSignRun,
  type SignedRunEnvelope,
} from "@workspace/api-client-react";
import {
  buildPythonCapture,
  buildSqlCapture,
  normalizeSqlRows,
  preCheckCapture,
  classifySignError,
} from "@/lib/envelopeClient";
import {
  decideCsvSetEqualSubmission,
  type CsvSetEqualCapture,
} from "@/lib/csvSetEqualSubmit";
import { toast } from "@/hooks/use-toast";
import {
  workspaceStepReducer,
  initialStepState,
  isProvisional,
  shouldAutoAdvance,
  shouldConfetti,
  shouldCelebrateProject,
  checkEnabled,
  submitEnabled,
  NO_CHECK_STEP_TYPES,
  type CheckResult,
} from "@/lib/workspaceStepMachine";
import {
  runPython,
  loadPyodideOnce,
  subscribePyodideStatus,
  type PyodideStatus,
} from "@/lib/pyodideRunner";
import { runViaRegistry } from "@/lib/executionRegistry";
import {
  resolveInitialStepIdx,
  buildStepSearch,
  parseStepParam,
  clampStepIdx,
} from "@/lib/workspaceStepUrl";
import {
  parseExecutionProfile,
  validateExpected,
  expectedOutputsSchema,
  FeatureDisabledError,
  type RunResult,
  type ExpectedOutputs,
} from "@workspace/execution-core";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { StudioTopBar } from "@/components/studio/StudioTopBar";
import { StudioShell } from "@/components/studio/StudioShell";
import { SolutionDialog } from "@/components/studio/SolutionDialog";
import type {
  StepVM,
  OutputVM,
  GradingResult,
  RunRow,
  SolutionPayload,
} from "@/components/studio/types";

type StepCompletion = { stepId: string; status: string };

const CODE_STEP_TYPES = new Set(["code_python", "code_sql"]);
const SQL_STEP_TYPES = new Set(["code_sql"]);
const TEXT_STEP_TYPES = new Set([
  "short_answer",
  "concept_check",
  "true_false",
  "multiple_choice",
]);

function submissionTypeForStep(stepType: string | undefined): "code" | "text" {
  if (stepType && CODE_STEP_TYPES.has(stepType)) return "code";
  return "text";
}

// Phase 57B-prereq — shown when a server-graded `csv_set_equal` step has no
// fresh captured result. Fail-safe: ask the learner to Run rather than
// silently submitting stale or empty rows.
const CSV_SET_EQUAL_NEEDS_RUN =
  "Run your query first — Atlas grades this step from your query's result.";

export default function ProjectWorkspace() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useGetProject(slug);
  const [enrolled, setEnrolled] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const { data: progress, isFetched: progressFetched } = useGetUserProjectProgress(
    project?.id ?? "",
    {
      query: { enabled: !!project?.id && enrolled } as any,
    },
  );
  const enrollMutation = useEnrollProject();
  const submitMutation = useSubmitStep();
  const checkMutation = useCheckStep();
  // Phase 49 — Sign-after-Run wiring. Envelopes are stored client-side
  // keyed by stepId so the learner can browse hints / output / open the
  // tutor between Run and Submit without losing the signed proof. We
  // clear an envelope on EDIT (capture is bound to the run that produced
  // it; editing the code means a future Submit should reflect the latest
  // attempt, not a stale envelope). Soft-fail: every sign failure silently
  // falls back to the legacy bare-string Submit path — Phase 49 must not
  // introduce a new Submit failure mode.
  const signMutation = useSignRun();
  const [envelopeByStepId, setEnvelopeByStepId] = useState<
    Record<string, SignedRunEnvelope>
  >({});

  // Phase 49 — Per-step run generation. Bumped on every mutation that
  // would invalidate an envelope (Run start, EDIT, Reset, history-restore,
  // step navigation). An in-flight sign captures the current gen and only
  // stashes its envelope if the gen still matches at resolution time —
  // closes the stale-envelope race where:
  //   1. learner Runs (sign A in flight)
  //   2. learner edits code (envelope cleared synchronously)
  //   3. sign A resolves → setEnvelopeByStepId re-populates a stale env
  //   4. Submit sends a signed-but-stale envelope for OLD code
  // We use a ref (not state) so the gen reads inside the async sign
  // closure see live values without triggering re-renders.
  const runGenByStep = useRef<Map<string, number>>(new Map());
  function bumpRunGen(stepId: string | undefined): number {
    if (!stepId) return 0;
    const next = (runGenByStep.current.get(stepId) ?? 0) + 1;
    runGenByStep.current.set(stepId, next);
    return next;
  }
  function currentRunGen(stepId: string | undefined): number {
    if (!stepId) return 0;
    return runGenByStep.current.get(stepId) ?? 0;
  }

  function clearEnvelopeForStep(stepId: string | undefined): void {
    if (!stepId) return;
    setEnvelopeByStepId((prev) => {
      if (!(stepId in prev)) return prev;
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  }

  // Phase 57B-prereq — last successful DuckDB-WASM result captured per step,
  // for server-graded `csv_set_equal` opt-in. Distinct from the signed
  // envelope (which is fire-and-forget and may be absent when signing is
  // disabled/fails): the {columns,rows} capture must be available on the
  // commit path even with no signing, so Option C stays soft-fail-safe. The
  // capture shares the EXACT invalidation lifecycle as the envelope — cleared
  // on Run start, edit, reset, history restore, and step navigation — and is
  // run-gen guarded so a stale in-flight run can never re-stash old rows.
  const [capturedSqlByStepId, setCapturedSqlByStepId] = useState<
    Record<string, CsvSetEqualCapture>
  >({});
  function clearCapturedSqlForStep(stepId: string | undefined): void {
    if (!stepId) return;
    setCapturedSqlByStepId((prev) => {
      if (!(stepId in prev)) return prev;
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  }

  const { data: userProfile } = useGetUserProfile();
  const isPro = (userProfile as { tier?: string } | undefined)?.tier === "pro";

  // Phase 23 — Workspace auto-resume / step deep-link support.
  //
  // `currentStepIdx` stays null until we've resolved one of:
  //   1. a valid `?step=N` URL param (1-indexed),
  //   2. the server's `progress.currentStepPosition` (1-indexed), or
  //   3. confirmation that progress has loaded with no usable position
  //      (→ default to step 0).
  // Until then we render the loading skeleton instead of flashing step 0,
  // which would briefly hide whatever step the learner asked to land on.
  // All 0↔1 conversion goes through `lib/workspaceStepUrl.ts` to prevent
  // off-by-one drift between server, URL, and UI.
  const [currentStepIdx, setCurrentStepIdx] = useState<number | null>(null);
  const resumeAppliedRef = useRef(false);
  const [code, setCode] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [output, setOutput] = useState<OutputVM | null>(null);
  const [activeTab, setActiveTab] =
    useState<"instructions" | "editor" | "output">("instructions");
  // Phase 24 — Per-step state machine. Replaces the legacy `gradingResult`
  // useState. The reducer is pure; side effects (confetti, celebration,
  // auto-advance, query-invalidation) are derived in a useEffect by comparing
  // the previous and current state via `prevStepStateRef`.
  const [stepState, dispatchStep] = useReducer(
    workspaceStepReducer,
    initialStepState,
  );
  const prevStepStateRef = useRef(stepState);
  // Phase 24 — Display selection. When the most recent transition is a
  // /check (provisional), the provisional banner wins even if there's a
  // stale committed `lastSubmit` lingering from an earlier submit on the
  // same step. Otherwise show the committed submit result (or nothing).
  const provisionalGrading = isProvisional(stepState);
  const gradingResult: GradingResult | null = provisionalGrading
    ? (stepState.lastCheck as GradingResult | null)
    : stepState.lastSubmit;
  const [showAi, setShowAi] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pyStatus, setPyStatus] = useState<PyodideStatus>("idle");
  const celebratedRef = useRef(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [diffRunId, setDiffRunId] = useState<string | null>(null);
  // Bumped whenever the user clicks "Ask tutor about this error". The
  // increment makes the seed value unique per click so the panel re-applies it
  // even if the underlying error text hasn't changed.
  const [tutorSeed, setTutorSeed] = useState<string>("");

  const steps = ((project?.steps ?? []) as Array<any>) as StepVM[];
  // `currentStepIdx` is null until resume resolves; use 0 as the safe fallback
  // for derived values so render paths stay defined, but the loading-skeleton
  // branch below ensures we don't actually paint step 0 prematurely.
  const safeStepIdx = currentStepIdx ?? 0;
  const currentStep = steps[safeStepIdx];
  const isCodeStep = CODE_STEP_TYPES.has(currentStep?.type ?? "");
  const isSqlStep = SQL_STEP_TYPES.has(currentStep?.type ?? "");
  // Python-only flag: SQL runs via DuckDB-WASM and must not be gated on
  // Pyodide download progress or block the Run button while Pyodide loads.
  const isPythonStep = isCodeStep && !isSqlStep;
  const isTextStep = TEXT_STEP_TYPES.has(currentStep?.type ?? "");
  const executionProfile = parseExecutionProfile(
    (project as any)?.executionProfile,
  );

  useEffect(() => {
    const unsubscribe = subscribePyodideStatus(setPyStatus);
    return unsubscribe;
  }, []);

  // Kick off Pyodide download in the background as soon as the workspace mounts
  // for a Python step, so the first "Run" feels instant.
  useEffect(() => {
    if (!isPythonStep) return;
    void loadPyodideOnce().catch(() => {
      // Status listener already flips to "error"; runCode will surface details.
    });
  }, [isPythonStep]);

  const completedStepIds = new Set(
    ((progress?.stepCompletions ?? []) as StepCompletion[])
      .filter(c => c.status === "passed")
      .map(c => c.stepId),
  );

  // Auto-enroll when the project loads. Reset enrollment state on project
  // change. Surface real errors (e.g. premium gating) instead of swallowing
  // them as success.
  useEffect(() => {
    if (!project?.id) return;
    setEnrolled(false);
    setEnrollError(null);
    // Phase 23 — Reset resume state when the active project changes so a
    // SPA navigation between `/projects/:slug` routes (no remount) doesn't
    // carry the prior project's resolved step into the new one.
    resumeAppliedRef.current = false;
    setCurrentStepIdx(null);
    enrollMutation.mutate(
      { projectId: project.id },
      {
        onSuccess: () => setEnrolled(true),
        onError: (err: any) => {
          const status = err?.status ?? err?.response?.status;
          if (status === 409) {
            setEnrolled(true);
            return;
          }
          setEnrollError(
            err?.response?.data?.message ??
              err?.message ??
              "Couldn't enroll in this project.",
          );
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Reset editor and grading state whenever the active step changes.
  useEffect(() => {
    setCode(currentStep?.starterCode ?? "");
    setTextAnswer("");
    dispatchStep({ type: "RESET" });
    setOutput(null);
    setActiveTab("instructions");
    setRunHistory(null);
    setRunHistoryVersion(0);
  }, [currentStepIdx, currentStep?.id, currentStep?.starterCode]);

  // Phase 23 — Apply initial resume exactly once per project mount.
  // Precedence: ?step=N → progress.currentStepPosition → step 0. We wait
  // until steps are loaded and either a URL param exists or progress has
  // been fetched, so we never flash step 0 over the learner's intended
  // landing step.
  useEffect(() => {
    if (resumeAppliedRef.current) return;
    if (steps.length === 0) return;
    const search = typeof window !== "undefined" ? window.location.search : "";
    // Phase 23 — `progressLoaded` distinguishes "we have an answer about
    // progress" from "we're still waiting". A URL `?step=N` short-circuits
    // this entirely (handled inside `resolveInitialStepIdx`), so the gating
    // below only matters for the no-URL case. We treat progress as resolved
    // when (a) the enrolled user's progress query has actually fetched, or
    // (b) enrollment itself failed (no chance of getting progress, so fall
    // back to step 0 — the enrollError banner will still render).
    //
    // Earlier draft used `progressFetched || !enrolled` which fired
    // immediately on first mount (when `enrolled` is still false) and
    // locked in step 0 before progress had a chance to load — defeating
    // the whole point of the phase for returning learners.
    const progressLoaded = enrolled ? progressFetched : enrollError !== null;
    const resolved = resolveInitialStepIdx({
      search,
      totalSteps: steps.length,
      progressPosition:
        (progress as { currentStepPosition?: number | null } | undefined)
          ?.currentStepPosition ?? null,
      progressLoaded,
    });
    if (resolved === null) return;
    resumeAppliedRef.current = true;
    setCurrentStepIdx(resolved);
    // Make sure the URL reflects the step we actually landed on (e.g. when
    // we seeded from progress with no URL param, or clamped an out-of-range
    // ?step=). replaceState avoids polluting back-button history.
    if (typeof window !== "undefined") {
      const nextSearch = buildStepSearch(resolved, window.location.search);
      if (nextSearch !== window.location.search) {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${nextSearch}${window.location.hash}`,
        );
      }
    }
  }, [steps.length, progress, progressFetched, enrolled, enrollError]);

  // Phase 23 — Browser back/forward support. Re-parse `?step=N` from the
  // URL on popstate so the active step follows history navigation. We only
  // clamp; if the param is missing/invalid we leave the current step alone
  // rather than snapping back to 0 (back-button from a non-workspace page
  // shouldn't reset progress).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (steps.length === 0) return;
    function onPopState() {
      const pos = parseStepParam(window.location.search);
      if (pos === null) return;
      setCurrentStepIdx(clampStepIdx(pos, steps.length));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [steps.length]);

  // Recent code-runs panel state. Lazily fetched the first time the user
  // opens the sheet, and re-fetched whenever a new run is recorded
  // (via runHistoryVersion bump).
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runHistory, setRunHistory] = useState<RunRow[] | null>(null);
  const [runHistoryVersion, setRunHistoryVersion] = useState(0);
  useEffect(() => {
    if (!historyOpen || !currentStep?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/runs?stepId=${encodeURIComponent(currentStep.id)}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const rows = (await res.json()) as RunRow[];
        if (!cancelled) setRunHistory(rows);
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [historyOpen, currentStep?.id, runHistoryVersion]);

  // Reference-solution dialog state. The data is fetched on-demand (only when
  // the user opens the dialog) so we never download a solution they don't
  // ask to see. The server enforces Pro gating + an engagement check.
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [solutionData, setSolutionData] = useState<SolutionPayload | null>(null);
  const [solutionError, setSolutionError] = useState<{
    status: number;
    message: string;
  } | null>(null);
  const [solutionLoading, setSolutionLoading] = useState(false);
  async function loadSolution() {
    if (!project?.slug) return;
    setSolutionLoading(true);
    setSolutionError(null);
    setSolutionData(null);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/projects/${encodeURIComponent(project.slug)}/solution`,
        { credentials: "include" },
      );
      if (res.ok) {
        setSolutionData((await res.json()) as SolutionPayload);
      } else {
        const body = await res.json().catch(() => ({}));
        setSolutionError({
          status: res.status,
          message:
            body?.message ?? body?.error ?? `Failed (HTTP ${res.status})`,
        });
      }
    } catch (err: any) {
      setSolutionError({ status: 0, message: err?.message ?? "Network error" });
    } finally {
      setSolutionLoading(false);
    }
  }

  function goToStep(idx: number) {
    const clamped = clampStepIdx(idx + 1, steps.length);
    // Phase 49 — Step navigation invalidates any envelope tied to the
    // step we're LEAVING. The mount effect for the new step resets the
    // editor to starterCode, so if a sign from the previous step were
    // to resolve after navigation it would stash an envelope bound to
    // code the editor no longer shows. Clear + bump the leaving step's
    // run-gen so any in-flight sign is dropped on resolution.
    const leavingStepId = currentStep?.id;
    clearEnvelopeForStep(leavingStepId);
    clearCapturedSqlForStep(leavingStepId);
    bumpRunGen(leavingStepId);
    setCurrentStepIdx(clamped);
    // Keep the URL in sync so reloads / shares land on the same step.
    // replaceState (not pushState) preserves the back-button semantics
    // (back from workspace → previous page, not previous step).
    if (typeof window !== "undefined") {
      const nextSearch = buildStepSearch(clamped, window.location.search);
      if (nextSearch !== window.location.search) {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${nextSearch}${window.location.hash}`,
        );
      }
    }
  }

  // Phase 49 — Sign a successful run as a SignedRunEnvelope and stash it
  // keyed by stepId. Soft-fail: any error (network, 422 unsignable kind,
  // 503 secret missing, 403 not enrolled, ...) is swallowed to console
  // and the envelope is not stashed — the next Submit silently falls back
  // to the legacy bare-string path.
  async function attemptSignAndStash(
    projectIdLocal: string,
    stepIdLocal: string,
    capture: ReturnType<typeof buildPythonCapture>,
    runGenAtStart: number,
  ): Promise<void> {
    const skip = preCheckCapture(capture);
    if (skip !== null) {
      // eslint-disable-next-line no-console
      console.debug("[envelope] skipping sign:", skip);
      return;
    }
    try {
      const res = await signMutation.mutateAsync({
        data: { projectId: projectIdLocal, stepId: stepIdLocal, capture },
      });
      // Phase 49 — Stale-race guard. If the learner edited / reset / restored
      // history / re-Ran while this sign was in flight, the step's run-gen
      // will have advanced past ours. Drop the envelope on the floor —
      // legacy bare-string submit still works.
      if (currentRunGen(stepIdLocal) !== runGenAtStart) {
        // eslint-disable-next-line no-console
        console.debug("[envelope] dropping stale sign result (gen mismatch)");
        return;
      }
      setEnvelopeByStepId((prev) => ({ ...prev, [stepIdLocal]: res.envelope }));
    } catch (err) {
      // Most common in Phase 49 production: 422 (validation kind not in
      // SIGNABLE_KINDS) and 503 (RUN_ENVELOPE_SIGNING_SECRET not set in
      // this environment). Both map to "no envelope; legacy Submit still
      // works fine for this learner".
      const reason = classifySignError(err);
      // eslint-disable-next-line no-console
      console.debug("[envelope] sign failed (silent fallback):", reason);
    }
  }

  async function runCode() {
    if (!code || isRunning) return;
    // Phase 24 — Block Run while a /check or /submit is in flight. The SQL
    // run path dispatches CHECK_START + CHECK_PASS/FAIL on parseable
    // expectedOutputs; without this guard, a Run during pending submit
    // would flip phase out of `submitting`, causing the phase-guarded
    // SUBMIT_PASS/FAIL action to be dropped when the submit response
    // finally lands — silently swallowing committed grading + XP +
    // celebration + auto-advance.
    if (!checkEnabled(stepState)) return;
    setOutput(null);
    setActiveTab("output");
    setIsRunning(true);
    // Phase 49 — A fresh Run invalidates any stale envelope for this step
    // upfront, AND bumps the per-step run-gen so that any sign request
    // still in flight from a prior Run will be ignored on resolution.
    const stepIdAtRun = currentStep?.id;
    clearEnvelopeForStep(stepIdAtRun);
    clearCapturedSqlForStep(stepIdAtRun);
    const runGenAtStart = bumpRunGen(stepIdAtRun);
    let runStdout = "";
    let runStderr = "";
    let runExitCode = 1;
    // Phase 49 — Whichever language path runs, capture the language's
    // RunResult shape so we can sign it after `finally`.
    let pythonRunResult: import("@/lib/pyodideRunner").ExecResult | null = null;
    let sqlRunResult: RunResult | null = null;
    try {
      if (isSqlStep) {
        // Route SQL through the execution registry. The DuckDB-WASM adapter
        // loads any datasets the step declares, runs the query, and returns
        // columns/rows we render in the output panel. If the step has
        // expectedOutputs, validateExpected gives instant educational feedback.
        const result: RunResult = await runViaRegistry(
          {
            language: "sql",
            code,
            datasetRefs:
              (currentStep?.datasetRefs as string[] | undefined) ?? undefined,
          },
          {
            projectProfile: (project as any)?.executionProfile,
            stepOverride: (currentStep as any)?.executionOverride,
          },
        );
        sqlRunResult = result;
        runExitCode = result.ok ? 0 : 1;
        runStderr = result.ok ? "" : (result.error ?? "Query failed.");
        runStdout = result.ok
          ? `${result.rows?.length ?? 0} row(s) in ${result.durationMs}ms`
          : "";
        setOutput({
          stdout: runStdout,
          stderr: runStderr,
          exitCode: runExitCode,
          columns: result.columns,
          rows: result.rows,
        });
        // Phase 57B-prereq — stash the fresh tabular result for server-graded
        // csv_set_equal. Success + columns only. Run-gen guarded so a stale
        // in-flight run can't resurrect old rows (this block is synchronous
        // after the await, so no edit can interleave here — the guard mirrors
        // the envelope stash for consistency and future-proofing).
        if (
          stepIdAtRun &&
          result.ok &&
          result.columns &&
          result.columns.length > 0 &&
          currentRunGen(stepIdAtRun) === runGenAtStart
        ) {
          const captured: CsvSetEqualCapture = {
            columns: [...result.columns],
            // Use the SAME normalizer as the signed-envelope path so the two
            // submission routes feed byte-identical rows to the comparator.
            rows: normalizeSqlRows(result.rows) ?? [],
          };
          setCapturedSqlByStepId((prev) => ({ ...prev, [stepIdAtRun]: captured }));
        }
        const parsedExpected = expectedOutputsSchema.safeParse(
          currentStep?.expectedOutputs,
        );
        if (parsedExpected.success) {
          const outcome = validateExpected({
            expected: parsedExpected.data as ExpectedOutputs,
            result,
          });
          const provisional: CheckResult = {
            status: outcome.passed ? "passed" : "failed",
            feedback:
              outcome.summary +
              (outcome.feedback ? `\n\n${outcome.feedback}` : ""),
          };
          // SQL "Run" path produces a local, provisional grading result.
          // Emit CHECK_START first so the phase-guarded CHECK_PASS /
          // CHECK_FAIL transition is accepted from `editing`.
          dispatchStep({ type: "CHECK_START" });
          dispatchStep({
            type: outcome.passed ? "CHECK_PASS" : "CHECK_FAIL",
            result: provisional,
          });
        }
      } else {
        const result = await runPython(code);
        pythonRunResult = result;
        runStdout = result.stdout;
        runStderr = result.stderr;
        runExitCode = result.exitCode;
        setOutput({
          stdout: runStdout,
          stderr: runStderr,
          exitCode: runExitCode,
        });
      }
    } catch (err: any) {
      if (err instanceof FeatureDisabledError) {
        runStderr = err.message;
      } else {
        runStderr =
          err?.message ??
          "Couldn't start the runtime. Check your network connection and try again.";
      }
      setOutput({ stdout: "", stderr: runStderr, exitCode: 1 });
    } finally {
      setIsRunning(false);
      // Phase 49 — Attempt to sign the capture as a verifiable envelope.
      // Fire-and-forget: never blocks the UI, and any failure silently
      // falls back to bare-string Submit. Gated to code steps (python/sql)
      // with a known step+project; pinned to the stepId captured BEFORE
      // any navigation, so a slow sign doesn't stash an envelope on the
      // wrong step if the learner advances mid-flight.
      if (project?.id && stepIdAtRun && (pythonRunResult || sqlRunResult)) {
        const capture = pythonRunResult
          ? buildPythonCapture(code, pythonRunResult)
          : buildSqlCapture(code, sqlRunResult!);
        void attemptSignAndStash(project.id, stepIdAtRun, capture, runGenAtStart);
      }
      // Fire-and-forget — recording the run shouldn't block the UI or surface
      // errors. The server caps payload sizes and prunes old rows, so we can
      // safely record every attempt.
      if (project?.id && code) {
        void fetch(`${import.meta.env.BASE_URL}api/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            projectId: project.id,
            stepId: currentStep?.id ?? null,
            code,
            stdout: runStdout,
            stderr: runStderr,
            ok: runExitCode === 0,
          }),
        })
          .then(() => {
            setRunHistoryVersion(v => v + 1);
          })
          .catch(() => {
            /* best-effort */
          });
      }
    }
  }

  // Phase 24 — Low-stakes Check. Server-graded, NO commit. Confetti,
  // celebration, XP, and auto-advance never fire on this path; those are
  // exclusively wired to SUBMIT_PASS transitions in the effect below.
  function checkStep() {
    if (!project?.id || !currentStep) return;
    if (!checkEnabled(stepState)) return;
    // Phase 57B-prereq — decide the submission shape. For every visible row
    // today `serverGrade` is false, so this returns the raw editor contents
    // verbatim and the path below is byte-identical to the pre-57B behavior.
    const decision = decideCsvSetEqualSubmission({
      // Defensive: the JSON path may only engage for SQL steps. `serverGrade`
      // is server-gated to csv_set_equal (a code_sql kind) today, but this
      // guarantees a future authoring mistake can't route a Python/text step's
      // editor contents into the {columns,rows} contract.
      serverGrade: currentStep.serverGrade === true && isSqlStep,
      rawSubmission: isCodeStep ? code : textAnswer,
      capture: capturedSqlByStepId[currentStep.id] ?? null,
    });
    if (decision.kind === "needs-run") {
      // Phase 57B-flip — needs-run is a nudge, not a failure. Surface a neutral
      // toast instead of red CHECK_FAIL styling and leave the step in `editing`
      // so nothing is marked wrong (the learner simply hasn't Run yet / edited).
      toast({ description: CSV_SET_EQUAL_NEEDS_RUN });
      return;
    }
    const submission = decision.submission;
    if (decision.kind === "raw" && !submission.trim()) {
      // Local validation must still surface — emit CHECK_START first so
      // the phase-guarded CHECK_FAIL transition is accepted. (Raw path only;
      // the csv_set_equal JSON contract is never empty.)
      dispatchStep({ type: "CHECK_START" });
      dispatchStep({
        type: "CHECK_FAIL",
        result: {
          status: "failed",
          feedback: isCodeStep
            ? "Write some code before checking."
            : "Enter your answer before checking.",
        },
      });
      return;
    }
    dispatchStep({ type: "CHECK_START" });
    checkMutation.mutate(
      {
        projectId: project.id,
        stepId: currentStep.id,
        data: {
          submission,
          submissionType: submissionTypeForStep(currentStep.type),
        },
      },
      {
        onSuccess: (result: unknown) => {
          const r = result as CheckResult;
          dispatchStep({
            type: r.status === "passed" ? "CHECK_PASS" : "CHECK_FAIL",
            result: r,
          });
        },
        onError: (err: any) => {
          dispatchStep({
            type: "CHECK_FAIL",
            result: {
              status: "failed",
              feedback:
                err?.message ?? "Couldn't run the check. Please try again.",
            },
          });
        },
      },
    );
  }

  function submitStep() {
    if (!project?.id || !currentStep) return;
    if (!submitEnabled(stepState)) return;
    // Phase 57B-prereq — same submission-shape decision as Check. Dark for all
    // visible rows (serverGrade=false ⇒ raw editor contents, byte-identical).
    const decision = decideCsvSetEqualSubmission({
      // Defensive: the JSON path may only engage for SQL steps. `serverGrade`
      // is server-gated to csv_set_equal (a code_sql kind) today, but this
      // guarantees a future authoring mistake can't route a Python/text step's
      // editor contents into the {columns,rows} contract.
      serverGrade: currentStep.serverGrade === true && isSqlStep,
      rawSubmission: isCodeStep ? code : textAnswer,
      capture: capturedSqlByStepId[currentStep.id] ?? null,
    });
    if (decision.kind === "needs-run") {
      // Phase 57B-flip — needs-run is a nudge, not a failure (see Check handler).
      // Neutral toast; leave step state untouched rather than red SUBMIT_FAIL.
      toast({ description: CSV_SET_EQUAL_NEEDS_RUN });
      return;
    }
    const submission = decision.submission;
    if (decision.kind === "raw" && !submission.trim()) {
      // Local validation must still surface — emit SUBMIT_START first so
      // the phase-guarded SUBMIT_FAIL transition is accepted. (Raw path only.)
      dispatchStep({ type: "SUBMIT_START" });
      dispatchStep({
        type: "SUBMIT_FAIL",
        result: {
          status: "failed",
          feedback: isCodeStep
            ? "Write some code before submitting."
            : "Enter your answer before submitting.",
        },
      });
      return;
    }
    dispatchStep({ type: "SUBMIT_START" });
    // Phase 49 — Attach the freshly-signed envelope if we have one for
    // this step. Server semantics (Phase 47–48): when envelope is present
    // AND its validation kind is in the pilot allow-list, /submit grades
    // against the verified capture; otherwise it grades the bare-string
    // `submission` as before. So sending the envelope is always safe.
    const envelopeForStep = envelopeByStepId[currentStep.id] ?? null;
    submitMutation.mutate(
      {
        projectId: project.id,
        stepId: currentStep.id,
        data: {
          submission,
          submissionType: submissionTypeForStep(currentStep.type),
          ...(envelopeForStep ? { envelope: envelopeForStep } : {}),
        },
      },
      {
        onSuccess: (result: unknown) => {
          const r = result as GradingResult;
          dispatchStep({
            type: r.status === "passed" ? "SUBMIT_PASS" : "SUBMIT_FAIL",
            result: r,
          });
        },
        onError: (err: any) => {
          dispatchStep({
            type: "SUBMIT_FAIL",
            result: {
              status: "failed",
              feedback:
                err?.message ?? "Couldn't submit your answer. Please try again.",
            },
          });
        },
      },
    );
  }

  // Phase 24 — Side effects driven by reducer transitions. Confetti,
  // project-completion celebration, auto-advance, and progress-cache
  // invalidation fire EXCLUSIVELY on SUBMIT_PASS. Checks never trigger
  // any of these.
  useEffect(() => {
    const prev = prevStepStateRef.current;
    if (prev === stepState) return;
    if (stepState.phase === "submit_passed" && project?.id) {
      queryClient.invalidateQueries({
        queryKey: getGetUserProjectProgressQueryKey(project.id),
      });
    }
    if (shouldConfetti(prev, stepState)) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    }
    if (
      shouldCelebrateProject(prev, stepState) &&
      !celebratedRef.current
    ) {
      celebratedRef.current = true;
      setShowCelebration(true);
    }
    if (
      shouldAutoAdvance(prev, stepState) &&
      safeStepIdx < steps.length - 1
    ) {
      const target = safeStepIdx + 1;
      setTimeout(() => goToStep(target), 1500);
    }
    prevStepStateRef.current = stepState;
  }, [stepState, project?.id, queryClient, safeStepIdx, steps.length]);

  function askTutorAboutError(stderr: string) {
    const trimmed = stderr.slice(0, 1200);
    const prompt = `I got this error running my code. Help me understand what's wrong without giving away the full answer.\n\n\`\`\`\n${trimmed}\n\`\`\``;
    setShowAi(true);
    setTutorSeed(
      prompt +
        "\u200B".repeat((tutorSeed.match(/\u200B/g)?.length ?? 0) + 1),
    );
  }

  // Phase 23 — Hold the skeleton until resume has resolved so we never
  // paint step 0 over the learner's intended landing step. Once
  // `currentStepIdx` is non-null we know either a URL param or progress
  // (or the empty-progress fallback) has been applied.
  const resumePending = !isLoading && project != null && currentStepIdx === null;

  if (isLoading || resumePending) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="border-b border-border px-4 py-2.5 flex items-center gap-3 shrink-0 bg-card/80">
          <div className="h-7 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-px bg-border" />
          <div className="h-5 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex-1 flex">
          <div className="w-60 border-r border-border p-4 space-y-3 hidden lg:block">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="flex-1 p-6 space-y-3">
            <div className="h-7 w-2/3 bg-muted rounded animate-pulse" />
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
            <div className="h-64 bg-muted rounded-lg animate-pulse mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <p className="text-muted-foreground">Project not found.</p>
        <Button asChild variant="outline">
          <Link href="/courses/data-engineering">Browse Projects</Link>
        </Button>
      </div>
    );
  }

  const enrollPending = enrollMutation.isPending && !enrolled;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <StudioTopBar
        project={project}
        executionProfile={executionProfile}
        enrollPending={enrollPending}
        enrollError={enrollError}
        showAi={showAi}
        onToggleAi={() => setShowAi(v => !v)}
      />
      <StudioShell
        project={project}
        steps={steps}
        currentStep={currentStep}
        currentStepIdx={safeStepIdx}
        completedStepIds={completedStepIds}
        isCodeStep={isCodeStep}
        isPythonStep={isPythonStep}
        isTextStep={isTextStep}
        code={code}
        onCodeChange={(v) => {
          setCode(v);
          // Phase 49 — Editing invalidates the signed envelope AND bumps
          // the per-step run-gen so any in-flight sign from the prior
          // Run is dropped on resolution (not just hidden by an
          // immediately-overwritten stash). Falls back to bare-string
          // submit until the learner Runs again.
          clearEnvelopeForStep(currentStep?.id);
          clearCapturedSqlForStep(currentStep?.id);
          bumpRunGen(currentStep?.id);
          dispatchStep({ type: "EDIT" });
        }}
        textAnswer={textAnswer}
        onTextAnswerChange={(v) => { setTextAnswer(v); dispatchStep({ type: "EDIT" }); }}
        output={output}
        isRunning={isRunning}
        pyLoading={pyStatus === "loading"}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        grading={gradingResult}
        provisional={provisionalGrading}
        showCelebration={showCelebration}
        isPro={isPro}
        checkPending={checkMutation.isPending}
        hideCheck={NO_CHECK_STEP_TYPES.has(currentStep?.type ?? "")}
        submitPending={submitMutation.isPending}
        onSelectStep={goToStep}
        onRun={runCode}
        onReset={() => {
          setCode(currentStep?.starterCode ?? "");
          // Phase 49 — Reset is a code mutation; same envelope-invalidation
          // guarantees as EDIT.
          clearEnvelopeForStep(currentStep?.id);
          clearCapturedSqlForStep(currentStep?.id);
          bumpRunGen(currentStep?.id);
          dispatchStep({ type: "EDIT" });
        }}
        onCheck={checkStep}
        onSubmit={submitStep}
        onAskTutor={askTutorAboutError}
        onOpenSolution={() => {
          setSolutionOpen(true);
          void loadSolution();
        }}
        showAi={showAi}
        tutorSeed={tutorSeed}
        historyOpen={historyOpen}
        onHistoryOpenChange={setHistoryOpen}
        runHistory={runHistory}
        diffRunId={diffRunId}
        onSelectHistoryCode={code => {
          setCode(code);
          // Phase 49 — Restoring a historical code snapshot is a code
          // mutation; same envelope-invalidation guarantees as EDIT.
          clearEnvelopeForStep(currentStep?.id);
          clearCapturedSqlForStep(currentStep?.id);
          bumpRunGen(currentStep?.id);
          dispatchStep({ type: "EDIT" });
          setHistoryOpen(false);
          setActiveTab("editor");
        }}
        onToggleDiff={id => setDiffRunId(diffRunId === id ? null : id)}
      />
      <SolutionDialog
        open={solutionOpen}
        onOpenChange={setSolutionOpen}
        loading={solutionLoading}
        error={solutionError}
        data={solutionData}
      />
    </div>
  );
}
