# Phase 60C — portfolio-artifact client contract + frontend manual download UX (close-out)

**Status:** SHIPPED. Makes the Phase-60B authenticated portfolio-artifact route
consumable from the Atlas frontend: adds the route to OpenAPI, regenerates the
orval clients in a controlled (purely additive) pass, and adds a narrow
manual JSON-download action on completed-project cards. **No grading/schema/
behavior change. No GitHub OAuth/publishing/public pages/cert-marketing. No new
`serverGrade`/opt-ins. Envelope enforcement OFF. Phase 52 untouched.**

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer`
→ SHIP**, no P0/P1. Both traced the chain (certificates card → generated
`getPortfolioArtifact(slug)` → 60B route → verbatim JSON download) and confirmed
the client introduces no new leak channel.

---

## 1. OpenAPI contract

`lib/api-spec/openapi.yaml` — NEW path
`GET /user/projects/{projectSlug}/portfolio-artifact` (operationId
`getPortfolioArtifact`, tag `user-projects`, `security: clerkAuth`, path param
`projectSlug`). Responses: `200` → new `PortfolioArtifactResponse`, `401` + `404`
→ `ErrorResponse`. NEW component schema `PortfolioArtifactResponse`:
`{ projectSlug: string, generatedAt: date-time, files: { "README.md",
"VALIDATION_EVIDENCE.md", "LIMITATIONS.md", "LEARNER_REFLECTION_TEMPLATE.md"
required; "DATASET_NOTES.md" optional } }` — `files` is filename→markdown only;
no `validationConfig`/`expectedRows`/answer-key field is exposed.

## 2. Codegen (controlled, additive)

Ran `pnpm --filter @workspace/api-spec run codegen` (orval 8.5.3 → react-query
client + zod, then `typecheck:libs`). **The feared ~95-file CRLF churn did NOT
occur** — a prior session already normalised the generated files to LF in the
index, so orval's LF output diffs content-only. The change is **purely additive
(+316 lines, 0 deletions)**: `getPortfolioArtifact` raw fn +
`useGetPortfolioArtifact` hook + query helpers + `PortfolioArtifactResponse`
types in `lib/api-client-react/src/generated/**`, and
`GetPortfolioArtifactResponse`/`GetPortfolioArtifactParams` zod + types in
`lib/api-zod/src/generated/**`. Generated files were NOT hand-edited.

## 3. `.gitattributes` (EOL containment)

NEW `.gitattributes`, scoped **only** to `lib/api-client-react/src/generated/**`,
`lib/api-zod/src/generated/**`, and `lib/api-spec/openapi.yaml` (`text eol=lf`).
Locks those paths to LF so future regens stay content-only — the
owner-roadmapped cleanup (CLAUDE.md NEXT item c / 60B close-out §14.1). Scoped
intentionally narrow; it does NOT renormalise the rest of the repo.

## 4. Frontend manual download UX

`artifacts/atlas/src/components/DownloadPortfolioBundleButton.tsx` (NEW) — a
small per-card action on the existing **Certificates** page
(`artifacts/atlas/src/pages/certificates.tsx`, which already lists every
completed project with its slug). On **click** (never on mount) it calls the
GENERATED raw fn `getPortfolioArtifact(projectSlug)`, serialises the response
verbatim with `JSON.stringify(bundle, null, 2)`, and saves it as
`${projectSlug}-portfolio.json` (object URL revoked in a `finally`). States:
idle / loading (`Preparing bundle…`, button disabled) / error. It deliberately
does NOT use the auto-firing `useGetPortfolioArtifact` query (that would build an
artifact for every completed project on render) — one artifact build per click.

**JSON download chosen** (no ZIP): the route already returns a structured
`{ projectSlug, generatedAt, files }` object; a single JSON file is the boring,
dependency-free representation and is trivial to verify in tests. ZIP was not
implemented (not trivial + not tested → out of scope per the brief).

## 5. Access / error behavior

All failure modes collapse to one safe state: `customFetch` throws on
401 (expired session), 404 (hidden / soft-deleted / unknown / not-enrolled — the
60B route's 404-not-403 contract), and 5xx; `fetch` rejects on network failure.
The component's bare `catch` sets `error` and renders one generic message
(`Couldn't prepare the bundle. Please try again.`) — the server error body is
never read or surfaced. A completed project with **no durable snapshot** still
returns `200` (the artifact degrades honestly in LIMITATIONS.md) and downloads
normally.

## 6. No-leak & honesty

- **No-leak:** the client serialises only the route output and reads no
  individual field; it renders **none** of the bundle into the DOM. The no-leak
  guarantee remains server-side (the unchanged 60B assembly chokepoint + route).
  60C adds no new channel — the OpenAPI schema exposes only filename→markdown.
- **Honesty (H3):** the only client copy is the static button/label/error
  strings. The backend runtime `findBannedClaims` fail-closed guard is unchanged.

## 7. Tests

- `DownloadPortfolioBundleButton.test.tsx` (NEW, 6): client called with slug
  on click (on-demand); **download payload === verbatim route output** (captures
  the Blob, deep-equals AND exact-string-matches `JSON.stringify(...,2)`); no
  spec/answer-key tokens in the payload; bundle contents never rendered to the
  DOM; no forbidden authorship/job/certification claim rendered; failure shows
  the safe message and writes **no** file (`createObjectURL`/anchor-click not
  called). Global `URL.*` mocks restored in `afterEach` (test hygiene).
- `user-portfolio-artifact.test.ts` (+1): the live 200 body is validated against
  the generated zod `GetPortfolioArtifactResponse` (OpenAPI contract test) with a
  non-vacuous negative control (a `files`-less body is rejected).

## 8. Independent reviews

- **architect: PASS** — no P0/P1. Traced certificates → button → raw fn → 60B
  route → JSON download; confirmed additive generated diff (0 deletions),
  scoped `.gitattributes`, on-demand fetch, 404-not-403 preserved, exactly 2
  serverGrade rows. P2s: contract zod not `.strict()` (generated, not editable;
  the dedicated server leak test is the real guard) → **noted**; missing
  close-out → **FIXED** (this doc).
- **code-reviewer: SHIP** — no P0/P1. Verified object-URL revoke in `finally`,
  error privacy (server body never read), non-vacuous tests, conventions match.
  P2s: global URL mocks not restored → **FIXED**; unmount-mid-fetch setState
  warning → **DEFERRED** (React 18 no-warn, no crash/leak, tiny manual button);
  `generatedAt` Date-vs-string across generators + leak-test-is-server-side →
  **noted** (expected orval behavior / by-design).

## 9. Tests & gates (Node 24 + Docker PG :5434)

typecheck + check:no-heuristic-runtime **PASS** · api-server **588/588** (+1
contract test) · atlas **165/165** (+6 download-button tests) · orval codegen
clean + `typecheck:libs` PASS · audit:csv-set-equal-bc PASS (1 opt-in) ·
audit:sql-resultset-bc PASS (3 dark + 1 opt-in) · audit:contains-bc 3/3 ·
audit:authoring exit 0.

## 10. Final invariants (confirmed)

Exactly 1 `csv_set_equal` + 1 `sql_resultset` opted in (both in the C2 authored
file; unchanged); no new validation rows/kinds; envelope enforcement OFF; Phase
52 untouched; **no schema/migration**; route remains authenticated + read-only;
`/check` writes no snapshots; `/submit` snapshot behavior unchanged; the frontend
exposes only the safe generated artifact. `RUBRIC_VERSION` frozen. **Phase 60D
not started.**

## 11. Deferred / follow-ups

- Optional safe submission-excerpt preview in the artifact (snapshots exist) —
  behind a fresh no-leak review.
- GitHub export / publishing (the deferred E2 tail) — owner approval required.
- Unmount-mid-fetch abort guard (P2, cosmetic) if the button later moves to a
  higher-churn surface.
