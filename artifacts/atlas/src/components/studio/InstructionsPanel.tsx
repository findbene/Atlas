import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Lightbulb, Target } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { StepVM } from "./types";
import { useHintState } from "./useHintState";

type Props = {
  step: StepVM;
  stepNumber: number;
  totalSteps: number;
  projectSlug?: string;
  /** Bump when a grading result lands so the hint state refetches. */
  refetchKey?: unknown;
};

export function InstructionsPanel({ step, stepNumber, totalSteps, projectSlug, refetchKey }: Props) {
  // Legacy single-hint fallback when this step has no pedagogy_config yet.
  const [showLegacyHint, setShowLegacyHint] = useState(false);
  useEffect(() => { setShowLegacyHint(false); }, [step.id]);

  const usePedagogy = !!step.hasPedagogy;
  const { state, advancing, advance } = useHintState({
    projectSlug,
    stepId: step.id,
    enabled: usePedagogy,
    refetchKey,
  });

  const hasLegacyHint = !!(step.hints && step.hints.length > 0);

  return (
    <ScrollArea className="h-full" data-testid="studio-instructions">
      <div className="p-6 space-y-4 max-w-3xl">
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Step {stepNumber} of {totalSteps}
          </span>
          <h2 className="text-xl font-bold mt-1">{step.title}</h2>
          {step.learningObjective && (
            <div
              className="mt-3 flex items-start gap-2 text-xs text-sky-200/90 rounded-md bg-sky-500/5 border border-sky-500/15 px-3 py-2"
              data-testid="learning-objective"
            >
              <Target className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <span className="uppercase tracking-wider font-semibold text-sky-300 mr-1">
                  Goal
                </span>
                {step.learningObjective}
                {step.requiredSkill && (
                  <span className="text-muted-foreground"> · skill: {step.requiredSkill}</span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.description}</ReactMarkdown>
        </div>

        {usePedagogy && state && (
          <div className="space-y-2" data-testid="hint-ladder">
            {state.contents.map((h, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-100"
                data-testid={`hint-level-${i + 1}`}
              >
                <div className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold mb-1">
                  Hint {i + 1} / {state.maxLevel}
                </div>
                <div className="whitespace-pre-wrap">{h}</div>
              </div>
            ))}

            {state.finalExplanation && (
              <div
                className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-100"
                data-testid="hint-final-explanation"
              >
                <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold mb-1">
                  Why this works
                </div>
                <div className="whitespace-pre-wrap">{state.finalExplanation}</div>
              </div>
            )}

            {state.canEscalate ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-400 hover:text-amber-300 -ml-2"
                onClick={() => void advance()}
                disabled={advancing}
                data-testid="hint-button"
              >
                <Lightbulb className="h-4 w-4 mr-1" />
                {state.level === 0
                  ? `Show first hint (1/${state.maxLevel})`
                  : `Show next hint (${state.level + 1}/${state.maxLevel})`}
              </Button>
            ) : state.level === 0 && state.availableLevels === 0 ? null : (
              <div className="text-xs text-muted-foreground italic pl-1">
                You've unlocked every hint for this step.
              </div>
            )}
          </div>
        )}

        {!usePedagogy && hasLegacyHint && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-400 hover:text-amber-300 -ml-2"
              onClick={() => setShowLegacyHint(v => !v)}
              data-testid="hint-button"
            >
              <Lightbulb className="h-4 w-4 mr-1" />
              {showLegacyHint ? "Hide hint" : "Show hint"}
            </Button>
            {showLegacyHint && (
              <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200">
                {step.hints![0]}
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
