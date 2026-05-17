import { useState, useRef, useEffect, lazy, Suspense } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ArrowLeft, Play, Bot, ChevronLeft, ChevronRight, CheckCircle, XCircle, Lightbulb, RotateCcw, Award, History, Eye, Lock, Sparkles, GitCompare, MessageCircleQuestion } from "lucide-react";
import { diffLines } from "diff";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import confetti from "canvas-confetti";
import { JobOutcomesPanel } from "@/components/JobOutcomesPanel";
import { AiTutorPanel } from "@/components/AiTutorPanel";
import { useIsMobile } from "@/hooks/use-mobile";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));


type StepCompletion = { stepId: string; status: string };
type RunRow = { id: string; code: string; stdout: string; stderr: string; ok: boolean; createdAt: string };
type SolutionPayload = { solutionCode: string | null; explanationMd: string; videoUrl: string | null };

function formatRunAge(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
type GradingResult = {
  status: "passed" | "failed";
  feedback?: string;
  xpEarned?: number;
  isFirstPass?: boolean;
  projectComplete?: boolean;
};

const CODE_STEP_TYPES = new Set(["code_python", "code_sql"]);
const TEXT_STEP_TYPES = new Set(["short_answer", "concept_check", "true_false", "multiple_choice"]);

function submissionTypeForStep(stepType: string | undefined): "code" | "text" {
  if (stepType && CODE_STEP_TYPES.has(stepType)) return "code";
  return "text";
}

export default function ProjectWorkspace() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useGetProject(slug);
  const isMobile = useIsMobile();
  const [enrolled, setEnrolled] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const { data: progress } = useGetUserProjectProgress(project?.id ?? "", {
    query: { enabled: !!project?.id && enrolled } as any,
  });
  const enrollMutation = useEnrollProject();
  const submitMutation = useSubmitStep();

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [code, setCode] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [output, setOutput] = useState<{ stdout: string; stderr: string; exitCode: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "output">("editor");
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pyStatus, setPyStatus] = useState<PyodideStatus>("idle");
  const celebratedRef = useRef(false);
  const [showCelebration, setShowCelebration] = useState(false);
  // Set when the user clicks "compare with current" inside the history sheet.
  const [diffRunId, setDiffRunId] = useState<string | null>(null);
  // Bumped whenever the user clicks "Ask tutor about this error". The
  // increment makes the seed value unique per click so the panel re-applies it
  // even if the underlying error text hasn't changed.
  const [tutorSeed, setTutorSeed] = useState<string>("");

  const steps = (project?.steps ?? []) as Array<any>;
  const currentStep = steps[currentStepIdx];
  const isCodeStep = CODE_STEP_TYPES.has(currentStep?.type ?? "");

  useEffect(() => {
    const unsubscribe = subscribePyodideStatus(setPyStatus);
    return unsubscribe;
  }, []);

  // Kick off Pyodide download in the background as soon as the workspace mounts
  // for a code-based step, so the first "Run" feels instant.
  useEffect(() => {
    if (!isCodeStep) return;
    void loadPyodideOnce().catch(() => {
      // Status listener already flips to "error"; runCode will surface details.
    });
  }, [isCodeStep]);
  const isTextStep = TEXT_STEP_TYPES.has(currentStep?.type ?? "");
  const completedStepIds = new Set(
    ((progress?.stepCompletions ?? []) as StepCompletion[])
      .filter(c => c.status === "passed")
      .map(c => c.stepId)
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
          // 409/already-enrolled and similar idempotent failures: still let
          // progress load.
          if (status === 409) {
            setEnrolled(true);
            return;
          }
          setEnrollError(
            err?.response?.data?.message ??
              err?.message ??
              "Couldn't enroll in this project."
          );
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Reset editor and grading state whenever the active step changes.
  useEffect(() => {
    setCode(currentStep?.starterCode ?? "");
    setTextAnswer("");
    setGradingResult(null);
    setOutput(null);
    setShowHint(false);
    setActiveTab("editor");
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
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [historyOpen, currentStep?.id, runHistoryVersion]);

  // Reference-solution dialog state. The data is fetched on-demand (only when
  // the user opens the dialog) so we never download a solution they don't
  // ask to see. The server enforces Pro gating + an engagement check.
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [solutionData, setSolutionData] = useState<SolutionPayload | null>(null);
  const [solutionError, setSolutionError] = useState<{ status: number; message: string } | null>(null);
  const [solutionLoading, setSolutionLoading] = useState(false);
  const { data: userProfile } = useGetUserProfile();
  const isPro = (userProfile as { tier?: string } | undefined)?.tier === "pro";
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
          message: body?.message ?? body?.error ?? `Failed (HTTP ${res.status})`,
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
      const result = await runPython(code);
      runStdout = result.stdout;
      runStderr = result.stderr;
      runExitCode = result.exitCode;
      setOutput({ stdout: runStdout, stderr: runStderr, exitCode: runExitCode });
    } catch (err: any) {
      runStderr =
        err?.message ??
        "Couldn't start the Python runtime. Check your network connection and try again.";
      setOutput({ stdout: "", stderr: runStderr, exitCode: 1 });
    } finally {
      setIsRunning(false);
      // Fire-and-forget — recording the run shouldn't block the UI or surface
      // errors. The server caps payload sizes and prunes old rows in the
      // background, so we can safely record every attempt.
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
        }).then(() => {
          // Refetch the history list so the new run shows up if the panel is open.
          setRunHistoryVersion(v => v + 1);
        }).catch(() => { /* best-effort */ });
      }
    }
  }

  async function submitStep() {
    if (!project?.id || !currentStep) return;
    const submission = isCodeStep ? code : textAnswer;
    if (!submission.trim()) {
      setGradingResult({
        status: "failed",
        feedback: isCodeStep ? "Write some code before submitting." : "Enter your answer before submitting.",
      });
      return;
    }
    submitMutation.mutate(
      {
        projectId: project.id,
        stepId: currentStep.id,
        data: { submission, submissionType: submissionTypeForStep(currentStep.type) },
      },
      {
        onSuccess: (result: any) => {
          const r = result as GradingResult;
          setGradingResult(r);
          // Refresh progress so the step badge in the nav updates.
          if (project?.id) {
            queryClient.invalidateQueries({
              queryKey: getGetUserProjectProgressQueryKey(project.id),
            });
          }
          if (r.status === "passed" && r.isFirstPass) {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
          }
          if (r.status === "passed" && r.projectComplete && !celebratedRef.current) {
            celebratedRef.current = true;
            setShowCelebration(true);
          }
          if (r.status === "passed" && !r.projectComplete && currentStepIdx < steps.length - 1) {
            setTimeout(() => goToStep(currentStepIdx + 1), 1500);
          }
        },
        onError: (err: any) => {
          setGradingResult({
            status: "failed",
            feedback: err?.message ?? "Couldn't submit your answer. Please try again.",
          });
        },
      }
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
          <div className="w-72 border-r border-border p-4 space-y-3 hidden md:block">
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
        <Button asChild variant="outline"><Link href="/domains/data-engineering">Browse Projects</Link></Button>
      </div>
    );
  }

  const enrollPending = enrollMutation.isPending && !enrolled;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header — wraps on mobile so chips don't overflow */}
      <div className="border-b border-border px-4 py-2.5 flex items-center gap-2 sm:gap-3 shrink-0 bg-card/80 flex-wrap">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2"><Link href={`/domains/${project.domainSlug}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {project.domainName}
          </Link></Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold text-sm truncate">{project.title}</span>
        {enrollPending && (
          <span className="text-xs text-muted-foreground italic">Enrolling…</span>
        )}
        {enrollError && (
          <span className="text-xs text-red-400 italic" title={enrollError}>
            {enrollError}
          </span>
        )}
        <Badge variant="outline" className="ml-auto text-xs">{project.difficulty}</Badge>
        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">+{project.xpReward} XP</Badge>
        <JobOutcomesPanel
          title={project.title}
          jobOutcomes={project.jobOutcomes}
          learningObjectives={project.learningObjectives ?? []}
          prerequisites={project.prerequisites ?? []}
          longDescription={project.longDescription}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-amber-300 hover:text-amber-200"
              data-testid="open-career-impact"
            >
              <Award className="h-4 w-4 mr-1" />
              Career Impact
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="sm"
          className={`text-xs ${showAi ? "text-blue-400" : "text-muted-foreground"}`}
          onClick={() => setShowAi(v => !v)}
        >
          <Bot className="h-4 w-4 mr-1" />
          AI Tutor
        </Button>
      </div>

      {/* Main layout — vertical stack on mobile, horizontal split on md+ */}
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction={isMobile ? "vertical" : "horizontal"}>
          {/* Instruction Panel */}
          <ResizablePanel defaultSize={isMobile ? 45 : 40} minSize={isMobile ? 20 : 25}>
            <div className="h-full flex flex-col">
              {/* Step Nav */}
              <div className="border-b border-border px-4 py-2 flex items-center gap-2 shrink-0 bg-muted/20">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goToStep(currentStepIdx - 1)} disabled={currentStepIdx === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex gap-1.5 flex-1 justify-center overflow-x-auto">
                  {steps.map((s: any, i: number) => (
                    <button
                      key={s.id}
                      onClick={() => goToStep(i)}
                      className={`h-6 w-6 rounded-full text-xs font-medium transition-colors flex items-center justify-center shrink-0 ${i === currentStepIdx ? "bg-primary text-primary-foreground" : completedStepIds.has(s.id) ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      aria-label={`Step ${i + 1}${completedStepIds.has(s.id) ? " (completed)" : ""}`}
                    >
                      {completedStepIds.has(s.id) ? <CheckCircle className="h-3 w-3" /> : i + 1}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goToStep(currentStepIdx + 1)} disabled={currentStepIdx >= steps.length - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                {currentStep ? (
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Step {currentStepIdx + 1} of {steps.length}</span>
                      <h2 className="text-lg font-bold mt-1">{currentStep.title}</h2>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentStep.description}</ReactMarkdown>
                    </div>
                    {currentStep.hints && currentStep.hints.length > 0 && (
                      <div>
                        <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 -ml-2" onClick={() => setShowHint(v => !v)}>
                          <Lightbulb className="h-4 w-4 mr-1" />
                          {showHint ? "Hide hint" : "Show hint"}
                        </Button>
                        {showHint && (
                          <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200">
                            {currentStep.hints[0]}
                          </div>
                        )}
                      </div>
                    )}
                    {gradingResult && (
                      <div className={`p-4 rounded-lg border ${gradingResult.status === "passed" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
                        <div className="flex items-center gap-2 font-semibold mb-1">
                          {gradingResult.status === "passed" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          {gradingResult.status === "passed" ? `Passed!${gradingResult.xpEarned ? ` +${gradingResult.xpEarned} XP` : ""}` : "Try again"}
                        </div>
                        {gradingResult.feedback && <p className="text-sm">{gradingResult.feedback}</p>}
                        {gradingResult.projectComplete && showCelebration && (
                          <div className="mt-3 pt-3 border-t border-emerald-500/20">
                            <div className="font-bold text-emerald-300 mb-2">
                              🎉 Project Complete! Excellent work!
                            </div>
                            {project?.jobOutcomes && (
                              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 mt-3">
                                <div className="text-xs uppercase tracking-wider text-amber-300 font-semibold mb-2 flex items-center gap-1.5">
                                  <Award className="h-3.5 w-3.5" /> What you just unlocked
                                </div>
                                {project.jobOutcomes.roles && project.jobOutcomes.roles.length > 0 && (
                                  <div className="text-sm text-foreground/90 mb-2">
                                    <span className="text-muted-foreground">Roles you're now closer to:</span>{" "}
                                    <span className="font-medium">
                                      {project.jobOutcomes.roles.slice(0, 3).join(" · ")}
                                    </span>
                                  </div>
                                )}
                                {project.jobOutcomes.resumeBullets?.[0] && (
                                  <div className="text-sm text-foreground/80 italic border-l-2 border-amber-500/40 pl-2 mb-3">
                                    "{project.jobOutcomes.resumeBullets[0]}"
                                  </div>
                                )}
                                <JobOutcomesPanel
                                  title={project.title}
                                  jobOutcomes={project.jobOutcomes}
                                  trigger={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100 h-7 text-xs"
                                      data-testid="completion-career-impact"
                                    >
                                      <Award className="h-3 w-3 mr-1" />
                                      View full Career Impact
                                    </Button>
                                  }
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No steps found.</p>
                )}
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Editor/Console Panel */}
          <ResizablePanel defaultSize={showAi ? 40 : 60} minSize={30}>
            <div className="h-full flex flex-col">
              {isCodeStep ? (
                <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "editor" | "output")} className="flex flex-col h-full">
                  <div className="border-b border-border px-2 pt-1 shrink-0 flex items-center justify-between">
                    <TabsList className="h-8 bg-transparent gap-1">
                      <TabsTrigger value="editor" className="h-7 text-xs">Editor</TabsTrigger>
                      <TabsTrigger value="output" className="h-7 text-xs">Output</TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-1 pr-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setCode(currentStep?.starterCode ?? "")}
                        disabled={!currentStep?.starterCode}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={runCode}
                        disabled={isRunning || pyStatus === "loading" || !code}
                        title={pyStatus === "loading" ? "Loading Python runtime..." : undefined}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {isRunning
                          ? "Running..."
                          : pyStatus === "loading"
                            ? "Loading runtime…"
                            : "Run"}
                      </Button>
                      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                        <SheetTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            title="Recent code runs"
                            aria-label="Recent code runs"
                          >
                            <History className="h-3 w-3 mr-1" />
                            History
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                          <SheetHeader>
                            <SheetTitle>Recent runs</SheetTitle>
                            <SheetDescription>
                              Your last 20 attempts on this step. Click "Use this code" to restore
                              the editor.
                            </SheetDescription>
                          </SheetHeader>
                          <div className="mt-4 space-y-3">
                            {runHistory === null ? (
                              <div className="text-xs text-muted-foreground">Loading…</div>
                            ) : runHistory.length === 0 ? (
                              <div className="text-xs text-muted-foreground">
                                No runs yet — hit Run to record your first attempt.
                              </div>
                            ) : runHistory.map(r => (
                              <div
                                key={r.id}
                                className="rounded-lg border border-border bg-card p-3 space-y-2"
                                data-testid={`run-row-${r.id}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-xs font-medium inline-flex items-center gap-1 ${r.ok ? "text-emerald-400" : "text-red-400"}`}>
                                    {r.ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                    {r.ok ? "Passed" : "Errored"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">{formatRunAge(r.createdAt)}</span>
                                </div>
                                <pre className="text-[11px] bg-background border border-border rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">
                                  {r.code.slice(0, 600)}{r.code.length > 600 ? "\n…" : ""}
                                </pre>
                                {(r.stdout || r.stderr) && (
                                  <pre className={`text-[11px] rounded p-2 overflow-x-auto max-h-24 whitespace-pre-wrap ${r.stderr ? "bg-red-950/30 text-red-300" : "bg-emerald-950/20 text-emerald-300"}`}>
                                    {(r.stderr || r.stdout).slice(0, 400)}
                                  </pre>
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs flex-1"
                                    onClick={() => { setCode(r.code); setHistoryOpen(false); setActiveTab("editor"); }}
                                  >
                                    Use this code
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs px-2"
                                    onClick={() => setDiffRunId(diffRunId === r.id ? null : r.id)}
                                    title="Compare with current editor"
                                    aria-label={`Compare run ${r.id} with current editor`}
                                    data-testid={`diff-toggle-${r.id}`}
                                  >
                                    <GitCompare className="h-3 w-3 mr-1" />
                                    {diffRunId === r.id ? "Hide diff" : "Diff"}
                                  </Button>
                                </div>
                                {diffRunId === r.id && (
                                  <pre className="mt-2 text-[11px] bg-background border border-border rounded p-2 overflow-x-auto max-h-64 whitespace-pre-wrap font-mono">
                                    {diffLines(r.code, code).map((part, i) => (
                                      <span
                                        key={i}
                                        className={
                                          part.added ? "bg-emerald-900/40 text-emerald-300"
                                          : part.removed ? "bg-red-900/40 text-red-300"
                                          : "text-muted-foreground"
                                        }
                                      >
                                        {part.added ? "+ " : part.removed ? "- " : "  "}
                                        {part.value.replace(/\n(?!$)/g, m => m + (part.added ? "+ " : part.removed ? "- " : "  "))}
                                      </span>
                                    ))}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        </SheetContent>
                      </Sheet>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { setSolutionOpen(true); void loadSolution(); }}
                        title={isPro ? "Reveal reference solution" : "Pro: reveal reference solution"}
                      >
                        {isPro ? <Eye className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                        Solution
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={submitStep} disabled={submitMutation.isPending}>
                        {submitMutation.isPending ? "Grading..." : "Submit"}
                      </Button>
                    </div>
                  </div>
                  <TabsContent value="editor" className="flex-1 m-0 overflow-hidden">
                    <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading editor...</div>}>
                      <MonacoEditor
                        height="100%"
                        language={currentStep?.type === "code_sql" ? "sql" : "python"}
                        theme="vs-dark"
                        value={code}
                        onChange={v => setCode(v ?? "")}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          padding: { top: 12 },
                          fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                        }}
                      />
                    </Suspense>
                  </TabsContent>
                  <TabsContent value="output" className="flex-1 m-0 overflow-hidden bg-[#0D1117]">
                    <ScrollArea className="h-full p-3">
                      {isRunning ? (
                        <div className="text-muted-foreground text-sm">
                          {pyStatus === "loading"
                            ? "Loading Python runtime (first run only, ~10MB)…"
                            : "Running…"}
                        </div>
                      ) : output ? (
                        <div className="font-mono text-sm space-y-2">
                          {output.stdout && <pre className="text-green-400 whitespace-pre-wrap">{output.stdout}</pre>}
                          {output.stderr && <pre className="text-red-400 whitespace-pre-wrap">{output.stderr}</pre>}
                          {!output.stdout && !output.stderr && <span className="text-muted-foreground">No output</span>}
                          <div className={`text-xs mt-2 ${output.exitCode === 0 ? "text-emerald-400" : "text-red-400"}`}>
                            Exit code: {output.exitCode}
                          </div>
                          {output.stderr && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 h-7 text-xs border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
                              data-testid="ask-tutor-about-error"
                              onClick={() => {
                                // Truncate stderr so we don't blast the tutor
                                // chat with a 10kB traceback.
                                const trimmed = output.stderr.slice(0, 1200);
                                const prompt =
                                  `I got this error running my code. Help me understand what's wrong without giving away the full answer.\n\n\`\`\`\n${trimmed}\n\`\`\``;
                                setShowAi(true);
                                // Append a zero-width marker so each click is a
                                // distinct string and the panel re-applies it.
                                setTutorSeed(prompt + "\u200B".repeat((tutorSeed.match(/\u200B/g)?.length ?? 0) + 1));
                              }}
                            >
                              <MessageCircleQuestion className="h-3 w-3 mr-1" />
                              Ask tutor about this error
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm">Run your code to see output here.</div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              ) : (
                // Non-code step: textarea answer panel
                <div className="flex flex-col h-full">
                  <div className="border-b border-border px-3 py-2 shrink-0 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {isTextStep ? "Your Answer" : "Submission"}
                    </span>
                    <Button size="sm" className="h-7 text-xs" onClick={submitStep} disabled={submitMutation.isPending}>
                      {submitMutation.isPending ? "Grading..." : "Submit"}
                    </Button>
                  </div>
                  <div className="flex-1 p-4 overflow-auto">
                    <textarea
                      value={textAnswer}
                      onChange={e => setTextAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full h-full min-h-[200px] bg-background border border-border rounded-lg p-3 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>

          {/* Reference Solution Dialog. Server enforces Pro tier + engagement
              gate; the client just renders whatever the API returns or the
              appropriate upsell/error message based on HTTP status. */}
          <Dialog open={solutionOpen} onOpenChange={setSolutionOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Reference Solution
                </DialogTitle>
                <DialogDescription>
                  This is one valid implementation — your own approach may differ and still be correct.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2">
                {solutionLoading ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
                ) : solutionError ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                      {solutionError.status === 402 ? (
                        <>
                          <p className="font-medium text-amber-200 mb-1">Pro feature</p>
                          <p className="text-amber-100/80">{solutionError.message}</p>
                          <Button asChild size="sm" className="mt-3 bg-amber-500 hover:bg-amber-600 text-amber-950">
                            <Link href="/upgrade">Upgrade to Pro</Link>
                          </Button>
                        </>
                      ) : solutionError.status === 403 ? (
                        <>
                          <p className="font-medium text-amber-200 mb-1">Try the project first</p>
                          <p className="text-amber-100/80">{solutionError.message}</p>
                        </>
                      ) : (
                        <p className="text-amber-100/80">{solutionError.message}</p>
                      )}
                    </div>
                  </div>
                ) : solutionData ? (
                  <div className="space-y-3">
                    {solutionData.solutionCode && (
                      <pre className="text-xs bg-[#0D1117] border border-border rounded p-3 overflow-x-auto whitespace-pre-wrap">
                        {solutionData.solutionCode}
                      </pre>
                    )}
                    {solutionData.explanationMd && (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {solutionData.explanationMd}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>

          {/* AI Tutor Panel */}
          {showAi && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={25} minSize={20}>
                <AiTutorPanel
                  projectId={project.id}
                  stepId={currentStep?.id ?? ""}
                  currentCode={code}
                  seedInput={tutorSeed}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
