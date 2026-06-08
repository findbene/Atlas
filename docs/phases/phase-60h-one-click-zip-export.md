# Phase 60H — one-click ZIP export for the GitHub-ready portfolio repository (close-out)

**Status:** SHIPPED. Converts the Phase-60G GitHub-ready repository JSON export
into a true one-click downloadable **ZIP archive**: a folder-structured bundle
(`<project-slug>/…`) the learner downloads and manually uploads to GitHub. NO
GitHub OAuth, NO token handling, NO direct push, NO public publishing, NO public
portfolio pages. The no-leak + evidence-honesty boundary is preserved by
construction (the ZIP is built from the same leak-safe 60G files).

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer`
→ SHIP**, no P0/P1. One actionable P2 (client/server filename consistency) was
fixed in-phase; the rest are documented/accepted (§8).

---

## 1. ZIP format

`lib/portfolioZip.ts` — a deterministic, **dependency-free** ZIP writer built by
hand on Node's `zlib` (no new dependency):
- DEFLATE (method 8) via `zlib.deflateRawSync`; table-driven IEEE CRC-32.
- Standard records: local file header (30B) + filename + data per entry, then
  the central directory (46B/entry) + End-Of-Central-Directory (22B).
- **Deterministic:** a FIXED DOS timestamp (1980-01-01) is written for every
  entry, entries are emitted in sorted order, and `deflateRawSync` is stable for
  the same input → the same (slug, files) yields a byte-identical archive.
- All files are nested under a single root folder `<safeRoot>/` where
  `safeRoot = safeRootFolder(projectSlug)`.

Externally validated: Python's `zipfile.testzip()` returns `None` (all CRCs
valid) on both the live API route output and the real-browser download — i.e. a
standards-valid archive that mainstream extractors open cleanly.

Bundle (for a completed learner, snapshot present):

```text
<project-slug>/
  README.md
  VALIDATION_EVIDENCE.md
  LIMITATIONS.md
  LEARNER_REFLECTION_TEMPLATE.md
  DATASET_NOTES.md                  # optional
  atlas-portfolio.json
  evidence/
    submission-summary.md           # optional (only when a snapshot exists)
```

### Path safety

- `safeRootFolder(slug)` reduces the slug to a single safe segment
  (`[A-Za-z0-9._-]`, slashes/backslashes/spaces → `-`, leading/trailing `.`/`-`
  stripped), falling back to `"portfolio"`. A traversal slug (`../../evil`)
  provably cannot produce a `/`, `\`, or `..` segment.
- `assertSafeEntryName(<root>/<key>)` re-rejects any absolute / backslash / NUL /
  `.`/`..`/empty-segment / non-allowlisted name and throws (the route fails
  closed). Entry names use forward slashes only (no OS-specific separator). The
  upstream 60G `assertSafeRepoPaths` already validates the inner keys, so this is
  layered defence.

## 2. Backend route / API

`GET /api/user/projects/:projectSlug/portfolio-repository.zip`
(added to `routes/user-portfolio-repository.ts`, alongside the JSON route). The
`.zip` suffix is a distinct literal path — no clash with the JSON route or its
`:projectSlug` capture. Contract is IDENTICAL to the JSON route:
- authenticated; `userId` from the session only (no path/query/body userId);
- 404 (never 403) for hidden / soft-deleted / unknown / non-enrolled (shared
  `assemblePortfolioArtifactInput` chokepoint);
- read-only;
- the SAME fail-closed canonical `findBannedClaims` guard runs over the bundle
  BEFORE packaging;
- response: `Content-Type: application/zip`, safe
  `Content-Disposition: attachment; filename="<safeRoot>-github-ready-repo.zip"`,
  `Content-Length`; the ZIP `Buffer` is sent via `res.end()`.
- error path returns a generic 500 (no error-body leak).

The ZIP is built from the SAME `generatePortfolioRepository(input).files` the
JSON route returns, so it cannot contain anything the JSON route does not.

## 3. OpenAPI / client decision

The binary `application/zip` response was **intentionally NOT added to the
OpenAPI codegen** — a binary body does not fit the JSON-oriented generated
react-query client cleanly and would introduce generated-client friction. Per
the brief's sanctioned alternative, the frontend uses a **narrow manual helper
over the existing `customFetch`** with `responseType: "blob"`, which already
applies the same base URL + bearer auth + `ApiError` semantics as the generated
client. `customFetch` (+ `CustomFetchOptions`) is now additively exported from
the `@workspace/api-client-react` barrel (a hand-written index, not codegen). No
codegen churn this phase. (Documented so a future maintainer does not assume the
`.zip` route is codegen-typed.)

## 4. Frontend UX

`DownloadGithubRepoButton` ("Download GitHub-Ready Repo") now downloads the ZIP
by default. On click (never on mount) it calls
`customFetch<Blob>(/api/user/projects/<slug>/portfolio-repository.zip,
{responseType:"blob"})` and saves the blob as `<slug>-github-ready-repo.zip`
(client filename sanitised to the same charset as the server's `safeRootFolder`
so the two agree and the saved name is always filesystem-safe). It never inspects
the archive (the file on disk is exactly the route bytes), shows a generic
non-leaky error on any failure, and has no OAuth / token input / sharing / push
affordance. No dashboard redesign.

## 5. ZIP content verification

Live API route + real-browser download, both extracted with Python `zipfile`:
`testzip()` → `None`; entries = the 6 files all under `<project-slug>/` (incl.
`evidence/submission-summary.md` when a snapshot exists); `atlas-portfolio.json`
is valid JSON after extraction with `serverGradedSteps = 2`; the single allowed
Atlas-verified claim present; honest LIMITATIONS present. The in-test independent
ZIP reader round-trips every entry in the unit + route tests.

## 6. No-leak verification

ZIP entries, extracted content, route response, DOM, and the downloaded file: no
validationConfig, expectedRows, expectedRowsHash, hidden spec, answer key,
reference query, comparator diagnostic, secret, or per-step serverGradeFlag.
`one_current` (a C2 answer-key cell) is **absent**; `overlap` appears only as the
authored-prose substring "no **overlap**ping effective ranges" (the documented
Phase-60E false positive), never as the cell value. Coverage: zip-layer test
(round-trip leak scan), route test (real-ZIP extract + token scan +
`findBannedClaims` over extracted content), frontend test (renders nothing,
verbatim blob), and the live + browser Python-`zipfile` scans.

## 7. Evidence-honesty verification

Only the allowed Atlas-verified claim + honest limitations + the explicit
manual-upload boundary. No authorship / no-outside-help / job-guarantee /
certification / tamper-proof / cheat-proof copy anywhere. The canonical
`findBannedClaims` guard returns zero hits and fails the ZIP route closed at
runtime, before packaging. Every "GitHub / OAuth / token / push / publish" string
in the changed files is a disclaimer (manual-upload framing), never integration
code.

## 8. Independent reviews

- **architect → PASS** (no P0/P1): ZIP records/CRC/offsets correct; traversal
  impossible (sanitise + assert + fail-closed); same access/privacy/honesty
  contract as the JSON route; `customFetch` blob reuse correct; scope = the 7
  stated files; invariants intact.
- **code-reviewer → SHIP** (no P0/P1): CRC-32 + LE fields + local↔central
  offsets + EOCD correct; method 8 paired with raw inflate; determinism scoped
  correctly; route distinctness + headers correct; Clerk bearer auth preserved
  through `customFetch`; non-vacuous tests.

P2 dispositions:
- **Fixed in-phase:** client/server download-filename consistency — the frontend
  now sanitises the slug to the same charset as the server's `safeRootFolder`.
- **Documented/accepted:** (a) the `.zip` route is intentionally not in the
  OpenAPI codegen (binary body) — noted in §3; (b) `deflateRawSync` byte output
  is not guaranteed identical across Node versions — determinism is correctly
  scoped to "same runtime, same input" and never claimed cross-version (a
  stored-method fallback would be the fix if a cross-env byte audit is ever
  added); (c) `safeRootFolder` is exported and reused by the route for the
  header filename — harmless tidiness.

## 9. Tests & gates (Node 24 + Docker PG :5434)

typecheck (4) + `check:no-heuristic-runtime` **OK** · **check:boot OK** ·
api-server unit **630/630** (+9: 5 zip-layer + 4 zip-route) · atlas **170/170**
(GitHub-repo button rewritten for ZIP) · **integration 4/4** · `audit:authoring`
exit 0 · `audit:sql-resultset-bc` PASS (3 dark + **1**) · `audit:csv-set-equal-bc`
PASS (**1**) · `audit:contains-bc` 3/3 · live API `.zip` + **true full-stack
browser ZIP download** both validated by Python `zipfile` (testzip `None`),
leak-free + honest.

## 10. Full-stack browser ZIP result

Real Chromium against the live stack (API :5055, FE :4178, Docker PG :5434): the
frontend booted, the completed cert card rendered, clicking "Download
GitHub-Ready Repo" called the real `.zip` route → real DB assembly → real
generated ZIP → a real `…-github-ready-repo.zip` file download (7926 bytes).
Extracted with Python `zipfile`: valid archive, all 6 files under the
`<project-slug>/` root, required files present, atlas-portfolio.json valid,
atlas-verified claim + honest limitations present, no spec/answer-key leak, no
banned claims.

## 11. Final invariants (confirmed)

Exactly **1** `csv_set_equal` + **1** `sql_resultset` opted in (unchanged; total
serverGrade=2); no new validation rows/kinds; envelope enforcement **OFF**;
Phase 52 untouched; **no schema/migration**; artifact + repository (JSON + ZIP)
routes authenticated + read-only; `/check` writes no snapshots; `/submit`
snapshot behaviour unchanged; **no GitHub OAuth / token / direct-push / public
publishing added**; no new dependency (`node:zlib` only); `RUBRIC_VERSION`
frozen. **Phase 60I not started.**

## 12. Remaining limitations

- ZIP entries set external file attributes = 0 (no Unix mode); extractors default
  to regular-file perms — harmless for a download-and-upload flow.
- The `.zip` route has no generated-client typing (binary, by design — §3).
- `deflateRawSync` byte output is runtime-stable but not guaranteed identical
  across Node versions (determinism scoped to "same runtime, same input").
- Still manual upload — no GitHub connection (deliberate; the publishing risk
  class is deferred).

## 13. Phase 60I recommendation

Owner-gated next steps (none started): (1) a guarded **GitHub publishing** path
(OAuth / token / direct push) — a SEPARATE risk class requiring its own
token-handling + security review; (2) optionally directory entries / Unix file
modes in the ZIP if a target extractor needs them; (3) set `ATLAS_ALLOWED_ORIGINS`
in the deploy manifest once the production frontend origin is known (carried over
from 60G). GitHub OAuth/direct publishing remains deferred until the local export
is proven in beta and a token-handling security model is approved.
