# Phase 60H — One-Click ZIP Export for GitHub-Ready Portfolio Repository
META: 2026-06-08 · COMPLETED · ZIP packaging · commit 0b23adf

## 1. Task Received
Phase 60H — convert the Phase-60G GitHub-ready repository JSON export into a true one-click downloadable ZIP archive: a folder-structured `<project-slug>/…` bundle the learner downloads + manually uploads to GitHub. Hard stops: no GitHub OAuth/token/direct-push/public-publishing/public-pages/cert-marketing; no new serverGrade/opt-ins/kind flips; no envelope; no Phase 52/schema/migration (unless a proven export defect); no secrets/force-push; do not start Phase 60I.

## 2. Completion Status
**COMPLETED.** Dependency-free ZIP writer + `.zip` route + frontend ZIP download + tests + live + true-browser ZIP verification + CORS-already-documented. Reviews architect **PASS** + code-reviewer **SHIP** (no P0/P1); 1 P2 fixed in-phase. Gates green. Committed `0b23adf`, pushed `main`. Phase 60I not started.

## 3. Files Changed
Commit `0b23adf` (9 files): `lib/portfolioZip.ts`(new)+`.test.ts`(new), `routes/user-portfolio-repository.ts`(+.zip handler)+`.test.ts`, `lib/api-client-react/src/index.ts` (export customFetch), `components/DownloadGithubRepoButton.tsx`(ZIP)+`.test.tsx`, `docs/phases/phase-60h-…md`(new), `.agentic/progress.md`.

## 4. Scope Control / Hard Stops Check
GitHub OAuth/token/push/publishing/public-pages? **no** (manual-upload only; every such string is a disclaimer). New dep? **no** (`node:zlib` core only). Schema/migration? **no.** New serverGrade/opt-in/kind? **no.** Envelope/Phase 52? **no.** `/check`+`/submit`+JSON-repo+artifact routes? **unchanged.** Secrets/force-push? **no.** Phase 60I? **not started.**

## 5. ZIP Packaging Design
`lib/portfolioZip.ts` — deterministic, dependency-free writer on Node `zlib`: DEFLATE (method 8) via `deflateRawSync` + table-driven IEEE CRC-32 + standard local-file-header / central-directory / EOCD records. FIXED DOS timestamp (1980-01-01) + sorted entries → byte-identical output for the same (slug, files). All files nested under `<safeRoot>/` where `safeRoot = safeRootFolder(slug)` (slug reduced to one safe `[A-Za-z0-9._-]` segment; traversal slug cannot yield `/`/`\`/`..`; fallback "portfolio"). `assertSafeEntryName` re-rejects absolute/backslash/NUL/`.`/`..`/empty-segment names (route fails closed). Forward-slash entry names only. Externally validated: Python `zipfile.testzip()`=None.

## 6. Backend Route / API Changes
`GET /api/user/projects/:projectSlug/portfolio-repository.zip` (added to `routes/user-portfolio-repository.ts`; `.zip` is a distinct literal path, no clash with the JSON route). IDENTICAL contract to the JSON route: session-only userId, 404-not-403 for hidden/unknown/non-enrolled, read-only, SAME fail-closed `findBannedClaims` BEFORE packaging. Sets `Content-Type: application/zip`, safe `Content-Disposition: attachment; filename="<safeRoot>-github-ready-repo.zip"`, `Content-Length`; sends the Buffer via `res.end()`. Generic 500 on error (no body leak). Built from the SAME `generatePortfolioRepository` files.

## 7. OpenAPI/Client Decision
Binary `application/zip` **intentionally NOT added to OpenAPI codegen** (avoids generated-client friction). Frontend uses a narrow manual helper over the existing `customFetch` with `responseType: "blob"` (reuses base URL + bearer auth + ApiError semantics). `customFetch` + `CustomFetchOptions` additively exported from the api-client-react barrel (hand-written index, not codegen). **No codegen churn.** Documented so a maintainer doesn't assume the `.zip` route is codegen-typed.

## 8. Frontend UX Changes
"Download GitHub-Ready Repo" now downloads the ZIP by default. On click → `customFetch<Blob>(…/portfolio-repository.zip, {responseType:"blob"})` → saves `<slug>-github-ready-repo.zip` (client filename sanitized to the server's `safeRootFolder` charset so they agree + the name is filesystem-safe). On-click only; renders nothing from the archive; generic non-leaky error; no OAuth/token/share. No dashboard redesign.

## 9. ZIP Content Verification
Live API + real-browser download, extracted with Python `zipfile`: `testzip()`=None (valid archive); 6 entries all under `<project-slug>/` (incl. `evidence/submission-summary.md` when a snapshot exists); `atlas-portfolio.json` valid JSON, `serverGradedSteps=2`; atlas-verified claim + honest LIMITATIONS present. In-test independent ZIP reader round-trips every entry in the unit + route tests.

## 10. No-Leak Verification
ZIP entries + extracted content + route response + DOM + downloaded file: no validationConfig / expectedRows / expectedRowsHash / spec / answer key / reference query / comparator diagnostic / secret / serverGradeFlag. `one_current` (C2 answer-key cell) **absent**; `overlap` only as authored-prose substring "no **overlap**ping…" (documented 60E false positive), not the cell value. Covered at: zip-layer test (round-trip scan), route test (real-ZIP extract + token scan + findBannedClaims over extracted content), frontend (renders nothing, verbatim blob), live API `.zip` scan, browser-download Python scan.

## 11. Evidence-Honesty Verification
Only the allowed Atlas-verified claim + honest limitations + an explicit manual-upload boundary. No authorship / no-outside-help / job-guarantee / certification / tamper-proof / cheat-proof copy. Canonical `findBannedClaims` zero hits + fails the ZIP route closed at runtime before packaging.

## 12. Full-Stack Browser ZIP Result
Real Chromium against the live stack (API :5055, FE :4178, Docker PG :5434): FE booted, completed cert card rendered, click "Download GitHub-Ready Repo" → real `.zip` route → real DB assembly → real generated ZIP → real `…-github-ready-repo.zip` download (7926 bytes). Python `zipfile`: valid (testzip None), 6 files under the `<project-slug>/` root, required files present, atlas-portfolio.json valid, atlas-verified claim + honest limitations, no spec/answer-key leak, no banned claims.

## 13. Independent Review Results
- **architect → PASS** (no P0/P1): ZIP records/CRC/offsets correct; traversal impossible (sanitize + assert + fail-closed); same access/privacy/honesty contract as the JSON route; `customFetch` blob reuse correct; scope = the 7 stated files; invariants intact.
- **code-reviewer → SHIP** (no P0/P1): CRC-32 + LE fields + local↔central offsets + EOCD correct; method 8 paired with raw inflate; determinism scoped correctly; route distinctness + headers correct; Clerk bearer auth preserved through `customFetch`; non-vacuous tests.
- **P2 fixed:** client/server download-filename consistency (frontend now sanitizes the slug to the server charset). **Documented/accepted:** `.zip` not in codegen (binary); `deflateRawSync` not byte-guaranteed cross-Node (determinism scoped to same runtime); `safeRootFolder` reused by the route for the header filename (tidiness).

## 14. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck (4) + `check:no-heuristic-runtime` **OK** · **check:boot OK** · api-server unit **630/630** (+9: 5 zip-layer + 4 zip-route) · atlas **170/170** · **integration 4/4** · `audit:authoring` exit 0 · `audit:sql-resultset-bc` PASS (3 dark + **1**) · `audit:csv-set-equal-bc` PASS (**1**) · `audit:contains-bc` 3/3 · live API `.zip` + true full-stack browser ZIP download both Python-`zipfile`-valid.

## 15. Failures, Fixes, and Surprises
None of note. The `/tmp/repo.zip` path wasn't visible to Windows Python during the live scan (git-bash vs Windows path) → re-ran with a cwd-relative file. The ZIP writer was correct first try (round-trips via the in-test reader + Python zipfile). The one reviewer P2 (filename consistency) fixed with a 1-line client sanitize.

## 16. Current Git State
Branch `main`. Feature **`0b23adf`** (9 files) on top of `24cc08b`, pushed (`24cc08b..0b23adf`). Archive commit follows. Working tree clean except hook-managed files. `.playwright-cli/*.zip` gitignored.

## 17. Remaining Risks / Blockers
ZIP entries set external attrs=0 (no Unix mode; harmless for download-and-upload). The `.zip` route has no generated-client typing (binary, by design). `deflateRawSync` byte output is runtime-stable but not guaranteed identical across Node versions. Still manual upload — no GitHub connection (deliberate; publishing risk class deferred).

## 18. Recommended Next Step
Owner approval for **Phase 60I** (none started): (1) a guarded GitHub publishing path (OAuth/token/direct push) — a SEPARATE risk class needing its own token-handling + security review; (2) optionally directory entries / Unix modes in the ZIP if a target extractor needs them; (3) set `ATLAS_ALLOWED_ORIGINS` in the deploy manifest once the prod frontend origin is known.

## 19. Explicit Stop Statement
**Stopped.** One-click ZIP export shipped as a deterministic, dependency-free archive over the proven 60G repository export (new `.zip` route + ZIP writer + frontend blob download), verified valid + leak-free + honest at the layer, route, frontend, live API, and a true full-stack browser download in real Chromium (Python `zipfile`-validated). Reviews PASS/SHIP, gates green, committed `0b23adf`. **No GitHub OAuth / token / push / publishing added. Phase 60I NOT started.** Awaiting next instruction.
