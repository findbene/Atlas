import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { StepVM } from "./types";

type Props = {
  step: StepVM;
  stepNumber: number;
  totalSteps: number;
};

export function InstructionsPanel({ step, stepNumber, totalSteps }: Props) {
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    setShowHint(false);
  }, [step.id]);
  const hasHint = !!(step.hints && step.hints.length > 0);
  return (
    <ScrollArea className="h-full" data-testid="studio-instructions">
      <div className="p-6 space-y-4 max-w-3xl">
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Step {stepNumber} of {totalSteps}
          </span>
          <h2 className="text-xl font-bold mt-1">{step.title}</h2>
        </div>
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.description}</ReactMarkdown>
        </div>
        {hasHint && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-400 hover:text-amber-300 -ml-2"
              onClick={() => setShowHint(v => !v)}
            >
              <Lightbulb className="h-4 w-4 mr-1" />
              {showHint ? "Hide hint" : "Show hint"}
            </Button>
            {showHint && (
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
