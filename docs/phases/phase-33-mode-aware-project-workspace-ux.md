# Phase 33 — Mode-Aware Project Workspace UX

**Status:** SHIPPED. Frontend-only overlay on Phase 32. Schema-free, additive, reversible.

**Predecessor:** [phase-32-learner-mode-selector.md](phase-32-learner-mode-selector.md). P32 activated the dormant `learning_mode` system end-to-end at the server layer (AI tutor + hint cadence already read mode at request time) and added a 4-button selector in `StudioTopBar`. P32 deferred *panel-level* mode-aware behavior to this phase.

---

## Goal

Make the project workspace **visibly and behaviorally** respond to the learner's current mode (`guided` / `hint` / `independent` / `dynamic_ai_adaptive`). The selector at the top of the workspace must now meaningfully change what the panels under it render.

Concretely:

- **Guided** — keep instructions expanded; surface a small "Ask Ada" CTA at the top of the instructions panel so help is always one click away.
- **Hint** — legacy behavior (no change vs. P25/P32).
- **Independent** — collapse long instructions behind a disclosure; suppress proactive hint reveal until the learner has at least one failed `/check` on record; on the validation panel, swap the "Reveal hint" button for a one-shot "Ask Ada for a nudge"; dampen exact-diff remediation to lengths + first-divergence index (no echo of the expected string).
- **Adaptive** — show a small badge that names which underlying mode Atlas is currently treating the learner as. (No panel rewrites — adaptive defers to the chosen underlying mode.)

Hard stops (preserved):

- No schema, no migration.
- No `/check`, `/submit`, cert-verify, portfolio, billing, deployment, Stripe touch.
- All P26–P32 invariants intact (RUBRIC_VERSION='1.0.1', advisory lock, 404-not-403, lineage integrity, no-heuristic runtime, etc.).

---

## What shipped

### New files

- `artifacts/atlas/src/components/studio/useLearningMode.ts` — shared hook + `dispatchLearningModeChanged(slug, mode)` window-`CustomEvent` bridge so the top-bar selector and the panels stay in sync without prop-drilling through `pages/project-workspace.tsx`. Includes:
  - Request-versioning (`fetchSeqRef`) so concurrent fetches can't reorder and clobber each other.
  - `hadAnySuccessRef` preserve-on-transient-error: once the hook has known a real mode value, a later non-OK refetch keeps the last-known mode rather than nulling it (which would briefly hide ModeSelector and revert panels to legacy default).
  - Functional `setState(s => ...)` form on every apply path so a fast optimistic update can never be clobbered by a slow stale fetch.
- `artifacts/atlas/src/components/studio/useLearningMode.test.tsx` — hook unit tests (mount fetch, 404 self-hide, optimistic dispatch, preserve-on-transient-error, cross-slug ignore).
- `artifacts/atlas/src/components/studio/InstructionsPanel.test.tsx` — covers guided CTA, independent disclosure, pedagogy + legacy `hints[]` suppression, **and the architect-flagged regression: legacy hint stays visible after a mid-step flip to independent**.
- `artifacts/atlas/src/components/studio/ValidationFeedbackPanel.mode.test.tsx` — Ada-nudge swap in independent mode; missing handler falls back to legacy hint-offer.

### Modified files

- `artifacts/atlas/src/components/studio/ModeSelector.tsx` — rewritten on `useLearningMode`; dispatches `LEARNING_MODE_CHANGED_EVENT` after a successful PATCH; new `data-testid="adaptive-mode-badge"` rendered when `currentMode === "dynamic_ai_adaptive"`. CTA gating + 404 self-hide unchanged.
- `artifacts/atlas/src/components/studio/InstructionsPanel.tsx` — gains `mode`, `hasFailedCheck`, `onRequestTutorNudge` props. Long-description disclosure in independent mode. **Two distinct suppression predicates** (`suppressPedagogyEscalation` and `suppressLegacyReveal`) so already-revealed legacy hints stay visible even when the learner flips to independent mid-step.
- `artifacts/atlas/src/components/studio/ValidationFeedbackPanel.tsx` — gains `mode`, `onRequestTutorNudge` props. Independent + handler → renders `independent-ada-nudge`; default / missing handler → legacy `hint-offer`.
- `artifacts/atlas/src/components/studio/RemediationPanel.tsx` — gains `mode` prop. Independent + exact-diff → dampened render via new `firstDivergenceIndex` helper (lengths + first divergence; expected string not echoed). Other branches untouched.
- `artifacts/atlas/src/components/studio/StudioShell.tsx` — wires `useLearningMode(project?.slug)`, latches `hasFailedCheck` via `useState` + two `useEffect`s (reset on `currentStep?.id`, set on `grading?.status === "failed"`), bridges `onRequestTutorNudge` → existing `onAskTutor("I'd like a small nudge...")`. Passes `mode` + handler to all three panels.
- `artifacts/atlas/src/components/studio/ModeSelector.test.tsx` — mock now closure-tracks `liveCurrentMode` so the post-PATCH refetch returns the new mode (otherwise the architect-flagged refetch race would revert the optimistic update).
- `artifacts/atlas/src/components/studio/RemediationPanel.test.tsx`, `artifacts/atlas/src/components/studio/ValidationFeedbackPanel.test.tsx` — extended for the new props.

### Unchanged

Every schema file, every migration, every backend route (incl. `learner-mode.ts` from P32), every test file other than the new + extended ones above, `pages/project-workspace.tsx`, every seed/content/rubric/anchor/wave file, AI tutor (`ai.ts`), hint routes (`hints.ts`), `/check`, `/submit`, cert-verify, portfolio, billing, admin, dashboard, onboarding, OpenAPI spec, codegen output, deployment checklist, scripts.

---

## Strategy decisions

1. **Event-bridge instead of prop drilling.** ModeSelector lives in `StudioTopBar`; the panels live deep under `StudioShell`. Threading a callback through `pages/project-workspace.tsx → StudioShell → StudioTopBar` would have rewritten a parent that's deliberately stable. Instead the hook publishes a `CustomEvent` on the window, and every consumer instance of `useLearningMode(slug)` re-syncs on its own. Same precedent as the inverse-FK lineage idea in the backend — keep cross-cutting state coordination out of the prop graph.

2. **Optimistic + reconcile, never blocking.** Mode flips have to feel instant. The hook applies an optimistic `setState` immediately on the event, then kicks off a background refetch to pick up fresh recommendation reason. Three race-safety mechanisms:
   - `fetchSeqRef` invalidates stale in-flight responses on slug change or rapid re-clicks.
   - `hadAnySuccessRef` preserves last-known mode on transient errors so ModeSelector doesn't blink off.
   - All `setState` calls in fetch paths use the functional form, so an optimistic update that landed mid-fetch is never overwritten by a stale snapshot.

3. **Two suppression predicates, not one.** The first cut had a single predicate `isIndependent && !hasFailedCheck && (state?.level ?? 0) === 0`. Architect review caught that on the legacy `hints[]` path `state === null`, so the predicate fires even when the learner has already toggled the hint open — yanking content they had access to a second earlier. Fixed: split into `suppressPedagogyEscalation` (gates the ladder button) and `suppressLegacyReveal` (which also reads `showLegacyHint` so an already-open legacy hint stays visible).

4. **Latch failed-check in committed state, not in a render-phase ref.** Architect flagged the original render-time `if (grading?.status === "failed") hasFailedCheckRef.current = true;` as not concurrent-safe. Moved to `useState` + a `useEffect` keyed on `grading?.status` so the latch flip is committed after render, never during it.

5. **No new OpenAPI / codegen.** This phase adds zero new endpoints. The hook reuses the P32 `/learning-mode/recommendation` endpoint. Plain `fetch` matches the `useHintState.ts` + P32 precedent.

6. **Test-mock closure-tracking documented.** The `ModeSelector` mock now mutates `liveCurrentMode` on PATCH so the optimistic-update path survives the subsequent refetch. Anyone writing a new test for a hook that does optimistic-update-then-refetch should follow the same pattern — `mockResolvedValueOnce` won't cut it.

7. **Dampened exact-diff privacy posture.** Independent learners shouldn't get the answer echoed back at them on a failed `/check`. The new dampened branch renders `Expected: <N> chars, got <M> chars, first divergence at index <K>` — same diagnostic value for someone who already understands the problem, no give-away for someone who doesn't.

---

## Final gate summary

| Gate | Result |
|---|---|
| `pnpm run typecheck` | ✅ clean |
| `@workspace/atlas` tests | ✅ 102/102 (20 new vs. P32 baseline of 82) |
| `@workspace/api-server` tests | ✅ 261/261 (no change) |
| `@workspace/execution-core` tests | ✅ 14/14 (no change) |
| `@workspace/api-server` test:integration | ✅ 3/3 (P30B real-PG `/submit` lock; not re-run — zero `/submit` code touched) |
| `check:no-heuristic-runtime` | ✅ OK |
| `audit:pedagogy` (visible) | ✅ 56/56 |
| Anchor drift | n/a (no content / rubric / scoring changes) |
| Lineage integrity | n/a (no `projects` / `project_candidates` writes) |
| Architect (round 1) | FAIL — 3 findings (1 critical, 1 medium, 1 low) |
| Architect findings — addressed | ✅ Critical (legacy hint regression) fixed via dual predicate; Medium (refetch race / preserve-on-error) fixed via seq-id + `hadAnySuccessRef`; Low (render-phase ref) fixed via state + effects. New tests added for each. |

---

## Invariants explicitly preserved (P21–P32)

- `RUBRIC_VERSION='1.0.1'` frozen.
- `AuthoredProject.candidateId: string` required.
- Anchor drift ≤ ±1 (n/a — no scoring touched).
- Lineage integrity (n/a — no writes to `projects` / `project_candidates`).
- `check:no-heuristic-runtime` allowlist unchanged.
- `learner_visible` filter + 404-not-403 privacy — unchanged.
- `/check` write-free, `/submit` advisory-locked (`atlas-submit:` namespace), per-user transactional integrity — unchanged.
- Cert-verify "evidence-backed completion record" language + privacy allowlist — unchanged.
- Portfolio DTOs (`PortfolioEvidence` / `UserPortfolioResponse`) — unchanged.
- 9-course taxonomy (`projects.course` source of truth) — unchanged.
- Stripe-sync + billing routes — unchanged.
- AI tutor prompt + hint route prompt — unchanged.
- Phase 31 deployment baseline / migration runner / checklist — unchanged. Atlas remains in dev preview; deploy switch is operator's explicit action.

---

## Known limitations (Phase 34 candidates)

- `firstDivergenceIndex` is UTF-16 code-unit based; an exact-diff that diverges inside a surrogate pair would report an index between the two halves. Non-critical for current curriculum (no projects compare emoji-bearing strings), but worth a `[...string]` upgrade if that ever changes.
- Adaptive mode shows a badge identifying the underlying mode but doesn't yet re-render panels with the adaptive treatment (it still routes to whichever underlying mode the server picked). True adaptive panel behavior is its own design problem.
- The hook's preserve-on-error path only protects mode + recommendation when the hook has already seen at least one success for the current slug. A first-mount failure still falls back to `{mode: null}`. That matches the existing P32 self-hide contract and is intentional.
- No per-attempt mode override in `/check` / `/submit` bodies — those contracts stay frozen.
- Server-side hint endpoint does not yet block requests by mode — `evaluateHintPolicy` shapes the response but a determined client can still call `/hint`. Mode-based hint-gating remains a follow-up.

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

Tests: +20 atlas (hook, InstructionsPanel mode-aware behavior incl.
legacy-hint preservation regression, ValidationFeedbackPanel nudge
swap, RemediationPanel dampening, ModeSelector adaptive badge).
Atlas 82 → 102. api-server 261/261, execution-core 14/14 unchanged.
All gates green. Architect: PASS after 3-finding fix-up round.
```
