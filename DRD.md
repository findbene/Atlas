# Atlas — Design Requirements Document (DRD)

**Version:** 1.0
**Status:** Authoritative reference for testable design acceptance criteria.
**Scope:** Design requirements lens — binary pass/fail acceptance criteria for every design area. Visual language rationale → DESIGN.md. Product scope → PRD.md. Architecture → ARD.md. Technical NFRs → TRD.md §10.
**Last updated:** 2026-06-05

> **How to use this document.** Each requirement is stamped with an ID, a priority (P0 = beta release gate, P1 = beta target, P2 = planned/post-beta), an imperative statement, and a binary acceptance criterion a reviewer can confirm with a pass/fail check. Rationale is not restated here — see DESIGN.md for the reasoning behind each design decision.

---

## Table of Contents

1. [Global UI](#1-global-ui)
2. [Accessibility](#2-accessibility)
3. [Studio Layout and Behavior](#3-studio-layout-and-behavior)
4. [Validation and Remediation UI](#4-validation-and-remediation-ui)
5. [Learning-Mode UX](#5-learning-mode-ux)
6. [Ada Tutor UI](#6-ada-tutor-ui)
7. [Honesty and Trust UI](#7-honesty-and-trust-ui)
8. [Progress and Motivation](#8-progress-and-motivation)
9. [PWA and Performance UX](#9-pwa-and-performance-ux)
10. [Content and Catalog UI](#10-content-and-catalog-ui)
11. [Beta Release Gate — P0 Checklist](#11-beta-release-gate--p0-checklist)

---

## 1. Global UI

**DRD-GLOBAL-01** (P0) — The application must ship with a functional dark theme and a functional light theme, switchable at runtime without a page reload.
Acceptance: Reviewer toggles ThemeToggle; the `dark` class moves from present to absent on `<html>` (or vice versa); all panels, the Studio, and every modal/sheet recolor correctly within the current frame with no flash of incorrect theme.

**DRD-GLOBAL-02** (P0) — The theme preference must persist across sessions.
Acceptance: Reviewer sets dark mode, closes the browser tab, reopens the app; the dark theme is active without requiring the user to re-toggle.

**DRD-GLOBAL-03** (P0) — Every color token defined in DESIGN.md §3.1 must satisfy WCAG 2.1 AA contrast thresholds in both themes independently: 4.5:1 for normal text against its background, 3:1 for large text (18px+ regular or 14px+ bold) and UI component boundaries.
Acceptance: Automated contrast audit (e.g., axe-core or Storybook a11y addon) reports zero contrast failures on the token set in both themes.

**DRD-GLOBAL-04** (P0) — The application must render correctly at three breakpoints: mobile (≤ 640px), tablet (641–1024px), and desktop (≥ 1025px). No horizontal scrollbar must appear at the target viewport width for each breakpoint.
Acceptance: Reviewer opens each primary surface (home, catalog, dashboard, studio, certificate) at each breakpoint width; no content overflows the viewport horizontally; no horizontal scrollbar is present.

**DRD-GLOBAL-05** (P0) — On mobile breakpoints, the Studio must switch from the three-column ResizablePanelGroup to a tab-based layout.
Acceptance: At viewport width ≤ 640px, the Studio renders as a tabbed interface (not side-by-side panels); all panels (Instructions, Editor, Output, Validation, Ada) are reachable via tab switching.

**DRD-GLOBAL-06** (P0) — Every interactive element must have a minimum touch target of 44×44 CSS pixels on mobile viewports.
Acceptance: DevTools device emulation at 375px width; reviewer inspects bounding boxes on toolbar buttons, tab items, and nav links; all measure at least 44×44px in effective tap area.

**DRD-GLOBAL-07** (P0) — All loading states must render a visible skeleton or spinner rather than blank content areas.
Acceptance: Reviewer throttles network to Slow 3G; navigating to the dashboard, catalog, and studio shows placeholder skeletons (not empty white space) while data loads.

**DRD-GLOBAL-08** (P0) — All error states (API failure, network loss, not-found routes) must render an informative message and at least one recovery action (e.g., Retry, Go home).
Acceptance: Reviewer triggers a 500 error on the dashboard API and a 404 route; each shows a message that identifies the problem and offers a labeled action; no "undefined" or raw JSON is displayed to the user.

**DRD-GLOBAL-09** (P0) — All empty states (zero items in a list, no completions yet, no run history) must render a message and, where applicable, a primary action to leave the empty state.
Acceptance: Reviewer creates a fresh account; visits dashboard (no completions), run history sheet (no runs), and certificates page (no certs); each shows a purposeful empty-state message, not a blank panel.

**DRD-GLOBAL-10** (P1) — All shadcn/ui components must be used without patching or forking their internal markup or Radix primitives. Atlas customization must be limited to className overrides, wrapping components, or additional props.
Acceptance: Code review confirms no direct edits to files inside the shadcn component source beyond the permitted extension pattern described in DESIGN.md §4.1.

**DRD-GLOBAL-11** (P1) — Icons must be sourced exclusively from `lucide-react`. No other icon library may be imported.
Acceptance: `grep -r "import.*from 'react-icons\|from '@heroicons\|from 'phosphor"` returns zero matches in `artifacts/atlas/src/`.

**DRD-GLOBAL-12** (P1) — All spacing values must resolve to Tailwind's 4px-base scale. No inline `style` properties with arbitrary pixel values for spacing.
Acceptance: Code review finds no `style={{ margin: '...' }}` or `style={{ padding: '...' }}` with non-token values in Studio or global layout components.

---

## 2. Accessibility

*WCAG 2.1 AA is the target for beta. Hard numeric thresholds: 4.5:1 for normal text; 3:1 for large text (18px+ regular, 14px+ bold) and non-text UI components (borders, icons, focus rings). Cross-reference: TRD.md §10.4.*

**DRD-A11Y-01** (P0) — All text/background color pairs in the rendered UI must meet a minimum contrast ratio of 4.5:1 (normal text) or 3:1 (large text and non-text UI) in both dark and light themes.
Acceptance: axe-core automated scan on the home, catalog, studio (guided mode), and certificate pages returns zero WCAG AA contrast violations in both themes.

**DRD-A11Y-02** (P0) — The entire Studio — including the Monaco editor, EditorToolbar (Run, Check, Submit), StepChecklist, ValidationFeedbackPanel, ModeSelector, and AiTutorPanel toggle — must be fully operable by keyboard alone.
Acceptance: Reviewer navigates the Studio exclusively with Tab, Shift+Tab, Enter, Space, and Arrow keys; every actionable element is reachable and activatable; no interactive element is keyboard-unreachable.

**DRD-A11Y-03** (P0) — Focus indicators must be visible on every interactive element. The default shadcn/ui ring focus style must not be suppressed with `outline: none` or `outline: 0` unless a custom visible focus indicator of equivalent visibility replaces it.
Acceptance: Reviewer tabs through each primary surface; every focused element has a visible ring or border change that is distinguishable from the unfocused state; no focus indicator is invisible.

**DRD-A11Y-04** (P0) — Every interactive element that lacks a visible text label must carry an `aria-label` or `aria-labelledby` that fully describes its purpose.
Acceptance: axe-core reports zero "Interactive element has no accessible name" violations on the Studio, Navbar, and onboarding pages.

**DRD-A11Y-05** (P0) — The ValidationFeedbackPanel and OutputPanel must be marked as live regions so screen readers announce updates when new validation or run results arrive.
Acceptance: Code review confirms `role="status"` or `aria-live="polite"` on ValidationFeedbackPanel and OutputPanel root elements; reviewer using a screen reader (NVDA or VoiceOver) hears the new validation result announced after submitting.

**DRD-A11Y-06** (P0) — The ExecutionModeChip must carry an `aria-label` that describes both the execution environment and the validation kind in plain language (e.g., "Execution: Pyodide, Grading: contains").
Acceptance: Code review confirms the `aria-label` attribute is present and includes both pieces of information; axe-core reports no label violation on this element.

**DRD-A11Y-07** (P0) — All framer-motion animations must respect `prefers-reduced-motion: reduce`. When this media query is active, animations must either be skipped entirely or reduced to an instantaneous opacity change with no translate or scale movement.
Acceptance: Reviewer enables "Reduce motion" in OS accessibility settings; reloads the app; navigates between routes, opens the Ada panel, and completes a step; no translate or scale animation plays; fade-only or instant transitions are acceptable.

**DRD-A11Y-08** (P0) — The Monaco editor must have an accessible label identifying it as a code editor for the current step.
Acceptance: Code review confirms Monaco's `aria-label` prop is set (e.g., "Code editor — Step 3: Aggregate revenue"); axe-core reports no label violation on the editor container.

**DRD-A11Y-09** (P0) — When a dialog (SolutionDialog) or sheet (RunHistorySheet) opens, focus must move to the dialog/sheet; when it closes, focus must return to the triggering element.
Acceptance: Reviewer opens and closes SolutionDialog using keyboard only; focus moves into the dialog on open and returns to the "Show solution" button on close; no focus is lost to the document body.

**DRD-A11Y-10** (P1) — The StepChecklist must be implemented as an ordered list (`<ol>`) with list items (`<li>`) for each step. Completed steps must communicate their state to screen readers via `aria-current` or a visually-hidden label.
Acceptance: Code review confirms `<ol>` wraps the checklist; each step item has an accessible completed/pending state; screen reader announces "Step 2: Filter by region, completed" for a completed step.

**DRD-A11Y-11** (P1) — The CountUp animation on the dashboard must render the final numeric value immediately when `prefers-reduced-motion: reduce` is active, with no counting animation.
Acceptance: Reviewer enables reduced motion; opens dashboard; the XP counter displays the final value without animating from zero.

**DRD-A11Y-12** (P1) — All tooltip content (shadcn/ui Tooltip primitive) must be accessible to keyboard users — tooltips must trigger on focus as well as on hover.
Acceptance: Reviewer keyboard-focuses the ExecutionModeChip, ModeSelector buttons, and icon-only toolbar buttons; the tooltip appears for each without requiring a mouse hover.

**DRD-A11Y-13** (P1) — The StreakHeatmap grid must have an accessible label and each active cell must expose its data to screen readers (e.g., via `aria-label` on the cell or a visually-hidden description).
Acceptance: Screen reader user navigating the StreakHeatmap grid hears the date and submission count for each non-empty cell without requiring visual inspection.

**DRD-A11Y-14** (P2) — An accessibility statement page must exist that documents known Monaco editor limitations and the platform's WCAG 2.1 AA compliance posture.
Acceptance: A publicly accessible `/accessibility` page exists; it names Monaco as a component with known screen-reader limitations and describes any workarounds or caveats.

---

## 3. Studio Layout and Behavior

**DRD-STUDIO-01** (P0) — The Studio must render all required panels in the correct reading order on desktop: StudioTopBar, StepChecklist (left sidebar), InstructionsPanel, EditorPanel, OutputPanel, ValidationFeedbackPanel, RemediationPanel (on fail), AiTutorPanel (when toggled), DatasetRefsBar.
Acceptance: DOM order inspection confirms panels appear in the order listed; Tab key traversal follows this order from top-left to bottom-right without requiring explicit `tabindex` overrides.

**DRD-STUDIO-02** (P0) — The Run button, Check button, and Submit button must be visually distinct from each other in icon, label, and visual weight.
Acceptance: Reviewer inspects the EditorToolbar; Run uses `Play` icon + "Run" label + `variant="outline"`; Check uses `FlaskConical` icon + "Check" label + `variant="secondary"`; Submit uses `SendHorizonal` icon + "Submit" label + `variant="default"` (brand fill); all three are simultaneously visible and distinguishable without color alone.

**DRD-STUDIO-03** (P0) — The Submit button must be disabled (not merely hidden) when the current step has not yet received a provisional pass from /check.
Acceptance: Reviewer loads a fresh step (no check result); the Submit button is rendered with `disabled` attribute; clicking it produces no action; the tooltip or adjacent label explains why it is disabled.

**DRD-STUDIO-04** (P0) — The OutputPanel must render three distinct states: stdout/result output (when a run has completed successfully), stderr output (when a run produced an error), and an empty/initial state (before the first run on a step).
Acceptance: Reviewer runs code that produces stdout; then runs code that produces stderr; then loads a new step with no run history; all three states render differently and are identifiable without hovering.

**DRD-STUDIO-05** (P0) — When a step contains tabular data output (SQL result set), the OutputPanel must render it as a structured table, not as raw text.
Acceptance: Reviewer submits a SQL query returning rows; the OutputPanel renders a table with column headers and data rows; the table is scrollable horizontally if it exceeds the panel width.

**DRD-STUDIO-06** (P0) — Resuming a project at a step the learner has previously visited must not cause a visible flicker or blank panel while the step data loads.
Acceptance: Reviewer submits step 2, navigates to step 3, returns to step 2; no blank white flash is visible during the transition; panels re-render with previous state visible or a smooth skeleton transition.

**DRD-STUDIO-07** (P0) — The Studio URL must deep-link to a specific step using a URL parameter or path segment (e.g., `/projects/:slug?step=2`).
Acceptance: Reviewer copies the URL while on step 3; opens it in a new browser tab (same auth session); the Studio loads at step 3, not step 1.

**DRD-STUDIO-08** (P0) — The DatasetRefsBar must list all dataset references for the current step and provide a link or mechanism to inspect each dataset.
Acceptance: On a step with declared `dataset_refs`, the DatasetRefsBar renders the dataset filenames and at least one way to view or reference each (link, inline preview, or preview trigger).

**DRD-STUDIO-09** (P1) — The SolutionDialog must be gated: it must require either a prior passing submission on the current step or an explicit acknowledgment from the learner before revealing the solution.
Acceptance: Reviewer opens SolutionDialog on a step with no prior passing submission; a confirmation step (not the solution itself) is shown first; reviewer must take an affirmative action before the solution renders.

**DRD-STUDIO-10** (P1) — The RunHistorySheet must display the learner's last runs (up to 20) for the current step, including code, stdout/stderr, and pass/fail status.
Acceptance: Reviewer runs code three times; opens RunHistorySheet; sees three entries in reverse chronological order with code preview, output, and pass/fail indicator per entry.

**DRD-STUDIO-11** (P1) — The EditorToolbar vertical separator must visually group the primary workflow actions (Run, Check, Submit) apart from the utility actions (Run History, Solution).
Acceptance: A visible separator (`|` divider or equivalent) appears between Submit and the Run History button in the EditorToolbar; reviewer can identify the two groups without reading labels.

**DRD-STUDIO-12** (P1) — The StudioTopBar must remain visible and statically positioned at all times during a Studio session; it must not scroll off-screen.
Acceptance: Reviewer scrolls the InstructionsPanel content to the bottom; the StudioTopBar remains at the top of the viewport throughout.

---

## 4. Validation and Remediation UI

**DRD-VAL-01** (P0) — A passing validation result and a failing validation result must be visually distinct using at minimum: icon (CircleCheck vs. CircleX), color (emerald vs. red), and label text ("Step passed" vs. "Step failed").
Acceptance: Reviewer produces a pass and a fail on the same step; compares both states; can identify pass vs. fail without reading the body copy, using color alone, or using icon alone — all three signals must be present simultaneously.

**DRD-VAL-02** (P0) — A /check result (provisional) must be visually distinguished from a /submit result (committed). The provisional result must include a "(provisional)" label or equivalent indicator in the ValidationFeedbackPanel.
Acceptance: Reviewer runs Check; sees "(provisional)" or equivalent text in the ValidationFeedbackPanel; then runs Submit (pass); the provisional label is absent from the committed result.

**DRD-VAL-03** (P0) — XP earned must only appear in the ValidationFeedbackPanel on a committed (/submit) pass, never on a provisional (/check) pass.
Acceptance: Reviewer checks (provisional pass); no XP amount is displayed; reviewer submits (committed pass); XP amount appears.

**DRD-VAL-04** (P0) — Confetti, particle effects, or full-screen celebration animations must never play on a /check result, regardless of pass/fail.
Acceptance: Reviewer achieves a provisional pass via Check; no confetti, particle, or full-screen overlay animation plays; the celebration is limited to the ValidationFeedbackPanel state change only.

**DRD-VAL-05** (P0) — Confetti or equivalent celebration animation may only play on a committed (/submit) pass. No celebration animation plays on a /submit fail.
Acceptance: Reviewer submits a passing step; a celebration animation (scale pulse on checkmark) plays; reviewer submits a failing step on a separate step; no celebration animation plays.

**DRD-VAL-06** (P0) — The RemediationPanel must be present and visible only when the most recent validation result is a fail. It must not render on pass, on initial load (before any check/submit), or in an empty state.
Acceptance: Reviewer inspects the Studio on initial load (no RemediationPanel present); produces a pass (no RemediationPanel); produces a fail (RemediationPanel appears); produces a subsequent pass (RemediationPanel disappears).

**DRD-VAL-07** (P0) — In independent mode, the RemediationPanel must NOT echo the expected output string or provide an exact diff. It must provide only: the length of the expected output, the length of the actual output, and the index of the first divergence.
Acceptance: Reviewer in independent mode produces a fail on an `exact` or string-validated step; inspects the RemediationPanel; confirms: (a) the expected string is not present; (b) a length comparison is present; (c) a first-divergence index is present.

**DRD-VAL-08** (P0) — In guided or hint mode, the RemediationPanel may show full diagnostic information including expected vs. actual values where applicable, per DESIGN.md §5.4.
Acceptance: Reviewer in guided mode produces a fail; the RemediationPanel shows specific expected vs. actual detail (not suppressed).

**DRD-VAL-09** (P1) — The ValidationFeedbackPanel must display a "Submit when ready" CTA only when the current state is provisional pass (passed /check, not yet submitted).
Acceptance: Reviewer produces a provisional pass; "Submit when ready" CTA is visible; reviewer submits; CTA is no longer shown; reviewer checks a fresh step (fail); CTA is not shown.

**DRD-VAL-10** (P1) — Validation feedback copy must be specific (it must reference the nature of the failure, not a generic "something went wrong") for all validation types that produce structured feedback (contains, json_equal, csv_set_equal, exact).
Acceptance: Reviewer produces a fail on a `contains`-validated step; the feedback message identifies what was checked (e.g., "Expected string not found in output") rather than a generic error message.

---

## 5. Learning-Mode UX

**DRD-MODE-01** (P0) — The ModeSelector must be present in the StudioTopBar on every Studio session, offering all four modes: Guided, Hint, Independent, and "Choose for me" (Adaptive).
Acceptance: Reviewer opens any project step in the Studio; all four mode options are visible and selectable from the StudioTopBar without opening a settings panel.

**DRD-MODE-02** (P0) — Switching learning modes must not flicker, blank, or hide any panel content that was already visible before the switch.
Acceptance: Reviewer reveals a hint in guided mode, then switches to independent mode; the revealed hint remains visible; no panel blinks or briefly disappears; the mode switch is instantaneous.

**DRD-MODE-03** (P0) — Switching learning modes must not clobber (remove or reset) any hint already revealed on the current step.
Acceptance: Reviewer reveals hint level 2 in hint mode, switches to guided mode, switches back to hint mode; hint level 2 is still visible without requiring re-reveal.

**DRD-MODE-04** (P0) — In independent mode, the hint ladder must not be visible until the learner has at least one failed /check result on the current step.
Acceptance: Reviewer is in independent mode with no prior check attempts on the current step; the hint ladder and "Reveal hint" button are not rendered; reviewer produces one failed check; the hint ladder becomes accessible.

**DRD-MODE-05** (P0) — In guided mode, the "Ask Ada" CTA must be visible at the top of the InstructionsPanel, requiring at most one click to open the Ada tutor.
Acceptance: Reviewer is in guided mode; the "Ask Ada" CTA or equivalent is visible in the InstructionsPanel without scrolling; clicking it opens the AiTutorPanel.

**DRD-MODE-06** (P0) — In independent mode, the "Ask Ada for a nudge" CTA must replace the "Reveal hint" button in the ValidationFeedbackPanel on a fail, and must not say "Reveal hint."
Acceptance: Reviewer in independent mode produces a fail; the ValidationFeedbackPanel shows "Ask Ada for a nudge" (or equivalent phrasing that does not promise to reveal the answer); no "Reveal hint" button is present.

**DRD-MODE-07** (P0) — In adaptive (dynamic_ai_adaptive) mode, a badge in the StudioTopBar must display the resolved underlying mode (guided, hint, or independent) so the learner can see what the system chose.
Acceptance: Reviewer selects "Choose for me"; a badge or label appears in the StudioTopBar naming the resolved underlying mode (e.g., "Guided" or "Independent"); it is updated if the system changes modes on a new step.

**DRD-MODE-08** (P1) — The "Choose for me" CTA in the ModeSelector must render below the four mode buttons only when the recommender's suggested mode differs from the current persisted mode.
Acceptance: Reviewer's current mode matches the recommender's suggestion; the "Choose for me" CTA is not displayed; reviewer switches to a mode that differs from the recommendation; "Choose for me" appears; reviewer clicks it; it applies the suggested mode and the CTA disappears.

**DRD-MODE-09** (P1) — Each ModeSelector button must carry an `aria-pressed` attribute reflecting whether it is the active mode.
Acceptance: Code review confirms `aria-pressed="true"` on the active mode button and `aria-pressed="false"` on inactive buttons; this updates when the mode changes.

**DRD-MODE-10** (P1) — Each ModeSelector button must have a tooltip (shadcn Tooltip) with a one-sentence description of what the mode does.
Acceptance: Reviewer hovers or focuses each mode button; a tooltip appears with a description; no tooltip is empty or identical across modes.

**DRD-MODE-11** (P1) — In independent mode, the RemediationPanel must not include the expected output value for `exact`, `contains`, or `json_equal` validated steps, regardless of whether the mode was switched from guided mid-step.
Acceptance: Reviewer starts in guided mode on an `exact` step, switches to independent mode, produces a fail; the RemediationPanel shows length and first-divergence index only, not the expected string.

---

## 6. Ada Tutor UI

**DRD-ADA-01** (P0) — The AiTutorPanel toggle button must be present in the StudioTopBar at every project step, using the `Bot` icon with an "Ada" label.
Acceptance: Reviewer opens any step in the Studio; the "Ada" toggle button (Bot icon + label) is visible in the StudioTopBar; it is not hidden by other elements.

**DRD-ADA-02** (P0) — The AiTutorPanel must slide in from the right on desktop (framer-motion, 250ms ease-out) and render as a full-height Sheet from the bottom on mobile (≤ 640px viewport).
Acceptance: Desktop: reviewer toggles Ada; panel slides in from the right in approximately 250ms; Mobile: reviewer toggles Ada; panel slides up from the bottom as a full-height Sheet.

**DRD-ADA-03** (P0) — The AiTutorPanel must not overlay or shrink the EditorPanel on desktop viewports where the panel group can accommodate both. If the viewport cannot accommodate both, the EditorPanel takes layout priority.
Acceptance: On a 1280px wide desktop viewport, reviewer opens Ada; the EditorPanel remains fully usable and is not obscured by the Ada panel; both panels are simultaneously visible.

**DRD-ADA-04** (P0) — While Ada is streaming a response, the message input must be disabled and the send button must change to a "Stop" button (Square icon) that aborts the SSE stream.
Acceptance: Reviewer sends a message to Ada; during streaming, the message input is disabled (non-typeable); the send button shows a Square icon; clicking it stops the stream.

**DRD-ADA-05** (P0) — A blinking cursor must be visible at the end of the last streamed token while Ada's response is in progress. No skeleton loader replaces the message content area during streaming.
Acceptance: Reviewer sends a message; the response area shows characters appearing progressively with a blinking cursor at the end; no skeleton replaces the text content during streaming.

**DRD-ADA-06** (P0) — Ada messages must render markdown, including code blocks with syntax highlighting and a copy button. Code blocks must not render mid-block (partial fence tokens must be buffered until the closing fence arrives).
Acceptance: Reviewer asks Ada a question that produces a code block in the response; the code block is fully rendered (not partially revealed) once it appears; it has syntax highlighting and a copy button.

**DRD-ADA-07** (P0) — If Ada is unreachable (network error or API error), the AiTutorPanel must display an inline error message in the chat, not a toast notification.
Acceptance: Reviewer simulates Ada API failure (e.g., disable network after opening Ada); a message appears inline in the chat (e.g., "Ada is unavailable right now. Try again in a moment."); no toast notification fires.

**DRD-ADA-08** (P0) — The AiTutorPanel header must display "Ada" as the panel name and a context line showing the current project title (e.g., "Your tutor for [project title]").
Acceptance: Reviewer opens Ada on a project; the panel header shows "Ada" and a sub-line with the project title; the sub-line does not say "AI Assistant" or "ChatBot."

**DRD-ADA-09** (P1) — User messages must be right-aligned with a brand-color background tint; Ada messages must be left-aligned with a surface-elevated background. Timestamps must appear below each message group in `text-xs text-muted-foreground`.
Acceptance: Visual inspection of the AiTutorPanel chat after a multi-turn conversation confirms the alignment and color rules; timestamps are present and styled correctly.

**DRD-ADA-10** (P1) — The AiTutorPanel must not auto-open on step load. It must remain closed by default until the learner explicitly toggles it.
Acceptance: Reviewer loads a step for the first time; the Ada panel is closed; the editor is the focused panel; no auto-open occurs.

**DRD-ADA-11** (P2) — In independent mode (pre-pass), Ada must not produce responses that reveal the solution code or walk through the solution logic step-by-step. This is enforced via the TutorContract system prompt; the UI must surface a context indicator that shows the current Ada mode (e.g., "Diagnostic mode" badge in the panel header).
Acceptance: Reviewer in independent mode opens Ada and sees a mode indicator ("Diagnostic mode" or equivalent); asks Ada for the solution; Ada's response does not include runnable solution code.

---

## 7. Honesty and Trust UI

**DRD-TRUST-01** (P0) — The following phrases must be absent from all learner-facing copy in the production UI: "verified authorship," "tamper-proof," "cheat-proof," "100% verified," "job guaranteed," "guaranteed to impress recruiters," and any equivalent overclaim. The phase-54 copy-safety CI gate is the enforcement mechanism; this requirement documents the design rule.
Acceptance: `check:copy-safety` CI script passes on the current codebase with zero violations; reviewer searches rendered UI text on certificate, verify, and portfolio pages for any of the banned phrases; none are found.

**DRD-TRUST-02** (P0) — Certificate copy must use approved language only: "verified completion record" or "evidence-backed project completion record." No other phrasing claiming verification of authorship or exclusivity of knowledge is permitted.
Acceptance: Reviewer views a completed certificate page and the public `/verify/:certId` page; the completion description uses one of the two approved phrasings; no alternate phrasing implying authorship verification is present.

**DRD-TRUST-03** (P0) — The ExecutionModeChip must be present on every gradeable project step in the StudioTopBar. It must not be hidden or optional.
Acceptance: Reviewer visits five gradeable steps across different validation types (contains, json_equal, exact, csv_set_equal, self_attest); the ExecutionModeChip is visible on each; it is not behind a toggle or hover-only reveal.

**DRD-TRUST-04** (P0) — The ExecutionModeChip must accurately display: (a) the execution environment (Pyodide / DuckDB / server-side) and (b) the validation kind (contains / json_equal / csv_set_equal / exact / regex / self_attest, etc.) for the current step.
Acceptance: Reviewer inspects the chip on a Python/contains step (shows "Pyodide | contains"), a SQL/json_equal step (shows "DuckDB | json_equal"), and a server-graded step; chip text matches the step's `validationType` and execution environment in each case.

**DRD-TRUST-05** (P0) — The public certificate verification page (`/verify/:certId`) must include a visible, legible link to the "How Atlas grades" explanation page. The link must not be smaller than `text-sm` or placed in a footnote below the fold.
Acceptance: Reviewer opens a public verify URL; locates the "How Atlas grades" link without scrolling; confirms it is at least `text-sm` size and not hidden in a footnote.

**DRD-TRUST-06** (P0) — A public "How Atlas grades" page must exist at a stable URL and must be linked from every certificate verification page.
Acceptance: Reviewer follows the "How Atlas grades" link from a verify page; the page loads (200 status) and describes the platform's grading mechanisms; the URL is stable and does not redirect to a marketing page.

**DRD-TRUST-07** (P0) — Hidden or unpublished content (archived projects, premium steps for non-subscribers) must return a 404 to unauthenticated and unauthorized users. The UI must not surface slugs, titles, or any existence signal for hidden content.
Acceptance: Reviewer requests the URL of an archived project without authentication; receives a 404 response; the page content does not name the project or hint at its existence; the link does not appear in the catalog or navigation for this user.

**DRD-TRUST-08** (P1) — The portfolio page (`/portfolio`) must display completion evidence per project (steps completed, XP earned, completion date) using only approved language. It must not use language implying independent authorship verification.
Acceptance: Reviewer views their portfolio; all project completion entries use approved language; no entry says "verified authorship" or equivalent.

**DRD-TRUST-09** (P1) — The StartHereCard and RecommendedStartHereCard must not use copy that implies a job placement guarantee or recruiter outcome promise.
Acceptance: Reviewer views onboarding step 2 and the dashboard recommended card; neither card contains phrases like "This project will get you hired" or "guaranteed job outcome."

---

## 8. Progress and Motivation

**DRD-PROG-01** (P0) — XP must be displayed in the Studio as an XP reward badge (e.g., "+150 XP") before submission, so the learner knows the reward before submitting.
Acceptance: Reviewer loads a step in the Studio; an XP reward amount is visible in the StudioTopBar or ValidationFeedbackPanel before any submission has been made.

**DRD-PROG-02** (P0) — XP earned must only be shown in the ValidationFeedbackPanel after a committed (/submit) pass. It must not appear after a /check pass or a /submit fail.
Acceptance: Reviewer produces a /check pass (no XP shown); a /submit fail (no XP shown); a /submit pass (XP amount shown); all three cases confirm the rule.

**DRD-PROG-03** (P0) — The dashboard must display: total XP, current streak count, StreakHeatmap, last in-progress project (with resume CTA), and list of completed projects.
Acceptance: Reviewer with at least one in-progress and one completed project loads the dashboard; all five data points are visible without scrolling on a 1280px desktop viewport.

**DRD-PROG-04** (P0) — The StreakHeatmap must render as a 52-week grid (7 columns × 52 rows layout orientation). Active days must be colored at graduated opacity based on submission count. Empty days must use a muted background.
Acceptance: Reviewer views the StreakHeatmap on the dashboard; it renders a full 52-week calendar grid; active days are visibly distinct from empty days; multiple submission counts within a week show opacity gradation.

**DRD-PROG-05** (P0) — The platform must not implement: daily login bonuses, "streak at risk" notifications, countdown timers for any engagement mechanic, or streak-break penalties.
Acceptance: Code review and UI review confirms none of these patterns exist; reviewer uses the platform for two days and observes no push notification, counter, or timer pressuring daily return.

**DRD-PROG-06** (P1) — The CountUp animation (dashboard XP total) must run once on mount, complete within 600ms, and be suppressed entirely when `prefers-reduced-motion: reduce` is active.
Acceptance: Reviewer (without reduced motion) loads the dashboard; XP counter animates from 0 to the total value, completing in approximately 600ms; reviewer enables reduced motion and reloads; XP displays the final value instantly with no animation.

**DRD-PROG-07** (P1) — The leaderboard must be accessible from navigation but must not be promoted on the dashboard as a primary motivation signal. The leaderboard must render as a ranked table (username, XP total, course focus) with no animated rank changes, trophies, or medals.
Acceptance: Reviewer opens the dashboard; no leaderboard ranking or position is shown; reviewer navigates to the leaderboard; it renders as a static table; no trophy icons, medal images, or animated rank transitions are present.

**DRD-PROG-08** (P1) — On final step project completion (committed pass with `projectComplete = true`), the completion animation must be limited to a scale pulse on the checkmark icon (scale 1 → 1.15 → 1, 200ms). No confetti, full-screen overlay, or sound effect may play.
Acceptance: Reviewer completes the final step of a project via /submit; the StepChecklist checkmark plays a brief scale pulse; no confetti, overlay, or audio plays; the next CTA ("View your completion record" / "Next project") appears within 300ms.

---

## 9. PWA and Performance UX

**DRD-PWA-01** (P1) — The application must have a valid web app manifest (via `vite-plugin-pwa`) that includes: name, short_name, icons at 192×192 and 512×512 (PNG, with maskable variants), `display: standalone`, `background_color: #09090b` (zinc-950), and a `theme_color`.
Acceptance: Chrome DevTools Application > Manifest panel shows all required fields; Lighthouse PWA audit reports no manifest errors; no installability-blocking fields are missing.

**DRD-PWA-02** (P1) — The InstallPrompt must appear as a non-intrusive bar at the bottom of the viewport (not a modal) when the browser fires `beforeinstallprompt`. It must be dismissible permanently.
Acceptance: Reviewer opens the app in a PWA-installable browser without prior dismissal; the install prompt appears as a bottom bar (not a centered modal); clicking "Not now" or equivalent dismisses it and it does not reappear on subsequent page loads in the same browser.

**DRD-PWA-03** (P1) — When Pyodide is loading for the first time on a step, the UI must display a progress indicator (progress bar or labeled spinner) in the OutputPanel or EditorPanel, not a blank or locked editor.
Acceptance: Reviewer clears browser cache and opens a Python step; the Pyodide loading state is visible and labeled (e.g., "Loading Python environment…"); the Run button is disabled during this period; the loading indicator resolves when Pyodide is ready.

**DRD-PWA-04** (P1) — When DuckDB-WASM is loading for the first time on a SQL step, the UI must display a progress indicator in the OutputPanel, not a blank or locked editor.
Acceptance: Same test pattern as DRD-PWA-03 applied to a SQL step; loading state is visible and labeled; resolves when DuckDB is ready.

**DRD-PWA-05** (P2) — The app shell (Navbar, routing, page chrome) must be served from the service worker cache when offline, so previously visited pages load without a network request to the application server.
Acceptance: Reviewer visits the dashboard while online; goes offline (DevTools > Network > Offline); refreshes the dashboard; the page shell loads from cache; a "You're offline" banner is shown; no blank screen or browser error page appears.

**DRD-PWA-06** (P2) — The Studio in offline mode must display a visible "You're offline — reconnect to run and submit" banner. The Run and Submit buttons must be disabled while offline.
Acceptance: Reviewer opens a project step while online, goes offline, attempts to run code; the offline banner is visible; Run and Submit buttons are disabled; no silent failure or ambiguous state is shown.

**DRD-PWA-07** (P1) — Page transitions between routes must complete within a perceived time of 300ms on a standard desktop connection (no artificial throttling). The PageTransition fade+translate animation must not extend beyond 300ms.
Acceptance: Reviewer uses Chrome Performance profiler; navigates between home → catalog → studio; the route transition animation completes within 300ms; no jank or dropped frames are visible in the recording.

---

## 10. Content and Catalog UI

**DRD-CAT-01** (P0) — Every project card in the catalog must display a DifficultyBadge using one of the three approved tiers: beginner (sky), intermediate (amber), advanced (red). The badge must use the difficulty text label in addition to color.
Acceptance: Reviewer views the catalog; every project card shows a difficulty badge with a text label ("Beginner," "Intermediate," or "Advanced"); no card shows a difficulty color without a label.

**DRD-CAT-02** (P0) — The catalog must support filtering by difficulty tier. The DifficultyFilter must function as a multi-select control and update the visible project list without a full page reload.
Acceptance: Reviewer selects "Beginner" in the DifficultyFilter; only beginner projects are shown; reviewer selects "Intermediate" in addition; both tiers are shown; the list updates without a page reload.

**DRD-CAT-03** (P0) — The catalog must be organized by domain. Each domain section must be clearly labeled and visually distinct from adjacent domain sections.
Acceptance: Reviewer views the catalog; nine domain sections are present (matching the `atlas_course` enum); each is labeled with the domain name; a visual boundary (heading, divider, or card grouping) separates adjacent domains.

**DRD-CAT-04** (P1) — Each catalog domain section must display a "Start Here" or recommended entry project that is visually distinguished from standard project cards (e.g., a StartHereCard component with an "Enroll and start" CTA).
Acceptance: Reviewer views at least one domain section in the catalog; one project is marked as the entry point with a distinguishing visual treatment and a primary CTA; other projects in the section do not have the same treatment.

**DRD-CAT-05** (P1) — Prerequisite information, where declared, must be displayed on the project detail page or card before enrollment. Prerequisites must not be revealed only after a learner has enrolled.
Acceptance: On a project that has declared prerequisites, the project card or detail page shows the prerequisite project name(s) before the learner clicks "Enroll"; the information is visible without requiring enrollment or login.

**DRD-CAT-06** (P1) — The onboarding flow must have exactly three steps: (1) domain selection, (2) Start Here project preview, (3) auto-navigate to the Studio on enrollment. Step 1 must not allow proceeding without a domain selection.
Acceptance: Reviewer creates a new account; the onboarding flow presents step 1 (domain selection); the "Next" or "Continue" action is disabled until a domain is selected; completing step 2 enrollment navigates directly to the Studio at step 1 of the project.

**DRD-CAT-07** (P2) — The catalog must support a search input that filters projects by title or keyword without a full page reload.
Acceptance: Reviewer types a project keyword into the catalog search; the visible project list updates within 300ms to show matching projects only; clearing the input restores the full list.

---

## 11. Beta Release Gate — P0 Checklist

This checklist aggregates all P0 requirements. A build may not ship to beta until every item is marked pass. Rationale for each item is in the linked requirement.

**Sign-off sheet — reviewer initials + pass/fail + date for each item:**

| # | ID | Requirement (abbreviated) | Pass / Fail | Reviewer | Date |
|---|---|---|---|---|---|
| 1 | DRD-GLOBAL-01 | Dark + light themes switch without page reload | | | |
| 2 | DRD-GLOBAL-02 | Theme preference persists across sessions | | | |
| 3 | DRD-GLOBAL-03 | All token color pairs meet WCAG AA contrast (both themes) | | | |
| 4 | DRD-GLOBAL-04 | No horizontal overflow at mobile/tablet/desktop breakpoints | | | |
| 5 | DRD-GLOBAL-05 | Studio uses tab layout at ≤ 640px viewport | | | |
| 6 | DRD-GLOBAL-06 | Touch targets ≥ 44×44px on mobile | | | |
| 7 | DRD-GLOBAL-07 | Skeleton/spinner on all loading states | | | |
| 8 | DRD-GLOBAL-08 | Informative error states with recovery action | | | |
| 9 | DRD-GLOBAL-09 | Purposeful empty states with action where applicable | | | |
| 10 | DRD-A11Y-01 | Zero axe-core contrast violations (both themes, key pages) | | | |
| 11 | DRD-A11Y-02 | Studio fully keyboard operable | | | |
| 12 | DRD-A11Y-03 | Visible focus indicators everywhere | | | |
| 13 | DRD-A11Y-04 | Zero "no accessible name" violations on interactive elements | | | |
| 14 | DRD-A11Y-05 | ValidationFeedbackPanel + OutputPanel are live regions | | | |
| 15 | DRD-A11Y-06 | ExecutionModeChip has aria-label for both execution env + grading kind | | | |
| 16 | DRD-A11Y-07 | All framer-motion animations respect prefers-reduced-motion | | | |
| 17 | DRD-A11Y-08 | Monaco editor has accessible aria-label | | | |
| 18 | DRD-A11Y-09 | Dialog/sheet focus managed on open and close | | | |
| 19 | DRD-STUDIO-01 | All Studio panels present in correct reading order | | | |
| 20 | DRD-STUDIO-02 | Run / Check / Submit visually distinct (icon + label + weight) | | | |
| 21 | DRD-STUDIO-03 | Submit disabled when no provisional pass | | | |
| 22 | DRD-STUDIO-04 | OutputPanel renders stdout / stderr / empty states distinctly | | | |
| 23 | DRD-STUDIO-05 | Tabular SQL output rendered as table, not raw text | | | |
| 24 | DRD-STUDIO-06 | No flicker on step resume | | | |
| 25 | DRD-STUDIO-07 | Studio URL deep-links to specific step | | | |
| 26 | DRD-STUDIO-08 | DatasetRefsBar lists all dataset refs with view mechanism | | | |
| 27 | DRD-VAL-01 | Pass vs. fail: icon + color + text label all present | | | |
| 28 | DRD-VAL-02 | Provisional (/check) vs. committed (/submit) visually distinct | | | |
| 29 | DRD-VAL-03 | XP shown only on committed pass, never on provisional | | | |
| 30 | DRD-VAL-04 | No confetti/celebration on /check results | | | |
| 31 | DRD-VAL-05 | Celebration only on /submit pass, not on /submit fail | | | |
| 32 | DRD-VAL-06 | RemediationPanel only on fail, absent on pass and initial load | | | |
| 33 | DRD-VAL-07 | Independent mode: no expected-output echo, no exact diff in remediation | | | |
| 34 | DRD-VAL-08 | Guided/hint mode: full diagnostic in remediation | | | |
| 35 | DRD-MODE-01 | ModeSelector present with all 4 modes on every step | | | |
| 36 | DRD-MODE-02 | Mode switch causes no flicker or panel blank | | | |
| 37 | DRD-MODE-03 | Mode switch does not clobber revealed hints | | | |
| 38 | DRD-MODE-04 | Independent mode: hint ladder hidden until first failed check | | | |
| 39 | DRD-MODE-05 | Guided mode: "Ask Ada" CTA visible in InstructionsPanel | | | |
| 40 | DRD-MODE-06 | Independent mode: "Ask Ada for a nudge" replaces hint button on fail | | | |
| 41 | DRD-MODE-07 | Adaptive mode: resolved underlying mode badge in StudioTopBar | | | |
| 42 | DRD-ADA-01 | Ada toggle button present in StudioTopBar at every step | | | |
| 43 | DRD-ADA-02 | Ada slides in from right (desktop) / Sheet from bottom (mobile) | | | |
| 44 | DRD-ADA-03 | Ada panel does not overlay or shrink EditorPanel (desktop) | | | |
| 45 | DRD-ADA-04 | Message input disabled + Stop button during Ada streaming | | | |
| 46 | DRD-ADA-05 | Blinking cursor during streaming; no skeleton for message content | | | |
| 47 | DRD-ADA-06 | Ada renders markdown with syntax-highlighted, copy-buttonable code blocks | | | |
| 48 | DRD-ADA-07 | Ada errors show inline in chat, not as toast | | | |
| 49 | DRD-ADA-08 | Ada panel header shows "Ada" + project title context line | | | |
| 50 | DRD-TRUST-01 | Banned overclaim phrases absent from all learner-facing copy | | | |
| 51 | DRD-TRUST-02 | Certificate copy uses only approved "verified completion record" language | | | |
| 52 | DRD-TRUST-03 | ExecutionModeChip present on every gradeable step, not hidden | | | |
| 53 | DRD-TRUST-04 | ExecutionModeChip accurately reflects execution env + validation kind | | | |
| 54 | DRD-TRUST-05 | "How Atlas grades" link visible and legible on verify page | | | |
| 55 | DRD-TRUST-06 | "How Atlas grades" page exists at stable URL | | | |
| 56 | DRD-TRUST-07 | Hidden content returns 404; no existence leak in UI | | | |
| 57 | DRD-PROG-01 | XP reward badge visible before submission | | | |
| 58 | DRD-PROG-02 | XP earned shown only on committed pass | | | |
| 59 | DRD-PROG-03 | Dashboard shows XP, streak, heatmap, resume CTA, completed list | | | |
| 60 | DRD-PROG-04 | StreakHeatmap renders 52-week grid with opacity gradation | | | |
| 61 | DRD-PROG-05 | No dark patterns: no login bonus, no streak panic, no countdown timers | | | |
| 62 | DRD-CAT-01 | Every project card has difficulty badge with text label | | | |
| 63 | DRD-CAT-02 | Catalog difficulty filter is multi-select and updates list without reload | | | |
| 64 | DRD-CAT-03 | Catalog organized by domain with clear section labels | | | |

---

## Cross-Document References

| Topic | Document |
|---|---|
| Visual language rationale, design philosophy, component intent | DESIGN.md |
| Technical NFRs (accessibility, performance budgets, security) | TRD.md §10 |
| Product feature scope and personas | PRD.md |
| Architecture decisions and rationale | ARD.md |
| Copy-safety enforcement (banned phrases, CI gate) | docs/phases/phase-54-copy-safety-hardening.md |
| Mode-aware workspace behavior | docs/phases/phase-33-mode-aware-project-workspace-ux.md |
| Ada tutor contract | docs/phases/phase-34-ada-tutor-step-contract.md |
| Independent-mode no-leak design | DESIGN.md §6.2 |
| Check vs. Submit state machine | docs/phases/phase-24-check-vs-submit-state-machine.md |
| Difficulty badges and filters | docs/phases/phase-16-difficulty-badges-and-filters.md |

---

*This document contains only testable, binary requirements. It does not contain design rationale (see DESIGN.md), product scope decisions (see PRD.md), or technical implementation detail (see TRD.md). When a requirement in this document conflicts with an implementation phase document, this document states what must be true in the shipped product; the phase document records implementation history.*
