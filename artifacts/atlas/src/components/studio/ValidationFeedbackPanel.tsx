import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Award, ChevronDown, ChevronRight, Lightbulb, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobOutcomesPanel } from "@/components/JobOutcomesPanel";
import type { GradingResult, StepVM } from "./types";
import { useHintState } from "./useHintState";

type Props = {
  grading: GradingResult;
  /** Phase 24 — true when this result came from /check (provisional, not
   *  committed). Provisional results hide XP, hide the project-complete
   *  celebration block, and surface a "not yet submitted" tag. */
  provisional?: boolean;
  project: any;
  showCelebration: boolean;
  step?: StepVM;
  projectSlug?: string;
  /** Bump when a new grading result lands so pedagogy feedback refetches. */
  refetchKey?: unknown;
};

export function ValidationFeedbackPanel({ grading, provisional = false, project, showCelebration, step, projectSlug, refetchKey }: Props) {
  const passed = grading.status === "passed";
  const { state: hintState, advance, advancing } = useHintState({
    projectSlug,
    stepId: step?.id,
    enabled: !!step?.hasPedagogy,
    refetchKey,
  });
  // Always expand when a new grading result lands so learners see XP earned,
  // completion celebration, and feedback immediately. Users can collapse
  // afterwards if they want to free up vertical space.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(true);
  }, [grading.status, grading.feedback, grading.projectComplete]);

  return (
    <div
      className={`rounded-lg border ${
        passed
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          : "bg-red-500/10 border-red-500/30 text-red-300"
      }`}
      data-testid="studio-validation"
    >
      <button
        type="button"
        className="w-full p-3 flex items-center gap-2 font-semibold text-left"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        {passed ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        <span className="flex-1">
          {passed
            ? provisional
              ? "Looks good — Submit when ready"
              : `Passed!${grading.xpEarned ? ` +${grading.xpEarned} XP` : ""}`
            : provisional
              ? "Not quite — keep editing"
              : "Try again"}
        </span>
        {provisional && (
          <span
            className="text-[10px] uppercase tracking-wider font-semibold rounded px-1.5 py-0.5 bg-foreground/10 text-foreground/70 mr-1"
            data-testid="check-provisional-tag"
          >
            Check · not submitted
          </span>
        )}
        {open ? (
          <ChevronDown className="h-4 w-4 opacity-60" />
        ) : (
          <ChevronRight className="h-4 w-4 opacity-60" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {!passed && hintState?.failureFeedback && (
            <div
              className="text-sm rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-red-100 whitespace-pre-wrap"
              data-testid="failure-feedback"
            >
              {hintState.failureFeedback}
            </div>
          )}
          {grading.feedback && (
            <p className="text-sm whitespace-pre-wrap">{grading.feedback}</p>
          )}
          {!passed && hintState?.shouldOffer && hintState.canEscalate && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100 h-7 text-xs"
              onClick={() => void advance()}
              disabled={advancing}
              data-testid="hint-offer"
            >
              <Lightbulb className="h-3 w-3 mr-1" />
              Want a nudge? Reveal hint {hintState.level + 1}/{hintState.maxLevel}
            </Button>
          )}
          {passed && hintState?.successFeedback && (
            <div
              className="text-sm rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-emerald-100 whitespace-pre-wrap"
              data-testid="success-feedback"
            >
              {hintState.successFeedback}
            </div>
          )}
          {passed && hintState?.portfolioRelevance && (
            <div
              className="text-xs rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-amber-200 flex items-start gap-2"
              data-testid="portfolio-relevance"
            >
              <Briefcase className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{hintState.portfolioRelevance}</span>
            </div>
          )}
          {!provisional && passed && grading.projectComplete && showCelebration && (
            <div className="mt-3 pt-3 border-t border-emerald-500/20">
              <div className="font-bold text-emerald-300 mb-2">
                🎉 Project Complete! Excellent work!
              </div>
              {project?.jobOutcomes && (
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 mt-3">
                  <div className="text-xs uppercase tracking-wider text-amber-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5" /> What you just unlocked
                  </div>
                  {project.jobOutcomes.roles &&
                    project.jobOutcomes.roles.length > 0 && (
                      <div className="text-sm text-foreground/90 mb-2">
                        <span className="text-muted-foreground">
                          Roles you're now closer to:
                        </span>{" "}
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
  );
}
