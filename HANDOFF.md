# Atlas — Session Handoff

**HEAD:** Phase 29 ship (pending commit by platform).
**Status:** Phase 29 **READY TO COMMIT**. Working tree changes: `artifacts/api-server/src/routes/user-portfolio.ts` (new), `artifacts/api-server/src/routes/user-portfolio.test.ts` (new), `artifacts/api-server/src/routes/index.ts` (+2 lines), `artifacts/atlas/src/pages/certificates.tsx` (rewritten on portfolio hook), `artifacts/atlas/src/pages/profile.tsx` (+ evidence chips in Completed + "View portfolio" link), `lib/api-spec/openapi.yaml` (+ `/user/portfolio` path + `PortfolioEvidence` + `UserPortfolioResponse` schemas), `lib/api-client-react/src/generated/*`, `lib/api-zod/src/generated/*`, `HANDOFF.md`, `replit.md`, `docs/phases/phase-29-portfolio-evidence-surface.md` (new).

---

## Final gate summary (Phase 29)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `check:no-heuristic-runtime` | OK |
| OpenAPI codegen | clean |
| atlas tests | **74/74** (unchanged) |
| api-server tests | **235 → 246/246** (+11 P29 portfolio) |
| curriculum-quality tests | **60/60** (unchanged) |
| execution-core tests | **4/4** (unchanged) |
| **Total tests** | **373 → 384/384** |
| Architect | **PASS** (2 test-coverage suggestions folded same session) |
| `author:project anchor-check` | drift **0.00 / 0.00** (no anchor-relevant changes) |
| `audit:pedagogy` (visible) | **56/56** (no content/visibility changes) |
| `audit:bad-completions` (dev DB) | **0 bad rows** (no /submit changes) |

---

## What Phase 29 shipped

- **`GET /api/user/portfolio` (authenticated)** — Reuses the Phase 26/27
  trustworthy completion model and the Phase 28 evidence SQL fragments
  (`stepsCompleted`, `evidenceHashCount`, `firstStepCompletedAt`,
  project-scoped `totalXpEarned` from
  `xp_transactions.metadata->>'projectId'`) to return one
  `PortfolioEvidence` row per completed project owned by the requester.
  Adds learner-facing fields (`course`, `difficulty`, `topRole`,
  `verifyUrl`, `printUrl`) instead of overloading `VerifiedCert`.
  Same defensive clamps as cert-verify: `stepsCompleted ≤ totalSteps`
  (including `totalSteps=0` edge), `evidenceHashCount ≤ stepsCompleted`,
  `durationSeconds ≥ 0`. Items sorted by `completedAt DESC`. Hidden
  (`learner_visible=false`) and soft-deleted projects are silently
  dropped — same anti-leak posture as `/dashboard`.
- **OpenAPI contract** — new `/user/portfolio` path + `PortfolioEvidence`
  + `UserPortfolioResponse` schemas under `user-projects` tag; full
  codegen regenerated for `api-client-react` + `api-zod`.
- **`certificates.tsx` evidence chips** — Per-cert card now shows
  `stepsCompleted/totalSteps`, `totalXpEarned`, evidence count (when
  ≥1), and optional time-invested span. New top-line portfolio summary
  (`completedCount` / `totalProjectXp` / `evidenceBackedCount`). Per
  the user's explicit pin from Phase 28, language is **"evidence-backed
  completion record"** — never "cryptographically attested". Adds a
  Verify link button (deep-link to existing `/verify/:certId` page).
- **`profile.tsx` Completed section** — compact evidence line under
  each completed item (`X/Y steps · Z XP · evidence recorded`) when
  the project is still visible, plus a "View portfolio →" link to
  `/certificates`. No decomposition of the 596-line page (pure
  additive overlay).
- **11 new backend tests** (`user-portfolio.test.ts`, new file) pinning:
  T1 happy-path ordering + summary aggregation; T2 empty state +
  `projects.findMany` not called; T3a/T3b user-isolation mirror (asserts
  `USER_A` in WHERE, `USER_B` absent — and vice versa); T4 401
  anonymous + zero portfolio queries; T5 privacy denylist (no `email`,
  `clerkId`, `userId`, `stripeCustomerId`, `submissionExcerpt`,
  `submissionSha256`, raw hashes) + serialized-string nested check (no
  `USER_A`/`USER_B`/`STRIPE_CUST`/internal `projectId` leak);
  T6 `totalSteps=0` clamp; T7 XP scoping (per-user × per-project);
  T8 hidden / soft-deleted projects silently dropped (no leak);
  T9 relative `verifyUrl` / `printUrl` (no scheme/host coupling);
  **T10** negative-duration clock-skew clamp (folded after architect
  review). T7 additionally pins captured `stepAggs` / `xpAggs` WHERE
  clauses include the authenticated `userId` AND the scoped
  `projectIds` (also folded after architect review).

## Privacy contract (pinned by T3 + T5 + T8)

- `userId` is sourced EXCLUSIVELY from `getCurrentUser(req)`. No path /
  query / body parameter accepts a userId, username, or
  project-ownership claim.
- All four data queries (`progressRows`, `projectRows`, `stepAggs`,
  `xpAggs`) are scoped by `userId = user.id` AND by the
  `projectIds` derived from the user's own completed enrollments.
- Response never contains: `email`, `clerkId`, internal user IDs,
  `stripeCustomerId`, `subscriptionTier`, `submissionExcerpt`,
  `submissionSha256`, raw submission content, raw per-step hashes, or
  data from any project other than the user's own completed visible
  projects.
- Hidden (`learner_visible=false`) and soft-deleted (`deletedAt IS NOT
  NULL`) projects render NO item — symmetric with `/dashboard` and
  `/courses/:slug`.

## Hard stops respected

- Zero schema / migration changes.
- Zero `/check` or `/submit` behavior changes.
- Zero rubric / anchor / taxonomy / content / wave / archive changes.
- Zero dashboard / cert-verify / public-profile behavior changes.
- Zero Stripe / AI tutor / PWA work.
- No new portfolio **page** — surfacing is on existing `/certificates`
  and `/profile`. No decomposition of `profile.tsx`.

## Files touched

- `artifacts/api-server/src/routes/user-portfolio.ts` (new, ~230 lines).
- `artifacts/api-server/src/routes/user-portfolio.test.ts` (new, 11 tests).
- `artifacts/api-server/src/routes/index.ts` (+2 lines: import + use).
- `artifacts/atlas/src/pages/certificates.tsx` (rewritten on
  `useGetUserPortfolio`; evidence chips + Verify button +
  portfolio summary).
- `artifacts/atlas/src/pages/profile.tsx` (+ `useGetUserPortfolio`
  hook + `evidenceBySlug` map + per-row evidence line +
  "View portfolio →" link).
- `lib/api-spec/openapi.yaml` (+ `/user/portfolio` path +
  `PortfolioEvidence` + `UserPortfolioResponse` schemas).
- `lib/api-client-react/src/generated/*` (codegen).
- `lib/api-zod/src/generated/*` (codegen).
- `HANDOFF.md`, `replit.md` (one-line phase entry),
  `docs/phases/phase-29-portfolio-evidence-surface.md` (new).

## Active invariants (post-Phase-29)

- Visible projects: **56**, hidden: 32, beginner: 10
- Zero-beginner courses: **0**
- Wave coverage: **56/56**
- Pedagogy (visible): **56/56**
- Lineage failures: **0 / 0 / 0 / 0**
- 9-course taxonomy intact; rubric `v1.0.1` frozen
- Anchor drift: **0.00 / 0.00**

## Phase 29 NOT addressed (deferred)

- **Print/PDF route at `/certificates/:slug/print`** — the
  `printUrl` returned by the portfolio endpoint references the existing
  per-cert page; a dedicated print-stylesheet route is a follow-up.
- **Bad-completions repair** — still read-only; defer until a
  production run shows non-zero.
- **Dashboard portfolio chip** — natural follow-up if we want the
  evidence summary on `/dashboard` as well.
- **PWA / install / offline shell** — deferred; no integrity dividend.
- **Real-Postgres concurrent /submit integration test** — still
  deferred from Phase 27 (infra-only).
