# Atlas — Session Handoff

**HEAD:** Phase 32 — Learner Mode Selector + Adaptive Recommender (working tree changes pending commit).
**Last shipped + committed:** Phase 31 — Deployment Readiness at `74debf5`.
**Status:** Phase 32 **READY TO COMMIT**.

Atlas remains deploy-ready (Phase 31 unchanged). **No deployment has occurred. No production DB has been touched.**

---

## Phase 32 working-tree changes

**New files**
- `lib/execution-core/src/learnerMode.ts` — pure `recommendLearnerMode(signals)` (6 documented first-match-wins rules)
- `lib/execution-core/src/learnerMode.test.ts` — 10 cases
- `artifacts/api-server/src/routes/learner-mode.ts` — PATCH + GET-recommendation endpoints
- `artifacts/api-server/src/routes/learner-mode.test.ts` — 15 cases
- `artifacts/atlas/src/components/studio/ModeSelector.tsx` — self-contained picker + "Choose for me" CTA
- `artifacts/atlas/src/components/studio/ModeSelector.test.tsx` — 8 cases
- `docs/phases/phase-32-learner-mode-selector.md` (close-out)

**Modified files**
- `lib/execution-core/src/index.ts` (exports `recommendLearnerMode` + 3 types)
- `artifacts/api-server/src/routes/index.ts` (mounts `learnerModeRouter`)
- `artifacts/atlas/src/components/studio/StudioTopBar.tsx` (1 line: `<ModeSelector projectSlug={...} />`)
- `HANDOFF.md` (this file)
- `replit.md` (Phase History: P24 rotated out, P32 added)
- `docs/phases/INDEX.md` (P32 entry appended)

**Unchanged:** every schema file, every migration (P31 baseline untouched), every route file other than `index.ts` + the new `learner-mode.ts`, every test file other than the new ones, every seed / content / rubric / anchor / wave file, AI tutor (`ai.ts`), hint routes (`hints.ts`), `/check`, `/submit`, cert-verify, portfolio, billing, admin, dashboard, onboarding, OpenAPI spec, all codegen output, deployment checklist, scripts.

---

## Strategy decisions

1. **Schema-free** — the `learning_mode` enum (`guided`/`hint`/`independent`/`dynamic_ai_adaptive`) and `user_progress.learning_mode` column have existed since P8. AI tutor (`ai.ts:144`) and hint policy (`hints.ts:77`) already read mode at request time. P32 = activate dormant machinery.
2. **Slug-based plain-fetch** (no OpenAPI/codegen changes) — matches `useHintState.ts` + `hints.ts` precedent; reduces surface area.
3. **Mode-aware InstructionsPanel / RemediationPanel rendering → DEFERRED to Phase 33** — server-side hint cadence + tutor tone change immediately on mode flip via existing wiring. The selector unlocks real product behavior with zero panel rewrites; that lets P32 stay genuinely small.
4. **CTA-oscillation guard** — "Choose for me" only renders when recommendation differs from current mode AND `reasonCode !== 'stay-the-course'`.
5. **Caller-scoped writes** — every DB read/write keyed on `getCurrentUser(req).id`; no path/body `userId` is ever consulted.

---

## Final gate summary (Phase 32)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | ✅ clean |
| `@workspace/execution-core` tests | ✅ 14/14 (10 new) |
| `@workspace/api-server` tests | ✅ 261/261 (15 new) |
| `@workspace/atlas` tests | ✅ 82/82 (8 new) |
| `@workspace/api-server` test:integration | ✅ 3/3 (P30B real-PG /submit lock, unchanged) |
| `check:no-heuristic-runtime` | ✅ OK |
| `audit:pedagogy` (visible) | ✅ 56/56 |
| Anchor drift | n/a (no content / rubric / scoring changes) |
| Lineage integrity | n/a (no `projects` / `project_candidates` writes) |
| Architect | ✅ PASS — all findings LOW/MED, zero blockers |

---

## Invariants explicitly preserved (P21–P31)

- `RUBRIC_VERSION='1.0.1'` frozen.
- `AuthoredProject.candidateId: string` required.
- Anchor drift ≤ ±1 (n/a — no scoring touched).
- Lineage integrity (promoted, candidatesWithInverse, mismatches, inverseMismatches, duplicateCandidatePromotions) — n/a.
- `check:no-heuristic-runtime` allowlist unchanged.
- `learner_visible` filter + 404-not-403 privacy — unchanged.
- `/check` write-free, `/submit` advisory-locked (`atlas-submit:` namespace), per-user transactional integrity — unchanged.
- Cert-verify "evidence-backed completion record" language + privacy allowlist — unchanged.
- Portfolio DTOs (`PortfolioEvidence` / `UserPortfolioResponse`) — unchanged.
- 9-course taxonomy (`projects.course` source of truth) — unchanged.
- Stripe-sync + billing routes — unchanged.
- AI tutor prompt + hint route prompt — unchanged (mode-aware behavior already shipped in P4 / P8).
- Phase 31 baseline migration + `scripts/src/migrate.ts` + `docs/deployment-checklist.md` — unchanged.

---

## Known limitations (Phase 33 candidates)

- No global per-user default (`users.preferred_mode`) — would require schema.
- No per-attempt mode override in `/check`/`/submit` bodies — those contracts stay frozen.
- Recommendation reason surfaced only via tooltip on "Choose for me" button — could be more prominent.
- Mode-aware panel rendering (independent → collapse instructions, hide hint button pre-attempt; guided → inline starter nudge from L1; adaptive → "currently treating as X because Y" badge).
- Server-side hint endpoint does not yet block requests by mode — `evaluateHintPolicy` shapes the response but a determined client can still call `/hint`. Mode-based hint-gating is a follow-up.

---

## Suggested commit message

```
Phase 32 — Learner Mode Selector + Adaptive Recommender (schema-free V1)

Activates the dormant learning_mode system shipped in P8. AI tutor +
hint policy already read user_progress.learning_mode at request time;
this phase adds the missing product surface: a 4-button selector in
StudioTopBar and a deterministic recommender helper with a "Choose
for me" CTA.

- New pure lib/execution-core/src/learnerMode.ts with 6 first-match-wins
  rules (struggling-step-back, fresh-start, demonstrated-mastery,
  ready-to-level-up, ready-for-challenge, stay-the-course). Signals
  echoed back. Divide-by-zero guarded.
- New routes/learner-mode.ts: PATCH /user/projects/:slug/learning-mode
  (enum-allowlisted, caller-scoped, 404-not-403 on non-enrolled) +
  GET /user/projects/:slug/learning-mode/recommendation (aggregates
  caller-scoped signals from user_progress + user_step_completions +
  user_project_step_hints).
- New ModeSelector.tsx: self-contained, self-hides on 404, plain-fetch
  precedent (no OpenAPI/codegen) per useHintState.ts. CTA gated against
  recommendation oscillation.
- Mode-aware InstructionsPanel/RemediationPanel rewrites deferred to
  Phase 33 — server-side hint cadence and tutor tone activate
  immediately via existing P4/P8 wiring.

Zero schema/migration/`/check`/`/submit`/cert-verify/portfolio/billing/
AI-tutor-prompt/hint-route/rubric/anchor/taxonomy/content/deployment
changes.

Tests: +33 (10 helper, 15 route, 8 component). All gates green.
Architect: PASS.
```
