# Atlas — Session Handoff

**HEAD:** Phase 28 ship (pending commit by platform).
**Status:** Phase 28 **READY TO COMMIT**. Working tree changes: `artifacts/api-server/src/routes/cert-verify.ts`, `artifacts/api-server/src/routes/cert-verify.test.ts` (new), `artifacts/atlas/src/pages/verify.tsx`, `lib/api-spec/openapi.yaml`, `lib/api-client-react/src/generated/*`, `lib/api-zod/src/generated/*`, `HANDOFF.md`, `replit.md`, `docs/phases/phase-28-cert-verify-evidence-enrichment.md` (new).

---

## Final gate summary (Phase 28)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `check:no-heuristic-runtime` | OK |
| OpenAPI codegen | clean |
| atlas tests | **74/74** (unchanged) |
| api-server tests | **222 → 235/235** (+13 P28 cert-verify) |
| curriculum-quality tests | **60/60** (unchanged) |
| execution-core tests | **4/4** (unchanged) |
| **Total tests** | **360 → 373/373** |
| `author:project anchor-check` | drift **0.00 / 0.00** (no anchor-relevant changes) |
| `audit:pedagogy` (visible) | **56/56** (no content/visibility changes) |
| `audit:bad-completions` (dev DB) | **0 bad rows** (no /submit changes) |
| Architect | **PASS** (R1 clamp-bug + 2 edge tests folded in same session) |

---

## What Phase 28 shipped

- **`/api/verify/:certId` enriched** with recruiter-facing evidence summary
  derived from the Phase 26/27 trustworthy completion model. New fields:
  `stepsCompleted`, `totalSteps`, `evidenceHashCount`, `totalXpEarned`
  (project-scoped from `xp_transactions.metadata->>'projectId'`),
  `firstStepCompletedAt`, `durationSeconds`. Pre-P28 fields preserved
  verbatim.
- **OpenAPI contract** — new `VerifiedCert` schema + `/verify/{certId}`
  path under `user-projects` tag; full codegen regenerated for
  `api-client-react` + `api-zod`.
- **`verify.tsx` evidence section** — new "Completion evidence recorded"
  block renders steps X/Y, XP earned, evidence records count, and
  optional time-invested span. Language is **"evidence-backed completion
  record"** per the user's explicit correction — no claim of
  cryptographic attestation. Raw hash values are never rendered.
- **13 new backend tests** (`cert-verify.test.ts`, new file) pinning:
  T1 enriched-fields happy path; T2a–T2d 404-not-403 for malformed /
  non-completed / null-completedAt / missing-user-or-project (no
  existence leak); T3 strict response field allowlist (denylist + nested
  serialized-string check for `email`, `clerkId`, internal IDs, Stripe
  IDs, raw excerpts/hashes); T4 `evidenceHashCount` semantics;
  T5 + **T5b** `stepsCompleted ≤ totalSteps` clamp including
  `totalSteps=0` edge; T6 + **T6b** `totalXpEarned` ledger-scoped sum
  with zero-legacy and negative-duration clamp; T7 + T7b backward
  compatibility and `recipientName` fallback.

## Privacy contract (pinned by T3)

Public response **never** contains: `email`, `clerkId`, internal user
IDs, `stripeCustomerId`, `subscriptionTier`, `submissionExcerpt`,
`submissionSha256`, raw submission content, raw per-step hashes, or any
data from a project other than the one the certificate is for. Only the
**count** of evidence hashes is exposed.

## Hard stops respected

- Zero schema / migration changes.
- Zero `/check` or `/submit` behavior changes.
- Zero rubric / anchor / taxonomy / content / wave / archive changes.
- Zero Stripe / AI tutor / PWA / dashboard / profile / portfolio work.
- Zero auth-route changes (`/verify/:certId` is and remains public).

## Architect review

- **R1 FAIL → PASS.** Architect caught a real clamp bug:
  `Math.min(stepsCompletedRaw, totalSteps || stepsCompletedRaw)` — when
  `project.totalSteps === 0` (archived / thin-stub projects exist in
  the catalog), the `||` fallback resolves to `raw`, breaking the
  `stepsCompleted ≤ totalSteps` invariant. **Folded in same session:**
  - Route now uses unconditional
    `const totalSteps = Math.max(0, project.totalSteps ?? 0);`
    `const stepsCompleted = Math.max(0, Math.min(stepsCompletedRaw, totalSteps));`
  - **T5b** pins the `totalSteps=0` edge → `stepsCompleted` and
    `evidenceHashCount` both clamp to 0.
  - **T6b** pins the `firstStepCompletedAt > completedAt` clock-skew
    edge → `durationSeconds` clamps to 0.

## Files touched

- `artifacts/api-server/src/routes/cert-verify.ts` (51 → 140 lines).
- `artifacts/api-server/src/routes/cert-verify.test.ts` (new, 13 tests).
- `artifacts/atlas/src/pages/verify.tsx` (147 → 219 lines, render-only
  additions + interface extension).
- `lib/api-spec/openapi.yaml` (+118 lines: new path + `VerifiedCert`
  schema).
- `lib/api-client-react/src/generated/*` (codegen).
- `lib/api-zod/src/generated/*` (codegen).
- `HANDOFF.md`, `replit.md` (one-line phase entry), this phase's
  `docs/phases/phase-28-cert-verify-evidence-enrichment.md` (new).

## Active invariants (post-Phase-28)

- Visible projects: **56**, hidden: 32, beginner: 10
- Zero-beginner courses: **0**
- Wave coverage: **56/56**
- Pedagogy (visible): **56/56**
- Lineage failures: **0 / 0 / 0 / 0**
- 9-course taxonomy intact; rubric `v1.0.1` frozen
- Anchor drift: **0.00 / 0.00**

## Phase 28 NOT addressed (deferred)

- **Bad-completions repair** — `audit:bad-completions` is read-only.
  Dev clean; production state unverified. Defer until a production
  read-only run shows non-zero, then spec a repair phase.
- **Learner-facing portfolio surface** — natural Phase 29: reuse
  `VerifiedCert`-shaped DTO inside an authenticated richer wrapper on
  profile / dashboard. Phase 28 deliberately scoped to the public cert
  page only.
- **PWA / install / offline shell** — deferred; no integrity dividend.
- **Real-Postgres concurrent /submit integration test** — still
  deferred from Phase 27 (infra-only).
