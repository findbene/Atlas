import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Eye, Lock } from "lucide-react";

type Props = {
  isRunning: boolean;
  pyLoading: boolean;
  isPythonStep: boolean;
  hasStarter: boolean;
  hasCode: boolean;
  isPro: boolean;
  submitPending: boolean;
  onRun: () => void;
  onReset: () => void;
  onOpenSolution: () => void;
  onSubmit: () => void;
};

export function EditorToolbar({
  isRunning,
  pyLoading,
  isPythonStep,
  hasStarter,
  hasCode,
  isPro,
  submitPending,
  onRun,
  onReset,
  onOpenSolution,
  onSubmit,
}: Props) {
  // SQL never gated on Pyodide load. Python Run is disabled while the runtime
  // is downloading (first time only).
  const runDisabled = isRunning || (isPythonStep && pyLoading) || !hasCode;
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
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={onSubmit}
        disabled={submitPending}
        data-testid="studio-submit"
      >
        {submitPending ? "Grading..." : "Submit"}
      </Button>
    </div>
  );
}
