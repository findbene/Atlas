/**
 * Phase 32 — Learner mode selector + adaptive "Choose for me" CTA.
 *
 * Self-contained. Fetches its own state from
 *   GET  /api/user/projects/:slug/learning-mode/recommendation  (also gives currentMode via signals)
 *   PATCH /api/user/projects/:slug/learning-mode
 *
 * Renders nothing while not enrolled (404 on first fetch) — keeps the
 * top bar uncluttered until the learner is actually in a project.
 *
 * Mode changes take effect immediately via the existing server-side
 * hint-policy (hints.ts) and AI-tutor wiring (ai.ts), both of which
 * already read user_progress.learning_mode at request time. This
 * component does NOT rewrite hint/instruction panels — that's an
 * intentional Phase 32 boundary.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

type DbLearningMode = "guided" | "hint" | "independent" | "dynamic_ai_adaptive";

type Recommendation = {
  recommendedMode: DbLearningMode;
  reasonCode: string;
  reason: string;
  signals: { currentMode: DbLearningMode } & Record<string, unknown>;
};

const MODE_LABELS: Record<DbLearningMode, string> = {
  guided: "Guided",
  hint: "Hint-based",
  independent: "Independent",
  dynamic_ai_adaptive: "Adaptive",
};

const MODE_TOOLTIPS: Record<DbLearningMode, string> = {
  guided: "Full step-by-step support — explicit instructions and proactive nudges.",
  hint: "Attempt first; hints unlock progressively when you get stuck.",
  independent: "Minimal scaffolding. Portfolio-grade expectations. Ask for help on demand.",
  dynamic_ai_adaptive: "Atlas calibrates depth based on how the work is going.",
};

const ALL_MODES: DbLearningMode[] = ["guided", "hint", "independent", "dynamic_ai_adaptive"];

type Props = {
  projectSlug: string | undefined;
};

export function ModeSelector({ projectSlug }: Props) {
  const [currentMode, setCurrentMode] = useState<DbLearningMode | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  const fetchState = useCallback(async () => {
    if (!projectSlug) return;
    try {
      const r = await fetch(
        `${import.meta.env.BASE_URL}api/user/projects/${encodeURIComponent(projectSlug)}/learning-mode/recommendation`,
        { credentials: "include" },
      );
      if (r.status === 404) { setEnrolled(false); return; }
      if (!r.ok) return;
      const body = (await r.json()) as Recommendation;
      setRecommendation(body);
      setCurrentMode(body.signals.currentMode);
      setEnrolled(true);
    } catch {
      // best-effort — silently hide on transport error
    }
  }, [projectSlug]);

  useEffect(() => {
    setRecommendation(null);
    setCurrentMode(null);
    setEnrolled(null);
    void fetchState();
  }, [fetchState]);

  const setMode = useCallback(async (mode: DbLearningMode) => {
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
      if (r.ok) setCurrentMode(mode);
    } finally {
      setPending(false);
    }
  }, [projectSlug, pending, currentMode]);

  const chooseForMe = useCallback(async () => {
    if (!recommendation) return;
    await setMode(recommendation.recommendedMode);
  }, [recommendation, setMode]);

  if (!projectSlug || enrolled === false || enrolled === null) return null;

  const showChooseForMe =
    recommendation !== null &&
    recommendation.reasonCode !== "stay-the-course" &&
    recommendation.recommendedMode !== currentMode;

  return (
    <div
      className="flex items-center gap-1 flex-wrap"
      data-testid="mode-selector"
      aria-label="Learning mode"
    >
      <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Mode:</span>
      <div className="inline-flex rounded-md border border-border bg-card/40 p-0.5">
        {ALL_MODES.map((m) => {
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
      {showChooseForMe && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => void chooseForMe()}
          title={recommendation!.reason}
          data-testid="mode-choose-for-me"
          className="text-xs text-amber-300 hover:text-amber-200 ml-1"
        >
          {pending
            ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          Choose for me
        </Button>
      )}
    </div>
  );
}
