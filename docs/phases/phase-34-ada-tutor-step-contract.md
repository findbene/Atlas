# Phase 34 — Ada Tutor Step Contract + Mode Telemetry

**Status:** Shipped. All gates green. Architect: **PASS** (one Medium nit consolidated).
**Parent:** Phase 33 — Mode-Aware Project Workspace UX (`7d7f1bea`).
**Scope:** Frontend+backend overlay. **Schema-free, additive, reversible.**

## Goal

Phase 32 activated the mode selector; Phase 33 made the workspace panels mode-aware. Phase 34 closes the loop on the AI side:

1. Make Ada's per-mode help boundary **explicit and structured** (not a tone hint buried in the system prompt).
2. Make `dynamic_ai_adaptive` resolve **deterministically** to a concrete underlying mode at request time — Ada should never be vague in adaptive.
3. Add **schema-free structured telemetry** for tutor + hint-escalation requests so the next phase can build a usage dashboard without a migration.
4. Ship a read-only `GET /api/admin/mode-usage` aggregate.

Hard stops honored: no schema/migration, no `/check` / `/submit` / cert-verify / portfolio / billing / deployment / Stripe touch, no rubric/anchor/taxonomy edits, no expansion of the 4-file no-heuristic allowlist, learner_visible filter unchanged, bidirectional lineage unchanged.

## New files

- `lib/execution-core/src/tutorContract.ts` — pure helpers `buildTutorContract(input)`, `renderTutorContractForPrompt(contract)`, `resolveAdaptiveMode(signals)`. Returns `{mode, effectiveMode, resolvedFromAdaptive, helpBoundary, allowedBehaviors[], forbiddenBehaviors[], validationGuidance, responseStyle}`. Independent + not-passed → `diagnostic-only` with explicit "Do NOT reveal the full solution" + "portfolio credibility" clauses. Independent + passed flips to `review-permissive`. Adaptive resolves first-match-wins: `stepPassed` → independent; `lastValidationFailed && attemptCount>=2` → guided rescue; `currentHintLevel>=3 || attemptCount>=3` → guided rescue; else hint (default, never guided — adaptive learners opted out of always-on scaffolding).
- `lib/execution-core/src/tutorContract.test.ts` — 17 cases: each mode boundary, adaptive resolution branches, render-shape contract, and the **solution-leak invariant** (independent + not-passed must always include "Do NOT reveal the full solution" regardless of attemptCount/hintLevel).

## Modified files

- `lib/execution-core/src/index.ts` — exports `buildTutorContract`, `renderTutorContractForPrompt`, `resolveAdaptiveMode`, `TutorContractInput`, `TutorContract`, `HelpBoundary`.
- `artifacts/api-server/src/routes/ai.ts` — renamed `SYSTEM_PROMPT` → `SYSTEM_PROMPT_BASE`, stripped the inline "Mode-aware tone" bullets (P4-era), added "TUTOR CONTRACT below" references in the base prompt. Per-request, after assembling `learnerStateBlock`, builds the contract from the SAME signals (`atlasMode`, `attemptCount`, `currentHintLevel`, `lastValidationFailed`, `stepPassed`) and appends `renderTutorContractForPrompt(contract)` to the system prompt **outside** the untrusted `<learner_state>` / `<project_context>` / `<step_pedagogy>` / `<user_data>` envelopes (so the model treats it as system policy, not learner data). Emits `req.log.info({evt:'ai.tutor.request', userId, projectId, stepId, tier, model, contract:{mode, effectiveMode, helpBoundary, resolvedFromAdaptive, currentHintLevel, attemptCount, lastValidationFailed, stepPassed}})` BEFORE the upstream stream call so the log lands even if the model call fails. General-context requests get the base prompt only (no contract block) — `telemetry: null` in the log.
- `artifacts/api-server/src/routes/hints.ts` — `POST /projects/:slug/steps/:stepId/hint/next` emits `req.log.info({evt:'hint.escalate', userId, projectId, projectSlug, stepId, mode, priorLevel, desiredLevel, cap, attemptCount, lastValidationFailed, stepPassed})` AFTER the atomic upsert (so the log reflects the level actually persisted).
- `artifacts/api-server/src/routes/admin.ts` — new `GET /api/admin/mode-usage` (requireAdmin). Reads `user_progress.learning_mode` via `db.execute(sql\`SELECT learning_mode, COUNT(*)::int AS n FROM user_progress GROUP BY learning_mode\`)`. Returns `{totalEnrollments, byMode:{guided,hint,independent,dynamic_ai_adaptive}, percentByMode}` — flat aggregate, NO per-user/per-project detail. Unknown enum values ignored defensively. Zero-row case → all zeros + zero percentages (no divide-by-zero).
- `artifacts/api-server/src/routes/ai.test.ts` — extended db mock with `userProgress`/`userProjectStepHints`/`userStepCompletions` query stubs, added `streamSpy` that captures `messages.stream(args)` so tests can assert on `system`. New 6-case suite "POST /ai/chat — Phase 34 Tutor Contract injection": guided → `proactive-scaffolded`, hint → `progressive-hints` + "collapse the hint ladder", independent+not-passed → `diagnostic-only` + no-leak language + "portfolio credibility", independent+passed → `review-permissive`, dynamic_ai_adaptive → annotated `effective_mode` (never left as adaptive), general context → no contract block.
- `artifacts/api-server/src/routes/admin.test.ts` — db mock gained `execute` + `userProgress` sentinel. New 5-case suite "GET /api/admin/mode-usage": 401 anon / 403 non-admin / 200 with shape + rounding / zero-row zero-percent / unknown-mode defensive / no-PII payload.

**Unchanged:** every schema file, every migration, every other backend route (incl. `/check`, `/submit`, cert-verify, portfolio, billing, dashboard, onboarding, enrollment, learner-mode, hints-GET), every frontend file, OpenAPI spec, all codegen output, seed/content/rubric/anchor/wave files, deployment checklist, scripts. The Tutor Contract module is purely additive; SYSTEM_PROMPT_BASE retains the full hint-discipline + safety hard floor verbatim — the contract tightens per-mode behavior on top, never below.

## Strategy decisions

1. **Pure helper in execution-core, not a route-local function.** Keeps the policy testable in isolation (no DB, no Anthropic mock, no Express harness), shareable if the dashboard later wants to render the same boundary copy, and locks the solution-leak invariant in a place architect explicitly flagged for regressions.
2. **Contract OUTSIDE untrusted envelopes.** The rendered block is appended to `SYSTEM_PROMPT_BASE` directly, not inside `<learner_state>` or `<project_context>`. Same threat model as the existing base prompt: instructions inside `<…>` tags are treated as learner data; trusted policy lives at the top level.
3. **Adaptive resolves to a CONCRETE mode at the contract layer, not at prompt time.** The model never sees the bare label `dynamic_ai_adaptive` without an explicit `effective_mode (adaptive resolution): …` line. Rules are first-match-wins, deterministic, signal-echoed, and use the same struggle thresholds the hint policy uses.
4. **Default for adaptive is HINT, not guided.** A learner who picked `dynamic_ai_adaptive` opted out of always-on scaffolding; rescuing to guided only fires when struggle signals do.
5. **Independent has TWO sub-modes via `stepPassed`.** Pre-pass: `diagnostic-only` (no leak, Socratic). Post-pass: `review-permissive` (discuss solution + alternatives). Same boundary axis Phase 33's RemediationPanel uses for its dampened-diff posture — consistent end-to-end.
6. **Schema-free telemetry.** Structured `req.log.info({evt, …})` calls only. No new tables, no migration, no Stripe-style sync. Operator can `rg evt:.ai.tutor.request` over pino logs today; a real dashboard is a follow-up phase.
7. **Telemetry timing.** `ai.tutor.request` BEFORE the stream so failures still emit. `hint.escalate` AFTER the upsert so the log reflects what was actually persisted (preventing "logged-but-didn't-write" false signal).
8. **Mode-usage endpoint is admin-gated and has NO per-user shape.** Same `requireAdmin` gate as `/api/admin/quality`. Returns a 4-row aggregate; no joins, no ids, no slugs. Architect-verified.
9. **Architect's nit fixed.** The original `resolveAdaptiveMode` had a redundant final `if`/`else` returning the same value — consolidated to a single labeled return with a comment explaining why the default is hint rather than guided.

## Final gate summary (Phase 34)

| Gate | Result |
| ---- | ------ |
| `pnpm --filter @workspace/execution-core run test` | **34/34** (17 new tutorContract cases) |
| `pnpm --filter @workspace/api-server run test` | **273/273** (6 new ai.ts + 5 new admin.ts cases) |
| `pnpm --filter @workspace/atlas run test` | **102/102** (unchanged from P33) |
| `pnpm --filter @workspace/api-server run test:integration` | **3/3** (P30B concurrency unchanged) |
| `pnpm run typecheck` | clean (libs build + 4 leaf packages + no-heuristic-runtime guard) |
| `pnpm run check:no-heuristic-runtime` | OK — 4-file allowlist unchanged |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | **56/56 visible** (unchanged) |

## Hard-rule re-verification

- Schema / migration changes: **none**.
- `/check`, `/submit`, cert-verify, portfolio, billing, deployment, Stripe, OpenAPI codegen: **untouched**.
- `learner_visible = TRUE` filter on learner-facing routes: **unchanged** (404-not-403 privacy intact).
- Bidirectional candidate ↔ project lineage: **untouched** (no admin/quality logic changed).
- RUBRIC_VERSION='1.0.1': **frozen**.
- 4-file no-heuristic allowlist: **not expanded** (`check:no-heuristic-runtime` green).
- 9 Atlas courses + "Atlas is a project-based learning platform for Data Engineering" framing: **unchanged**.

## Known follow-ups (Phase 35 candidates)

- Surface `mode-usage` aggregate in the admin UI (currently API-only).
- Add a sibling `evt:'ai.tutor.response'` log capturing latency + token count + assistant length so the dashboard can show per-mode cost/length distributions.
- Consider a structured-log → time-series pipeline (a real `mode_usage_daily` materialized view) once there is enough deployed traffic to make it worthwhile.
- Optional: aggregate `hint.escalate` events into a per-step difficulty signal that feeds back into the adaptive resolver (the loop is currently open).
