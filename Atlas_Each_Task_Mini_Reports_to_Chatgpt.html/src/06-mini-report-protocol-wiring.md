# Mini-Report Protocol — wire 12-section report + HTML archive into memory + hooks
META: 2026-06-06 · COMPLETED · config/docs-only

## 1. Task Received
Owner directive (config/docs-only): make two obligations permanent + reliably executed after EVERY Atlas task/mini-phase — (1) return the exact 12-section `# Claude Code Mini-Report`; (2) save each report as HTML in `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html` (single underscore). Wire into permanent/persistent memory; use hooks or other methods so it is delivered on time without prompting. Hard stops: don't break existing build/grader state; no production/schema/env/canary change.

## 2. Completion Status
**COMPLETED.** Both obligations are now wired in four reinforcing places: project `CLAUDE.md` (loaded every turn), persistent memory, a canonical template file, and a SessionStart hook. The archive folder was reconciled to the owner's single-underscore name and this very report was filed into it via the documented flow.

## 3. Files Changed
- `.claude/atlas-mini-report-template.md` — **added** — canonical 12-section format + archival steps (single source of truth). Intentional.
- `CLAUDE.md` — **modified** — new MANDATORY "Mini-report protocol" section. Intentional.
- `.claude/hooks/atlas-mini-report-reminder.sh` — **added** — SessionStart hook that injects the two-obligation reminder each session. Intentional.
- `.claude/settings.json` — **modified** — wired the SessionStart hook. Intentional.
- `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/**` — **added** (git rename from the old `Atlas__…` double-underscore folder, which is **deleted**) + `src/06-mini-report-protocol-wiring.md` (this report) + regenerated `index.html` and `phase-*.html`. Intentional.
- `~/.claude/projects/.../memory/atlas-chatgpt-mini-report.md` — **modified** (outside repo) — single-underscore path + enforcement note.

## 4. Scope Control / Hard Stops Check
- App code changed? **no**
- DB schema/migration changed? **no**
- Project content changed? **no**
- Env/canary changed? **no**
- OpenAPI/codegen changed? **no**
- Production touched? **no**
- Phase 52 touched? **no**
- Any row opted in? **no**
- Any unexpected file changed? **no** (folder rename is the owner-intended single-underscore path)

## 5. Implementation Details
Four-layer enforcement: (a) `CLAUDE.md` mandatory section — loaded into context every turn, the primary safeguard; (b) `.claude/atlas-mini-report-template.md` — the exact format, referenced everywhere so it lives once; (c) memory `atlas-chatgpt-mini-report` — the why + the archival how, persistent across sessions; (d) SessionStart hook — injects a terse reminder each session (non-blocking, `exit 0`). `build.py` is path-agnostic (uses its own dir), so the folder rename needed no code change. No behavior of the app/grader touched.

## 6. Tests and Gates Run
- `python build.py` (archive regen) — **PASS** (rebuilt index.html + 7 standalone pages from 7 src reports).
- No code gates required (config/docs-only; no app/lib/scripts source touched). typecheck/test/audit — **NOT RUN — reason:** out of scope (no code change).

## 7. Failures, Fixes, and Surprises
The archive folder had been renamed on disk by the owner from `Atlas__Each…` (double underscore) to `Atlas_Each…` (single) — git showed the old as deleted + the new as untracked. Reconciled by committing the rename and standardizing every reference to the single-underscore path. No other surprises.

## 8. Current Git State
Branch `main`; previous HEAD `43381bb` (mini-report archive). This change (template + hook + settings + CLAUDE.md + folder rename + this report) committed on top and pushed. Working tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md`.

## 9. Current Project State After This Task
The mini-report + archive protocol is now self-reinforcing across CLAUDE.md, memory, template, and a hook. Every future Atlas task will produce the 12-section report and archive it. No engineering state changed; Phase 57B-flip remains the last shipped phase (1 csv_set_equal row opted in, envelope off), pending independent review + observation.

## 10. Remaining Risks / Blockers
- The SessionStart hook surfaces a reminder but cannot *force* output; the real guarantee is the CLAUDE.md per-turn rule + discipline. Low risk.
- 57B-flip's independent subagent reviews are still pending (API 529'd earlier) — unrelated to this task but still open.

## 11. Recommended Next Step
Recommended next step: re-run `/code-review` + `atlas-architect-reviewer` on Phase 57B-flip now that the API has recovered (owner approval / test-audit). This protocol task itself needs nothing further.

## 12. Explicit Stop Statement
Stopped. Ready for next instruction.
