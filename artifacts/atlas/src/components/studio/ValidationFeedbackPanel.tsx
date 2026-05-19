import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Award, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobOutcomesPanel } from "@/components/JobOutcomesPanel";
import type { GradingResult } from "./types";

type Props = {
  grading: GradingResult;
  project: any;
  showCelebration: boolean;
};

export function ValidationFeedbackPanel({ grading, project, showCelebration }: Props) {
  const passed = grading.status === "passed";
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
            ? `Passed!${grading.xpEarned ? ` +${grading.xpEarned} XP` : ""}`
            : "Try again"}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 opacity-60" />
        ) : (
          <ChevronRight className="h-4 w-4 opacity-60" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3">
          {grading.feedback && (
            <p className="text-sm whitespace-pre-wrap">{grading.feedback}</p>
          )}
          {passed && grading.projectComplete && showCelebration && (
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
