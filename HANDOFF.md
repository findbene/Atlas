# Atlas — Session Handoff

**HEAD:** Phase 33 — Mode-Aware Project Workspace UX (working tree changes pending commit).
**Last shipped + committed:** Phase 32 — Learner Mode Selector + Adaptive Recommender at `95faf40`.
**Status:** Phase 33 **READY TO COMMIT**.

Atlas remains deploy-ready (Phase 31 unchanged). **No deployment has occurred. No production DB has been touched.**

---

## Phase 33 working-tree changes

**New files**
- `artifacts/atlas/src/components/studio/useLearningMode.ts` — shared hook + `dispatchLearningModeChanged(slug, mode)` window-`CustomEvent` bridge. Request-versioning (`fetchSeqRef`), preserve-on-transient-error (`hadAnySuccessRef`), functional `setState` everywhere.
- `artifacts/atlas/src/components/studio/useLearningMode.test.tsx` — 6 cases (mount fetch, 404 self-hide, optimistic dispatch, preserve-on-transient-error, cross-slug ignore, lifecycle).
- `artifacts/atlas/src/components/studio/InstructionsPanel.test.tsx` — 7 cases (guided CTA, independent disclosure, pedagogy + legacy `hints[]` suppression, and the architect-flagged regression: legacy hint stays visible after mid-step flip to independent).
- `artifacts/atlas/src/components/studio/ValidationFeedbackPanel.mode.test.tsx` — 3 cases (Ada nudge swap, default fallback, missing-handler fallback). In its own file so the top-level `useHintState` stub doesn't bleed into the sibling suite.
- `docs/phases/phase-33-mode-aware-project-workspace-ux.md` (close-out).

**Modified files**
- `artifacts/atlas/src/components/studio/ModeSelector.tsx` — rewritten on `useLearningMode`; dispatches `LEARNING_MODE_CHANGED_EVENT` after PATCH; new `data-testid="adaptive-mode-badge"` when `currentMode === "dynamic_ai_adaptive"`.
- `artifacts/atlas/src/components/studio/InstructionsPanel.tsx` — new `mode`/`hasFailedCheck`/`onRequestTutorNudge` props. Long-instruction disclosure. **Dual suppression predicates** (`suppressPedagogyEscalation` for the ladder, `suppressLegacyReveal` reading `showLegacyHint` for the one-shot hint) so earned hints survive a mid-step mode flip.
- `artifacts/atlas/src/components/studio/ValidationFeedbackPanel.tsx` — new `mode`/`onRequestTutorNudge` props. Independent + handler swaps `hint-offer` for `independent-ada-nudge`.
- `artifacts/atlas/src/components/studio/RemediationPanel.tsx` — new `mode` prop + `firstDivergenceIndex` helper. Independent + exact-diff dampened (lengths + first divergence; expected not echoed).
- `artifacts/atlas/src/components/studio/StudioShell.tsx` — wires `useLearningMode(project?.slug)`. **`hasFailedCheck` latched via `useState` + two `useEffect`s** (reset on `currentStep?.id`, set on `grading?.status === "failed"`) — no render-phase mutation. Bridges `onRequestTutorNudge` → existing `onAskTutor("I'd like a small nudge...")`. Passes `mode` + handler to all 3 panels.
- `artifacts/atlas/src/components/studio/ModeSelector.test.tsx` — mock now closure-tracks `liveCurrentMode` so post-PATCH refetch reflects the new mode (otherwise the optimistic update reverts).
- `artifacts/atlas/src/components/studio/RemediationPanel.test.tsx`, `artifacts/atlas/src/components/studio/ValidationFeedbackPanel.test.tsx` — extended for new props.
- `HANDOFF.md` (this file).
- `replit.md` (Phase History: P25 rotated out, P33 added).
- `docs/phases/INDEX.md` (P33 entry appended).

**Unchanged:** every schema file, every migration, every backend route (incl. the P32 `learner-mode.ts`), `pages/project-workspace.tsx`, every test file other than the new + extended ones above, every seed / content / rubric / anchor / wave file, AI tutor (`ai.ts`), hint routes (`hints.ts`), `/check`, `/submit`, cert-verify, portfolio, billing, admin, dashboard, onboarding, OpenAPI spec, all codegen output, deployment checklist, scripts. Untracked `attached_assets/Pasted-*.txt` scratch files MUST NOT be committed.

---

## Strategy decisions

1. **Event bridge instead of prop-drilling.** ModeSelector lives in `StudioTopBar`; the panels live deep under `StudioShell`. Threading callbacks through `pages/project-workspace.tsx` would have rewritten a deliberately stable parent. The hook publishes a `CustomEvent` on the window; every consumer instance re-syncs on its own.
2. **Optimistic + reconcile.** Mode flips feel instant. Three race-safety mechanisms in the hook: `fetchSeqRef` (invalidate stale in-flight responses), `hadAnySuccessRef` (preserve last-known mode on transient errors so ModeSelector doesn't blink off), functional `setState` everywhere (an optimistic update mid-fetch is never overwritten by a stale snapshot).
3. **Two suppression predicates, not one.** Architect caught that a single predicate on the legacy `hints[]` path fires even when `showLegacyHint` is true. Split into `suppressPedagogyEscalation` and `suppressLegacyReveal` — the latter reads `showLegacyHint` so an already-open hint stays visible after a mid-step flip to independent.
4. **`hasFailedCheck` latched in committed state, not in a render-phase ref.** Moved to `useState` + `useEffect` keyed on `grading?.status` so the flip is committed after render, never during it. Concurrent-mode safe.
5. **No new OpenAPI / codegen.** Zero new endpoints. Reuses P32's `/learning-mode/recommendation`. Plain `fetch` per `useHintState.ts` + P32 precedent.
6. **Test-mock closure-tracking documented.** The `ModeSelector` mock mutates `liveCurrentMode` on PATCH so the optimistic-update path survives the refetch. Anyone writing tests for hooks that do optimistic-then-refetch should follow the same pattern — `mockResolvedValueOnce` is insufficient.
7. **Dampened exact-diff privacy posture.** Independent learners don't get the answer echoed back on a failed `/check`: render `Expected: N chars, got M chars, first divergence at index K`.

---

## Final gate summary (Phase 33)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | ✅ clean |
| `@workspace/atlas` tests | ✅ 102/102 (20 new vs. P32 baseline of 82) |
| `@workspace/api-server` tests | ✅ 261/261 (no change) |
| `@workspace/execution-core` tests | ✅ 14/14 (no change) |
| `@workspace/api-server` test:integration | ✅ 3/3 (P30B real-PG `/submit` lock — not re-run; zero `/submit` code touched) |
| `check:no-heuristic-runtime` | ✅ OK |
| `audit:pedagogy` (visible) | ✅ 56/56 |
| Anchor drift | n/a (no content / rubric / scoring changes) |
| Lineage integrity | n/a (no `projects` / `project_candidates` writes) |
| Architect | ✅ PASS after 3-finding fix-up round — critical (legacy-hint regression) fixed via dual predicate; medium (refetch race / preserve-on-error) fixed via seq-id + `hadAnySuccessRef`; low (render-phase ref) fixed via state + effects; each with new test coverage |

---

## Invariants explicitly preserved (P21–P32)

- `RUBRIC_VERSION='1.0.1'` frozen.
- `AuthoredProject.candidateId: string` required.
- Anchor drift ≤ ±1 (n/a — no scoring touched).
- Lineage integrity (n/a — no `projects` / `project_candidates` writes).
- `check:no-heuristic-runtime` allowlist unchanged.
- `learner_visible` filter + 404-not-403 privacy — unchanged.
- `/check` write-free, `/submit` advisory-locked (`atlas-submit:` namespace), per-user transactional integrity — unchanged.
- Cert-verify "evidence-backed completion record" language + privacy allowlist — unchanged.
- Portfolio DTOs — unchanged.
- 9-course taxonomy — unchanged.
- Stripe-sync + billing routes — unchanged.
- AI tutor prompt + hint route prompt — unchanged.
- Phase 31 deployment baseline / migration runner / checklist — unchanged. Atlas remains in dev preview; deploy switch is operator's explicit action.

---

## Known limitations (Phase 34 candidates)

- `firstDivergenceIndex` is UTF-16 code-unit based; an exact-diff that diverges inside a surrogate pair would report an index between the two halves. Non-critical for current curriculum; `[...string]` upgrade if that changes.
- Adaptive mode shows a badge naming the underlying mode but doesn't yet re-render panels with an "adaptive treatment" of its own. True adaptive panel behavior is its own design problem.
- The hook's preserve-on-error path only protects mode after at least one successful read for the current slug. First-mount failure still falls back to `{mode: null}` — matches P32's self-hide contract.
- No per-attempt mode override in `/check` / `/submit` bodies — those contracts stay frozen.
- Server-side hint endpoint does not block requests by mode; a determined client can still call `/hint` directly. Mode-based hint-gating remains a follow-up.

---

## Suggested commit message

```
Phase 33 — Mode-Aware Project Workspace UX (frontend-only overlay on P32)

Activates the per-panel half of the P32 learner-mode system. The
StudioTopBar selector now meaningfully changes what the three workspace
panels render and how they prompt for help.

- New useLearningMode hook + window CustomEvent bridge so the top-bar
  selector and the panels stay in sync without prop-drilling.
  Request-versioning, preserve-on-transient-error, and functional
  setState everywhere — no flicker, no overwriting an optimistic update
  with a stale fetch.
- InstructionsPanel: guided Ask-Ada CTA, independent long-description
  disclosure, dual suppression predicates (pedagogy ladder + legacy
  hints[]) that keep already-revealed hints visible even after a
  mid-step flip to independent.
- ValidationFeedbackPanel: independent + handler swaps Reveal-hint for
  Ask-Ada-for-a-nudge; default / missing handler keeps legacy behavior.
- RemediationPanel: independent + exact-diff dampens to length +
  first-divergence index, never echoes the expected string.
- StudioShell wires hook + hasFailedCheck latch (committed via
  useEffect, never in render) + onRequestTutorNudge → existing
  onAskTutor bridge.

Zero schema/migration/`/check`/`/submit`/cert-verify/portfolio/billing/
AI-tutor-prompt/hint-route/rubric/anchor/taxonomy/content/deployment
changes. Backend, including the P32 learner-mode routes, unchanged.

Tests: +20 atlas (hook, InstructionsPanel mode-aware incl. legacy-hint
preservation regression, ValidationFeedbackPanel nudge swap,
RemediationPanel dampening, ModeSelector adaptive badge). Atlas 82 →
102. api-server 261/261, execution-core 14/14 unchanged. All gates
green. Architect: PASS after 3-finding fix-up round.
```
