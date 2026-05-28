/**
 * Phase 54 — H1/H2 normalized banned-pattern source-level guard.
 *
 * Phase 53 introduced this guard with exact-substring matching across 7
 * user-facing source files. Phase 54 upgrades the matching to the
 * normalized regex patterns in `banned-h1h2-phrases.ts`, which catch:
 *   - Unicode hyphen variants (U+2010..U+2015, U+2212, fullwidth, etc.)
 *   - whitespace variants (NBSP, zero-width, line wraps)
 *   - case variation
 *   - hyphen-vs-space variants (`tamper proof` and `tamper-proof` both)
 *   - common phrase variants
 *
 * Trade-off (unchanged from Phase 53): source-level grep does NOT catch
 * runtime-composed strings (server-returned copy, i18n keys, string
 * concatenation across lines that breaks the regex). For those, the
 * server-side audit lives separately. Hardcoded literals are by far the
 * highest-risk category, and rendering each page would require mocking
 * Clerk / react-query / fetch — too brittle for a copy guard.
 *
 * If this test fails, FIX THE COPY — do NOT weaken the guard. If you
 * find a real-world evasion not caught by the existing patterns, ADD A
 * PATTERN in `banned-h1h2-phrases.ts`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BANNED_H1H2_PATTERNS, normalize } from "./banned-h1h2-phrases";

// Paths are relative to this test file's directory (src/lib/).
const GUARDED_FILES: readonly { label: string; path: string }[] = [
  { label: "certificate-print page", path: "../pages/certificate-print.tsx" },
  { label: "certificate verify page", path: "../pages/verify.tsx" },
  { label: "certificates listing page", path: "../pages/certificates.tsx" },
  { label: "marketing home page", path: "../pages/home.tsx" },
  {
    label: "workspace validation panel",
    path: "../components/studio/ValidationFeedbackPanel.tsx",
  },
  { label: "onboarding page", path: "../pages/onboarding.tsx" },
  {
    label: "api-server email templates",
    path: "../../../api-server/src/lib/email.ts",
  },
];

describe("H1/H2 normalized banned-pattern guard — user-facing surfaces", () => {
  for (const { label, path } of GUARDED_FILES) {
    it(`${label} contains no banned H1/H2 phrase`, () => {
      const abs = resolve(__dirname, path);
      const normalized = normalize(readFileSync(abs, "utf8"));
      for (const { label: phraseLabel, regex } of BANNED_H1H2_PATTERNS) {
        const match = normalized.match(regex);
        if (match) {
          // Build a context window so the failure message is actionable.
          const hit = match.index ?? 0;
          const start = Math.max(0, hit - 40);
          const end = Math.min(
            normalized.length,
            hit + match[0].length + 40,
          );
          const context = normalized
            .slice(start, end)
            .replace(/\s+/g, " ")
            .trim();
          throw new Error(
            `Banned phrase "${phraseLabel}" found in ${label} (${path}). ` +
              `Matched: "${match[0]}". Context: …${context}… ` +
              `Fix the copy — do NOT weaken the guard. See ` +
              `src/lib/banned-h1h2-phrases.ts for the H3 rationale.`,
          );
        }
        expect(match).toBeNull();
      }
    });
  }

  it("guards every high-risk surface category (refactor-drift sentinel)", () => {
    const labels = GUARDED_FILES.map((f) => f.label).join(" | ");
    for (const required of [
      "certificate-print",
      "verify",
      "certificates listing",
      "home",
      "workspace validation",
      "onboarding",
      "email",
    ]) {
      expect(labels).toContain(required);
    }
  });
});

describe("normalize() — Phase 54 dash/whitespace/control defenses", () => {
  it("lowercases", () => {
    expect(normalize("TAMPER-PROOF")).toBe("tamper-proof");
  });

  it("converts every Unicode dash variant to ASCII hyphen", () => {
    // U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure dash,
    // U+2013 en dash, U+2014 em dash, U+2015 horizontal bar,
    // U+2212 minus sign, U+FF0D fullwidth hyphen-minus.
    const variants = ["\u2010", "\u2011", "\u2012", "\u2013", "\u2014", "\u2015", "\u2212", "\uff0d"];
    for (const dash of variants) {
      expect(normalize(`tamper${dash}proof`)).toBe("tamper-proof");
    }
  });

  it("converts NBSP and narrow NBSP to regular space; strips ZWSP", () => {
    // U+00A0 NBSP, U+202F narrow NBSP → space.
    expect(normalize("tamper\u00a0proof")).toBe("tamper proof");
    expect(normalize("tamper\u202fproof")).toBe("tamper proof");
    // U+200B zero-width space is Cf-class → stripped entirely.
    expect(normalize("tamper\u200bproof")).toBe("tamperproof");
  });

  it("strips every Unicode format-control char (Phase 54 v2 evasion fix)", () => {
    // ZWJ U+200D, ZWNJ U+200C, word joiner U+2060, BOM U+FEFF,
    // soft hyphen U+00AD, LRM U+200E, RLM U+200F, bidi LRO/RLO/PDF
    // U+202D/E/C, isolates U+2066-9. All Cf → stripped.
    const controls = [
      "\u200c", "\u200d", "\u200e", "\u200f",
      "\u2060", "\ufeff", "\u00ad",
      "\u202a", "\u202b", "\u202c", "\u202d", "\u202e",
      "\u2066", "\u2067", "\u2068", "\u2069",
    ];
    for (const c of controls) {
      expect(normalize(`tamper${c}proof`)).toBe("tamperproof");
    }
  });

  it("NFKC-normalizes fullwidth letters to ASCII (Phase 54 v2 evasion fix)", () => {
    // ｔａｍｐｅｒ－ｐｒｏｏｆ (fullwidth letters U+FF54.. + fullwidth hyphen U+FF0D)
    expect(normalize("\uff54\uff41\uff4d\uff50\uff45\uff52\uff0d\uff50\uff52\uff4f\uff4f\uff46"))
      .toBe("tamper-proof");
    // ＴＡＭＰＥＲ（uppercase fullwidth）should also lowercase to ASCII.
    expect(normalize("\uff34\uff21\uff2d\uff30\uff25\uff32")).toBe("tamper");
  });
});

describe("BANNED_H1H2_PATTERNS — Phase 54 catches Phase 49 + new variants", () => {
  function matches(label: string, text: string): boolean {
    const pattern = BANNED_H1H2_PATTERNS.find((p) => p.label === label);
    if (!pattern) throw new Error(`unknown banned label: ${label}`);
    return pattern.regex.test(normalize(text));
  }

  it("catches the original Phase 49 list (no regression)", () => {
    expect(matches("tamper-proof", "Tamper-Proof Certificate")).toBe(true);
    expect(matches("tamper-proof", "tamperproof certificate")).toBe(true);
    expect(matches("cheat-proof", "cheat-proof grading")).toBe(true);
    expect(matches("cheat-proof", "cheatproof grading")).toBe(true);
    expect(matches("fraud-proof", "fraud-proof system")).toBe(true);
    expect(matches("anti-cheat", "Atlas uses anti-cheat methods")).toBe(true);
    expect(matches("verified authorship", "verified authorship of code")).toBe(true);
    expect(matches("proven authorship", "proven authorship across runs")).toBe(true);
    expect(matches("proves you wrote", "proves you wrote the solution")).toBe(true);
    expect(matches("guarantees you wrote", "guarantees you wrote it")).toBe(true);
    expect(matches("guaranteed authentic", "guaranteed authentic record")).toBe(true);
    expect(matches("proven mastery", "proven mastery of SQL")).toBe(true);
    expect(matches("certifies mastery", "certifies mastery of the topic")).toBe(true);
    expect(matches("plagiarism-proof", "plagiarism-proof record")).toBe(true);
    expect(matches("independently verified", "independently verified by a third party")).toBe(true);
    expect(matches("100% verified", "100% verified by Atlas")).toBe(true);
  });

  it("catches Unicode dash variants (Phase 54 new defense)", () => {
    expect(matches("tamper-proof", "tamper\u2011proof")).toBe(true);    // non-breaking hyphen
    expect(matches("tamper-proof", "tamper\u2013proof")).toBe(true);    // en dash
    expect(matches("tamper-proof", "tamper\u2014proof")).toBe(true);    // em dash
    expect(matches("anti-cheat", "anti\u2212cheat")).toBe(true);        // minus sign
  });

  it("catches hyphen-vs-space variants (Phase 54 new defense)", () => {
    expect(matches("tamper-proof", "tamper proof certificate")).toBe(true);
    expect(matches("cheat-proof", "cheat   proof system")).toBe(true);  // multi-space
    expect(matches("anti-cheat", "anti\u00a0cheat")).toBe(true);        // NBSP
  });

  it("catches Phase 54 new phrase variants", () => {
    expect(matches("authorship verified", "authorship verified by Atlas")).toBe(true);
    expect(matches("machine-verified authorship", "machine-verified authorship")).toBe(true);
    expect(matches("machine-verified authorship", "machine verified authorship")).toBe(true);
    expect(matches("session-verified solver", "session-verified solver")).toBe(true);
    expect(matches("verified that you wrote", "we verified that you wrote it")).toBe(true);
    expect(matches("certified mastery", "certified mastery of Python")).toBe(true);
    expect(matches("outside-help-free", "outside-help-free record")).toBe(true);
    expect(matches("outside-help-free", "outside help free completion")).toBe(true);
  });

  it("catches 100-percent variants", () => {
    expect(matches("100% verified", "100 % verified")).toBe(true);
    expect(matches("100% verified", "100  percent  verified")).toBe(true);
    expect(matches("100% verified", "100%verified")).toBe(true);
  });

  it("does NOT overmatch 100% verified embedded inside larger tokens", () => {
    // The boundary on the leading `100` prevents matches inside digit
    // sequences like score IDs / version numbers; the trailing boundary
    // prevents matches like "verifiedly" / "verifiedness".
    expect(matches("100% verified", "score2100% verifiedly tested")).toBe(false);
    expect(matches("100% verified", "v100% verifiedness")).toBe(false);
  });

  it("does NOT match the disclosure page's negative phrasing", () => {
    // how-atlas-grades.tsx says things like "It does not prove that you
    // wrote the code yourself" and "It does not certify mastery". These
    // must NOT trip the guard — they are the canonical honest copy.
    expect(matches("proves you wrote", "It does not prove that you wrote the code")).toBe(false);
    expect(matches("certifies mastery", "It does not certify mastery of the concepts")).toBe(false);
    expect(matches("certified mastery", "It does not certify mastery of the concepts")).toBe(false);
  });

  it("does NOT overmatch inside unrelated words (Phase 54 v2 boundary fix)", () => {
    // Word-boundary lookarounds prevent matches inside larger letter
    // sequences. These are deliberately constructed adversarial cases.
    expect(matches("tamper-proof", "stamper proofreader review")).toBe(false);
    expect(matches("cheat-proof", "uncheatproofly behavior")).toBe(false);
    expect(matches("anti-cheat", "anticheating norm")).toBe(false);
    expect(matches("proven mastery", "improven masteryless")).toBe(false);
    // Forward-tense future phrasing on home.tsx must not match anything.
    expect(matches("verified authorship", "verifies authorship-tracking workflows")).toBe(false);
  });

  it("catches Phase 54 v2 evasions: ZWJ + fullwidth bypass attempts", () => {
    // The two specific bypasses called out at architect review.
    expect(matches("tamper-proof", "tamper\u200dproof")).toBe(true);  // ZWJ between stems
    expect(matches("tamper-proof", "tamper\u200cproof")).toBe(true);  // ZWNJ between stems
    expect(matches("tamper-proof", "\uff54\uff41\uff4d\uff50\uff45\uff52\uff0d\uff50\uff52\uff4f\uff4f\uff46")).toBe(true);  // full fullwidth
    expect(matches("anti-cheat", "anti\ufeffcheat")).toBe(true);      // BOM between stems
    expect(matches("verified authorship", "verified\u00adauthorship")).toBe(true);  // soft hyphen
  });
});
