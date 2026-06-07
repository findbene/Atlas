# Atlas Mini-Report — canonical format (owner directive, 2026-06-06)

**MANDATORY.** After EVERY Atlas task or mini-phase you complete, return this exact 12-section
report — never a vague summary, never just "done." It must be detailed enough for ChatGPT (the
director) to review state and issue the next safe instruction. Header the whole thing
`# Claude Code Mini-Report`. End with the explicit stop statement and **do not start the next phase
unless explicitly approved.**

Then ALSO archive it (see the "Archival" note at the bottom).

---

## 1. Task Received
Restate the exact task/phase. Include: phase name (if any); whether read-only / implementation /
audit / docs-only / test-only; the hard stops you were required to respect.

## 2. Completion Status
One of: **COMPLETED · PARTIALLY COMPLETED · BLOCKED · FAILED · STOPPED FOR APPROVAL**. Then 2–5 sentences.

## 3. Files Changed
Every changed file: path · change type (added / modified / deleted / generated / hook-generated) ·
short explanation · intentional vs tool/hook-generated. If none: "No files changed."

## 4. Scope Control / Hard Stops Check
Confirm each (yes/no), explain every "yes":
- App code changed? · DB schema/migration changed? · Project content changed? · Env/canary changed? ·
  OpenAPI/codegen changed? · Production touched? · Phase 52 touched? · Any row opted in? ·
  Any unexpected file changed?

## 5. Implementation Details
Functions/components/routes/helpers added or modified · important logic decisions ·
compatibility/BC notes · safety guards added · behavior intentionally left unchanged.

## 6. Tests and Gates Run
Each command: name · pass/fail · counts · failure reason (if failed) · new vs pre-existing.
For any required gate skipped: "NOT RUN — reason: ...".

## 7. Failures, Fixes, and Surprises
Broken assumptions · failed attempts · type errors · races · codegen/hook/dependency/runtime issues ·
anything tried that didn't work. If none: "No failures or surprises."

## 8. Current Git State
Branch · latest commit hash (if committed) · pushed? · `git status --short` · clean? · hook-managed dirty files.

## 9. Current Project State After This Task
What is now true · what is still not true · what remains dark/off · what is still blocked ·
whether the next planned phase can safely begin.

## 10. Remaining Risks / Blockers
Technical risks · test gaps · verification gaps · local-env blockers · production blockers ·
anything needing owner approval.

## 11. Recommended Next Step
"Recommended next step: ..." + classify as: read-only proposal / implementation / test-audit /
commit / rollback / owner approval.

## 12. Explicit Stop Statement
Exactly one of: "Stopped. Awaiting approval." · "Stopped. Ready for next instruction." ·
"Blocked. Awaiting owner decision." · "Failed. Needs correction before continuing."

---

## Archival (MANDATORY, same time as delivery)
Persist every mini-report to the repo-root HTML archive **`Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/`**
(single underscore after "Atlas"):
1. Add `src/NN-<slug>.md` (NN = next chronological number; first line `# Title`; second line
   `META: <date> · <status>`; body = the 12 sections in Markdown).
2. `cd` into the folder and run `python build.py` (uses the `markdown` pip lib — local dev tool) to
   regenerate `index.html` + the per-report page. Do NOT hand-edit generated HTML.
3. Commit the new `src/*.md` + regenerated HTML. `index.html` is the entry point.
