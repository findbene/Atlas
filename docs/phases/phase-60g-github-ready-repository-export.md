# Phase 60G — GitHub-ready local portfolio repository export (close-out)

**Status:** SHIPPED. Upgrades the portfolio artifact system from a single JSON
bundle into a **GitHub-ready local repository export**: a deterministic JSON
bundle of repo-relative files the learner downloads and **manually** uploads to
GitHub. Export-bundle implementation only — **no GitHub OAuth, no token, no
direct push, no public publishing, no public portfolio pages.** Atlas's
evidence-honesty + no-leak boundary is preserved by construction.

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer`
→ SHIP**, no P0/P1. Three converging P2 test-completeness items were fixed
in-phase (§9).

---

## 1. Repository export format

`generatePortfolioRepository(input)` is a **thin layer over the Phase-60A
generator**. It reuses `generatePortfolioArtifact` verbatim for the Markdown
evidence files (so the honesty / no-leak logic is never duplicated) and only
ADDS a machine-readable metadata file and an optional learner-evidence summary.

Minimum bundle (a learner reconstructs a folder named `projectSlug`):

```text
<project-slug>/
  README.md
  VALIDATION_EVIDENCE.md
  LIMITATIONS.md
  LEARNER_REFLECTION_TEMPLATE.md
  DATASET_NOTES.md                  # optional (only when datasets are known)
  atlas-portfolio.json              # machine-readable metadata
  evidence/
    submission-summary.md           # optional — only when a snapshot exists
```

The bundle is returned as `{ projectSlug, generatedAt, format:
"github-ready-repository", files }` where `files` maps each repo-relative path →
contents. Determinism: the generator is pure, the metadata file list is sorted,
and metadata key order is a fixed literal → byte-identical output for the same
input.

**Path safety:** every file key is a fixed constant (no slug/author/learner
value is ever interpolated into a path, so traversal is structurally
impossible). `assertSafeRepoPaths` is a defence-in-depth guard that rejects any
key that is empty, absolute, contains a backslash/NUL, uses a disallowed
character, or has a `.`/`..`/empty path segment. It is exported and has a
non-vacuous negative-control test.

### `atlas-portfolio.json` (safe metadata only)

`schema` (`atlas-portfolio/v1`), `format`, `generatedAt`, `project` (slug,
title, course, role, difficulty), `files` (the full bundle list), `evidence`
(stepsCompleted, totalSteps, evidenceHashCount, totalXpEarned,
**serverGradedSteps / clientProvisionalSteps / selfAttestedSteps** counts,
submittedCodeAvailable, submittedOutputAvailable), `verification` (the single
allowed Atlas-verified claim, reused from the generator's exported constant),
`limitations` (short safe summary), `manualUpload` (the no-OAuth / manual-upload
orientation), and `verifyUrl`. It contains NO validationConfig, expectedRows,
expectedRowsHash, spec object, per-step `serverGradeFlag`, reference query,
comparator internal, or secret — `serverGradedSteps` is a derived COUNT, never
the flag.

### `evidence/submission-summary.md` (optional, learner-evidence-framed)

Emitted **only** when a durable submission snapshot exists
(`submittedCodeAvailable || submittedOutputAvailable`). It is explicitly
labelled "**Learner-submitted evidence** … not an Atlas answer key or reference
solution," and lists per passed step only the validation kind + evidence-strength
label + completion time (the same safe facts as VALIDATION_EVIDENCE.md). It
deliberately exports **no** raw submission, clamped excerpt, hash value, or
validation spec — the full submission stays server-side, which is why nothing
here can leak a spec value. This is the conservative reading of the brief's
"clamped excerpts only if already safely stored": the learner-evidence framing +
the `evidence/` structure are delivered, the excerpt/hash content is
deliberately withheld (documented here).

## 2. Backend route / API

`GET /api/user/projects/:projectSlug/portfolio-repository`
(`routes/user-portfolio-repository.ts`) — a sibling of the Phase-60B artifact
route with an identical privacy/access contract:
- `userId` comes EXCLUSIVELY from the authenticated session; no path/query/body
  param accepts a userId.
- 404 (never 403) for a hidden / soft-deleted / unknown project or a
  non-enrolled user (no existence leak) — via the shared
  `assemblePortfolioArtifactInput` chokepoint.
- Read-only; no write side effects.
- Defence-in-depth: the whole bundle is run through the CANONICAL H3
  `findBannedClaims` guard and fails closed (500) rather than ever serving
  over-claiming copy.

Response stays JSON for Phase 60G (no ZIP — avoided as out-of-scope dependency
risk; the frontend downloads the JSON and the learner reconstructs the folder).

## 3. OpenAPI / client

Added the path + `PortfolioRepositoryResponse` schema (`files` as
`additionalProperties: string` to accommodate the nested `evidence/…` path and
`atlas-portfolio.json`; `format` is a required `enum`). Regenerated orval in one
controlled pass (`pnpm --filter @workspace/api-spec run codegen`) — churn is
**additive only** (+184 insertions, 0 deletions): `getPortfolioRepository`
(client), `GetPortfolioRepositoryResponse` (zod), and three generated type
files. No generated file was hand-edited. The scoped `.gitattributes`
(eol=lf, Phase 60C) keeps the codegen diff content-only.

## 4. Frontend UX

`DownloadGithubRepoButton` ("Download GitHub-Ready Repo", GitHub icon) renders
next to the existing "Download Portfolio Bundle" button on each completed-project
certificate card. On click only (never on mount), it calls the generated
`getPortfolioRepository(slug)` and saves the response verbatim as
`<projectSlug>-github-ready-repo.json`. It renders NOTHING from the bundle (no
client-side leak channel), shows a generic non-leaky error on any failure, and
has no GitHub OAuth / token input / direct-push / public-sharing affordance.

## 5. CORS deploy-manifest decision

`artifacts/api-server/.replit-artifact/artifact.toml` gained a **commented,
non-secret documentation note** under `[services.production.run.env]` describing
the Phase-60F `ATLAS_ALLOWED_ORIGINS` lever and how to set it to the deployed
frontend origin(s). It is left COMMENTED (documentation only) because the
production frontend origin is not known in this repo — no domain is invented and
no production runtime behaviour is changed (CORS stays production-inert
reflective until an operator uncomments it with the real origin). This honours
the hard stop ("safe deploy-manifest CORS documentation if non-secret; if the
production domain is unknown, documentation only").

## 6. No-leak verification

Across the generated bundle, the route response, the DOM, and the downloaded
JSON: no validationConfig, expectedRows, expectedRowsHash, hidden spec, answer
key, reference query, comparator diagnostic, secret, or per-step
`serverGradeFlag`. Coverage:
- **layer test** — answer-key-impossible by construction (the input model has no
  spec field); pins that the export adds none (emits the COUNT, not the flag).
- **route test** — a fixture whose steps carry REAL `validation_config.spec`
  (`serverGrade:true`, `expectedRows` with `one_current`/`overlap`/`secretval`)
  is scanned end-to-end through assembly → export → HTTP; the snapshot-PRESENT
  path is scanned too (with the summary included).
- **frontend test** — the download is exactly the route output, serialised
  verbatim; nothing rendered into the DOM.
- **real-data live scan** — the booted API + the real C2 catalog + the 60F
  e2e learner (who has a real snapshot): 401 no-token, 404 unknown slug, all 6
  files, `serverGradedSteps=2`, no spec tokens, `one_current` absent, no banned
  claims, summary labelled learner-evidence. (`overlap` appears only as the
  authored-prose substring "no **overlap**ping effective ranges" — the same
  documented Phase-60E false positive, not the answer-key value.)

## 7. Evidence-honesty verification

Only the allowed Atlas-verified claim + honest limitations + an explicit
manual-upload boundary. No authorship / no-outside-help / job-guarantee /
certification / tamper-proof / cheat-proof copy. The CANONICAL `findBannedClaims`
guard returns zero hits over the bundle in both tests and fails the route closed
at runtime. Every "GitHub/OAuth/token/push/publish" string in the changed files
is a DISCLAIMER (manual-upload framing), never integration code.

## 8. Independent reviews

- **architect → PASS** (no P0/P1): traced planted answer-key tokens end-to-end
  and confirmed they cannot reach the bundle; submission-summary safe + correctly
  conditional; path guard correct; access/privacy/honesty intact; scope clean.
- **code-reviewer → SHIP** (no P0/P1): determinism, self-referential file list,
  conditional summary, no-leak (count vs flag), route contract + non-vacuous
  negative control, frontend verbatim-serialize, additive codegen — all verified.

## 9. P2 dispositions (fixed in-phase)

1. **Route did not exercise the snapshot-present path** (architect) → added a
   route test that mocks a present snapshot, asserts `evidence/submission-summary.md`
   is emitted via HTTP, and re-scans the full response for leakage.
2. **`assertSafeRepoPaths` had no negative-control test** (code-reviewer) →
   exported the guard + added a parametric test asserting it throws on
   `../x` / `/abs` / `a\b` / `a/./b` / `a/../b` / `a//b` / `""` / trailing-space /
   `*`.
3. **Metadata `files` under-asserted** (code-reviewer) → assert `meta.files`
   equals the actual `Object.keys(files)` set; added a clarifying comment on the
   answer-key-impossible property.

## 10. Tests & gates (Node 24 + Docker PG :5434)

typecheck (4 projects) + `check:no-heuristic-runtime` **OK** · **check:boot OK** ·
api-server unit **621/621** (+17 new: 9 repository-layer + 8 repository-route) ·
atlas **170/170** (+5 GitHub-repo button) · **integration 4/4** (regression) ·
`audit:authoring` exit 0 · `audit:sql-resultset-bc` PASS (3 dark + **1**) ·
`audit:csv-set-equal-bc` PASS (**1**) · `audit:contains-bc` 3/3 · real-data live
route scan PASS.

## 11. Final invariants (confirmed)

Exactly **1** `csv_set_equal` + **1** `sql_resultset` opted in (live catalog,
unchanged; total serverGrade=2); no new validation rows/kinds; envelope
enforcement **OFF**; Phase 52 untouched; **no schema/migration**; artifact +
repository routes authenticated + read-only; `/check` writes no snapshots;
`/submit` snapshot behaviour unchanged; the frontend exposes only safe generated
artifacts; **no GitHub OAuth / token / direct-push / public publishing added**;
`RUBRIC_VERSION` frozen. **Phase 60H not started.**

## 12. Remaining limitations

- The export is a JSON bundle of repo files; the learner reconstructs + uploads
  the folder manually (no ZIP, no GitHub connection — deliberate, this phase).
- `evidence/submission-summary.md` exports no per-step hash/excerpt
  (conservative no-leak posture) — a future phase could surface the one-way
  hashes behind a fresh no-leak review if there's product demand.
- CORS production hardening remains an operator opt-in
  (`ATLAS_ALLOWED_ORIGINS`); the deploy manifest documents it but cannot set a
  real origin until the production frontend domain is known.

## 13. Phase 60H recommendation

Owner-gated next steps (none started): (1) ZIP packaging of the repository
bundle (dependency-free, fully tested) for a one-click folder; (2) a guarded
GitHub publishing path (OAuth/token/direct-push) — a SEPARATE risk class
requiring its own token-handling + security review; (3) optionally surface the
one-way submission hashes in `submission-summary.md` behind a fresh no-leak
review. Set `ATLAS_ALLOWED_ORIGINS` in the deploy manifest once the production
frontend origin is known.
