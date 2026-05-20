import { useCallback, useEffect, useState } from "react";

export type HintState = {
  level: number;
  maxLevel: number;
  availableLevels: number;
  contents: string[];
  finalExplanation: string | null;
  successFeedback: string | null;
  failureFeedback: string | null;
  portfolioRelevance: string | null;
  canEscalate: boolean;
  shouldOffer: boolean;
  mode: string;
  attemptCount: number;
  stepPassed: boolean;
};

type Opts = {
  projectSlug: string | undefined;
  stepId: string | undefined;
  enabled: boolean;
  /** Bump to force a refetch (e.g. when grading lands). */
  refetchKey?: unknown;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useHintState({ projectSlug, stepId, enabled, refetchKey }: Opts) {
  const [state, setState] = useState<HintState | null>(null);
  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const canFetch = enabled && !!projectSlug && !!stepId && UUID_RE.test(stepId);

  const refetch = useCallback(async () => {
    if (!canFetch) return;
    setLoading(true);
    try {
      const r = await fetch(
        `${import.meta.env.BASE_URL}api/projects/${encodeURIComponent(projectSlug!)}/steps/${stepId}/hint`,
        { credentials: "include" },
      );
      if (r.ok) setState(await r.json());
    } finally {
      setLoading(false);
    }
  }, [canFetch, projectSlug, stepId]);

  const advance = useCallback(async () => {
    if (!canFetch) return;
    setAdvancing(true);
    try {
      const r = await fetch(
        `${import.meta.env.BASE_URL}api/projects/${encodeURIComponent(projectSlug!)}/steps/${stepId}/hint/next`,
        { method: "POST", credentials: "include" },
      );
      if (r.ok) setState(await r.json());
    } finally {
      setAdvancing(false);
    }
  }, [canFetch, projectSlug, stepId]);

  useEffect(() => {
    setState(null);
    void refetch();
    // refetchKey is intentionally part of the dependency list to force a
    // re-pull whenever the parent signals a new grading result lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, refetchKey]);

  return { state, loading, advancing, refetch, advance };
}
