import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetProject,
  useGetUserProjectProgress,
  getGetUserProjectProgressQueryKey,
  useEnrollProject,
  useSubmitStep,
  useGetUserProfile,
} from "@workspace/api-client-react";
import {
  runPython,
  loadPyodideOnce,
  subscribePyodideStatus,
  type PyodideStatus,
} from "@/lib/pyodideRunner";
import { runViaRegistry } from "@/lib/executionRegistry";
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

export default function ProjectWorkspace() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useGetProject(slug);
  const [enrolled, setEnrolled] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const { data: progress } = useGetUserProjectProgress(project?.id ?? "", {
    query: { enabled: !!project?.id && enrolled } as any,
  });
  const enrollMutation = useEnrollProject();
  const submitMutation = useSubmitStep();
  const { data: userProfile } = useGetUserProfile();
  const isPro = (userProfile as { tier?: string } | undefined)?.tier === "pro";

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [code, setCode] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [output, setOutput] = useState<OutputVM | null>(null);
  const [activeTab, setActiveTab] =
    useState<"instructions" | "editor" | "output">("instructions");
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
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
  const currentStep = steps[currentStepIdx];
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
    setGradingResult(null);
    setOutput(null);
    setActiveTab("instructions");
    setRunHistory(null);
    setRunHistoryVersion(0);
  }, [currentStepIdx, currentStep?.id, currentStep?.starterCode]);

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
    const clamped = Math.max(0, Math.min(steps.length - 1, idx));
    setCurrentStepIdx(clamped);
  }

  async function runCode() {
    if (!code || isRunning) return;
    setOutput(null);
    setActiveTab("output");
    setIsRunning(true);
    let runStdout = "";
    let runStderr = "";
    let runExitCode = 1;
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
        const parsedExpected = expectedOutputsSchema.safeParse(
          currentStep?.expectedOutputs,
        );
        if (parsedExpected.success) {
          const outcome = validateExpected({
            expected: parsedExpected.data as ExpectedOutputs,
            result,
          });
          setGradingResult({
            status: outcome.passed ? "passed" : "failed",
            feedback:
              outcome.summary +
              (outcome.feedback ? `\n\n${outcome.feedback}` : ""),
          });
        }
      } else {
        const result = await runPython(code);
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

  function submitStep() {
    if (!project?.id || !currentStep) return;
    const submission = isCodeStep ? code : textAnswer;
    if (!submission.trim()) {
      setGradingResult({
        status: "failed",
        feedback: isCodeStep
          ? "Write some code before submitting."
          : "Enter your answer before submitting.",
      });
      return;
    }
    submitMutation.mutate(
      {
        projectId: project.id,
        stepId: currentStep.id,
        data: {
          submission,
          submissionType: submissionTypeForStep(currentStep.type),
        },
      },
      {
        onSuccess: (result: any) => {
          const r = result as GradingResult;
          setGradingResult(r);
          if (project?.id) {
            queryClient.invalidateQueries({
              queryKey: getGetUserProjectProgressQueryKey(project.id),
            });
          }
          if (r.status === "passed" && r.isFirstPass) {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
          }
          if (
            r.status === "passed" &&
            r.projectComplete &&
            !celebratedRef.current
          ) {
            celebratedRef.current = true;
            setShowCelebration(true);
          }
          if (
            r.status === "passed" &&
            !r.projectComplete &&
            currentStepIdx < steps.length - 1
          ) {
            setTimeout(() => goToStep(currentStepIdx + 1), 1500);
          }
        },
        onError: (err: any) => {
          setGradingResult({
            status: "failed",
            feedback:
              err?.message ?? "Couldn't submit your answer. Please try again.",
          });
        },
      },
    );
  }

  function askTutorAboutError(stderr: string) {
    const trimmed = stderr.slice(0, 1200);
    const prompt = `I got this error running my code. Help me understand what's wrong without giving away the full answer.\n\n\`\`\`\n${trimmed}\n\`\`\``;
    setShowAi(true);
    setTutorSeed(
      prompt +
        "\u200B".repeat((tutorSeed.match(/\u200B/g)?.length ?? 0) + 1),
    );
  }

  if (isLoading) {
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
        currentStepIdx={currentStepIdx}
        completedStepIds={completedStepIds}
        isCodeStep={isCodeStep}
        isPythonStep={isPythonStep}
        isTextStep={isTextStep}
        code={code}
        onCodeChange={setCode}
        textAnswer={textAnswer}
        onTextAnswerChange={setTextAnswer}
        output={output}
        isRunning={isRunning}
        pyLoading={pyStatus === "loading"}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        grading={gradingResult}
        showCelebration={showCelebration}
        isPro={isPro}
        submitPending={submitMutation.isPending}
        onSelectStep={goToStep}
        onRun={runCode}
        onReset={() => setCode(currentStep?.starterCode ?? "")}
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
