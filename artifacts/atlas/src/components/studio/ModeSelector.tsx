/**
 * Phase 32 — Learner mode selector + adaptive "Choose for me" CTA.
 * Phase 33 — Uses `useLearningMode` (shared) + dispatches change event
 * so the workspace panels react immediately. Adds an Adaptive-mode
 * badge that explains the currently recommended underlying mode.
 *
 * Self-contained. Renders nothing while not enrolled (404) — keeps the
 * top bar uncluttered until the learner is actually in a project.
 *
 * Mode changes take effect immediately via the existing server-side
 * hint policy + AI tutor wiring (mode-aware since P4/P8), AND via the
 * Phase-33 mode-aware UI in InstructionsPanel / ValidationFeedbackPanel
 * / RemediationPanel (which subscribe to the same `useLearningMode`
 * state).
 */
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import {
  useLearningMode,
  dispatchLearningModeChanged,
  type DbLearningMode,
} from "./useLearningMode";

const MODE_LABELS: Record<DbLearningMode, string> = {
  guided: "Guided",
  hint: "Hint-based",
  independent: "Independent",
  dynamic_ai_adaptive: "Adaptive",
};

const MODE_TOOLTIPS: Record<DbLearningMode, string> = {
  guided:
    "Full step-by-step support — explicit instructions and proactive nudges.",
  hint: "Attempt first; hints unlock progressively when you get stuck.",
  independent:
    "Minimal scaffolding. Portfolio-grade expectations. Ask for help on demand.",
  dynamic_ai_adaptive:
    "Atlas calibrates depth based on how the work is going.",
};

const ALL_MODES: DbLearningMode[] = [
  "guided",
  "hint",
  "independent",
  "dynamic_ai_adaptive",
];

type Props = {
  projectSlug: string | undefined;
};

export function ModeSelector({ projectSlug }: Props) {
  const { mode: currentMode, recommendation, ready } = useLearningMode(projectSlug);
  const [pending, setPending] = useState(false);

  const setMode = useCallback(
    async (mode: DbLearningMode) => {
      if (!projectSlug || pending || mode === currentMode) return;
      setPending(true);
      try {
        const r = await fetch(
          `${import.meta.env.BASE_URL}api/user/projects/${encodeURIComponent(projectSlug)}/learning-mode`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode }),
          },
        );
        if (r.ok) dispatchLearningModeChanged(projectSlug, mode);
      } finally {
        setPending(false);
      }
    },
    [projectSlug, pending, currentMode],
  );

  const chooseForMe = useCallback(async () => {
    if (!recommendation) return;
    await setMode(recommendation.recommendedMode);
  }, [recommendation, setMode]);

  // Hide while the fetch is in flight or when the learner isn't enrolled
  // (mode === null after `ready`). Same self-hide behavior as P32.
  if (!projectSlug || !ready || currentMode === null) return null;

  const showChooseForMe =
    recommendation !== null &&
    recommendation.reasonCode !== "stay-the-course" &&
    recommendation.recommendedMode !== currentMode;

  const showAdaptiveBadge =
    currentMode === "dynamic_ai_adaptive" && recommendation !== null;

  return (
    <div
      className="flex items-center gap-1 flex-wrap"
      data-testid="mode-selector"
      aria-label="Learning mode"
    >
      <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">
        Mode:
      </span>
      <div className="inline-flex rounded-md border border-border bg-card/40 p-0.5">
        {ALL_MODES.map(m => {
          const active = m === currentMode;
          return (
            <button
              key={m}
              type="button"
              disabled={pending}
              onClick={() => void setMode(m)}
              title={MODE_TOOLTIPS[m]}
              aria-pressed={active}
              data-testid={`mode-option-${m}`}
              className={
                "px-2 py-1 text-xs rounded transition-colors " +
                (active
                  ? "bg-blue-500/20 text-blue-300"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30")
              }
            >
              {MODE_LABELS[m]}
            </button>
          );
        })}
      </div>
      {showAdaptiveBadge && (
        <span
          data-testid="adaptive-mode-badge"
          title={recommendation.reason}
          className="text-[11px] ml-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-200 border border-purple-500/20"
        >
          Adaptive: using {MODE_LABELS[recommendation.recommendedMode]}
        </span>
      )}
      {showChooseForMe && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => void chooseForMe()}
          title={recommendation.reason}
          data-testid="mode-choose-for-me"
          className="text-xs text-amber-300 hover:text-amber-200 ml-1"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1" />
          )}
          Choose for me
        </Button>
      )}
    </div>
  );
}
