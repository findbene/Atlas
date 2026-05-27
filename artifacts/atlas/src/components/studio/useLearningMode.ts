/**
 * Phase 33 — Shared learning-mode hook + change broadcaster.
 *
 * Single fetch of the P32 recommendation endpoint, reused by:
 *   - `StudioShell` (drives mode-aware InstructionsPanel /
 *     ValidationFeedbackPanel / RemediationPanel rendering).
 *   - `ModeSelector` (top-bar picker; calls `dispatchLearningModeChanged`
 *     after a successful PATCH so the panels react immediately).
 *
 * Communication between sibling consumers uses a window CustomEvent.
 * No global store, no React-Query coupling — keeps the surface
 * additive and reversible, matching the Phase 32 plain-fetch precedent
 * (`useHintState.ts`).
 *
 * If `projectSlug` is undefined or the fetch 404s (learner not enrolled)
 * the hook returns `{ mode: null, recommendation: null, ready: true }`.
 * Consumers treat `mode === null` as "no mode signal — render legacy
 * default behavior".
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type DbLearningMode =
  | "guided"
  | "hint"
  | "independent"
  | "dynamic_ai_adaptive";

export type LearningModeRecommendation = {
  recommendedMode: DbLearningMode;
  reasonCode: string;
  reason: string;
  signals: { currentMode: DbLearningMode } & Record<string, unknown>;
};

export type LearningModeState = {
  mode: DbLearningMode | null;
  recommendation: LearningModeRecommendation | null;
  ready: boolean;
};

export const LEARNING_MODE_CHANGED_EVENT = "atlas:learning-mode-changed";

export function dispatchLearningModeChanged(
  slug: string,
  mode: DbLearningMode,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LEARNING_MODE_CHANGED_EVENT, { detail: { slug, mode } }),
  );
}

export function useLearningMode(
  projectSlug: string | undefined,
): LearningModeState {
  const [state, setState] = useState<LearningModeState>({
    mode: null,
    recommendation: null,
    ready: false,
  });
  // Request-versioning + initial-fetch sentinel so concurrent fetches
  // can't reorder and so transient errors AFTER a successful response
  // don't blow away an already-known mode (which would briefly hide
  // ModeSelector and revert panel rendering to legacy defaults).
  const fetchSeqRef = useRef(0);
  const hadAnySuccessRef = useRef(false);

  const fetchState = useCallback(async () => {
    if (!projectSlug) {
      hadAnySuccessRef.current = false;
      setState({ mode: null, recommendation: null, ready: true });
      return;
    }
    const seq = ++fetchSeqRef.current;
    const isStale = () => seq !== fetchSeqRef.current;
    // Preserve-on-error: read the freshest state via the functional
    // setState form so we never clobber an optimistic update that
    // landed AFTER this fetch was kicked off but BEFORE it failed.
    const applyPreserve = () =>
      setState(s => (isStale() ? s : { ...s, ready: true }));
    const applyReset = () =>
      setState(s => (isStale() ? s : { mode: null, recommendation: null, ready: true }));
    const applySuccess = (body: LearningModeRecommendation) =>
      setState(s =>
        isStale()
          ? s
          : { mode: body.signals.currentMode, recommendation: body, ready: true },
      );
    try {
      const r = await fetch(
        `${import.meta.env.BASE_URL}api/user/projects/${encodeURIComponent(projectSlug)}/learning-mode/recommendation`,
        { credentials: "include" },
      );
      if (!r.ok) {
        if (hadAnySuccessRef.current) applyPreserve();
        else applyReset();
        return;
      }
      const body = (await r.json()) as LearningModeRecommendation;
      hadAnySuccessRef.current = true;
      applySuccess(body);
    } catch {
      if (hadAnySuccessRef.current) applyPreserve();
      else applyReset();
    }
  }, [projectSlug]);

  // Mount + slug change: reset to "loading" and kick off a fresh fetch.
  useEffect(() => {
    fetchSeqRef.current++; // invalidate any in-flight prior fetch
    hadAnySuccessRef.current = false;
    setState({ mode: null, recommendation: null, ready: false });
    void fetchState();
  }, [fetchState]);

  // Cross-component refresh: ModeSelector dispatches after PATCH so
  // sibling consumers (StudioShell + panels) refetch without coupling.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = (e: Event) => {
      const ev = e as CustomEvent<{ slug: string; mode: DbLearningMode }>;
      if (!projectSlug || ev.detail?.slug !== projectSlug) return;
      // Optimistic update so panels react instantly; the background
      // refetch reconciles the recommendation reason against fresh
      // server-computed signals. Stale fetch responses are dropped
      // by the seq-id guard inside `fetchState`.
      hadAnySuccessRef.current = true;
      setState(s => ({ ...s, mode: ev.detail.mode, ready: true }));
      void fetchState();
    };
    window.addEventListener(LEARNING_MODE_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(LEARNING_MODE_CHANGED_EVENT, onChange);
  }, [projectSlug, fetchState]);

  return state;
}
