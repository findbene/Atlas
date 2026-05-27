# Phase 32 — Learner Mode Selector + Adaptive Recommender

**Status:** Shipped, all gates green, architect PASS.
**HEAD before:** `74debf5` (Phase 31 + deployment-checklist push-vs-migrate patch).

---

## Brief

Activate the dormant learner-mode system. Atlas has had a 4-value `learning_mode` Postgres enum (`guided` / `hint` / `independent` / `dynamic_ai_adaptive`) on `user_progress` since Phase 8, and the AI tutor (`ai.ts:144`) + hint policy (`hints.ts:77`) already read it at request time. What was missing was the **product surface**: a way for the learner to actually choose a mode, and an adaptive recommender that suggests one based on signals.

User-approved scope: **schema-free V1**, no `/check` / `/submit` / cert-verify / portfolio / billing / deployment / rubric / taxonomy / content changes, preserve all P21–P31 invariants.

## Tighter-than-brief V1 scope decisions

| Brief item | V1 decision | Why |
|---|---|---|
| Schema | **No changes** | Enum + column already exist; all 4 modes valid since P8. |
| New endpoints | `PATCH /api/user/projects/:slug/learning-mode` + `GET /api/user/projects/:slug/learning-mode/recommendation` | Slug-based, mirrors `hints.ts` precedent. |
| Pure recommender | New `lib/execution-core/src/learnerMode.ts` | Importable from both server (signal load) and client (reason rendering). |
| OpenAPI / codegen | **Skipped** — plain fetch from frontend | Matches `useHintState.ts` precedent; reduces surface area. |
| Mode-aware InstructionsPanel / RemediationPanel | **Deferred to Phase 33** | Server-side hint cadence + tutor tone already mode-aware; selector unlocks real behavior with zero panel rewrites. |
| Mass content edits | **None** | Per user instruction. |
| New seeded projects | **None** | Per user instruction. |

## Files

**New:**
- `lib/execution-core/src/learnerMode.ts` — pure `recommendLearnerMode(signals)` with 6 documented rules (first-match-wins): `struggling-step-back`, `fresh-start`, `demonstrated-mastery`, `ready-to-level-up`, `ready-for-challenge`, `stay-the-course`. Signals echoed in response.
- `lib/execution-core/src/learnerMode.test.ts` — 10 cases pinning each rule + determinism + zero-step-divide-by-zero guard.
- `artifacts/api-server/src/routes/learner-mode.ts` — both endpoints. PATCH validates against enum allowlist; GET aggregates signals from `userProgress` (prior completions), `userStepCompletions` (attempts/passed), `userProjectStepHints` (max hint level), then delegates to the pure recommender.
- `artifacts/api-server/src/routes/learner-mode.test.ts` — 15 cases: anon → 401, invalid mode → 400, missing body → 400, unknown slug → 404, not-enrolled → 404 (both routes), 4× per-mode accept-and-persist with scoped-WHERE assertion, fresh learner → guided, struggling-in-independent → hint, negative-attempt-math clamp.
- `artifacts/atlas/src/components/studio/ModeSelector.tsx` — self-contained: fetches recommendation (which carries `signals.currentMode`), self-hides on 404, renders 4-button picker + "Choose for me" CTA. CTA hidden when recommendation matches current OR `reasonCode==='stay-the-course'` (no oscillation).
- `artifacts/atlas/src/components/studio/ModeSelector.test.tsx` — 8 cases: 404 hides component, undefined slug hides, 4 options render with current `aria-pressed=true`, CTA visibility matrix (stay-the-course / rec=current / rec≠current), click-mode PATCH wiring, Choose-for-me PATCH wiring.

**Modified:**
- `lib/execution-core/src/index.ts` — exports `recommendLearnerMode` + 3 types.
- `artifacts/api-server/src/routes/index.ts` — mounts `learnerModeRouter`.
- `artifacts/atlas/src/components/studio/StudioTopBar.tsx` — one line: `<ModeSelector projectSlug={...} />` between enrollment status and `ExecutionModeChip`.

**Unchanged:** every schema file, every migration, `/check`, `/submit`, cert-verify, portfolio, billing, AI tutor (`ai.ts`), hint routes (`hints.ts`), admin, dashboard, onboarding, codegen output, OpenAPI spec, scripts, rubric/anchor/content, deployment checklist.

## Recommender rules (lib/execution-core/src/learnerMode.ts)

First-match wins, ordering is load-bearing:

1. **`struggling-step-back`** — `currentMode === 'independent'` AND (attempts/step > 4 OR maxHintLevel ≥ 3) → recommend `hint`. Catches independent learners before Rule 3 would keep them there.
2. **`fresh-start`** — 0 prior completions AND ≤ 1 step done → recommend `guided`.
3. **`demonstrated-mastery`** — ≥ 3 prior completions AND attempts/step ≤ 2 AND maxHintLevel ≤ 1 → recommend `independent`.
4. **`ready-to-level-up`** — `currentMode === 'guided'` AND ≥ 1 prior completion AND attempts/step ≤ 2 AND ≥ 2 steps done → recommend `hint`.
5. **`ready-for-challenge`** — ≥ 1 prior completion AND 0 < attempts/step ≤ 4 → recommend `hint`.
6. **`stay-the-course`** — default; return current mode unchanged.

`attemptsPerStep` guards `stepsDone <= 0` and returns 0 (no division by zero).

## Signal derivation (routes/learner-mode.ts)

- `priorCompletedProjects` ← `COUNT(*) FROM user_progress WHERE userId=caller AND status='completed'`.
- `currentProjectStepsCompleted` ← `COUNT(*) FILTER (WHERE passed) FROM user_step_completions WHERE userId=caller AND projectId=ctx.project.id`.
- `currentProjectAttempts` ← `MAX(0, SUM(attempt_count) - stepsCompleted)`. Defensible approximation: `attempt_count` tracks total attempts including the final passing one, so `total - passes` ≈ failed-before-pass. Clamped at 0 for pathological rows.
- `currentProjectHintLevelMax` ← `MAX(hint_level)` from `user_project_step_hints`, default 0.
- `currentMode` ← `user_progress.learning_mode`.

All reads are caller-scoped — no path/body `userId` is ever read.

## Frontend behavior

- `ModeSelector` is mounted by `StudioTopBar`. It does **not** receive props from the workspace state — it manages its own lifecycle so the workspace stays decoupled.
- Mode change is fire-and-forget PATCH; on `r.ok`, the component flips its local `currentMode` (no full refetch — the recommendation reason might go stale, that's acceptable; refetch happens on next slug change).
- "Choose for me" CTA only renders when the recommender's pick differs from the current persisted mode AND the reason is actionable (not `stay-the-course`). Prevents button-flicker / decision-fatigue.
- BASE_URL prefix used throughout (artifact path-routing convention).

## Final gate summary

| Gate | Result |
|---|---|
| `pnpm run typecheck` | ✅ clean |
| `@workspace/execution-core` tests | ✅ 14/14 (10 new) |
| `@workspace/api-server` tests | ✅ 261/261 (15 new) |
| `@workspace/atlas` tests | ✅ 82/82 (8 new) |
| `@workspace/api-server` test:integration | ✅ 3/3 (P30B real-PG /submit lock) |
| `check:no-heuristic-runtime` | ✅ OK |
| `audit:pedagogy` (visible) | ✅ 56/56 |
| Anchor drift | n/a — no content / rubric / scoring changes |
| Lineage integrity | n/a — no `projects` / `project_candidates` writes |
| Architect | ✅ PASS — findings LOW/MED, zero blockers |

## Invariants explicitly preserved

- `RUBRIC_VERSION='1.0.1'` frozen.
- `/check` zero changes (write-free).
- `/submit` zero changes (atlas-submit advisory-lock convention untouched).
- Cert-verify + portfolio zero changes ("evidence-backed completion record" language untouched).
- Billing + Stripe-sync zero changes.
- 9-course taxonomy zero changes.
- `learner_visible` filter + 404-not-403 privacy unchanged.
- Phase 31 baseline migration + `scripts/src/migrate.ts` + deployment-checklist zero changes — Atlas remains deploy-ready, still in dev preview.

## Architect findings (summary)

PASS. Highlights:

- **Safety [LOW]** — Both routes scoped via `getCurrentUser(req)`; PATCH only mutates `user_progress.learning_mode` (no XP, completion, or hint-state side effects); 404-not-403 preserved; no cross-user read.
- **Correctness [MED]** — `failedAttempts = totalAttempts - stepsCompleted` approximation defensible for V1; first-match-wins rule ordering verified (Rule 1 catches stuck-in-independent before Rule 3 would lock it in); divide-by-zero guarded.
- **UX [LOW]** — CTA hiding matrix correctly prevents oscillation; self-hiding on 404 keeps top bar clean for non-project routes.
- **Invariants [LOW]** — Zero impact on rubric, /submit lock, taxonomy, visibility, lineage.
- **Deferred [LOW]** — Phase 33 panel-rendering rewrites are safe to defer; server-side hint cadence + tutor tone activate immediately on mode change.

No changes required for V1 merge.

## Known limitations (carry to Phase 33 if desired)

- **No global per-user default mode** — would require a `users.preferred_mode` column (schema change, deferred).
- **No per-attempt mode override** in `/check`/`/submit` bodies — those contracts stay frozen.
- **Recommendation reason is server-computed but only surfaced via tooltip** on the "Choose for me" button — Phase 33 could surface it more prominently with reason-coded styling.
- **Mode-aware Instructions / Remediation panel rendering** — server is already mode-aware; client rendering changes are a Phase 33 product decision (e.g., independent mode collapses instructions to a brief, hides hint button until first failed `/check`).
- **Client-side independent-mode hint suppression** — `evaluateHintPolicy` gates server-side based on mode, but a determined client can still call `/hint`. Adding mode-based server-side hint-gating is a follow-up.
