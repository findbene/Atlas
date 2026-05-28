/**
 * Phase 53 — Honest-claim ceiling (H3) shared guard list.
 *
 * Atlas's H3 ceiling: enabled paths verify that submitted runtime output
 * matched the expected result and that the record was issued by Atlas at
 * the time the learner passed the step. Atlas does NOT claim:
 *
 *   - independent authorship of the learner's code (H1),
 *   - that the learner did not use outside help (H2),
 *   - tamper-proof / cheat-proof / fraud-proof validation,
 *   - "100% verified" or third-party-audited authorship,
 *   - certified mastery or anti-cheat guarantees.
 *
 * Any user-facing surface that includes one of the phrases below crosses
 * H3 and must be reworded.
 *
 * This list is the single source of truth. It is consumed by:
 *   - `src/pages/how-atlas-grades.test.tsx` — DOM scan of the disclosure page.
 *   - `src/lib/banned-h1h2-phrases.test.ts` — source-level grep of all
 *     other user-facing surfaces (certificates, verify, home, workspace
 *     completion block, etc.).
 *
 * When adding a phrase here, prefer the most generic form that catches
 * compounds (e.g. `tamper-proof` also catches `tamper-proof certificate`,
 * `tamper-proof receipt`).
 */
export const BANNED_H1H2_PHRASES: readonly string[] = [
  "tamper-proof",
  "tamperproof",
  "cheat-proof",
  "cheatproof",
  "fraud-proof",
  "verified authorship",
  "proven authorship",
  "proves you wrote",
  "guarantees you wrote",
  "guaranteed authentic",
  "proven mastery",
  "certifies mastery",
  "anti-cheat",
  "plagiarism-proof",
  "100% verified",
  "independently verified",
];
