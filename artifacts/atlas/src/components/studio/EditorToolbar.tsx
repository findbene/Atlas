import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Eye, Lock, CheckCircle2 } from "lucide-react";

type Props = {
  isRunning: boolean;
  pyLoading: boolean;
  isPythonStep: boolean;
  hasStarter: boolean;
  hasCode: boolean;
  isPro: boolean;
  /** Phase 24 — disable Check button while a check or submit is in flight. */
  checkPending: boolean;
  /** True when this step type has no useful check (self_attest etc.). */
  hideCheck: boolean;
  submitPending: boolean;
  onRun: () => void;
  onReset: () => void;
  onOpenSolution: () => void;
  onCheck: () => void;
  onSubmit: () => void;
};

export function EditorToolbar({
  isRunning,
  pyLoading,
  isPythonStep,
  hasStarter,
  hasCode,
  isPro,
  checkPending,
  hideCheck,
  submitPending,
  onRun,
  onReset,
  onOpenSolution,
  onCheck,
  onSubmit,
}: Props) {
  // SQL never gated on Pyodide load. Python Run is disabled while the runtime
  // is downloading (first time only).
  const actionInFlight = checkPending || submitPending;
  // Phase 24 — Disable Run while a /check or /submit is in flight. SQL
  // runs locally dispatch reducer actions that could otherwise hijack
  // the `submitting` phase and cause a pending submit's response to be
  // dropped by the reducer's phase-guard.
  const runDisabled = isRunning || (isPythonStep && pyLoading) || !hasCode || actionInFlight;
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={onReset}
        disabled={!hasStarter}
      >
        <RotateCcw className="h-3 w-3 mr-1" />
        Reset
      </Button>
      <Button
        size="sm"
        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
        onClick={onRun}
        disabled={runDisabled}
        title={isPythonStep && pyLoading ? "Loading Python runtime..." : undefined}
        data-testid="studio-run"
      >
        <Play className="h-3 w-3 mr-1" />
        {isRunning
          ? "Running..."
          : isPythonStep && pyLoading
            ? "Loading runtime…"
            : "Run"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={onOpenSolution}
        title={isPro ? "Reveal reference solution" : "Pro: reveal reference solution"}
      >
        {isPro ? (
          <Eye className="h-3 w-3 mr-1" />
        ) : (
          <Lock className="h-3 w-3 mr-1" />
        )}
        Solution
      </Button>
      {!hideCheck && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onCheck}
          disabled={actionInFlight}
          title="Get fast feedback without committing your attempt"
          data-testid="studio-check"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {checkPending ? "Checking..." : "Check"}
        </Button>
      )}
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={onSubmit}
        disabled={actionInFlight}
        data-testid="studio-submit"
      >
        {submitPending ? "Grading..." : "Submit"}
      </Button>
    </div>
  );
}
