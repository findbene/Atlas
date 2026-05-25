/**
 * Phase 23 — Workspace step URL helpers.
 *
 * Single source of truth for the 0-indexed (UI) ↔ 1-indexed (server / URL)
 * conversion that the workspace uses to deep-link a learner to a specific
 * step via `?step=N`.
 *
 * Conventions:
 * - The server's `progress.currentStepPosition` is 1-indexed (matches
 *   `project_steps.stepNumber`); the server defaults to `1` when no progress
 *   row exists.
 * - The URL query param `?step=N` is also 1-indexed because it's user-facing
 *   (`?step=1` is a more natural deep-link than `?step=0`).
 * - The UI's `currentStepIdx` is 0-indexed because it indexes into the
 *   `steps[]` array.
 *
 * All conversion happens through these helpers — `project-workspace.tsx`
 * never does arithmetic on its own to prevent the classic off-by-one drift
 * between the server and the UI.
 */

/** Parse `?step=N` from a URL search string. Returns the 1-indexed number,
 *  or `null` if missing / not a positive integer. Negative, zero, NaN, and
 *  non-integer values all return `null` rather than getting silently clamped
 *  — clamping happens downstream once we know `steps.length`. */
export function parseStepParam(search: string): number | null {
  // Accept both "?step=3" and "step=3" so callers can pass either
  // window.location.search or a hand-built string.
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = params.get("step");
  if (raw === null) return null;
  // Reject non-digit input (e.g. "abc", "1.5", "1e2") — we want a strict
  // positive integer or nothing.
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/** Convert a 1-indexed step position (from URL or server progress) into a
 *  0-indexed array index, clamped to `[0, totalSteps - 1]`. When
 *  `totalSteps <= 0`, returns 0 (a defensive default — the workspace
 *  shouldn't render in that case anyway). */
export function clampStepIdx(position: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  if (!Number.isFinite(position)) return 0;
  const idx = Math.floor(position) - 1;
  if (idx < 0) return 0;
  if (idx > totalSteps - 1) return totalSteps - 1;
  return idx;
}

/** Convert a 0-indexed UI index back to a 1-indexed URL step number. */
export function idxToStepNumber(idx: number): number {
  return Math.max(1, idx + 1);
}

/** Build the `?step=N` search string for a 0-indexed UI index. Returns the
 *  string with the leading `?` included so it can be slotted straight into
 *  `history.replaceState`. */
export function buildStepSearch(idx: number, existingSearch: string = ""): string {
  const params = new URLSearchParams(
    existingSearch.startsWith("?") ? existingSearch.slice(1) : existingSearch,
  );
  params.set("step", String(idxToStepNumber(idx)));
  return `?${params.toString()}`;
}

/** Resolve the initial step index for the workspace.
 *
 *  Precedence:
 *  1. Valid `?step=N` URL param (clamped to range).
 *  2. Server `progress.currentStepPosition` (clamped to range).
 *  3. `null` — caller should treat as "not ready yet" and render a skeleton
 *     rather than flashing step 0.
 *
 *  The `progressLoaded` flag distinguishes "we asked the server and there's
 *  no progress" (→ default to step 0) from "we haven't asked yet" (→ wait).
 *  Without this distinction we'd flash step 0 before progress resolves. */
export function resolveInitialStepIdx(args: {
  search: string;
  totalSteps: number;
  progressPosition: number | null | undefined;
  progressLoaded: boolean;
}): number | null {
  const { search, totalSteps, progressPosition, progressLoaded } = args;
  if (totalSteps <= 0) return null;

  const urlPos = parseStepParam(search);
  if (urlPos !== null) return clampStepIdx(urlPos, totalSteps);

  if (!progressLoaded) return null;

  if (progressPosition != null && Number.isFinite(progressPosition)) {
    return clampStepIdx(progressPosition, totalSteps);
  }

  // Server returned progress but it has no usable currentStepPosition —
  // start at the beginning.
  return 0;
}
