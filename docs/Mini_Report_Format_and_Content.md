Going forward, after every task or mini-phase you complete for Atlas, return a structured mini-report in the format below.

Do not give a vague summary. Do not only say “done.” The report must be detailed enough for ChatGPT to review the state and give the next safe instruction.

Use this exact report structure:

# Claude Code Mini-Report

## 1. Task Received

Restate the exact task/phase you were asked to complete.

Include:

* phase name, if any
* whether the task was read-only, implementation, audit, docs-only, or test-only
* hard stops you were required to respect

## 2. Completion Status

State one of:

* COMPLETED
* PARTIALLY COMPLETED
* BLOCKED
* FAILED
* STOPPED FOR APPROVAL

Then explain in 2–5 sentences.

## 3. Files Changed

List every changed file.

For each file, include:

* file path
* change type: added / modified / deleted / generated / hook-generated
* short explanation of what changed
* whether the change was intentional or tool/hook-generated

If no files changed, say:

“No files changed.”

## 4. Scope Control / Hard Stops Check

Explicitly confirm whether each hard stop was respected.

Use this format:

* App code changed? yes/no
* DB schema/migration changed? yes/no
* Project content changed? yes/no
* Env/canary changed? yes/no
* OpenAPI/codegen changed? yes/no
* Production touched? yes/no
* Phase 52 touched? yes/no
* Any row opted in? yes/no
* Any unexpected file changed? yes/no

If any answer is “yes,” explain why.

## 5. Implementation Details

Explain what you actually changed technically.

Include:

* functions/components/routes/helpers added or modified
* important logic decisions
* compatibility/backward-compatibility notes
* safety guards added
* behavior that intentionally remains unchanged

## 6. Tests and Gates Run

List every command/test/audit run.

For each one, include:

* command name
* pass/fail
* important counts, if available
* failure reason, if failed
* whether failure is new or pre-existing

Example:

* `pnpm typecheck` — PASS
* `pnpm test --filter api-server` — PASS, 459/459
* `pnpm audit:csv-set-equal-bc` — PASS, 15/15 byte-identical

If a required gate was not run, state clearly:

“NOT RUN — reason: ...”

## 7. Failures, Fixes, and Surprises

List anything that failed, was corrected, or contradicted the original assumption.

Include:

* broken assumptions
* failed test attempts
* type errors
* race conditions
* codegen issues
* hook behavior
* dependency/runtime problems
* anything Claude Code tried that did not work

If nothing failed, say:

“No failures or surprises.”

## 8. Current Git State

Include:

* current branch
* latest commit hash, if committed
* whether pushed
* `git status --short`
* whether working tree is clean
* any hook-managed dirty files

## 9. Current Project State After This Task

Explain the new state of the project after your work.

Include:

* what is now true
* what is still not true
* what remains dark/off
* what is still blocked
* whether the next planned phase can safely begin

## 10. Remaining Risks / Blockers

List unresolved issues.

Include:

* technical risks
* test gaps
* verification gaps
* local environment blockers
* production blockers
* anything requiring owner approval

## 11. Recommended Next Step

Give one recommended next action.

Use this format:

“Recommended next step: ...”

Also state whether the next step should be:

* read-only proposal
* implementation
* test/audit
* commit
* rollback
* owner approval

## 12. Explicit Stop Statement

End with one of these:

* “Stopped. Awaiting approval.”
* “Stopped. Ready for next instruction.”
* “Blocked. Awaiting owner decision.”
* “Failed. Needs correction before continuing.”

Do not start the next phase unless explicitly approved.
