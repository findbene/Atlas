# Phase 60C — Portfolio Artifact Client Contract + Frontend Manual Download UX
META: 2026-06-07 · COMPLETED · implementation (OpenAPI + orval codegen + FE download UX) · commit b748cc9

## 1. Task Received
Phase 60C — make the Phase-60B authenticated portfolio-artifact route usable from the Atlas frontend: add the OpenAPI/client contract, regenerate the orval clients in a controlled way, and add a narrow manual-download UX for completed projects. Hard stops: no GitHub OAuth / direct push / publishing / public portfolio pages / cert-marketing; no new `serverGrade`/opt-ins/kind flips; no envelope enforcement; no Phase 52 / env / canary / cloud changes; no schema/migration (unless fixing a 60B defect — none needed); no force-push; no secrets; do not start Phase 60D.

## 2. Completion Status
**COMPLETED.** OpenAPI path + schema added; orval regen purely additive; scoped `.gitattributes`; on-demand JSON download button on the Certificates page; FE + contract tests; reviews architect **PASS** + code-reviewer **SHIP** (no P0/P1); all gates green. Phase 60D not started.

## 3. Files Changed
- `lib/api-spec/openapi.yaml` — **modified**: new GET path + `PortfolioArtifactResponse` schema.
- `lib/api-client-react/src/generated/{api.ts,api.schemas.ts}` — **regen** (additive).
- `lib/api-zod/src/generated/{api.ts,types/index.ts,types/portfolioArtifactResponse.ts,types/portfolioArtifactResponseFiles.ts}` — **regen/new** (additive).
- `.gitattributes` — **new** (scoped eol=lf: 2 generated dirs + openapi.yaml only).
- `artifacts/atlas/src/components/DownloadPortfolioBundleButton.tsx` (+`.test.tsx`) — **new**.
- `artifacts/atlas/src/pages/certificates.tsx` — **modified** (import + per-card button).
- `artifacts/api-server/src/routes/user-portfolio-artifact.test.ts` — **modified** (+contract test).
- `docs/phases/phase-60c-portfolio-artifact-client-and-download.md`, `.agentic/progress.md` — **new/modified**.
- Hook-managed (NOT in commit): `.agentic/self-review.log`.
Commit `b748cc9` = 14 files, +779/−0.

## 4. Scope Control / Hard Stops Check
App code? **yes** (FE button + OpenAPI + generated client). DB schema/migration? **no.** Grading/behavior? **no.** Env/canary/cloud? **no.** Phase 52? **no.** New serverGrade/opt-in/kind? **no.** GitHub OAuth/publishing/public pages/cert-marketing? **no.** Force-push/secrets? **no.** Phase 60D started? **no.**

## 5. OpenAPI / Client Changes
NEW `GET /user/projects/{projectSlug}/portfolio-artifact` (operationId `getPortfolioArtifact`, `security: clerkAuth`, path param `projectSlug`; 200→`PortfolioArtifactResponse`, 401+404→`ErrorResponse`). NEW schema `PortfolioArtifactResponse` = `{projectSlug, generatedAt(date-time), files{README.md, VALIDATION_EVIDENCE.md, LIMITATIONS.md, LEARNER_REFLECTION_TEMPLATE.md required; DATASET_NOTES.md optional}}` (filename→markdown only). Codegen via `pnpm --filter @workspace/api-spec run codegen` (orval 8.5.3 → react-query client + zod, then `typecheck:libs`); no hand-edits. Generated: `getPortfolioArtifact` raw fn + `useGetPortfolioArtifact` hook + `GetPortfolioArtifactResponse` zod.

## 6. Frontend UX Implemented
`DownloadPortfolioBundleButton` on the existing **Certificates** page (already lists every completed project with its slug). On **click** (never on mount) → generated raw `getPortfolioArtifact(slug)` → `JSON.stringify(bundle, null, 2)` → Blob download `${slug}-portfolio.json` (object URL revoked in `finally`). States: idle / loading (`Preparing bundle…`, disabled) / error. Deliberately NOT the auto-firing `useGetPortfolioArtifact` query (that would build an artifact per completed card on render) — one build per click. Boring, narrow, no dashboard redesign.

## 7. Download Format Decision
**JSON** (preferred per brief). The route already returns a structured `{projectSlug, generatedAt, files}` object → a single JSON file is the dependency-free, test-verifiable representation. **ZIP not implemented** (not trivial + not tested → out of scope).

## 8. Access / Error Behavior
All failures collapse to one safe state via the component's `catch`: 401 (expired session), 404 (hidden/soft-deleted/unknown/not-enrolled — 60B's 404-not-403), 5xx, and network rejects all → generic `Couldn't prepare the bundle. Please try again.` The server error body is never read/surfaced; on failure no object URL/anchor-click fires (no file written). A completed project with **no durable snapshot** still returns 200 and downloads (artifact degrades honestly in LIMITATIONS.md).

## 9. No-Leak Verification
The client serialises ONLY the route output and reads no individual field; it renders **none** of the bundle into the DOM (asserted). The no-leak guarantee stays server-side (unchanged 60B assembly chokepoint + route); 60C adds no new channel — the OpenAPI `files` exposes only filename→markdown. FE test asserts the downloaded payload carries no `validationconfig`/`expectedrows`/`expectedrowshash`/`servergrade`/`answer key`/`select `/`"spec"` tokens; the load-bearing server leak test (`user-portfolio-artifact.test.ts`) remains the real guard.

## 10. Evidence-Honesty Verification
Only static client copy (button/label/error). FE test asserts no forbidden authorship/job/certification claim renders. Backend runtime `findBannedClaims` fail-closed guard unchanged. No certificate/credential marketing added.

## 11. Generated-File Churn / EOL Notes
**The feared ~95-file orval CRLF churn did NOT occur** — a prior session already normalised the generated files to LF in the git index, so orval's LF output diffs **content-only**: purely additive **+316 lines, 0 deletions** across the generated dirs. Added a scoped `.gitattributes` (`text eol=lf` for `lib/api-client-react/src/generated/**`, `lib/api-zod/src/generated/**`, `lib/api-spec/openapi.yaml`) to keep future regens content-only — does NOT renormalise the rest of the repo. Git emits expected "CRLF→LF on next touch" notices for those paths (intended).

## 12. Independent Review Results
- **atlas-architect-reviewer → PASS** (no P0/P1): traced certificates → button → raw fn → 60B route → JSON download; confirmed additive diff (0 deletions), scoped `.gitattributes`, on-demand fetch, 404-not-403 preserved, exactly 2 serverGrade rows, envelope OFF, Phase 52 untouched. P2: contract zod not `.strict()` (generated, not editable — server leak test is the real guard) → noted; missing close-out → **FIXED**.
- **code-reviewer → SHIP** (no P0/P1): verified object-URL revoke in `finally`, error privacy (server body never read), non-vacuous tests, conventions match. P2: global URL mocks not restored → **FIXED**; unmount-mid-fetch setState → **DEFERRED** (React 18 no-warn, no crash/leak, tiny manual button); `generatedAt` Date-vs-string + leak-test-is-server-side → noted (expected orval / by-design).

## 13. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck + check:no-heuristic-runtime **PASS** · api-server **588/588** (+1 contract test) · atlas **165/165** (+6 download-button tests) · orval codegen clean + `typecheck:libs` PASS · audit:csv-set-equal-bc PASS (1 opt-in) · audit:sql-resultset-bc PASS (3 dark + 1 opt-in) · audit:contains-bc 3/3 · audit:authoring exit 0.

## 14. Failures, Fixes, and Surprises
- **Surprise (good):** expected the ~95-file CRLF storm; got a clean additive diff because the index was already LF — `.gitattributes` now locks that in.
- **Fix (code-reviewer P2):** test reassigned `globalThis.URL.createObjectURL/revokeObjectURL` without restoring → added `afterEach` restore of the captured originals. Did NOT use `vi.restoreAllMocks()` (it would remove the module-level anchor-click spy and break the assertions); restored only the two globals. Re-ran the file: 6/6 green.
- **Fix (architect P2):** added the missing `docs/phases/phase-60c-*.md` close-out.

## 15. Current Git State
Branch `main`. Feature commit **`b748cc9`** (14 files, +779/−0) on top of `f8c0aa4`. Archive commit follows. `git status --short` clean except hook-managed `.agentic/self-review.log`. Will push to `main` after the archive.

## 16. Remaining Risks / Blockers
- Contract test uses a non-`.strict()` generated zod (can't reject extra fields) — the server leak test is the real guard; noted, not a defect.
- Unmount-mid-fetch abort guard deferred (cosmetic) — revisit if the button moves to a higher-churn surface.
- Full app UI can't boot until Phase 0.2 (Replit-connector decouple); the button is unit-verified, not browser-booted end-to-end.
- Pre-60B completions still have no durable snapshot (honest degrade, no backfill).

## 17. Recommended Next Step
**Owner approval to start Phase 60D** (likely: optional safe submission-excerpt preview behind a fresh no-leak review, then GitHub export/publishing — the deferred E2 tail). Do not begin unprompted. Optional parallel cleanups (owner-approve): Phase 0.2 connector decouple for a real `pnpm dev` to browser-verify the download end-to-end.

## 18. Explicit Stop Statement
Stopped. Phase 60C complete, reviewed (PASS/SHIP), committed `b748cc9`, gates green. Phase 60D NOT started. Awaiting next instruction.
