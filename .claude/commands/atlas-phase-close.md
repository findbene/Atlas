---
description: Close out an Atlas phase — write the close-out doc and rotate HANDOFF.md, docs/phases/INDEX.md, and replit.md Phase History. Use only after /atlas-validate is green and the architect review is PASS.
argument-hint: <phase-id>
---

# Atlas Phase Close — `$ARGUMENTS`

Finalize the phase record so the next session (or agent) recovers full context. Run only after all gates are green and `atlas-architect-reviewer` returned PASS.

## Steps

1. **Write close-out** `docs/phases/phase-$ARGUMENTS-<slug>.md` matching the existing close-out shape: summary · files-changed table · gates table (with deltas) · architect review history (rounds + verdict) · known caveats (user-accepted) · next-phase recommendation.
2. **Rotate `HANDOFF.md`** — update "Latest shipped phase", working-tree status, visible catalog count, parent commit chain, the per-phase summary block, and the gates table. HANDOFF.md is the single source of truth for live state.
3. **Rotate `docs/phases/INDEX.md`** — move the latest-pointer to this phase; append the chronological entry.
4. **Rotate `replit.md` Phase History** — keep the latest 3 phases inline; the displaced one lives only in INDEX.md.
5. **Update `.agentic/progress.md`** — current phase, next steps, any new decisions/deviations.
6. **Stage + summarize commit.** Propose a conventional-commit message (`feat|fix|refactor(scope): …`). Do NOT commit unless the owner says so. Append the standard Co-Authored-By trailer.

## Guardrails

Do not overstate. If a caveat was user-accepted, record it verbatim. If a gate was skipped, say which and why. Quote the real gate numbers — never fabricate a passing count.
