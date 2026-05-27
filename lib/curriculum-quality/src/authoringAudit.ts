/**
 * Phase 35 — Pure helpers for the project-authoring audit
 * (`scripts/src/audit-project-authoring.ts`).
 *
 * Extracted here so they're typecheck/test-covered inside an existing
 * vitest harness, without bolting a vitest config onto `@workspace/scripts`.
 *
 * No DB imports. No side effects.
 */

/**
 * Minimal shape of a step's pedagogy config we look at for leak detection.
 * Kept loose (all-optional strings) so callers can pass `PedagogyConfig`
 * from `@workspace/execution-core` without an extra cast.
 */
export type HintLeakPedagogy = {
  hintLevel4?: string | null;
  hintLevel5?: string | null;
};

const MIN_SIGNATURE_LEN = 40;
const WINDOW_LEN = 40;
const WINDOW_STRIDE = 10;
const MAX_JSON_SYNTAX_RATIO = 0.5;

/**
 * Cheap, deterministic heuristic: returns true when the highest-level hints
 * (L4 or L5) appear to embed a literal slice of the step's expectedOutputs.
 *
 * This catches the most common leak: an author pastes the fixture JSON / CSV
 * straight into L5. It will NOT catch paraphrased leaks — those are caught
 * by the human review pass in the publish-readiness checklist.
 *
 * False-positive avoidance: any 40-char window that is mostly JSON syntax
 * characters (`{}[]":,` + whitespace) is skipped, because near-empty JSON
 * shells trivially appear inside any descriptive sentence.
 */
export function hintLeakSuspected(
  cfg: HintLeakPedagogy | null | undefined,
  expectedOutputs: unknown,
): boolean {
  if (!cfg) return false;
  if (expectedOutputs === null || expectedOutputs === undefined) return false;

  let signature: string;
  try {
    signature = JSON.stringify(expectedOutputs);
  } catch {
    return false;
  }
  if (typeof signature !== "string" || signature.length < MIN_SIGNATURE_LEN) {
    return false;
  }

  const hints = [cfg.hintLevel4, cfg.hintLevel5].filter(
    (h): h is string => typeof h === "string" && h.length >= MIN_SIGNATURE_LEN,
  );
  if (hints.length === 0) return false;

  for (const hint of hints) {
    for (let i = 0; i + WINDOW_LEN <= signature.length; i += WINDOW_STRIDE) {
      const window = signature.slice(i, i + WINDOW_LEN);
      const syntaxChars = window.match(/[{}\[\]":,\s]/g)?.length ?? 0;
      if (syntaxChars / window.length > MAX_JSON_SYNTAX_RATIO) continue;
      if (hint.includes(window)) return true;
    }
  }
  return false;
}
