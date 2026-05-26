# Phase 29 — Learner-facing Portfolio / Authenticated Evidence Surface

## Objective

Surface the Phase 26/27 trustworthy completion evidence on the
learner's *own* authenticated surfaces (`/certificates`, `/profile`)
without touching the public `/verify/:certId` cert page, the
`/dashboard` payload, or any of the write paths (`/check`, `/submit`,
enrollment).

## Shape

- **New route:** `GET /api/user/portfolio` (auth-required).
- **New DTOs:** `PortfolioEvidence`, `UserPortfolioResponse`. Modeled
  separately from `VerifiedCert` because the privacy contracts and
  field needs differ (the public cert needs `recipientName` / `issuer`;
  the learner's own surface needs `course` / `difficulty` / `topRole`
  / `verifyUrl` / `printUrl` and does not need recipient identity
  echoed back).
- **Frontend changes (pure overlay):**
  - `certificates.tsx` switched from `useListUserProjects` to
    `useGetUserPortfolio`; per-cert evidence chips + portfolio
    summary band + Verify deep-link button.
  - `profile.tsx` adds a parallel `useGetUserPortfolio` query, builds
    an `evidenceBySlug` map, and inlines a compact one-line evidence
    summary under each completed row, plus a "View portfolio →" link
    in the Completed card header. No decomposition.

## Evidence semantics (carry-over from P28)

Same SQL fragments and same defensive clamps as
`artifacts/api-server/src/routes/cert-verify.ts`:

- `stepsCompleted` = `count(*) filter (where passed=true)` GROUP BY
  `projectId`, clamped to `[0, totalSteps]` (so the
  `totalSteps=0` archived/thin-stub edge clamps to 0 instead of
  exposing pathological raw counts).
- `evidenceHashCount` = same count with the extra
  `submissionSha256 is not null` predicate, clamped to
  `[0, stepsCompleted]`. Raw hash values are never read into the
  response.
- `firstStepCompletedAt` = `min(completedAt) filter (where
  passed=true)` GROUP BY `projectId`. Null when no passed rows exist
  (legacy pre-P26 completions).
- `durationSeconds` = `completedAt − firstStepCompletedAt`, in whole
  seconds, clamped `≥ 0`. Null when `firstStepCompletedAt` is null.
- `totalXpEarned` = `sum(amount)` GROUP BY
  `metadata->>'projectId'` from `xp_transactions`, scoped by
  `userId = me` AND `projectIds = ANY(...)`. Legacy pre-P26 awards
  (which were not ledger-written) contribute 0.

## Privacy contract (pinned by tests T3a/T3b, T5, T8)

- `userId` is sourced EXCLUSIVELY from `getCurrentUser(req)`. There
  is no path/query/body parameter that accepts a userId, username,
  or project-ownership claim.
- All four data queries are scoped by `userId = me` AND by the
  `projectIds` derived from the requester's own completed
  enrollments. The `projectsFindMany` step additionally enforces
  `learnerVisible = true` AND `deletedAt IS NULL`.
- Response never contains: `email`, `clerkId`, internal user IDs,
  `stripeCustomerId`, `subscriptionTier`, `submissionExcerpt`,
  `submissionSha256`, raw submission content, raw per-step
  hashes, or any data scoped to a different user or project.
  Internal `projectId` UUIDs are never echoed — only the public
  `slug` is.
- Hidden / soft-deleted projects render **no item** — symmetric
  with `/dashboard` and `/courses/:slug`. Per-summary aggregates
  (`completedCount`, `totalProjectXp`, `evidenceBackedCount`) are
  computed over the post-drop `items[]` so they stay consistent.

## UI language pin

Per the explicit user correction from Phase 28, all evidence
language is **"evidence-backed completion record"** — never
"cryptographically attested" or "verified by hash". Both the
`/certificates` summary band and the per-cert evidence chip follow
this rule. Per-row evidence line on `/profile` simply says "evidence
recorded".

## Out of scope (deferred follow-ups)

- Dedicated print-stylesheet route at `/certificates/:slug/print`.
  The portfolio endpoint returns the `printUrl` as a relative path
  pointing at the existing per-cert page; a dedicated print route is
  a follow-up.
- Dashboard evidence chip on `/dashboard`.
- Decomposition of the 596-line `profile.tsx` — explicitly
  out of scope for this phase per the user's instruction.
- New `/portfolio` page — surfacing is on existing pages only.
- Print-ready PDF / shareable image generation.

## Hard stops respected

- Zero schema / migration changes.
- Zero `/check` or `/submit` behavior changes.
- Zero rubric / anchor / taxonomy / content / wave / archive changes.
- Zero dashboard / cert-verify / public-profile behavior changes.
- Zero Stripe / AI tutor / PWA work.

## Gate summary

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `check:no-heuristic-runtime` | OK |
| OpenAPI codegen | clean |
| atlas tests | 74/74 (unchanged) |
| api-server tests | 235 → 245/245 (+10 P29) |
| curriculum-quality tests | 60/60 (unchanged) |
| execution-core tests | 4/4 (unchanged) |
| Total tests | 373 → 383/383 |
| `audit:pedagogy` (visible) | 56/56 (unchanged) |
| Anchor drift | 0.00 / 0.00 |

## Test pin index (`user-portfolio.test.ts`)

- **T1** Happy path: items ordered `completedAt DESC`; summary
  matches.
- **T2** Empty state: zero completions → 200 with empty items + zero
  summary; `projects.findMany` not called.
- **T3a/T3b** User isolation A/B mirror: asserts `USER_A` in WHERE,
  `USER_B` absent (and vice versa).
- **T4** 401 anonymous; no portfolio data queried.
- **T5** Privacy denylist (top-level + per-item) + serialized-string
  nested check guarding `USER_A`/`USER_B`/`STRIPE_CUST` + internal
  `projectId`.
- **T6** Clamp: `stepsCompleted ≤ totalSteps`, including the
  `totalSteps = 0` archived edge.
- **T7** XP scoping: only `userId = me` AND `projectId IN scoped`
  XP transactions contribute.
- **T8** Hidden / soft-deleted projects silently dropped; no leak.
- **T9** Share URLs are relative (`/verify/...` and
  `/certificates/.../print`); no scheme/host coupling.
