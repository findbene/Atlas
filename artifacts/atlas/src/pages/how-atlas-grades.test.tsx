/**
 * Phase 49 — Disclosure copy guard.
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
 *   3. It does NOT contain H1/H2 overclaim language — the words and
 *      phrases below are banned from the copy because they would
 *      imply guarantees our mechanism does not support.
 *
 * If this test fails, fix the page copy — do NOT weaken the guard.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Router as WouterRouter } from "wouter";
import HowAtlasGrades from "./how-atlas-grades";
import { BANNED_H1H2_PHRASES } from "../lib/banned-h1h2-phrases";

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
    const body = document.body.textContent?.toLowerCase() ?? "";
    // Banned: any wording that would imply a stronger guarantee than
    // "the output matched what was expected and the record was issued
    // by Atlas." Each entry would constitute an H1/H2 overclaim.
    // Source of truth: `src/lib/banned-h1h2-phrases.ts`.
    for (const phrase of BANNED_H1H2_PHRASES) {
      expect(body).not.toContain(phrase);
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
