# Phase 57B-flip — promote C2 + opt in one csv_set_equal step
META: 2026-06-06 · SHIPPED — first LIVE opt-in (1 row), envelope off · commit 055049b

## 1. Task Received
Promote the repaired C2 candidate to visible/publish-ready and enable `serverGrade:true` on exactly one verified `csv_set_equal` step (C2 step 3). Re-seed, resolve the 2 deferred P2s if low-risk, add OpenAPI/Orval `serverGrade` honesty, run gates + reviews, validate the opt-in path. Envelope enforcement stays off; Phase 52 untouched.

## 2. Completion Status
**DONE** (one caveat). Committed `055049b`, pushed. All mechanical gates green. **Caveat:** the independent `atlas-architect-reviewer` + `code-reviewer` subagents returned `API Error: 529 Overloaded` on 2 attempts each (Anthropic outage) and produced no findings; a rigorous Opus self-review was performed instead — re-run the subagent reviews when the API recovers.

## 3. Files Changed (10 files, +311/−83)
Source: authored C2 (serverGrade), `project-workspace.tsx` (toast P2), `audit-csv-set-equal-bc.ts` (audit extension). Spec/codegen: `openapi.yaml` + `api-client-react/.../api.schemas.ts` + `api-zod/.../api.ts` + `api-zod/.../types/projectStep.ts`. Docs: close-out + `.agentic/progress.md` + `CLAUDE.md`. DB ops (not in git): backfill + promote + audit --commit.

## 4. Scope Control / Hard Stops
**Exactly one row opted in** (grep `serverGrade` in `scripts/src/authored/` → single hit). No envelope enforcement (`csv_set_equal` not in `PILOT_RUNTIME_KINDS`; `ATLAS_ENVELOPE_REQUIRED_KINDS` empty; envelopeGrade.ts/envelopeSubmit.ts/user.ts **zero diff**). Phase 52 untouched · no schema/migration · no cloud/waves · no cert/marketing copy · no secrets · no force-push. Generated diff kept focused (autocrlf normalized away ~95 EOL-only churn files).

## 5. Implementation Details
- **Promotion:** `backfill:phase55-candidates` (created C2 candidate `c2dbc2db`) → `author:project promote` (inserts visible `projects` row — `learnerVisible` default TRUE; learner routes gate on `learnerVisible` only, not `qualityStatus` — + 8 steps + atomic inverse-lineage stamp) → `audit --commit` → **rubric 85.3 → qualityStatus=approved**.
- **serverGrade:** `...semantic-layer...ts:379` — `serverGrade: true` as first key of the step-3 csv_set_equal spec; authoring guard accepts it.
- **OpenAPI/Orval:** optional `ProjectStep.serverGrade: boolean` → regen added `serverGrade?: boolean` to schemas + zod. Optional → backward-compatible. `typecheck:libs` passed.
- **P2s:** P2b (needs-run) **resolved** — neutral `toast` + early return, no red CHECK/SUBMIT_FAIL, step stays `editing`. P2a (popstate clear) **deferred with rationale** — nav is replaceState-only (popstate never fires for step changes) + capture is per-stepId keyed, so no stale/cross-step submission is possible; clearing would risk discarding a valid capture.

## 6. Tests and Gates Run
typecheck + check:no-heuristic-runtime **PASS** · execution-core **83/83** · atlas **159/159** · api-server **466/466** · curriculum-quality **132 pass** (1 env-only `COURSE_TAXONOMY` ENOENT) · `audit:authoring` **exit 0** (48 visible projects, 100 steps) · `audit:contains-bc` **PASS 3/3** · `audit:csv-set-equal-bc` **PASS**. Architect + code review — **subagents 529'd**; Opus self-review performed.

## 7. audit:csv-set-equal-bc — expected visible count
`Visible csv_set_equal steps: 1 (dark: 0, opted-in: 1)` · dark BC mismatches 0 · opt-in grading checks **5/5 pass** · **PASS**.

## 8. Step 3 pass/fail validation evidence
Extended audit exercised the live row through the real `gradeSubmission`→`gradeCsvSetEqual` commit path: correct `{columns, rows:expectedRows}` → **pass**; `""` / raw SQL / malformed JSON / wrong-rows (mrr 199→200) → **all fail closed**. End-to-end chain: Phase-0.zz browser-WASM output == `expectedRows` (byte-verified) → FE submits exactly that capture on commit → server passes.

## 9. Phase 52 + envelope enforcement
Untouched. `envelopeGrade.ts`/`envelopeSubmit.ts`/`user.ts` zero diff; `PILOT_RUNTIME_KINDS={json_equal}` (csv_set_equal excluded); `ATLAS_ENVELOPE_REQUIRED_KINDS` empty. The opted-in row is graded by the commit path only; envelope rides along as provenance, not enforced. No env/canary change.

## 10. Current Git State + Project State
HEAD `055049b` on `main`, pushed. Working tree clean except hook-managed files. C2 is now a **visible, approved project with 1 server-graded csv_set_equal step**; catalog 48 visible projects / 100 steps; envelope dark.

## 11. Remaining Risks / Blockers
- **Independent review pending** — architect + `/code-review` 529'd; re-run when API recovers (the one gate not completed by a subagent). Self-review found no issues.
- **R1:** `audit:authoring` static classifier still labels csv_set_equal "client-provisional" (ignores serverGrade) — informational only.
- **R2:** generated-file CRLF churn (orval 8.5.3 vs repo CRLF) — handled via autocrlf; durable fix = `.gitattributes eol=lf` for `lib/*/src/generated/**`.
- **R3:** enterprise-NRR filter dead-branches (carried 0.z) — future fixture-author caution.
- Envelope enforcement for csv_set_equal = separate future operator decision (independent of this opt-in and of the parked Phase-52 canary).

## 12. Recommended Next Step
Re-run `/code-review` + `atlas-architect-reviewer` when the API recovers, then **observe the single opted-in row** in a real env (staging/private beta) before opting in more rows or considering envelope enforcement. Next hardening = Phase 58 (`sql_resultset`) — do not start until the flip is reviewed + observed.

## Explicit Stop
Stopped after Phase 57B-flip. Exactly one row opted in (C2 step 3); envelope enforcement off; Phase 52 untouched; Phase 58 not started.
