# Atlas — Session Handoff

**HEAD:** Phase 34 — Ada Tutor Step Contract + Mode Telemetry, committed at `9f6edb7`.
**Last shipped + committed:** Phase 34 — Ada Tutor Step Contract + Mode Telemetry at `9f6edb7` (parent: Phase 33 at `7d7f1bea`).
**Status:** Phase 34 **SHIPPED**. Working tree clean (or carrying only the trim-replit-phase-history docs cleanup).

Atlas remains deploy-ready (Phase 31 unchanged). **No deployment has occurred. No production DB has been touched.**

---

## Phase 34 working-tree changes

**New files**
- `lib/execution-core/src/tutorContract.ts` — pure `buildTutorContract(input)` + `renderTutorContractForPrompt(contract)` + `resolveAdaptiveMode(signals)`. Returns `{mode, effectiveMode, resolvedFromAdaptive, helpBoundary, allowedBehaviors[], forbiddenBehaviors[], validationGuidance, responseStyle}`. Independent + not-passed pinned to `diagnostic-only` with explicit "Do NOT reveal the full solution" + "portfolio credibility" clauses; independent + passed → `review-permissive`. Adaptive resolves first-match-wins (stepPassed→independent; lastFailed+≥2 attempts OR hintLevel≥3 OR ≥3 attempts→guided rescue; else hint, never guided).
- `lib/execution-core/src/tutorContract.test.ts` — 17 cases: each mode boundary, all adaptive resolution branches, render shape, and the solution-leak invariant (independent + not-passed must always include "Do NOT reveal the full solution" regardless of attemptCount/hintLevel).
- `docs/phases/phase-34-ada-tutor-step-contract.md` (close-out).

**Modified files**
- `lib/execution-core/src/index.ts` — exports `buildTutorContract`, `renderTutorContractForPrompt`, `resolveAdaptiveMode`, `TutorContractInput`, `TutorContract`, `HelpBoundary`.
- `artifacts/api-server/src/routes/ai.ts` — renamed `SYSTEM_PROMPT` → `SYSTEM_PROMPT_BASE`, stripped the inline P4-era "Mode-aware tone" bullets, added "TUTOR CONTRACT below" references. Per-request, after assembling `learnerStateBlock`, builds the contract from the SAME signals (`atlasMode`, `attemptCount`, `currentHintLevel`, `lastValidationFailed`, `stepPassed`) and appends `renderTutorContractForPrompt(contract)` to the system prompt **outside** the untrusted `<learner_state>` / `<project_context>` / `<step_pedagogy>` / `<user_data>` envelopes. Emits `req.log.info({evt:'ai.tutor.request', userId, projectId, stepId, tier, model, contract:{…}})` BEFORE the upstream stream call (so failures still emit). General-context requests → base prompt only + `telemetry: null` in the log.
- `artifacts/api-server/src/routes/hints.ts` — `POST /projects/:slug/steps/:stepId/hint/next` emits `req.log.info({evt:'hint.escalate', userId, projectId, projectSlug, stepId, mode, priorLevel, desiredLevel, cap, attemptCount, lastValidationFailed, stepPassed})` AFTER the atomic upsert (so the log reflects what was persisted).
- `artifacts/api-server/src/routes/admin.ts` — new `GET /api/admin/mode-usage` (requireAdmin). Reads `user_progress.learning_mode` via `db.execute(sql\`SELECT learning_mode, COUNT(*)::int AS n FROM user_progress GROUP BY learning_mode\`)`. Returns `{totalEnrollments, byMode:{guided,hint,independent,dynamic_ai_adaptive}, percentByMode}` — flat aggregate, no per-user/per-project detail, defensive on unknown enum values, divide-by-zero guarded.
- `artifacts/api-server/src/routes/ai.test.ts` — extended db mock with `userProgress` / `userProjectStepHints` / `userStepCompletions` query stubs; added `streamSpy` capturing `messages.stream(args)` so tests can assert on `system`. New 6-case suite "POST /ai/chat — Phase 34 Tutor Contract injection".
- `artifacts/api-server/src/routes/admin.test.ts` — db mock gained `execute` + `userProgress` sentinel; `drizzle-orm` mock switched to `importActual` passthrough (was a stub-only export). New 5-case suite "GET /api/admin/mode-usage".
- `replit.md` (Phase History: P26 stays in scope, P34 prepended).
- `docs/phases/INDEX.md` (P34 entry appended).
- `HANDOFF.md` (this file).

**Unchanged:** every schema file, every migration, every other backend route (incl. `/check`, `/submit`, cert-verify, portfolio, billing, dashboard, onboarding, enrollment, learner-mode, hints-GET), every frontend file (atlas + mockup-sandbox), OpenAPI spec, all codegen output, seed/content/rubric/anchor/wave files, deployment checklist, scripts. The Tutor Contract module is purely additive; `SYSTEM_PROMPT_BASE` retains the full hint-discipline + safety hard floor verbatim — the contract tightens per-mode behavior on top, never below.

---

## Strategy decisions

1. **Pure helper in execution-core, not a route-local function.** Keeps the policy testable without DB / Anthropic / Express harnesses, and locks the solution-leak invariant in a single place architect explicitly flagged for future regressions.
2. **Contract OUTSIDE untrusted envelopes.** Rendered text appended to `SYSTEM_PROMPT_BASE` directly, never inside `<learner_state>` or `<project_context>`. Same threat model as the existing base prompt.
3. **Adaptive resolves to a CONCRETE mode at the contract layer.** The model never sees a bare `dynamic_ai_adaptive` label without an explicit `effective_mode (adaptive resolution): …` line right next to it. Rules first-match-wins, deterministic, signal-echoed.
4. **Adaptive default = hint, not guided.** A learner who picked `dynamic_ai_adaptive` opted out of always-on scaffolding; we only rescue to guided when the struggle signals (lastFailed+≥2 attempts, hintLevel≥3, attempts≥3) actually fire.
5. **Independent splits on `stepPassed`.** Pre-pass → `diagnostic-only` (Socratic, no leak). Post-pass → `review-permissive` (discuss solution + alternatives). Mirrors Phase 33's dampened-diff posture in `RemediationPanel` — consistent end-to-end.
6. **Schema-free telemetry only.** No new tables, no migration, no Stripe-style sync. Structured `req.log.info({evt, …})` is enough for an operator to `rg evt:.ai.tutor.request` today; a real dashboard is a follow-up phase.
7. **Telemetry timing matters.** `ai.tutor.request` fires BEFORE the upstream stream (so failures still emit). `hint.escalate` fires AFTER the upsert (so the log reflects what was actually persisted, preventing "logged-but-didn't-write" false signal).
8. **`mode-usage` admin endpoint has zero per-user shape.** 4-row aggregate; no joins, no ids, no slugs. Locked by an explicit no-PII assertion in the test.
9. **Architect's nit consolidated.** Original `resolveAdaptiveMode` had a redundant final `if`/`else` returning the same value — collapsed to a single labeled return with a comment explaining why the default is hint rather than guided.

---

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
| Architect review | **PASS** after one Medium consolidation (redundant adaptive branch) |

## Hard-rule re-verification

- Schema / migration changes: **none**.
- `/check`, `/submit`, cert-verify, portfolio, billing, deployment, Stripe, OpenAPI codegen: **untouched**.
- `learner_visible = TRUE` filter on learner-facing routes: **unchanged** (404-not-403 privacy intact).
- Bidirectional candidate ↔ project lineage: **untouched**.
- RUBRIC_VERSION='1.0.1': **frozen**.
- 4-file no-heuristic allowlist: **not expanded** (`check:no-heuristic-runtime` green).
- 9 Atlas courses + "Atlas is a project-based learning platform for Data Engineering" framing: **unchanged**.

## Untracked scratch

- `attached_assets/Pasted-*.txt` from prior sessions remain untracked. **Do not commit.**

## Known follow-ups (Phase 35 candidates)

- Surface `mode-usage` aggregate in the admin UI (currently API-only).
- Add a sibling `evt:'ai.tutor.response'` log capturing latency + token count + assistant length so the dashboard can show per-mode cost/length distributions.
- Consider a structured-log → time-series pipeline (a real `mode_usage_daily` materialized view) once there is enough deployed traffic.
- Optional: aggregate `hint.escalate` events into a per-step difficulty signal that feeds back into the adaptive resolver (the loop is currently open).
