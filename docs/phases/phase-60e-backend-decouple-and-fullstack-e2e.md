# Phase 60E — backend connector decouple + true full-stack portfolio download E2E (close-out)

**Status:** SHIPPED. Makes the backend/API stack boot in a controlled local/test
mode and verifies the Phase-60C portfolio download through a TRUE full-stack
browser path: real frontend → real API server → real Postgres → real
authenticated route → real generated client → real browser download. **Infra +
E2E hardening. No GitHub/export/publishing, no excerpt preview, no new
serverGrade/opt-ins, no schema/migration, envelope enforcement OFF, Phase 52
untouched.**

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer`
→ SHIP**, no P0/P1. Both traced the test-auth adapter and confirmed it is
production-inert (the `NODE_ENV` gate is enforced at the deploy manifest layer,
not merely asserted in code).

---

## 1. The backend/local-API blocker found

The API server **already boots** locally with just `PORT` + `DATABASE_URL` —
the Stripe/Replit connector init is self-guarded (`index.ts` warns + skips
without `REPLIT_CONNECTORS_HOSTNAME`), and the run-envelope secret only
hard-fails under `REPLIT_DEPLOYMENT=1`. The REAL blocker is **auth**:
`clerkMiddleware` (`app.ts`) hard-throws *"Missing Clerk Secret Key"* on **every**
request (even `/api/healthz`) when real Clerk credentials are absent — so a local
stack 500s on everything. **Classification:** auth/session coupling. (Confirmed
by reproduction: booted `dist/index.mjs` with PORT + DATABASE_URL → "Server
listening", then `curl /api/healthz` → 500 with the Clerk stack trace.)

## 2. The decoupling fix (smallest safe, production-inert)

An env-gated, triple-fail-closed **test-auth adapter** in
`artifacts/api-server/src/lib/auth.ts`:

- `isE2EAuthMode()` ⇔ `ATLAS_E2E_AUTH === "1"` **AND** `NODE_ENV !== "production"`.
- `e2eClerkIdFromRequest(req)`: returns a **fixed** clerkId
  (`ATLAS_E2E_AUTH_CLERK_ID`) **only** when `ATLAS_E2E_AUTH_TOKEN` is set AND the
  request carries a matching `X-Atlas-E2E-Auth` header; otherwise `null`. It
  never reads a userId from the request → no impersonation primitive.
- `requireAuth` / `getCurrentUser`: in e2e mode resolve the seeded user (or 401)
  and **never call Clerk's `getAuth`**; otherwise the original Clerk path is
  byte-unchanged.
- `app.ts`: `clerkMiddleware` is registered only `if (!isE2EAuthMode())` — it is
  skipped in e2e mode (it needs the secret key), and registered exactly as
  before in production.

**Why production is untouched:** with `ATLAS_E2E_AUTH` unset (production),
`isE2EAuthMode()` is false at all three decision points, so the real Clerk
middleware + Clerk auth path run exactly as before. Defense in depth: even if
`ATLAS_E2E_AUTH` leaked into a prod env, `NODE_ENV="production"` (set in the
deploy manifest) independently disables the adapter. `auth.test.ts` (10 tests)
pins all three gates, including a non-vacuous production test that asserts the
Clerk path **is** taken (`getAuth` called) and yields 401.

## 3. Bug fixed to reach the E2E (real correctness defect)

`routes/user-portfolio.ts` built its XP rollup with
`sql\`…->>'projectId' = ANY(${projectIds})\``, which binds a JS array into one
parameter slot — Postgres rejects it as a *"malformed array literal"* and the
route **500s for any user with a completed project** (so the Certificates page —
the download button's home — was unrenderable). Changed to
`inArray(sql\`…->>'projectId'\`, projectIds)` (emits `IN ($1,$2,…)`). Per-user +
per-project scoping is preserved; the empty case can't reach the line (the route
early-returns when there are no completed projects).

## 4. Local full-stack E2E setup

`scripts/e2e-fullstack-portfolio.sh` (repeatable; no tribal knowledge):
1. Docker Postgres `atlas-pg` on :5434 (existing), 2. `seed` (catalog,
idempotent) + `seed:e2e` (test learner + completed C2), 3. build the API,
4. build the frontend E2E bundle wired to the real API
(`VITE_E2E_API_BASE` + `VITE_E2E_API_TOKEN`), 5. boot the API (PORT +
DATABASE_URL + `ATLAS_E2E_AUTH=1` + token + `NODE_ENV=development`), 6. serve the
frontend, 7. print the `playwright-cli` drive commands. `dist/*` is gitignored.

## 5. Authentication / test strategy

A **test-only Clerk shim** on the frontend (the 60D alias mock — no real Clerk)
combined with the **API's gated test-auth adapter**: the frontend injects the
`X-Atlas-E2E-Auth` token header, the API's real `requireAuth` resolves the
seeded learner. This exercises the REAL `requireAuth`/`getCurrentUser` contract
(including 401 for a tokenless request) without making the route public,
bypassing auth in production, or trusting a userId from the request. The seeded
user is a `learner` (admin routes still 403). `seed:e2e` writes only learner-side
state (user + progress + step completions) — no authored content, validation
config, serverGrade, or answer keys.

## 6. Portfolio download — true E2E result

Verified in real Chromium against the real stack:
- the frontend booted, the Certificates card rendered the **real DB project
  title** (the full authored name — proving the real `/api/user/portfolio` call,
  not a mock);
- **"Download Portfolio Bundle"** was visible; clicking it called the **real**
  `/api/user/projects/:slug/portfolio-artifact` → **real DB-backed assembly** →
  real Phase-60A generator → a **real JSON file download**;
- the payload had `projectSlug`, `generatedAt`, and `files` with all four of
  README.md / VALIDATION_EVIDENCE.md / LIMITATIONS.md /
  LEARNER_REFLECTION_TEMPLATE.md;
- the VALIDATION_EVIDENCE table showed the **real per-step classification** —
  step 2 `sql_resultset` **server-graded** + step 3 `csv_set_equal`
  **server-graded** (the 2 live opted-in rows), others client-provisional /
  exact / contains — derived from the DB via the canonical predicate;
- API-level: `/api/healthz` 200, portfolio/artifact 401 without the token, 200
  with it, **404 for an unknown slug** (no hidden-project existence leak).

## 7. Snapshot behavior verification

The seeded completions have **no** `portfolio_submission_snapshot`, so the
artifact **honestly degrades** — LIMITATIONS.md says the submitted code/output is
"not included" (verified in the downloaded payload). `/check`-writes-nothing and
`/submit`-writes-on-fresh-pass remain unit-verified
(`user-submit-snapshot.test.ts`, in the 598 api-server tests; unchanged this
phase). A browser-level fresh-pass-`/submit`→snapshot E2E is deferred (Task 8
allows API-level + documented follow-up) — it needs a runnable grading/submit
flow, out of this phase's scope.

## 8. No-leak verification

Real-browser scan of the DOM **and** the downloaded JSON: no `validationConfig`,
`expectedRows`, `expectedRowsHash`, hidden specs, answer keys, reference
queries, comparator diagnostics, secrets, or forbidden claims. The answer-key
cell values for the C2 csv step (`one_current`, `secretval`) and `expectedRows`
were **all absent**; the only banned-token match (`overlap`) was a false positive
from "no **overlap**ping effective ranges" in the authored skill copy. The
no-leak guarantee remains the server-side assembly chokepoint (unchanged).

## 9. Evidence-honesty verification

The artifact makes only the allowed Atlas-verified claim and the honest
LIMITATIONS disclaimers ("does not prove… without assistance", "does not
guarantee employment", "does not certify… competence", code "not included"). No
tamper-proof / cheat-proof / job-guaranteed / verified-authorship copy. The
runtime `findBannedClaims` fail-closed guard on the route is unchanged.

## 10. Independent reviews

- **architect → PASS** (no P0/P1): production-inertness clean across three gates;
  fixed clerkId (no impersonation); 404-not-403 preserved; inArray fix correct;
  seed learner-only; invariants intact (serverGrade still csv 1 / sql 1).
- **code-reviewer → SHIP** (no P0/P1): traced the request end-to-end; verified
  the `NODE_ENV` gate at the deploy manifest (`artifact.toml`), `inArray` against
  the installed Drizzle impl, idempotent FK-correct seed, and non-vacuous tests.

P2 dispositions: getCurrentUser e2e branch untested → **FIXED** (+2 tests, 10
total); missing close-out → **FIXED** (this doc). **Deferred with rationale:**
(a) `getAuth(req)` throws under e2e mode in two OUT-OF-SCOPE production routes
(`user.ts:48` `/user/profile`, `ai.ts:345/522`) — e2e-mode-only, not the
portfolio flow (which routes through the gated `getCurrentUser`), and not a
production concern; touching unrelated production routes would broaden scope, so
it is logged for a future phase. (b) the pre-existing reflective
`cors({origin:true, credentials:true})` posture — not introduced here, backlog.

## 11. Tests & gates (Node 24 + Docker PG :5434)

typecheck + check:no-heuristic-runtime **PASS** · **check:boot OK** · api-server
**598/598** (+10 auth adapter tests) · atlas **165/165** · audit:csv-set-equal-bc
PASS (1 opt-in) · audit:sql-resultset-bc PASS (3 dark + 1) · audit:contains-bc
3/3 · audit:authoring exit 0 (server-graded csv 1 / sql 1) · full-stack download
browser-verified end-to-end.

## 12. Final invariants (confirmed)

Exactly 1 `csv_set_equal` + 1 `sql_resultset` opted in (unchanged); no new
validation rows/kinds; envelope enforcement OFF; Phase 52 untouched; **no
schema/migration**; artifact route still authenticated + read-only; `/check`
writes no snapshots; `/submit` snapshot behavior unchanged; the frontend exposes
only safe generated artifacts; **backend/API local boot blocker removed** (gated,
production-inert); portfolio download **browser-verified through the full stack**.
`RUBRIC_VERSION` frozen. **Phase 60F not started.**

## 13. Remaining limitations

- The frontend still fakes **identity** (Clerk shim) — real Clerk SSO in a
  browser needs real keys (a deploy concern, not a code blocker). The API auth
  *middleware contract* is exercised (401/200/404 via the real `requireAuth`).
- The fresh-pass `/submit`→snapshot loop is browser-unverified (API/unit-verified);
  a browser-level run is a documented follow-up.
- Stripe/Resend/Anthropic connectors are still warn-and-skip locally — fine for
  the portfolio flow; a real billing/email/tutor local run is separate (D1/0.2).

## 14. Phase 60F recommendation

With the full stack bootable locally and the download browser-verified, the
deferred E2E tail is unblocked — owner-gated: (1) optional safe
submission-excerpt preview behind a fresh no-leak review; then (2) GitHub export
/ publishing. Also worth a small hardening pass: guard the two out-of-scope
`getAuth` callers for full local-stack robustness, and tighten CORS. None started.
