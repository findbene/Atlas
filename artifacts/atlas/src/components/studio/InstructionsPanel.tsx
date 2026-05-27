import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Lightbulb, Target, ChevronDown, ChevronRight, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { StepVM } from "./types";
import { useHintState } from "./useHintState";
import type { DbLearningMode } from "./useLearningMode";

type Props = {
  step: StepVM;
  stepNumber: number;
  totalSteps: number;
  projectSlug?: string;
  /** Bump when a grading result lands so the hint state refetches. */
  refetchKey?: unknown;
  /** Phase 33 — current learning mode. `null` falls back to legacy
   *  default rendering (matches the pre-P33 baseline). */
  mode?: DbLearningMode | null;
  /** Phase 33 — true once the learner has made at least one failed
   *  /check or /submit on the current step. Drives the independent-mode
   *  "hide hint escalation until a real attempt has failed" rule. */
  hasFailedCheck?: boolean;
  /** Phase 33 — guided / independent modes surface an "Ask Ada" CTA
   *  inside the instructions area. Optional; if omitted the CTA is
   *  not rendered. */
  onRequestTutorNudge?: () => void;
};

export function InstructionsPanel({
  step,
  stepNumber,
  totalSteps,
  projectSlug,
  refetchKey,
  mode,
  hasFailedCheck,
  onRequestTutorNudge,
}: Props) {
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

  // Phase 33 — mode-aware rendering switches. Default `null`/unknown
  // mode falls through as "hint" (the historical default).
  const isIndependent = mode === "independent";
  const isGuided = mode === "guided";

  // Independent mode: collapse long instructions until the learner
  // explicitly expands. Threshold tuned to ~3 short paragraphs so we
  // don't double-toggle trivial 1-line steps.
  const longInstructions = (step.description?.length ?? 0) > 280;
  const [instructionsOpen, setInstructionsOpen] = useState(
    !(isIndependent && longInstructions),
  );
  useEffect(() => {
    // Reset disclosure state whenever the step or mode flips.
    setInstructionsOpen(!(isIndependent && longInstructions));
  }, [step.id, isIndependent, longInstructions]);

  // Independent mode hint suppression. The proactive escalate button
  // (and the legacy one-shot reveal button) is hidden until at least
  // one failed attempt is on record. Already-revealed hints — both
  // pedagogy-ladder content the learner has clicked through and a
  // legacy hint they previously toggled open — must REMAIN visible
  // (the learner earned them; yanking them on a later mode flip would
  // be a privacy/UX regression).
  //
  // Pedagogy path: `state.level > 0` means at least one hint is open,
  // which is itself sufficient proof of an attempt → escalate stays.
  // Legacy path: the parent UI tracks revealed state via
  // `showLegacyHint`; we treat that as the same "already-revealed"
  // signal so the reveal button (and the visible hint body) stay.
  const suppressPedagogyEscalation =
    isIndependent && !hasFailedCheck && (state?.level ?? 0) === 0;
  const suppressLegacyReveal =
    isIndependent && !hasFailedCheck && !showLegacyHint;

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

        {isIndependent && longInstructions ? (
          <div data-testid="instructions-collapsible">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInstructionsOpen(v => !v)}
              aria-expanded={instructionsOpen}
              data-testid="instructions-disclosure-toggle"
              className="text-xs -ml-2 text-muted-foreground hover:text-foreground"
            >
              {instructionsOpen ? (
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 mr-1" />
              )}
              {instructionsOpen ? "Hide full instructions" : "Show full instructions"}
            </Button>
            {instructionsOpen && (
              <div
                className="prose prose-invert prose-sm max-w-none mt-2"
                data-testid="instructions-body"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.description}</ReactMarkdown>
              </div>
            )}
          </div>
        ) : (
          <div
            className="prose prose-invert prose-sm max-w-none"
            data-testid="instructions-body"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.description}</ReactMarkdown>
          </div>
        )}

        {isGuided && onRequestTutorNudge && (
          <div
            className="rounded-md bg-sky-500/5 border border-sky-500/20 px-3 py-2 flex items-center gap-2"
            data-testid="guided-ada-cta"
          >
            <Bot className="h-4 w-4 text-sky-300 shrink-0" />
            <span className="text-xs text-sky-100 flex-1">
              New to this? Ada can walk you through it.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRequestTutorNudge}
              className="h-7 text-xs text-sky-200 hover:text-sky-100"
              data-testid="guided-ada-cta-button"
            >
              Ask Ada
            </Button>
          </div>
        )}

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

            {state.canEscalate && !suppressPedagogyEscalation ? (
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
            ) : suppressPedagogyEscalation ? (
              <div
                className="text-xs text-muted-foreground italic pl-1"
                data-testid="independent-hint-suppressed"
              >
                Independent mode — give it a real attempt first. Hints unlock after a failed check.
              </div>
            ) : state.level === 0 && state.availableLevels === 0 ? null : (
              <div className="text-xs text-muted-foreground italic pl-1">
                You've unlocked every hint for this step.
              </div>
            )}
          </div>
        )}

        {!usePedagogy && hasLegacyHint && !suppressLegacyReveal && (
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
        {!usePedagogy && hasLegacyHint && suppressLegacyReveal && (
          <div
            className="text-xs text-muted-foreground italic pl-1"
            data-testid="independent-hint-suppressed"
          >
            Independent mode — give it a real attempt first. Hints unlock after a failed check.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
