/**
 * Phase 49 — Disclosure copy guard (Phase 54 normalized-pattern edition).
 *
 * The "How Atlas Grades" page is the single learner-facing surface that
 * documents the honest-claim ceiling H3. Three things must always be
 * true on this page:
 *
 *   1. It exists and renders (it is the route operators link new
 *      learners to from onboarding and the workspace).
 *   2. It explicitly states the limits of what automated checks prove
 *      (no claim of independent authorship, no claim of no-outside-help,
 *      no claim of mastery).
 *   3. It does NOT contain H1/H2 overclaim language — the regex patterns
 *      in `lib/banned-h1h2-phrases.ts` are banned from the copy because
 *      they would imply guarantees our mechanism does not support.
 *
 * If this test fails, fix the page copy — do NOT weaken the guard.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Router as WouterRouter } from "wouter";
import HowAtlasGrades from "./how-atlas-grades";
import { BANNED_H1H2_PATTERNS, normalize } from "../lib/banned-h1h2-phrases";

function renderPage() {
  return render(
    <WouterRouter>
      <HowAtlasGrades />
    </WouterRouter>,
  );
}

describe("How Atlas Grades — Phase 49 disclosure", () => {
  it("renders the page heading", () => {
    renderPage();
    expect(screen.getByTestId("how-atlas-grades-heading")).toBeInTheDocument();
    expect(screen.getByTestId("how-atlas-grades-heading").textContent).toMatch(/grade/i);
  });

  it("renders all four required sections", () => {
    renderPage();
    expect(screen.getByTestId("how-atlas-grades-what-we-check")).toBeInTheDocument();
    expect(screen.getByTestId("how-atlas-grades-signed-runs")).toBeInTheDocument();
    expect(screen.getByTestId("how-atlas-grades-what-not-proven")).toBeInTheDocument();
    expect(screen.getByTestId("how-atlas-grades-fallback")).toBeInTheDocument();
  });

  it("explicitly disclaims independent-authorship and no-outside-help proof", () => {
    renderPage();
    const limits = screen.getByTestId("how-atlas-grades-what-not-proven");
    const text = limits.textContent ?? "";
    // Must explicitly mention that automated checks do not establish
    // authorship or outside-help-free work. Loose regex so we don't lock
    // ourselves into one phrasing.
    expect(text).toMatch(/(wrote.*yourself|independently)/i);
    expect(text).toMatch(/outside help/i);
    expect(text).toMatch(/mastery/i);
  });

  it("does not contain H1/H2 overclaim language anywhere on the page", () => {
    renderPage();
    // Normalize the rendered DOM text so Unicode dashes / NBSP can't
    // sneak in. Source of truth: `src/lib/banned-h1h2-phrases.ts`.
    const body = normalize(document.body.textContent ?? "");
    for (const { label, regex } of BANNED_H1H2_PATTERNS) {
      if (regex.test(body)) {
        throw new Error(
          `Banned phrase "${label}" detected on /how-atlas-grades. ` +
            `Fix the page copy — do NOT weaken the guard.`,
        );
      }
      expect(body).not.toMatch(regex);
    }
  });

  it("describes the signed runtime captures pilot scope honestly", () => {
    renderPage();
    const signed = screen.getByTestId("how-atlas-grades-signed-runs");
    const text = signed.textContent ?? "";
    expect(text).toMatch(/pilot/i);
    expect(text).toMatch(/(output.*matched|matched.*expected)/i);
    // Should be clear the signature is self-issued, not third-party-verified.
    expect(text).toMatch(/atlas/i);
  });

  it("explains the soft-fail fallback so learners are not alarmed by it", () => {
    renderPage();
    const fallback = screen.getByTestId("how-atlas-grades-fallback");
    const text = fallback.textContent ?? "";
    expect(text).toMatch(/(unavailable|hiccup|not.*pilot|not configured)/i);
    expect(text).toMatch(/(still goes through|existing grading)/i);
  });
});
