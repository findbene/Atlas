# Atlas — Design System & Product Design

**Version:** 1.0
**Status:** Authoritative reference for visual design, brand, and UX intent.
**Scope:** Design lens — brand, visual language, component system, UX patterns, motion, accessibility.
Product scope → PRD.md. Architecture rationale → ARD.md. Technical implementation → TRD.md.
Testable design requirements and acceptance criteria → DRD.md (references this doc for rationale).
**Last updated:** 2026-06-05

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Brand and Tone](#2-brand-and-tone)
3. [Visual Language](#3-visual-language)
4. [Component System](#4-component-system)
5. [The Studio Experience](#5-the-studio-experience)
6. [Learning-Mode UX](#6-learning-mode-ux)
7. [Ada Tutor Design](#7-ada-tutor-design)
8. [Key Flows](#8-key-flows)
9. [Progress and Motivation Design](#9-progress-and-motivation-design)
10. [Accessibility and PWA Intent](#10-accessibility-and-pwa-intent)

---

## 1. Design Philosophy

### 1.1 Six Brand Attributes

These six words define how Atlas must feel to a learner at every moment of use. They are ordered intentionally — each one constrains the one that follows.

**Serious.** Atlas competes for real career outcomes. The interface does not use cartoons, mascots, or celebratory animations that belong on a consumer gaming app. Seriousness is conveyed through considered typography, disciplined whitespace, and the absence of visual noise. Every pixel earns its place.

**Premium.** The learner is investing time and money. The interface should feel worth that investment — not expensive for the sake of ornament, but polished to the degree that the learner trusts the platform is built with care. Premium means no rough edges: consistent spacing, type that reads cleanly at small sizes, states that are handled rather than ignored, components that feel finished.

**Technical.** The primary audience is engineers and career switchers trying to become engineers. The interface must be at home with code. Monaco editors, terminal-style output panels, execution status labels, and validation results are first-class UI, not awkward intrusions. Code blocks use monospace type with syntax highlighting. Dataset references are rendered clearly. The workspace feels like a serious development tool.

**Calm.** Learners working through hard technical problems are already in a state of moderate cognitive load. The interface does not compete for attention. Colors are muted. Animations are purposeful and brief. Nothing blinks, rotates, or pulses unless it is communicating a meaningful state change. Error states are informative, not alarming. The overall emotional register is composed.

**Trustworthy.** Trust is built across many small decisions. Validation results say what they actually checked, not what would be most flattering. Certificates are described accurately. Ada does not pretend to know things she does not know. The interface acknowledges its own limits — a step that could not be auto-graded says so, rather than pretending to verify what it cannot. Every honesty decision in the product has a corresponding design expression.

**Accessible.** A technically capable learner who relies on assistive technology or works in a low-vision environment should not be excluded. Accessible contrast is a design constraint, not an afterthought. Keyboard navigation works across the entire Studio. Focus indicators are visible. Reduced-motion preferences are respected. See Section 10 for intent; hard criteria are in DRD.md.

### 1.2 Six Design Principles

**Clarity over decoration.** When a decorative choice conflicts with readability or comprehension, readability wins. This applies at every scale: an icon that is ambiguous gets a text label; a chart that requires a legend gets simpler data; a transition that takes attention away from the content gets shortened or removed.

**Confidence without overclaiming.** This principle is load-bearing for the business. Atlas's primary differentiator is honest validation — the platform says exactly what it checks and what it does not. The design must reinforce this posture. Labels on certificates say "verified completion record" and "evidence-backed project completion," never "verified authorship," "tamper-proof," or "cheat-proof." The ExecutionModeChip honestly labels how a step is graded. A public "how Atlas grades" page exists and is linked from verification pages. Every piece of copy that could be read as an overclaim is a design bug, not a marketing opportunity. This matters because recruiters and hiring managers will eventually develop pattern recognition for platforms that overclaim — when that happens, Atlas's honest positioning becomes a competitive advantage. The design earns long-term trust by accepting short-term restraint.

**Code and workspace first.** The Studio is the product. The Monaco editor, the output panel, the validation feedback panel — these are the surfaces that learners spend the most time with. Navigation, marketing copy, and informational chrome exist to support the Studio, not the reverse. When making layout decisions, ask which arrangement puts the learner's code and its results in the most prominent position.

**Accessible contrast.** Color is never the only signal. Status is communicated through color plus icon plus text label, not color alone. Every foreground/background color combination in the design system is checked against WCAG contrast requirements. The dark theme is not a visual shortcut — it must meet the same bar as the light theme.

**Strong progress feedback.** The learner must always know where they are and what happens next. Step progress is surfaced in the checklist and the top bar. Validation results are unambiguous. XP earned is acknowledged. Submissions produce durable evidence that the learner can see immediately. The design never leaves a learner in an ambiguous "did that work?" state.

**No gamification that undermines credibility.** XP, streaks, and progress visuals are present because they provide useful feedback about consistent practice. They are not designed to exploit variable-reward psychology. There are no daily login bonuses, no achievement badges for trivial actions, no countdown timers, no push notifications pressuring re-engagement. The StreakHeatmap is a calm historical view, not a pressure mechanism. The leaderboard is an optional surface, not the primary motivation. This constraint is tied directly to the target audience: career switchers evaluating Atlas for credibility will be repelled, not attracted, by casino-style engagement mechanics.

---

## 2. Brand and Tone

### 2.1 Voice Principles

Atlas speaks in three modes: instructional (project steps and hints), supportive (Ada, onboarding, error states), and factual (certificates, verification pages, copy-safety surfaces). The voice across all three shares these qualities:

**Calm.** Never urgent, never panicked. Error states explain what happened and what to try — they do not alarm. Progress acknowledgment is warm but not effusive.

**Precise.** Technical accuracy over colloquial simplicity. Terms are used correctly. If a concept has a proper name ("DuckDB," "Pyodide," "SSE stream"), the interface uses it rather than a vague approximation.

**Encouraging without hype.** "You completed this step" is correct. "You're crushing it!" is not. Positive reinforcement acknowledges real accomplishment; it does not manufacture enthusiasm. The XP number, the completed checkmark, and the step completion record are the reward — they do not need a superlative on top of them.

**Honest at the boundary.** When the platform cannot verify something, it says so in plain language. This is a non-negotiable brand requirement. Copy that slides into overclaim territory ("This proves you wrote this code," "Guaranteed to impress recruiters") is a product defect. See the copy-safety guardrails in phase 54 documentation.

### 2.2 Honesty as a Design Material

Honesty is not only a legal or compliance concern — it is expressed visually and structurally throughout the interface.

**ExecutionModeChip** is a first-class UI component that labels how a step is graded: Pyodide (in-browser Python), DuckDB (in-browser SQL), server-side, or a grading kind like `contains` or `json_equal`. Learners can read exactly how their submission will be evaluated before they submit.

**Check vs. Submit distinction** is a visual and interaction design requirement, not just an API concern. The Run button, Check button, and Submit button must be visually distinct in weight, color, and labeling, because their consequences differ: running produces local output, checking is provisional and does not create a completion record, submitting creates a durable completion record. The validation feedback panel communicates whether a result is provisional or committed.

**Certificate and portfolio copy** uses "verified completion record" and "evidence-backed project completion" as the standard phrasing. The design system includes a copy checklist tied to this: any surface that surfaces completion data must use approved language. This is maintained in the copy-safety gate in the CI pipeline (phase 54 `check:copy-safety`).

**"How Atlas grades" page** is linked from every certificate verification page. The design positions this link as part of the honest disclosure, not fine print — it should be visible and legible, not hidden at the bottom in a 10px footnote.

### 2.3 Tone by Surface

| Surface | Tone | Example |
|---|---|---|
| Project step instructions | Direct, instructional, precise | "Write a SQL query that returns the top 10 customers by revenue, ordered descending." |
| Hint | Guiding, not revealing | "Consider which aggregate function you need to total revenue per customer." |
| Ada (guided mode) | Warm, step-specific, Socratic | "You're close — what does GROUP BY do to the rows before the aggregate runs?" |
| Ada (independent mode, pre-pass) | Diagnostic, non-revealing | "What output did you expect? What did you actually get?" |
| Validation pass | Factual, affirmative | "Step passed. Your query returned the correct result." |
| Validation fail | Specific, constructive | "Your output has 10 rows but the first column values don't match. Check your ORDER BY direction." |
| Certificate | Formal, precise | "Evidence-backed project completion record for [Project Title]." |
| Error state | Plain, actionable | "Couldn't connect to the execution environment. Refresh and try again." |

---

## 3. Visual Language

### 3.1 Color Philosophy

Atlas uses a restrained palette built around dark-first design. The primary usage context is a code workspace where learners may spend hours. Dark backgrounds reduce eye strain in sustained use and are the conventional environment for professional development tools. Light mode is a first-class citizen, not an afterthought, because accessibility and user preference both demand it.

**Semantic color roles** (expressed as design tokens mapped to Tailwind CSS 4 custom properties):

```
--color-background          Base page background (dark: zinc-950 / light: white)
--color-surface             Panel and card backgrounds (dark: zinc-900 / light: zinc-50)
--color-surface-elevated    Dialogs, popovers, dropdowns (dark: zinc-800 / light: white)
--color-border              Subtle separators (dark: zinc-800/60 / light: zinc-200)
--color-text-primary        Body text (dark: zinc-100 / light: zinc-900)
--color-text-secondary      Metadata, labels, captions (dark: zinc-400 / light: zinc-500)
--color-text-muted          Placeholder, disabled (dark: zinc-600 / light: zinc-400)

--color-brand               Atlas primary (indigo-600 / indigo-500 in dark)
--color-brand-subtle        Brand tint for backgrounds (indigo-950/40 dark / indigo-50 light)

--color-success             Pass states (emerald-500)
--color-success-subtle      Pass background tint (emerald-950/30 dark / emerald-50 light)
--color-error               Fail states (red-500)
--color-error-subtle        Fail background tint (red-950/30 dark / red-50 light)
--color-warning             Caution states (amber-500)
--color-warning-subtle      Caution tint (amber-950/30 dark / amber-50 light)
--color-info                Informational (sky-500)
--color-info-subtle         Info tint (sky-950/30 dark / sky-50 light)

--color-xp                  XP reward accent (amber-400)
--color-code-surface        Monaco editor background (zinc-950 dark / zinc-50 light)
```

**Color usage rules:**

- Status states (pass, fail, warning, info) always combine color with an icon and a text label. Color alone is never the sole signal.
- Decorative color use is minimal. Color draws attention; use it where the learner should look, not as decoration.
- The brand color (indigo) is reserved for primary actions and navigation. It should not appear in content, step instructions, or feedback panels, where it would compete with status signals.
- XP amber is used only for XP-related UI: the XP badge, the XP earned display, the XP counter in the dashboard summary.

### 3.2 Typography

The type system is built for two reading contexts that must coexist: prose reading (instructions, hints, Ada responses) and code reading (Monaco editor, output panels, inline code references).

**Scale (Tailwind utilities, mapped to tokens):**

| Role | Size | Weight | Usage |
|---|---|---|---|
| Page title | text-2xl (24px) | semibold | Page-level headings |
| Section heading | text-lg (18px) | semibold | Panel headings, dialog titles |
| Card heading | text-base (16px) | medium | Project card titles, step titles |
| Body | text-sm (14px) | regular | Instructions, hint text, descriptions |
| Label / meta | text-xs (12px) | medium | Badges, chips, timestamps, captions |
| Code inline | text-sm (14px), monospace | regular | Inline code, dataset references |
| Code block | text-sm (14px), monospace | regular | Monaco editor, output panel |

**Font families:**

- **System sans-serif** for all prose: `font-sans` (Tailwind default system stack). No custom typeface loading — avoids layout shift and keeps the bundle lean.
- **System monospace** for all code: `font-mono` (Tailwind default). Applied to Monaco editor, OutputPanel, InstructionsPanel code blocks, DatasetRefsBar, any inline `<code>` element.

**Reading rhythm:** Line height for prose is `leading-relaxed` (1.625). Code output uses `leading-normal` (1.5) to match terminal conventions. Instruction panels use `prose` utility from `@tailwindcss/typography` with overrides that enforce the Atlas type scale.

### 3.3 Spacing and Density

The Studio is a dense workspace. The space allocation decisions are:

- **Panels use tight internal padding** (`p-3` or `p-4`) because learners need to see as much content as possible without scrolling.
- **Borders replace margins** between panels: the ResizableHandle separates panels without consuming vertical space.
- **Top bar is compact** (`py-2.5`) because it is always visible and must not crowd the workspace below it.
- **Instructions and output use comfortable reading spacing** within their panels — the density is at the panel boundary, not inside the reading context.
- **Dialogs and sheets use standard shadcn/ui padding** (`p-6`) because they are transient surfaces, not persistent workspace panels.

Spacing scale follows Tailwind's 4px base unit. No custom spacing values — all spacing tokens map to the Tailwind scale (1=4px, 2=8px, 3=12px, 4=16px, 6=24px, 8=32px).

### 3.4 Iconography

All icons are from `lucide-react`. No mixing of icon libraries. Icon usage rules:

- **Size:** `h-4 w-4` (16px) for inline/button icons, `h-5 w-5` (20px) for standalone informational icons. No icon smaller than 14px in interactive contexts.
- **Pairing:** Every icon that carries semantic meaning (status, action) is paired with a visible text label or a tooltip. The tooltip must use the shadcn/ui `Tooltip` primitive, not a title attribute.
- **Semantic icons** used consistently across the system:

| Icon | Lucide name | Meaning |
|---|---|---|
| Run | `Play` | Execute code locally |
| Check | `FlaskConical` | Provisional validation (/check) |
| Submit | `SendHorizonal` | Committed submission (/submit) |
| Pass | `CircleCheck` | Validation passed |
| Fail | `CircleX` | Validation failed |
| Hint | `Lightbulb` | Hint available or requested |
| Ada | `Bot` | AI tutor |
| Step complete | `CheckCircle2` | Step in checklist completed |
| Step pending | `Circle` | Step in checklist not yet complete |
| Back | `ArrowLeft` | Navigation back to course |
| History | `History` | Run history |
| Solution | `KeyRound` | Gated solution dialog |
| Difficulty | `Gauge` | Difficulty badge |
| XP | `Zap` | XP reward |
| Streak | `Flame` | Active streak |
| Certificate | `Award` | Certificate/completion |

### 3.5 Motion

All animations use `framer-motion`. Motion serves two purposes: communicating state transitions and orienting the learner spatially. It does not serve decoration.

**Principles:**

- **Duration budget:** Panel transitions and page transitions: 200–300ms. Micro-interactions (button press, badge appear): 100–150ms. Longer than 350ms for a UI element is a design bug unless it is a full-page transition with a strong spatial metaphor.
- **Easing:** `ease-out` for elements entering the viewport (decelerate to rest). `ease-in` for elements leaving. `ease-in-out` for positional changes within the viewport.
- **No decorative animation:** Nothing animates unless it is communicating a state change (panel mounting, validation result arriving, mode switching, step completion). Background animations, idle animations, and attention-seeking loops are prohibited.
- **Reduced motion:** All animations must be suppressible via `prefers-reduced-motion: reduce`. The `PageTransition` component and any framer-motion usage must check this media query. See Section 10.

**Common patterns:**

- `PageTransition`: fade + subtle upward translate (`y: 8 → 0`, `opacity: 0 → 1`), 250ms ease-out. Wraps every route.
- Validation result panel: fade-in on mount when a result arrives, no animation while result is stable.
- Mode switch: no animation to the panel content itself (avoid flicker); the ModeSelector button state updates immediately via optimistic setState.
- Step completion celebration: a brief scale + fade on the checkmark icon in the StepChecklist, 200ms, no confetti or full-screen overlays.
- Ada panel opening: slide-in from right, 250ms ease-out.
- Sheet/dialog: shadcn/ui defaults (slide from bottom on mobile, fade+scale on desktop).

### 3.6 Design Tokens for Tailwind 4

Tailwind CSS 4 uses CSS custom properties natively. The Atlas token layer is maintained in `artifacts/atlas/src/index.css` under `@layer base`. Token naming follows the `--color-{role}` convention documented in Section 3.1. When shadcn/ui components reference `hsl(var(--background))`, Atlas tokens provide those values. The ThemeProvider class strategy (`dark` class on `<html>`) switches the token values.

Token categories:
- `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground` — shadcn base tokens
- `--primary`, `--primary-foreground` — brand color
- `--secondary`, `--secondary-foreground` — secondary actions
- `--muted`, `--muted-foreground` — disabled, metadata
- `--accent`, `--accent-foreground` — hover states
- `--destructive`, `--destructive-foreground` — error/destructive actions
- `--border`, `--input`, `--ring` — structural tokens
- `--radius` — border radius base (0.5rem = 8px; badges use 0.25rem)

Atlas-specific additions (prefixed `--atlas-`):
- `--atlas-color-success`, `--atlas-color-success-subtle`
- `--atlas-color-xp`, `--atlas-color-xp-subtle`
- `--atlas-color-code-bg`
- `--atlas-font-mono` (not overriding the system stack; only used as a standalone utility)

---

## 4. Component System

### 4.1 Foundation

The component system is built on shadcn/ui with Radix UI primitives. Approximately 28 `@radix-ui/react-*` packages are installed. The shadcn components are the building blocks; Atlas-specific components extend them with domain semantics.

**Extension pattern:** Atlas components wrap shadcn primitives, add Atlas-specific props and styling, and expose a consistent API. They do not fork or patch shadcn internals. When a shadcn component satisfies the need, it is used directly. New Atlas components are created only when domain semantics cannot be expressed through shadcn's composition model.

**File organization:** All Atlas-specific components live in `artifacts/atlas/src/components/`. Studio-specific components are scoped to `artifacts/atlas/src/components/studio/`.

### 4.2 Global Components

**Navbar** — top navigation bar present on all non-studio routes. Contains: logo/wordmark, primary nav links, ThemeToggle, user avatar/auth state. Does not appear inside the Studio (StudioTopBar replaces it in the workspace).

**PageTransition** — framer-motion wrapper applied to every route. Provides the fade+translate entrance on navigation. Must respect `prefers-reduced-motion`.

**ThemeProvider / ThemeToggle** — class-based dark/light switching. ThemeProvider sets the `dark` class on `<html>`. ThemeToggle is a compact icon button using `Sun`/`Moon` lucide icons. Available in the Navbar and optionally in the Studio top bar.

**DifficultyBadge / DifficultyFilter** — displays difficulty tier (beginner, intermediate, advanced). Badge variant: a compact colored label. Filter variant: a tab-style multi-select for the catalog page. Color mapping: beginner = sky, intermediate = amber, advanced = red — always with text label, never color alone.

**ExecutionModeChip** — the honesty label. Displays the grading mechanism for the current step: execution environment (Pyodide / DuckDB / server-side) and validation kind (contains / json_equal / csv_set_equal / exact / regex). This is a first-class component because it answers the learner's implicit question "how is this being graded?" before they submit. Positioned in the StudioTopBar at `ml-auto` (right-aligned). Must not be hidden or optional.

**InstallPrompt** — PWA install banner. Appears when the browser fires `beforeinstallprompt`. Designed as a low-friction bar at the bottom of the viewport, not a modal that interrupts the workflow. Can be dismissed permanently.

**CountUp** — animated number counter for XP and streak values on the dashboard. Uses framer-motion. Must respect `prefers-reduced-motion` by skipping the animation and rendering the final value immediately.

**StreakHeatmap** — GitHub-style contribution grid showing daily practice activity. Renders a calendar of 52 weeks. Active days use the brand color at varying opacity (1 session = low opacity, 3+ sessions = full brand color). Empty days use a muted background. No day labels by default; the week labels and month labels use `text-xs text-muted-foreground`. This is a calm historical view, not a pressure mechanism.

**RoadmapView** — visual display of a course's project sequence and dependencies. Uses a node-and-edge layout. Completed projects render with the success color and a checkmark; locked projects use muted colors.

**StartHereCard / RecommendedStartHereCard** — the primary CTA on the dashboard for a new learner. StartHereCard: a project card with an "Enroll and start" action. RecommendedStartHereCard: the same card with an additional "Recommended for you" label. These must not use language that implies a guarantee ("This project will get you hired").

### 4.3 Studio Components (Detailed in Section 5)

The Studio component inventory: StudioShell, StudioTopBar, InstructionsPanel, EditorPanel, EditorToolbar, OutputPanel, ValidationFeedbackPanel, RemediationPanel, ModeSelector, AiTutorPanel (sidebar), SolutionDialog, StepChecklist, RunHistorySheet, DatasetRefsBar.

### 4.4 Badges and Status Chips

Atlas uses three distinct visual units for labeling:

**shadcn Badge** — used for static metadata: difficulty, XP reward, course tag. Variant: `outline` for neutral labels (difficulty, course), styled `bg-amber-500/10 text-amber-400 border-amber-500/20` for XP.

**ExecutionModeChip** — domain-specific chip for execution and grading kind. Always rendered as a compact pill with two parts: the execution environment and the validation kind. Uses `text-xs`, monospace-weight label, and a neutral color (no status color — it is informational, not a status signal).

**Status indicator** — appears in ValidationFeedbackPanel and the StepChecklist. Uses icon + color + text, never color alone. Pass: `CircleCheck` in `text-emerald-500`. Fail: `CircleX` in `text-red-500`. Provisional: `FlaskConical` in `text-amber-400` with a "(provisional)" label.

---

## 5. The Studio Experience

### 5.1 Overview

The Studio is the core product surface. A learner spends the majority of their Atlas time here, moving through the steps of a project: reading instructions, writing code, running it, checking output, submitting. The design decisions in the Studio are the most consequential in the entire product.

### 5.2 Layout

The Studio uses a ResizablePanelGroup (from shadcn/ui `@/components/ui/resizable`) with a three-column layout on desktop. The learner can drag the ResizableHandle to adjust panel widths within bounds. On mobile, a tab-based layout replaces the side-by-side columns.

**Desktop layout (annotated ASCII):**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ STUDIO TOP BAR                                                               │
│  ← Course / Project Title    [Mode: Guided ▾]    [Pyodide | contains]  ···  │
├──────────────────────────────────────────────────────────────────────────────┤
│ STEP CHECKLIST (left sidebar, collapsible on ≤md)                            │
│  ☑ Step 1: Load the dataset                                                  │
│  ☑ Step 2: Filter by region                                                  │
│  ● Step 3: Aggregate revenue        ← current step (highlighted)             │
│  ○ Step 4: Export to CSV                                                     │
├────────────────────────┬─────────────────────────────┬───────────────────────┤
│ INSTRUCTIONS PANEL     │ EDITOR PANEL                 │ ADA TUTOR PANEL      │
│                        │  [Python ▾]  Run  Check  Sub │ (sidebar, toggled    │
│  Step 3: Aggregate     │ ─────────────────────────────│  via top-bar button) │
│  revenue               │  1 import pandas as pd       │                      │
│                        │  2 df = load_data()          │  Ada                 │
│  Instructions text...  │  3 result = df.groupby(...)  │  ─────────────────── │
│                        │  4                           │  You're grouping     │
│  [Hint available ▾]    │                              │  correctly. What     │
│                        │                              │  aggregate function  │
│  [Ask Ada ↗]  (guided) │                              │  do you need next?   │
├────────────────────────┤──────────────────────────────│                      │
│ VALIDATION FEEDBACK    │ OUTPUT PANEL                  │  [message input]     │
│  ✓ Step passed         │  > 10 rows returned          │  [Send]              │
│  XP +150               │  customer_id | revenue       │                      │
│  [Submit when ready]   │  ──────────── ──────────     │                      │
│                        │  C001        | 48200.00      │                      │
├────────────────────────┤──────────────────────────────┴───────────────────────┤
│ REMEDIATION PANEL      │ DATASET REFS BAR                                      │
│  (renders only on fail)│  Datasets: customers.csv · orders.csv · [View ↗]     │
└────────────────────────┴────────────────────────────────────────────────────────┘
```

**Panel reading order** (left to right, top to bottom):
1. StudioTopBar — orientation: where am I, what mode, how is this graded
2. StepChecklist — progress: what has been done, what is next
3. InstructionsPanel — task definition: what to do in this step
4. EditorPanel — work area: write the solution
5. OutputPanel — feedback on run: what the code produced
6. ValidationFeedbackPanel — feedback on check/submit: did it pass or fail
7. RemediationPanel — failure analysis: what was wrong (mode-dependent depth)
8. AiTutorPanel — contextual help: ask Ada (sidebar, toggled)
9. DatasetRefsBar — reference: what data is available

### 5.3 Run, Check, and Submit — Visual Distinction

These three actions have different consequences and must be visually distinct.

**Run** (`Play` icon, secondary variant, left of the toolbar group)
- Executes code locally in Pyodide/DuckDB. Produces output. Does not call any grading API. Does not create any record.
- Visual weight: `Button variant="outline"` with `Play` icon.
- Label: "Run"

**Check** (`FlaskConical` icon, secondary variant, center)
- Calls `/check` — provisional validation. Produces a grading result. Does not create a completion record. The result is labeled "(provisional)" in the ValidationFeedbackPanel.
- Visual weight: `Button variant="secondary"` with `FlaskConical` icon.
- Label: "Check"

**Submit** (`SendHorizonal` icon, primary variant, right of the toolbar group)
- Calls `/submit` — committed submission. Creates a durable completion record when passed. Earns XP. Updates the portfolio evidence.
- Visual weight: `Button variant="default"` (brand primary fill) with `SendHorizonal` icon.
- Label: "Submit"
- Gating: Submit is only enabled when the current step has been checked and passed (provisional pass). The ValidationFeedbackPanel surfaces a "Submit when ready" CTA in this state. This gating is enforced by the Phase-24 workspace state machine, not by the UI independently — the UI reflects the reducer state.

**EditorToolbar layout:**

```
[Run ▷]    [Check ⟁]    [Submit →]    |    [Run History]    [Solution (gated)]
```

The vertical separator `|` visually groups the primary workflow actions from the utility actions.

### 5.4 Validation Pass and Fail

**Pass state (ValidationFeedbackPanel):**

```
┌─────────────────────────────────────┐
│ ✓  Step passed                      │  ← emerald-500 icon + text
│                                     │
│    Your query returned the correct  │  ← factual, specific feedback
│    result. 10 rows, correct schema. │
│                                     │
│    +150 XP  (committed only)        │  ← amber-400 XP, hidden if provisional
│                                     │
│    [Submit when ready →]            │  ← only when provisional+passed
└─────────────────────────────────────┘
```

**Fail state (ValidationFeedbackPanel + RemediationPanel):**

```
┌─────────────────────────────────────┐
│ ✗  Step failed                      │  ← red-500 icon + text
│                                     │
│    Your output has the correct      │  ← specific, non-revealing feedback
│    number of rows but column        │    (depth depends on mode — see §6)
│    values differ.                   │
│                                     │
│    [Reveal hint ▸]   (guided/hint)  │  ← hidden in independent mode
│    [Ask Ada for a nudge]  (indep.)  │  ← shown instead in independent
└─────────────────────────────────────┘

┌─────────────────────────────────────┐  ← RemediationPanel (below, on fail)
│  Remediation                        │
│                                     │
│  Expected: 10 rows, got: 10 rows    │  ← guided/hint: full diff detail
│  First mismatch at row 3:           │    independent: lengths + first
│  expected 48200.00, got 4820.00     │    divergence only, no echo of
└─────────────────────────────────────┘    expected value
```

### 5.5 SolutionDialog — Gating

The solution is behind a deliberate gate: the learner must either have submitted the step at least once, or explicitly acknowledge they want to see the solution and accept that it will be noted. The dialog is opened via a secondary button in the toolbar. The gate is a brief confirmation step, not a multi-step form. The dialog header says "Show solution" — not "Cheat" or "Give up" (which would be judgmental) and not "Answer" (which implies passivity). "Solution" positions looking at it as a learning act.

---

## 6. Learning-Mode UX

The four learning modes produce meaningfully different experiences across three panels — InstructionsPanel, ValidationFeedbackPanel, RemediationPanel — and in Ada's behavior. Mode changes must not flicker existing revealed content, must not clobber already-revealed hints, and must feel immediate (optimistic update via the `useLearningMode` hook's CustomEvent bridge).

### 6.1 Mode Comparison

| UX dimension | Guided | Hint | Independent | Adaptive |
|---|---|---|---|---|
| InstructionsPanel | Fully expanded by default | Standard display | Long description collapsed behind disclosure; learner opens it | Defers to resolved underlying mode |
| "Ask Ada" CTA in instructions | Visible at top of panel, always one click away | Not pinned (standard Ada toggle) | Not shown proactively | Defers to resolved mode |
| Hint ladder | Available immediately | Available; learner chooses next level | Suppressed until at least one failed `/check` on this step | Defers to resolved mode |
| ValidationFeedbackPanel on fail | "Reveal hint" button shown | "Reveal hint" button shown | "Ask Ada for a nudge" button replaces hint reveal | Defers to resolved mode |
| RemediationPanel on fail | Full diagnostic: exact expected vs. actual where available | Full diagnostic | Dampened: lengths + first divergence index only; expected value not echoed | Defers to resolved mode |
| Ada system prompt mode | `proactive-scaffolded`: Ada offers to walk through the step | `progressive-hints`: Ada collapses hint ladder, encourages before giving next | `diagnostic-only` (pre-pass): Socratic only, no solution reveal; `review-permissive` (post-pass): can discuss solution | Resolves to a concrete underlying mode per request |
| "Choose for me" CTA | Visible if recommendation differs from current | Visible if recommendation differs | Visible if recommendation differs | N/A (this is the adaptive button) |
| Adaptive mode badge | n/a | n/a | n/a | Small badge in StudioTopBar naming resolved underlying mode |

### 6.2 The Independent-Mode No-Leak Rule

Independent mode exists to build transferable skill. A learner who has never failed can not claim to have truly solved the problem independently. The design enforces this:

1. **Hint ladder is suppressed** until the learner has at least one failed `/check` result on the current step. The "Reveal hint" button does not render. This is a frontend gate, enforced in InstructionsPanel via the `suppressPedagogyEscalation` predicate and the `hasFailedCheck` latch from StudioShell.

2. **Already-revealed hints stay visible** if the learner switches to independent mode mid-step. The `suppressLegacyReveal` predicate checks `showLegacyHint` before hiding. This prevents the jarring experience of content disappearing when the mode changes. (Implemented via the dual-predicate design in phase 33.)

3. **Remediation is dampened.** When a step uses exact-diff validation, the RemediationPanel in independent mode renders: "Expected: N chars, got: M chars. First divergence at index K." It does not echo the expected string. The learner gets diagnostic information sufficient to understand the shape of the error, without being given the answer.

4. **Ada is Socratic, not revealing.** The tutorContract `diagnostic-only` boundary is enforced in the AI system prompt: Ada may ask questions, point to documentation, describe what the output shape should look like — but may not show the solution or walk through the logic step by step. The phrase "Do NOT reveal the full solution" and "portfolio credibility" rationale are explicit in the contract. Post-pass (`review-permissive`), Ada can discuss the solution freely.

5. **This is a design rule, not only an implementation rule.** Any future change to feedback depth, hint availability, or Ada behavior in independent mode must be reviewed against this principle. The goal of independent mode is to produce real skill, which means the platform must not inadvertently give the answer away.

### 6.3 Mode Selector Design

The ModeSelector is a 4-button picker rendered in the StudioTopBar between the project title breadcrumb and the ExecutionModeChip. Each button:
- Has the mode name as its label
- Uses `aria-pressed` to communicate the current active mode
- Uses `Button variant="ghost"` for inactive modes, `variant="secondary"` for the active mode
- Has a tooltip describing what the mode does (one sentence, precise, no hype)

The "Choose for me" CTA renders below the 4 buttons only when:
- The recommender's suggested mode differs from the current persisted mode
- The reason code is not `stay-the-course`

This prevents button-flicker and decision fatigue. The CTA is a text button (`variant="link"`), visually subordinate to the mode buttons.

---

## 7. Ada Tutor Design

### 7.1 Presence and Position

Ada is present at every project step via the AiTutorPanel sidebar. The sidebar is toggled by a button in the StudioTopBar (`Bot` icon + "Ada" label). It is off by default and does not auto-open, because learners in independent mode especially should not be prompted toward AI assistance before they have attempted the problem.

The sidebar slides in from the right (framer-motion, 250ms ease-out). On mobile, it renders as a Sheet (full-height drawer from the bottom). The sidebar does not overlay the editor panel on desktop — it causes the ResizablePanelGroup to rebalance. On smaller viewports where the panel group cannot accommodate both, the editor takes priority and Ada renders in the sheet.

### 7.2 Streaming Feel

Ada responses are streamed via SSE (Server-Sent Events) from the backend. The design must reflect this:

- A blinking cursor (`|`) appears while the stream is in progress, positioned at the end of the last rendered token.
- Markdown is rendered progressively using `react-markdown` with `rehype-highlight` for code blocks. Code blocks appear complete once the closing fence token arrives; they do not render mid-block.
- The message input is disabled while Ada is streaming. The send button changes to a "Stop" button (using `Square` lucide icon) that aborts the SSE stream.
- No skeleton loaders for the message content — the cursor suffices. A skeleton is used only for the initial mount before the first message has been sent.

### 7.3 Mode-Aware Tone

Ada's behavior is controlled by the TutorContract system (phase 34). The design implications:

- In **guided mode** (`proactive-scaffolded`), Ada may open with an orientation to the step and proactively offer to walk through it. The "Ask Ada" CTA in InstructionsPanel is prominent.
- In **hint mode** (`progressive-hints`), Ada encourages the learner to use the hint ladder first and supplements rather than replaces it.
- In **independent mode, pre-pass** (`diagnostic-only`), Ada asks questions and points to documentation. She does not explain the solution. Ada's response in this mode should feel like a thoughtful senior engineer who refuses to just give the answer, but does engage with the learner's specific situation.
- In **independent mode, post-pass** (`review-permissive`), Ada can discuss the solution, compare approaches, and explain tradeoffs.
- In **adaptive mode**, the TutorContract resolves to a concrete underlying mode deterministically before the system prompt is built. Ada never receives the bare label `dynamic_ai_adaptive` in the prompt.

### 7.4 Personality and Boundaries

Ada is a calm, knowledgeable senior practitioner — not a cheerleader, not a search engine, not a code generation service. She is aware of the project context, the current step, the learner's mode, and the step's pedagogy intent. She does not use superlatives ("Great question!"). She does not generate complete solutions on request in independent mode. She does not hallucinate — when she does not know something specific to the learner's submission, she says so and redirects.

The AiTutorPanel header should say "Ada" (not "AI Assistant" or "ChatBot"). A single-line descriptor underneath: "Your tutor for [project title]." This keeps the context visible throughout the conversation.

### 7.5 Chat UI Conventions

- User messages: right-aligned, brand-color background tint, `rounded-2xl rounded-br-sm`
- Ada messages: left-aligned, surface-elevated background, `rounded-2xl rounded-bl-sm`
- Timestamps: `text-xs text-muted-foreground`, rendered below each message group, not inline
- Code in Ada responses: rendered in a styled code block with a copy button, monospace, syntax-highlighted
- Error state (Ada unreachable): an inline error message in the chat, not a toast. "Ada is unavailable right now. Try again in a moment."

---

## 8. Key Flows

### 8.1 Onboarding Flow

The onboarding flow is a 3-step wizard: course selection, project preview, enrollment.

```
/onboarding
  Step 1: Pick your course domain
    → 9 domain cards in a 3×3 grid
    → Each card: domain name, brief (2-sentence) description, difficulty indicator
    → No ability to proceed without selection
    → No "skip" on this step (selection is required)

  Step 2: Preview your Start Here project
    → StartHereCard for the recommended entry project in the selected domain
    → Project title, difficulty badge, step count, XP reward, brief scenario description
    → "Enroll and start" CTA (primary button)
    → "Pick a different course ←" secondary link

  Step 3: Workspace (auto-navigate after enrollment)
    → Project workspace opens at Step 1
    → First-time experience: InstructionsPanel is expanded, Mode defaults to Guided
    → No tutorial overlay — the workspace is self-explanatory by design
```

Server is the source of truth for onboarding state (`/api/onboarding/state`). There is no localStorage state. Already-completed users are bounced to `/dashboard` on mount.

### 8.2 Project Workspace Flow

```
/projects/:slug
  → Load project metadata + steps + current progress
  → StudioShell mounts with current step from user_progress
  → Learner reads instructions → writes code → Run → Check → revise → Submit
  → On Submit + pass: XP awarded, step marked complete, StepChecklist updates, 
    optional step-completion animation
  → On final step submit: project-complete celebration (brief, not intrusive)
  → CTA: "View your portfolio record" or "Next project in [course]"
```

**Check vs. Submit discipline in the flow:**
- Learner can Check as many times as needed. Results are provisional.
- Submit is enabled only after a Check pass (enforced by the workspace state machine).
- The ValidationFeedbackPanel makes the provisional/committed distinction explicit.

### 8.3 Evidence and Portfolio Flow

```
/certificates  →  list of completed projects with evidence chips
                  (steps completed, evidence hash count, XP earned, duration)
                  → "Verify" deep-link per certificate → /verify/:certId
                  → "Share on LinkedIn" / "Share on GitHub" (planned)

/verify/:certId  →  public page, no auth required
                    → Completion record: project title, learner name (username),
                      completion date, steps completed, evidence hash count
                    → "How Atlas grades" link (visible, legible)
                    → Certificate copy: "Evidence-backed project completion record"
                    → No authorship, tamper-proof, or cheat-proof language

/profile  →  compact evidence summary per completed project
             → "View portfolio →" link
```

The portfolio and certificate surfaces are the external-facing artifacts that recruiters may see. The design must be clean, professional, and honest. No decorative elements that inflate the impression. The evidence data speaks for itself.

### 8.4 Dashboard Flow

```
/dashboard
  → XP total (CountUp animation, brief)
  → Streak count + StreakHeatmap (historical view, calm)
  → Resume: last in-progress project card with "Continue →"
  → In-progress: list of started-but-not-complete projects
  → Completed: list of completed projects with evidence chips
  → RecommendedStartHereCard (only when 0 prior completions)
```

The dashboard is a status surface, not an engagement surface. It answers "where was I and what should I do next?" efficiently. It does not push the learner toward any action through urgency or manufactured scarcity.

---

## 9. Progress and Motivation Design

### 9.1 XP

XP is earned on committed submissions only. It is not earned on Check results. It is not earned for logging in, opening a project, or hitting a daily streak. This is a deliberate design decision tied to the credibility principle: XP should reflect real accomplishment.

XP is displayed:
- In the StudioTopBar as a badge (`+{xpReward} XP`) so the learner knows the reward before submitting
- In the ValidationFeedbackPanel as `+{xpEarned} XP` after a committed pass
- In the dashboard summary as a total (`{totalXP} XP`)
- In the certificate and portfolio evidence as `totalXpEarned` on each project

The CountUp animation on the dashboard is the only animated XP element. It runs once on mount, takes 600ms, and is suppressed by `prefers-reduced-motion`.

### 9.2 Streaks

A streak is a count of consecutive days with at least one committed submission. It is not incremented by checking, opening the app, or any other engagement signal.

**StreakHeatmap design:**
- 52-week GitHub-style grid, 7 columns (days) × 52 rows (weeks)
- Active days use the brand color (indigo) at graduated opacity: 1 submission = 20%, 2 = 50%, 3+ = 100%
- Empty days: `bg-muted` (very subtle)
- No day-of-week labels by default (reduces cognitive overhead in the compact grid)
- Month labels above the grid: 3-letter abbreviations, `text-xs text-muted-foreground`
- Tooltip on hover (shadcn Tooltip): "3 submissions on May 15, 2026"

**What streak does not do:**
- No daily login bonus
- No "streak at risk" notification
- No penalty for breaking a streak (the heatmap simply shows an empty day)
- No leaderboard position based on streak

### 9.3 Leaderboard

The leaderboard is an optional surface, accessible from the nav, not promoted on the dashboard. It ranks learners by total XP. The design is deliberately understated: a ranked table with username, XP total, and course focus. No trophies, no medals, no animated rank changes. Learners who prefer not to appear can set their profile to private (planned feature).

### 9.4 Project Completion

On the final step of a project, a completion event fires when `/submit` passes. The design response:
- The StepChecklist shows all steps checked
- The ValidationFeedbackPanel shows the pass state with a "Project complete" label (if `projectComplete = true` AND `!provisional`)
- A brief celebratory animation plays on the checkmark: a scale pulse (`1 → 1.15 → 1`) over 200ms, using the success color
- No confetti, no full-screen overlay, no sound
- The next CTA appears: "View your completion record →" (links to `/certificates`) and "Next project in [Course]" if there is a sequenced next project

The restraint here is intentional. A learner who completed a serious technical project deserves acknowledgment — but the acknowledgment should be proportionate to the accomplishment. A brief animation and a clear next step are more respectful than a 5-second fireworks show.

---

## 10. Accessibility and PWA Intent

### 10.1 Accessibility Principles

Atlas targets WCAG 2.1 AA compliance. Hard acceptance criteria are in DRD.md. This section states the design intent.

**Color contrast:** All text/background combinations are designed to meet the 4.5:1 ratio for normal text and 3:1 for large text (18px+ regular or 14px+ bold). Both dark and light themes must independently satisfy this requirement. The design token values in Section 3.1 are selected with this constraint in mind.

**Keyboard navigation:** The Studio must be fully operable by keyboard. Tab order follows the reading order described in Section 5.2. Focus indicators must be visible — shadcn's default `ring` focus indicator is preserved; it must not be overridden with `outline: none` without a visible replacement.

**Focus management:** When a dialog or sheet opens (SolutionDialog, RunHistorySheet), focus moves to the dialog and returns to the trigger element on close. This is handled by Radix UI's focus management primitives (FocusScope), which shadcn wraps correctly.

**Screen reader support:** Every interactive element has an accessible name, either from its text content or from `aria-label`. Status regions that update dynamically (ValidationFeedbackPanel, OutputPanel) are marked as `role="status"` or `aria-live="polite"` so screen readers announce updates without interrupting the user. The ExecutionModeChip must have an `aria-label` that describes both parts ("Execution: Pyodide, Grading: contains").

**Semantic HTML:** Panel headings use the correct heading level (`<h2>` for panel titles, `<h3>` for sub-sections within panels). Lists of steps use `<ol>` in the StepChecklist. The code editor (Monaco) has known accessibility limitations — document these limitations clearly in DRD.md and on the "accessibility statement" page.

**Reduced motion:** The `prefers-reduced-motion: reduce` media query is respected throughout. All framer-motion animations must use the `useReducedMotion` hook from framer-motion and skip or dramatically shorten animations when it is true. The CountUp animation renders the final value immediately. The PageTransition skips the translate and fades instantaneously.

**Touch targets:** All interactive elements are at least 44×44px in their effective touch target, following WCAG 2.5.5 (Target Size). On mobile, the Studio toolbar buttons must meet this requirement even in their compact form.

### 10.2 PWA Intent

The `vite-plugin-pwa` package is present. The design intent for PWA:

**Installability:** A web app manifest with the Atlas name, icon set (multiple sizes), and `display: standalone` is required for the install prompt to trigger. The InstallPrompt component handles the `beforeinstallprompt` event and renders a non-intrusive install bar.

**Offline shell:** The planned offline capability is an app shell strategy: the shell (Navbar, routing, page chrome) loads from the service worker cache; API data (projects, progress, dashboard) is network-first with a graceful degradation message when offline. The Studio in offline mode shows a clear "You're offline — reconnect to run and submit" banner rather than a broken state.

**Splash screen and icon:** The installed PWA should show the Atlas wordmark on the splash screen with a dark background (`#09090b`, zinc-950). Icons at 192×192 and 512×512 in PNG, maskable variants for Android.

Hard PWA acceptance criteria (manifest completeness, Lighthouse PWA score, offline behavior) are in DRD.md.

### 10.3 Cross-References

- Testable acceptance criteria for all accessibility and PWA requirements: **DRD.md**
- Product-level PWA scope and milestone: **PRD.md §10**
- Technical implementation of service worker and manifest: **TRD.md §2.2**

---

## Cross-Document References

| Topic | Document |
|---|---|
| Product scope, personas, feature requirements | PRD.md |
| Architecture decisions and rationale | ARD.md |
| Technical stack, API, schema, grading contract | TRD.md |
| Testable design requirements and acceptance criteria | DRD.md |
| Copy-safety enforcement (banned phrases, CI gate) | docs/phases/phase-54-copy-safety-hardening.md |
| Mode-aware workspace behavior (implementation) | docs/phases/phase-33-mode-aware-project-workspace-ux.md |
| Ada tutor contract (implementation) | docs/phases/phase-34-ada-tutor-step-contract.md |
| Certificate evidence fields (implementation) | docs/phases/phase-28-cert-verify-evidence-enrichment.md |
| Portfolio evidence surface (implementation) | docs/phases/phase-29-portfolio-evidence-surface.md |

---

*This document is the design authority for visual language, brand posture, and UX intent. It does not contain testable acceptance criteria (those are in DRD.md) or product scope decisions (those are in PRD.md). When a design decision in this document conflicts with an implementation detail in a phase document, this document states the intent and the phase document records the implementation delta.*
