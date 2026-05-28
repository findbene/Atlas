/**
 * Phase 54 — H1/H2 honest-claim guard (normalized-pattern edition).
 *
 * Atlas's H3 ceiling: enabled paths verify that submitted runtime output
 * matched the expected result and that the record was issued by Atlas
 * at the time the learner passed the step. Atlas does NOT claim:
 *
 *   - independent authorship of the learner's code (H1),
 *   - that the learner did not use outside help (H2),
 *   - tamper-proof / cheat-proof / fraud-proof validation,
 *   - "100% verified" / third-party-audited authorship,
 *   - certified mastery / anti-cheat guarantees.
 *
 * Phase 49 shipped a 16-entry exact-substring list. Phase 54 upgrades to
 * normalized regex patterns to close the easy-evasion gaps the architect
 * called out at Phase 53 review:
 *
 *   - Unicode hyphens (`tamper‑proof` with U+2011, em dash, en dash, etc.)
 *   - whitespace variants (NBSP, double-space, line wraps, zero-width)
 *   - case variation (handled by `normalize`)
 *   - hyphen-vs-space variants (`tamper proof` matches `tamper-proof`)
 *   - common phrase variants ("authorship verified", "machine-verified
 *     authorship", "session-verified solver", "verified that you wrote",
 *     "certified mastery", "outside-help-free")
 *
 * This module is the single source of truth. Consumed by:
 *   - `src/pages/how-atlas-grades.test.tsx` — DOM scan of the disclosure page.
 *   - `src/lib/banned-h1h2-phrases.test.ts` — source-level grep of every
 *     other user-facing surface.
 *
 * If you find a real-world evasion not caught by these patterns, ADD A
 * PATTERN — do NOT weaken the guard.
 */

/**
 * Normalize a string for honest-claim matching:
 *   - NFKC-normalize first (fullwidth `ｔａｍｐｅｒ` → ASCII `tamper`,
 *     fullwidth `％` → ASCII `%`, ligatures decomposed, etc.).
 *   - Lowercase.
 *   - Strip every Unicode format-control character (`\p{Cf}` covers
 *     ZWJ U+200D, ZWNJ U+200C, word joiner U+2060, BOM U+FEFF, soft
 *     hyphen U+00AD, bidi isolates/overrides U+202A..U+202E and
 *     U+2066..U+2069). These are invisible characters an evasion-
 *     minded author could insert mid-phrase to defeat substring
 *     matching.
 *   - Convert remaining Unicode dash/hyphen variants to ASCII `-`.
 *   - Convert NBSP, zero-width spaces, and line/paragraph separators
 *     to a regular space (so `\s` in patterns matches them).
 */
export function normalize(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{Cf}/gu, "")
    .replace(
      // U+002D ASCII hyphen, U+2010..U+2015 hyphen/dash family,
      // U+2212 minus sign, U+FE58/FE63 small hyphen-minus,
      // U+FF0D fullwidth hyphen-minus (NFKC handles FF0D but keep
      // for defense-in-depth if NFKC is ever bypassed).
      /[\u002d\u2010\u2011\u2012\u2013\u2014\u2015\u2212\ufe58\ufe63\uff0d]/g,
      "-",
    )
    .replace(
      // U+00A0 NBSP, U+2000..U+200A en/em spaces, U+2028/U+2029
      // line/paragraph separators, U+202F narrow NBSP, U+205F medium
      // math space, U+3000 ideographic space. (ZWSP U+200B is in
      // \p{Cf} and already stripped above.)
      /[\u00a0\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g,
      " ",
    );
}

/**
 * Build a regex that matches an N-word phrase where each word is
 * separated by zero or more `[-\s]` characters AND is bounded by
 * non-letter / non-number on both sides. Zero-or-more between stems
 * so compound forms like `tamperproof` and `cheatproof` are caught
 * with a single rule; Unicode word boundaries (`\p{L}\p{N}`) so that
 * unrelated longer words like `stamper proofreader` do NOT match
 * `tamper-proof`.
 */
function stem(...words: string[]): RegExp {
  const escaped = words.map((w) =>
    w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped.join("[-\\s]*")}(?![\\p{L}\\p{N}])`,
    "u",
  );
}

export interface BannedPattern {
  /** Human-readable label used in failure messages. */
  readonly label: string;
  /** Match against `normalize(text)`. */
  readonly regex: RegExp;
}

export const BANNED_H1H2_PATTERNS: readonly BannedPattern[] = [
  // ── Tamper / cheat / fraud / plagiarism claims ─────────────────────
  { label: "tamper-proof", regex: stem("tamper", "proof") },
  { label: "cheat-proof", regex: stem("cheat", "proof") },
  { label: "fraud-proof", regex: stem("fraud", "proof") },
  { label: "plagiarism-proof", regex: stem("plagiarism", "proof") },
  { label: "anti-cheat", regex: stem("anti", "cheat") },

  // ── Authorship claims (H1) ─────────────────────────────────────────
  { label: "verified authorship", regex: stem("verified", "authorship") },
  { label: "authorship verified", regex: stem("authorship", "verified") },
  { label: "proven authorship", regex: stem("proven", "authorship") },
  {
    label: "machine-verified authorship",
    regex: stem("machine", "verified", "authorship"),
  },
  {
    label: "session-verified solver",
    regex: stem("session", "verified", "solver"),
  },
  { label: "proves you wrote", regex: stem("proves", "you", "wrote") },
  {
    label: "verified that you wrote",
    regex: stem("verified", "that", "you", "wrote"),
  },
  { label: "guarantees you wrote", regex: stem("guarantees", "you", "wrote") },
  { label: "guaranteed authentic", regex: stem("guaranteed", "authentic") },

  // ── Mastery claims ─────────────────────────────────────────────────
  { label: "proven mastery", regex: stem("proven", "mastery") },
  { label: "certifies mastery", regex: stem("certifies", "mastery") },
  { label: "certified mastery", regex: stem("certified", "mastery") },

  // ── Outside-help claims (H2) ───────────────────────────────────────
  { label: "outside-help-free", regex: stem("outside", "help", "free") },

  // ── Third-party / independent verification claims ──────────────────
  { label: "independently verified", regex: stem("independently", "verified") },

  // ── Percentage claims ──────────────────────────────────────────────
  // "100% verified" / "100 percent verified" / "100  %  verified" / etc.
  // Bounded with the same Unicode word-boundary lookarounds stem() uses
  // so embedded-in-token forms like `score100% verified-by-x` don't
  // overmatch the leading `100`. `%` is not a letter/number so it does
  // not need an inner boundary.
  {
    label: "100% verified",
    regex: /(?<![\p{L}\p{N}])100\s*(%|percent)\s*verified(?![\p{L}\p{N}])/u,
  },
];

/**
 * Back-compat label-only export. Useful for documentation / error
 * messages that need the canonical list of phrase labels but don't
 * need the regexes.
 */
export const BANNED_H1H2_LABELS: readonly string[] = BANNED_H1H2_PATTERNS.map(
  (p) => p.label,
);
