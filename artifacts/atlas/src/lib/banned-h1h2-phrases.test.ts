/**
 * Phase 53 — H1/H2 banned-phrase source-level guard.
 *
 * The DOM-scan guard in `pages/how-atlas-grades.test.tsx` only covers the
 * one disclosure page. This test extends coverage to every other
 * high-visibility user-facing surface by grepping the file source. It
 * catches hardcoded literal copy that crosses the H3 ceiling, without
 * needing to render each page (which would require mocking Clerk, query
 * client, fetch, etc. — too brittle for a copy guard).
 *
 * Trade-off: this won't catch runtime-composed strings (e.g. copy built
 * from i18n keys or server responses). For those, the server side has
 * separate audits. Hardcoded literals are by far the highest-risk
 * surface category, so this guard catches the cases that matter most.
 *
 * If this test fails, FIX THE COPY — do NOT weaken the guard.
 *
 * Note: runs in the default jsdom env (matches the rest of the atlas
 * suite — the setup file relies on `Element`). Node fs/path are still
 * available, so we read source files directly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BANNED_H1H2_PHRASES } from "./banned-h1h2-phrases";

// Paths are relative to this test file's directory (src/lib/).
// Each entry is a user-facing surface scanned for H1/H2 overclaim copy.
const GUARDED_FILES: readonly { label: string; path: string }[] = [
  { label: "certificate-print page", path: "../pages/certificate-print.tsx" },
  { label: "certificate verify page", path: "../pages/verify.tsx" },
  { label: "certificates listing page", path: "../pages/certificates.tsx" },
  { label: "marketing home page", path: "../pages/home.tsx" },
  { label: "workspace validation panel", path: "../components/studio/ValidationFeedbackPanel.tsx" },
  { label: "onboarding page", path: "../pages/onboarding.tsx" },
  { label: "api-server email templates", path: "../../../api-server/src/lib/email.ts" },
];

describe("H1/H2 banned-phrase guard — user-facing surfaces", () => {
  for (const { label, path } of GUARDED_FILES) {
    it(`${label} contains no banned H1/H2 phrase`, () => {
      const abs = resolve(__dirname, path);
      const source = readFileSync(abs, "utf8").toLowerCase();
      for (const phrase of BANNED_H1H2_PHRASES) {
        // Use indexOf so the failure message shows which phrase tripped.
        const hit = source.indexOf(phrase);
        if (hit !== -1) {
          // Build a small context window for the failure message.
          const start = Math.max(0, hit - 40);
          const end = Math.min(source.length, hit + phrase.length + 40);
          const context = source.slice(start, end).replace(/\s+/g, " ");
          throw new Error(
            `Banned phrase "${phrase}" found in ${label} (${path}). ` +
              `Context: …${context}… ` +
              `Fix the copy — do not weaken this guard. See ` +
              `src/lib/banned-h1h2-phrases.ts for the H3 rationale.`,
          );
        }
        expect(hit).toBe(-1);
      }
    });
  }

  it("guards at least one file in every high-risk surface category", () => {
    // Sanity check: if a refactor moves a surface, this test surfaces it.
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
