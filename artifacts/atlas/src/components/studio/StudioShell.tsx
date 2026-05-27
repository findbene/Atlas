import { useEffect, useRef, useState } from "react";
import { useLearningMode } from "./useLearningMode";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { StepChecklist } from "./StepChecklist";
import { InstructionsPanel } from "./InstructionsPanel";
import { EditorPanel } from "./EditorPanel";
import { EditorToolbar } from "./EditorToolbar";
import { OutputPanel } from "./OutputPanel";
import { ValidationFeedbackPanel } from "./ValidationFeedbackPanel";
import { RemediationPanel } from "./RemediationPanel";
import { DatasetRefsBar } from "./DatasetRefsBar";
import { RunHistorySheet } from "./RunHistorySheet";
import { AiTutorPanel } from "@/components/AiTutorPanel";
import type { StepVM, OutputVM, GradingResult, RunRow } from "./types";

export type StudioShellProps = {
  project: any;
  steps: StepVM[];
  currentStep: StepVM | undefined;
  currentStepIdx: number;
  completedStepIds: Set<string>;

  isCodeStep: boolean;
  isPythonStep: boolean;
  isTextStep: boolean;

  code: string;
  onCodeChange: (v: string) => void;
  textAnswer: string;
  onTextAnswerChange: (v: string) => void;

  output: OutputVM | null;
  isRunning: boolean;
  pyLoading: boolean;
  activeTab: "instructions" | "editor" | "output";
  onActiveTabChange: (t: "instructions" | "editor" | "output") => void;

  grading: GradingResult | null;
  /** Phase 24 — when true, the current `grading` came from /check (provisional);
   *  when false, from /submit (committed). The panel uses this to hide XP and
   *  completion celebration UI for provisional results. */
  provisional: boolean;
  showCelebration: boolean;

  isPro: boolean;
  checkPending: boolean;
  /** Hide the Check button entirely for step types with no useful check
   *  (self_attest, reflection, concept_check, file_upload). */
  hideCheck: boolean;
  submitPending: boolean;

  onSelectStep: (i: number) => void;
  onRun: () => void;
  onReset: () => void;
  onCheck: () => void;
  onSubmit: () => void;
  onAskTutor: (stderr: string) => void;
  onOpenSolution: () => void;

  showAi: boolean;
  tutorSeed: string;

  historyOpen: boolean;
  onHistoryOpenChange: (v: boolean) => void;
  runHistory: RunRow[] | null;
  diffRunId: string | null;
  onSelectHistoryCode: (code: string) => void;
  onToggleDiff: (id: string) => void;
};

export function StudioShell(props: StudioShellProps) {
  const {
    project,
    steps,
    currentStep,
    currentStepIdx,
    completedStepIds,
    isCodeStep,
    isPythonStep,
    isTextStep,
    code,
    onCodeChange,
    textAnswer,
    onTextAnswerChange,
    output,
    isRunning,
    pyLoading,
    activeTab,
    onActiveTabChange,
    grading,
    provisional,
    showCelebration,
    isPro,
    checkPending,
    hideCheck,
    submitPending,
    onSelectStep,
    onRun,
    onReset,
    onCheck,
    onSubmit,
    onAskTutor,
    onOpenSolution,
    showAi,
    tutorSeed,
    historyOpen,
    onHistoryOpenChange,
    runHistory,
    diffRunId,
    onSelectHistoryCode,
    onToggleDiff,
  } = props;

  const isMobile = useIsMobile();
  const [stepsSheetOpen, setStepsSheetOpen] = useState(false);

  // Phase 33 — mode-aware UI subscribes to the same state the
  // top-bar ModeSelector mutates (via the LEARNING_MODE_CHANGED_EVENT
  // bridge in `useLearningMode.ts`).
  const { mode: learningMode } = useLearningMode(project?.slug);

  // Latch: once the current step has produced a failed result, remember
  // it so the independent-mode hint suppression releases. The latch is
  // step-scoped — stored as the step id a failure was last observed
  // for, derived `hasFailedCheck = failedStepId === currentStep?.id`.
  //
  // Step-change race: the parent (`pages/project-workspace.tsx`) clears
  // `grading` via a `dispatchStep({type:"RESET"})` in a useEffect on
  // step change. Effects run AFTER render, so there is exactly one
  // render where `currentStep.id` has already flipped but `grading`
  // still holds the previous step's `failed` snapshot. We must NOT
  // re-latch the new step from that stale snapshot.
  //
  // The guard: latch only on a FRESH `grading` reference. `prevGradingRef`
  // remembers the last grading object we observed; the latch effect
  // commits only when the reference has actually changed (a real new
  // /check or /submit response), which by construction can only happen
  // AFTER the parent's RESET has nulled the stale value. The latch flip
  // is committed via useEffect (after render, never during render) —
  // concurrent-mode safe.
  const [failedStepId, setFailedStepId] = useState<string | null>(null);
  const prevGradingRef = useRef<typeof grading>(grading);
  useEffect(() => {
    if (
      grading !== prevGradingRef.current &&
      grading?.status === "failed" &&
      currentStep?.id
    ) {
      setFailedStepId(currentStep.id);
    }
    prevGradingRef.current = grading;
  }, [grading, currentStep?.id]);
  const hasFailedCheck =
    failedStepId !== null && failedStepId === currentStep?.id;

  // Bridge to the existing `onAskTutor(stderr)` plumbing in
  // pages/project-workspace.tsx — that handler builds the prompt and
  // opens the Ada side panel. Reuse it for the mode-aware nudge CTAs
  // without changing the page contract.
  const requestTutorNudge = () =>
    onAskTutor(
      "I'd like a small nudge on this step — please help me think it through without giving away the full solution.",
    );

  if (!currentStep) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No steps found.
      </div>
    );
  }

  const editorLanguage: "python" | "sql" =
    currentStep.type === "code_sql" ? "sql" : "python";
  const datasetRefs = currentStep.datasetRefs ?? [];

  // The main column hosts: tab strip (with EditorToolbar on right for code
  // steps), active tab content, optional textarea (text steps), validation
  // banner, and the dataset chips bar at the very bottom.
  const mainColumn = (
    <div className="h-full flex flex-col min-h-0">
      <Tabs
        value={activeTab}
        onValueChange={v =>
          onActiveTabChange(v as "instructions" | "editor" | "output")
        }
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="border-b border-border px-2 pt-1 shrink-0 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Mobile / tablet steps trigger — hidden on lg where the rail is visible */}
            <Sheet open={stepsSheetOpen} onOpenChange={setStepsSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs lg:hidden"
                  aria-label="Open step list"
                  data-testid="open-steps-sheet"
                >
                  <Menu className="h-4 w-4 mr-1" />
                  Steps
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="px-4 py-3 border-b border-border">
                  <SheetTitle>Steps</SheetTitle>
                </SheetHeader>
                <StepChecklist
                  steps={steps}
                  currentIdx={currentStepIdx}
                  completedStepIds={completedStepIds}
                  onSelect={i => {
                    onSelectStep(i);
                    setStepsSheetOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>
            <TabsList className="h-8 bg-transparent gap-1">
              <TabsTrigger value="instructions" className="h-7 text-xs">
                Instructions
              </TabsTrigger>
              {isCodeStep && (
                <TabsTrigger value="editor" className="h-7 text-xs">
                  Editor
                </TabsTrigger>
              )}
              {isCodeStep && (
                <TabsTrigger value="output" className="h-7 text-xs">
                  Output
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          <div className="flex items-center gap-1 pr-2">
            {isCodeStep ? (
              <>
                <EditorToolbar
                  isRunning={isRunning}
                  pyLoading={pyLoading}
                  isPythonStep={isPythonStep}
                  hasStarter={!!currentStep.starterCode}
                  hasCode={!!code}
                  isPro={isPro}
                  checkPending={checkPending}
                  hideCheck={hideCheck}
                  submitPending={submitPending}
                  onRun={onRun}
                  onReset={onReset}
                  onOpenSolution={onOpenSolution}
                  onCheck={onCheck}
                  onSubmit={onSubmit}
                />
                <RunHistorySheet
                  open={historyOpen}
                  onOpenChange={onHistoryOpenChange}
                  runs={runHistory}
                  currentCode={code}
                  diffRunId={diffRunId}
                  onSelectCode={onSelectHistoryCode}
                  onToggleDiff={onToggleDiff}
                />
              </>
            ) : (
              <>
                {!hideCheck && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={onCheck}
                    disabled={checkPending || submitPending}
                    data-testid="studio-check"
                  >
                    {checkPending ? "Checking..." : "Check"}
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onSubmit}
                  disabled={checkPending || submitPending}
                  data-testid="studio-submit"
                >
                  {submitPending ? "Grading..." : "Submit"}
                </Button>
              </>
            )}
          </div>
        </div>

        <TabsContent value="instructions" className="flex-1 m-0 overflow-hidden">
          <InstructionsPanel
            step={currentStep}
            stepNumber={currentStepIdx + 1}
            totalSteps={steps.length}
            projectSlug={project?.slug}
            refetchKey={grading?.status ? `${grading.status}:${grading.feedback ?? ""}` : currentStep.id}
            mode={learningMode}
            hasFailedCheck={hasFailedCheck}
            onRequestTutorNudge={requestTutorNudge}
          />
        </TabsContent>
        {isCodeStep && (
          <TabsContent value="editor" className="flex-1 m-0 overflow-hidden">
            <EditorPanel
              language={editorLanguage}
              value={code}
              onChange={onCodeChange}
            />
          </TabsContent>
        )}
        {isCodeStep && (
          <TabsContent value="output" className="flex-1 m-0 overflow-hidden">
            <OutputPanel
              output={output}
              isRunning={isRunning}
              pyLoading={pyLoading}
              onAskTutor={onAskTutor}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Text-style steps render their textarea here, below the (always-on-Instructions) tabs. */}
      {!isCodeStep && (
        <div className="border-t border-border p-4 shrink-0">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            {isTextStep ? "Your Answer" : "Submission"}
          </label>
          <textarea
            value={textAnswer}
            onChange={e => onTextAnswerChange(e.target.value)}
            placeholder="Type your answer here..."
            className="w-full min-h-[160px] bg-background border border-border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid="text-answer"
          />
        </div>
      )}

      {grading && (
        <div className="border-t border-border p-3 shrink-0 max-h-[40vh] overflow-y-auto">
          <ValidationFeedbackPanel
            grading={grading}
            provisional={provisional}
            project={project}
            showCelebration={showCelebration}
            step={currentStep}
            projectSlug={project?.slug}
            refetchKey={`${grading.status}:${grading.feedback ?? ""}`}
            onSubmit={onSubmit}
            submitPending={submitPending}
            mode={learningMode}
            onRequestTutorNudge={requestTutorNudge}
          />
          <RemediationPanel
            feedback={grading.feedback}
            submission={isCodeStep ? code : textAnswer}
            hidden={grading.status !== "failed" || hideCheck}
            mode={learningMode}
          />
        </div>
      )}

      <DatasetRefsBar refs={datasetRefs} />
    </div>
  );

  // Rail visible at lg+. Below lg, the user opens it via the Sheet inside mainColumn.
  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      {!isMobile && (
        <div className="w-60 shrink-0 border-r border-border hidden lg:block">
          <StepChecklist
            steps={steps}
            currentIdx={currentStepIdx}
            completedStepIds={completedStepIds}
            onSelect={onSelectStep}
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={showAi ? 70 : 100} minSize={40}>
            {mainColumn}
          </ResizablePanel>
          {showAi && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={30} minSize={20}>
                <AiTutorPanel
                  projectId={project.id}
                  stepId={currentStep.id}
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
