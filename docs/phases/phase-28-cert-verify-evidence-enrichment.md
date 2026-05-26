# Phase 28 — Cert-verify Evidence Enrichment

**Status:** Shipped.
**Predecessor:** Phase 27 (concurrent /submit race hardening) closed the
transactional reward boundary. The Phase 26/27 evidence (`submission_sha256`
on passed step rows; `xp_transactions` ledger entries) was being **written
trustworthily but never surfaced**. Phase 28 cashes in that work on the
public certificate page.

---

## Goal

Turn `/api/verify/:certId` from a bare completion assertion into a
recruiter-facing evidence summary backed by the Phase 26/27 trustworthy
completion model — without leaking any private learner data.

## Non-goals

- Schema or migration changes.
- `/check` or `/submit` behavior changes.
- Rubric / anchor / taxonomy / content / wave / archive changes.
- Stripe / AI tutor / PWA / dashboard / profile / portfolio work.
- Cryptographic-attestation claims. (User correction explicitly forbade
  this language until Atlas exposes a real verifiable proof model.)

## Approved evidence fields

| Field | Source | Notes |
|---|---|---|
| `stepsCompleted` | `COUNT(*) FILTER (passed=true)` on `user_step_completions` scoped to `(userId, projectId)` | Defensively clamped: `max(0, min(raw, totalSteps))`. |
| `totalSteps` | `projects.total_steps` | Defensively clamped to `≥ 0`. |
| `evidenceHashCount` | `COUNT(*) FILTER (passed=true AND submission_sha256 IS NOT NULL)` | **Count only** — raw hash strings never exposed. Clamped to `≤ stepsCompleted`. |
| `totalXpEarned` | `SUM(xp_transactions.amount)` where `userId=cert.userId AND metadata->>'projectId' = cert.projectId` | Project-scoped only. Legacy pre-P26 completions correctly read `0`. |
| `firstStepCompletedAt` | `MIN(user_step_completions.completed_at) FILTER (passed=true)` | Nullable for legacy rows with no step-completion data. |
| `durationSeconds` | `completedAt − firstStepCompletedAt`, whole seconds | Clamped to `≥ 0` (clock-skew defense). Null when `firstStepCompletedAt` is null. |

Pre-Phase-28 fields (`certId`, `recipientName`, `recipientUsername`,
`projectTitle`, `projectSlug`, `completedAt`, `issuer`) are preserved
verbatim.

## Privacy contract (pinned by T3)

Public response **never** contains:

- `email`, `clerkId`
- internal `userId` / `projectId` strings
- `stripeCustomerId`, `subscriptionTier`
- `submissionExcerpt`, `submissionSha256` (raw)
- raw submission content
- data from any project other than the certificate's project
- any attempt body / learner workspace content

T3 enforces both a property-name denylist AND a serialized-string nested
check (asserts that sensitive *values* like the user email, clerk ID,
Stripe customer ID, and internal UUIDs are not present anywhere in the
JSON body).

## 404 contract

Always 404 — **never** 403 — for every failure mode:

- malformed `certId` (regex gate before any DB hit)
- missing `user_progress` row
- row with `status != 'completed'`
- row with `completedAt = null`
- missing referenced user or project

No existence leak.

## Frontend language (user correction)

The verify page renders an **"Completion evidence recorded"** section
with footnote *"Each submission is recorded as an evidence-backed
completion record at the time the learner passed the step. Counts only —
no learner submission content is exposed."*

Explicitly **NOT** used: "cryptographically attested", "cryptographic
proof", "verifiable proof". Atlas does not (yet) expose a real verifiable
proof model — a stored SHA-256 is integrity metadata, not attestation.

## Architect review

**R1 FAIL → PASS.** Architect found a real clamp bug:
`Math.min(stepsCompletedRaw, totalSteps || stepsCompletedRaw)` — when
`project.totalSteps === 0` (archived / thin-stub projects exist in the
catalog), the `||` fallback resolves to `raw`, breaking the
`stepsCompleted ≤ totalSteps` invariant. **Folded in same session:**

- Route now uses unconditional
  `const totalSteps = Math.max(0, project.totalSteps ?? 0);`
  `const stepsCompleted = Math.max(0, Math.min(stepsCompletedRaw, totalSteps));`
- **T5b** pins the `totalSteps=0` edge → both `stepsCompleted` and
  `evidenceHashCount` clamp to 0.
- **T6b** pins `firstStepCompletedAt > completedAt` (clock skew)
  → `durationSeconds === 0`.

## Files touched

- `artifacts/api-server/src/routes/cert-verify.ts` — 51 → 140 lines.
  New SQL aggregations + Phase 28 evidence response. Privacy-allowlist
  response shape.
- `artifacts/api-server/src/routes/cert-verify.test.ts` — **new**,
  13 tests (T1, T2a–T2d, T3, T4, T5, T5b, T6, T6b, T7, T7b).
- `artifacts/atlas/src/pages/verify.tsx` — 147 → 219 lines. Interface
  extended to match new `VerifiedCert` schema; new evidence section
  with `data-testid="verify-evidence"`, `verify-steps`, `verify-xp`,
  `verify-evidence-count`, `verify-duration`. `formatDuration` helper.
- `lib/api-spec/openapi.yaml` — new `/verify/{certId}` path + new
  `VerifiedCert` component schema.
- `lib/api-client-react/src/generated/*`, `lib/api-zod/src/generated/*`
  — orval codegen output.
- `HANDOFF.md`, `replit.md` — phase entry.
- `docs/phases/phase-28-cert-verify-evidence-enrichment.md` — this file.

## Final gate summary

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean (all packages + libs) |
| `check:no-heuristic-runtime` | OK |
| OpenAPI codegen | clean |
| atlas tests | **74/74** (unchanged) |
| api-server tests | **222 → 235/235** (+13 P28) |
| curriculum-quality tests | **60/60** (unchanged) |
| execution-core tests | **4/4** (unchanged) |
| **Total tests** | **360 → 373/373** |
| `author:project anchor-check` | drift **0.00 / 0.00** (no anchor changes) |
| `audit:pedagogy` (visible) | **56/56** (no content changes) |
| `audit:bad-completions` (dev DB) | **0** (no /submit changes) |
| Architect | **PASS** (R1 folded in) |

## Active invariants (post-Phase-28)

- Visible projects: 56, hidden: 32, beginner: 10
- Zero-beginner courses: 0
- Wave coverage: 56/56
- Pedagogy (visible): 56/56
- Lineage failures: 0 / 0 / 0 / 0
- 9-course taxonomy intact; rubric `v1.0.1` frozen
- Anchor drift: 0.00 / 0.00

## Deferred / next-phase candidates

- **Phase 29 (suggested):** Learner-facing portfolio surface — reuse
  the `VerifiedCert` shape inside an authenticated richer wrapper on
  profile / dashboard. Natural follow-on now that the public contract
  is set.
- **Bad-completions repair:** read-only audit clean in dev; production
  state unverified. Defer until a production read-only run shows
  non-zero.
- **PWA / install / offline shell:** no integrity dividend; deferred.
- **Real-Postgres concurrent /submit integration test:** still deferred
  from Phase 27 (requires infra not in test harness).
