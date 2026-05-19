import { CheckCircle, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StepVM } from "./types";

type Props = {
  steps: StepVM[];
  currentIdx: number;
  completedStepIds: Set<string>;
  onSelect: (idx: number) => void;
};

export function StepChecklist({ steps, currentIdx, completedStepIds, onSelect }: Props) {
  const completedCount = steps.filter(s => completedStepIds.has(s.id)).length;
  const pct = steps.length === 0 ? 0 : Math.round((completedCount / steps.length) * 100);
  return (
    <div className="h-full flex flex-col bg-muted/10" data-testid="studio-steps">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span className="font-medium uppercase tracking-wider">Progress</span>
          <span>
            {completedCount}/{steps.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <ol className="py-2">
          {steps.map((s, i) => {
            const completed = completedStepIds.has(s.id);
            const active = i === currentIdx;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className={`w-full text-left px-4 py-2.5 flex items-start gap-2.5 border-l-2 transition-colors ${
                    active
                      ? "bg-primary/10 border-primary text-foreground"
                      : completed
                        ? "border-emerald-500/40 hover:bg-muted/40"
                        : "border-transparent hover:bg-muted/40"
                  }`}
                  data-testid={`studio-step-${i + 1}`}
                  aria-current={active ? "step" : undefined}
                >
                  <span className="mt-0.5 shrink-0">
                    {completed ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : active ? (
                      <Play className="h-4 w-4 text-primary" />
                    ) : (
                      <span className="block h-4 w-4 rounded-full border border-muted-foreground/40 text-[10px] leading-4 text-center text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                      Step {i + 1}
                    </span>
                    <span
                      className={`block text-sm leading-tight truncate ${active ? "font-semibold" : "font-medium"}`}
                    >
                      {s.title}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </ScrollArea>
    </div>
  );
}
