import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useParams, Link } from "wouter";
import {
  useGetProject,
  useGetUserProjectProgress,
  getGetUserProjectProgressQueryKey,
  useEnrollProject,
  useSubmitStep,
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
import { ArrowLeft, Play, Send, Bot, ChevronLeft, ChevronRight, CheckCircle, XCircle, Lightbulb, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import confetti from "canvas-confetti";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

interface AiMessage { role: "user" | "assistant"; content: string; }

function AiTutorPanel({ projectId, stepId, currentCode }: { projectId: string; stepId: string; currentCode: string }) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function sendMessage() {
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);
    let assistantContent = "";
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: userMsg, contextType: "project", contextId: projectId, stepId, currentCode }),
      });
      if (!res.ok) {
        assistantContent = `Sorry — the AI tutor is unavailable right now (HTTP ${res.status}).`;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantContent };
          return updated;
        });
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              assistantContent += parsed.content ?? "";
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry — couldn't reach the AI tutor. Check your connection and try again." };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-card/50 border-l border-border">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Bot className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-medium">Atlas AI</span>
        <span className="text-xs text-muted-foreground ml-auto">Claude-powered</span>
      </div>
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
            <Bot className="h-8 w-8 mx-auto opacity-50" />
            <p>Ask me anything about this project.</p>
            <p className="text-xs">I'll guide you without giving away the answer.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`${msg.role === "user" ? "ml-4" : "mr-4"}`}>
                <div className={`rounded-lg p-3 text-sm ${msg.role === "user" ? "bg-primary/10 text-foreground ml-auto" : "bg-muted text-foreground"}`}>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content || "..."}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="p-3 border-t border-border flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask a question..."
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          disabled={isStreaming}
        />
        <Button size="sm" onClick={sendMessage} disabled={isStreaming || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

type StepCompletion = { stepId: string; status: string };
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
  }, [currentStepIdx, currentStep?.id, currentStep?.starterCode]);

  function goToStep(idx: number) {
    const clamped = Math.max(0, Math.min(steps.length - 1, idx));
    setCurrentStepIdx(clamped);
  }

  async function runCode() {
    if (!code || isRunning) return;
    setOutput(null);
    setActiveTab("output");
    setIsRunning(true);
    try {
      const result = await runPython(code);
      setOutput({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    } catch (err: any) {
      setOutput({
        stdout: "",
        stderr:
          err?.message ??
          "Couldn't start the Python runtime. Check your network connection and try again.",
        exitCode: 1,
      });
    } finally {
      setIsRunning(false);
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
      {/* Header */}
      <div className="border-b border-border px-4 py-2.5 flex items-center gap-3 shrink-0 bg-card/80">
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

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Instruction Panel */}
          <ResizablePanel defaultSize={40} minSize={25}>
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
                        {gradingResult.projectComplete && (
                          <div className="mt-2 font-bold text-emerald-300">Project Complete! Excellent work!</div>
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

          {/* AI Tutor Panel */}
          {showAi && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={25} minSize={20}>
                <AiTutorPanel
                  projectId={project.id}
                  stepId={currentStep?.id ?? ""}
                  currentCode={code}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
