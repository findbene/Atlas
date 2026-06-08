# Phase 60G — GitHub-Ready Local Portfolio Repository Export
META: 2026-06-08 · COMPLETED · export-bundle implementation · commit 0903e90

## 1. Task Received
Phase 60G — upgrade the portfolio artifact system from a JSON bundle into a GitHub-ready LOCAL repository export: recruiter-ready repo files a learner downloads + manually uploads to GitHub, preserving Atlas's evidence-honesty boundary and avoiding OAuth/publishing risk. Hard stops: no GitHub OAuth/token/direct-push/public-publishing/public-pages/cert-marketing; no new serverGrade/opt-ins/kind flips; no envelope enforcement; no Phase 52/schema/migration (unless a proven export defect); deploy-manifest CORS = documentation/non-secret only; no secrets/force-push; do not start Phase 60H.

## 2. Completion Status
**COMPLETED.** Export layer + route + OpenAPI/client + frontend button + tests + real-data live scan + CORS doc note. Reviews architect **PASS** + code-reviewer **SHIP** (no P0/P1); 3 P2 test-completeness items fixed in-phase. Gates green. Committed `0903e90`, pushed `main`. Phase 60H not started.

## 3. Files Changed
Commit `0903e90` (20 files + generated): `lib/portfolioArtifact.ts` (export claim const), `lib/portfolioRepository.ts`(new)+`.test.ts`(new), `routes/user-portfolio-repository.ts`(new)+`.test.ts`(new), `routes/index.ts` (mount), `lib/api-spec/openapi.yaml` + regenerated `lib/api-client-react/src/generated/*` + `lib/api-zod/src/generated/*`, `components/DownloadGithubRepoButton.tsx`(new)+`.test.tsx`(new), `pages/certificates.tsx`, `.replit-artifact/artifact.toml` (CORS doc), `docs/phases/phase-60g-…md`(new), `.agentic/progress.md`.

## 4. Scope Control / Hard Stops Check
GitHub OAuth/token/direct-push/publishing/public-pages? **no** (manual-upload only; every such string is a disclaimer). New serverGrade/opt-in/kind? **no.** Envelope/Phase 52/schema/migration? **no.** New dep? **no** (`Github` icon from existing lucide-react). Deploy-manifest? **documentation-only commented note, non-secret, no domain invented.** Secrets/force-push? **no.** Phase 60H started? **no.**

## 5. Repository Export Format
`generatePortfolioRepository(input)` — a THIN layer over the 60A generator. Reuses the MD files verbatim; adds `atlas-portfolio.json` + optional `evidence/submission-summary.md`. Returns `{projectSlug, generatedAt, format:"github-ready-repository", files}` (files = repo-relative path → contents; learner rebuilds a `<projectSlug>/` folder). Deterministic (pure generator + sorted file list + fixed metadata key order). Fixed file-path constants (no slug/author interpolation → traversal impossible) + `assertSafeRepoPaths` guard (exported, negative-tested). `atlas-portfolio.json` = safe metadata only (project, file list, evidence COUNTS incl. serverGradedSteps, availability flags, Atlas-verified claim, limitations summary, manual-upload note, verifyUrl) — no spec/answer-key/serverGradeFlag. `evidence/submission-summary.md` emitted only when a snapshot exists; labelled "learner-submitted evidence, not an Atlas answer key"; no raw excerpt/hash/spec.

## 6. Backend Route / API Changes
`GET /api/user/projects/:projectSlug/portfolio-repository` (`routes/user-portfolio-repository.ts`), mounted in `routes/index.ts`. Sibling of the 60B artifact route: userId from session only, 404-not-403 for hidden/deleted/unknown/non-enrolled (shared `assemblePortfolioArtifactInput` chokepoint), read-only, fail-closed canonical `findBannedClaims` over the whole bundle. JSON response (no ZIP — out-of-scope dependency risk).

## 7. OpenAPI/Client Changes
Added the path + `PortfolioRepositoryResponse` schema (`files` = additionalProperties string for the nested `evidence/…` + json paths; `format` required enum). Regenerated orval in one controlled pass — **additive only (+184 / −0)**: `getPortfolioRepository` (client), `GetPortfolioRepositoryResponse` (zod), 3 generated type files. No generated file hand-edited; `.gitattributes` eol=lf keeps the diff content-only.

## 8. Frontend UX Changes
`DownloadGithubRepoButton` ("Download GitHub-Ready Repo", GitHub icon) renders next to "Download Portfolio Bundle" on each completed-project card (`certificates.tsx`). On click only → generated `getPortfolioRepository(slug)` → saves `<slug>-github-ready-repo.json` verbatim. Renders nothing from the bundle; generic non-leaky error; no OAuth/token/share affordance.

## 9. CORS Deploy-Manifest Decision
Added a COMMENTED, non-secret documentation note under `[services.production.run.env]` in api-server `artifact.toml` describing the Phase-60F `ATLAS_ALLOWED_ORIGINS` lever + how to set it to the deployed frontend origin(s). Left commented because the production frontend origin is unknown here — no domain invented, no runtime change (CORS stays production-inert reflective until an operator uncomments it). Honours the "documentation only if domain unknown" hard stop.

## 10. No-Leak Verification
Bundle + route response + DOM + downloaded JSON: no validationConfig / expectedRows / expectedRowsHash / spec / answer key / reference query / comparator diagnostic / secret / serverGradeFlag. Coverage: layer test (answer-key-impossible by construction — the input model has no spec field; emits the COUNT not the flag), route test (fixture with REAL `serverGrade:true` + `expectedRows`/`one_current`/`overlap`/`secretval`, incl. the snapshot-PRESENT path), frontend test (verbatim serialize, nothing rendered), and a real-data live scan (booted API + real C2 + 60F e2e learner with a real snapshot): 401 no-token, 404 unknown slug, all 6 files, serverGradedSteps=2, no spec tokens, `one_current` absent, no banned claims, summary learner-labelled. (`overlap` = the authored-prose "no overlapping…" substring, the documented 60E false positive — not the cell value.)

## 11. Evidence-Honesty Verification
Only the allowed Atlas-verified claim + honest limitations + an explicit manual-upload boundary. No authorship / no-outside-help / job-guarantee / certification / tamper-proof / cheat-proof copy. Canonical `findBannedClaims` returns zero hits over the bundle in both tests and fails the route closed at runtime.

## 12. Independent Review Results
- **architect → PASS** (no P0/P1): traced planted answer-key tokens end-to-end — cannot reach the bundle; submission-summary safe + correctly conditional; path guard correct + sufficient; access/privacy/honesty intact; scope clean.
- **code-reviewer → SHIP** (no P0/P1): determinism, self-referential file list, conditional summary, no-leak (count vs flag), route contract + non-vacuous negative control, frontend verbatim-serialize, additive codegen — all verified.
- **P2s fixed in-phase:** (1) snapshot-present route test (summary via HTTP + re-scan); (2) exported + negative-tested `assertSafeRepoPaths` (`../x` / `/abs` / `a\b` / `a/./b` / `a//b` / `""` / trailing-space / `*`); (3) `meta.files` === actual keys assertion + clarifying comment.

## 13. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck (4) + `check:no-heuristic-runtime` **OK** · **check:boot OK** · api-server unit **621/621** (+17: 9 repository-layer + 8 repository-route) · atlas **170/170** (+5 GitHub-repo button) · **integration 4/4** (regression) · `audit:authoring` exit 0 · `audit:sql-resultset-bc` PASS (3 dark + **1**) · `audit:csv-set-equal-bc` PASS (**1**) · `audit:contains-bc` 3/3 · real-data live route scan PASS.

## 14. Failures, Fixes, and Surprises
None of note. The export layer is a clean additive sibling of the proven 60B route; codegen was a clean additive pass. The only adjustments were the 3 P2 test-completeness fixes from the reviewers. The leak-token set for the repository tests intentionally avoids bare `serverGrade` (collides with the safe metadata key `serverGradedSteps`) — uses `serverGradeFlag` / `"serverGrade"` / `validationConfig` instead.

## 15. Current Git State
Branch `main`. Feature **`0903e90`** (20 files + generated) on top of `8759e08`, pushed (`8759e08..0903e90`). Archive commit follows. Working tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md` (intentionally not committed).

## 16. Remaining Risks / Blockers
Export is a JSON bundle (no ZIP, no GitHub connection — deliberate this phase; learner reconstructs the folder manually). `submission-summary.md` exports no per-step hash/excerpt (conservative no-leak posture). CORS production hardening remains an operator opt-in; the manifest documents it but can't set a real origin until the prod frontend domain is known.

## 17. Recommended Next Step
Owner approval for **Phase 60H** (none started): (1) ZIP packaging of the bundle (dependency-free, tested) for one-click; (2) a guarded GitHub publishing path (OAuth/token/push) — a SEPARATE risk class needing its own token-handling + security review; (3) optionally surface the one-way submission hashes in `submission-summary.md` behind a fresh no-leak review. Set `ATLAS_ALLOWED_ORIGINS` in the deploy manifest once the prod origin is known.

## 18. Explicit Stop Statement
**Stopped.** GitHub-ready repository export shipped as a thin, leak-safe layer over the proven artifact system (new route + atlas-portfolio.json + optional learner-evidence summary + frontend button), verified no-leak/honest at the layer, route, frontend, and real-data live scan. Reviews PASS/SHIP, gates green, committed `0903e90`. **No GitHub OAuth / token / push / publishing added. Phase 60H NOT started.** Awaiting next instruction.
