### Progressive Hints + Socratic Tutor

Hint ladder (L0–L5) lives in `pedagogy_config` jsonb on `project_steps` (plus nullable `learning_objective`, `required_skill` columns). Per-user hint state in `user_project_step_hints` (unique on `user_id, step_id`). Mappers + `evaluateHintPolicy` + `hintsUpTo` + `MAX_HINT_LEVEL=5` in `lib/execution-core/src/pedagogy.ts`.

Routes in `artifacts/api-server/src/routes/hints.ts`:
- `GET /api/projects/:slug/steps/:stepId/hint` — current level, unlocked hint texts, feedback fields, policy-suggested next level.
- `POST /api/projects/:slug/steps/:stepId/hint/next` — atomic upsert via `ON CONFLICT (user_id, step_id) DO UPDATE` with `LEAST(cap, GREATEST(hint_level + 1, desired))`, so concurrent requests can't double-increment past the cap or regress. `desired` honors the per-mode policy (e.g. `adaptive_inquiry` jumps to L3 after 2 fails).

Disclosure boundary is server-side: tutor route (`ai.ts`) injects only `hintsUpTo(pedagogy, currentLevel)` into `<step_pedagogy>`; `finalExplanation` is only returned/streamed when `currentLevel >= MAX_HINT_LEVEL` or the step is passed. Frontend hiding is UX, not security. `currentCode` is sanitized before being placed inside `<user_data>` — any literal `</user_data>` / `<project_context>` etc. has a zero-width space inserted after the `<` so a learner's input can't close the untrusted envelope and resume "trusted" instructions.

DB enum `learning_mode` is still `('guided','hint','independent')`. We map at the app layer to the 4 Atlas mode names; `dynamic_ai_adaptive` aliases to `guided` until the enum is extended (TODO — requires a Drizzle migration to add the new variant; user-facing toggle blocked on this).

**Per-process hint state cache** — same caveat as `userCache` in `requireAuth`: the hint API and tutor route read `user_project_step_hints` per request without an in-memory cache today, but any future caching layer (e.g. to avoid the SELECT on every tutor message) MUST be invalidated on every `POST /hint/next`. For multi-instance deployments this either needs Redis or a TTL strategy. Single-instance deployments are fine without it.

Phase 4 also added a FK on `user_project_step_hints.step_id → project_steps(id) ON DELETE CASCADE` so deleting a step automatically cleans up learner hint state (Phase 5 §0 cleanup).

