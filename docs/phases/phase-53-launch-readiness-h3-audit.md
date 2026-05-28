# Phase 53 — Launch-Readiness H3 Honest-Claim Audit

**Status:** CLOSED.
**Type:** Audit + minimal copy/link/guard expansion. Pure frontend + test infra. Zero canary-path edits.
**Parent commit:** `efa4ddf` (Phase 52 — operator flip kit prepared, flip not executed).
**Phase 52 status (unchanged):** operator-execution still pending. Phase 53 is **not** the 10% ramp evaluation.

---

## Why this phase

Phase 52 closed with the production canary flip parked pending operator execution. Rather than open Phase 53 as the 10% ramp evaluation (which requires real operator evidence from the Phase 52 kit), this phase takes a separate safe lane: a launch-readiness audit of every user-facing surface that makes a claim about what Atlas verifies, certifies, or attests.

The audit hardens the **H3 honest-claim ceiling** that Phases 49–52 established as frozen:

> Atlas may say enabled paths verify that submitted runtime output matched the expected result and that the record was issued by Atlas at the time the learner passed the step.
> Atlas may NOT claim independent authorship (H1), no-outside-help (H2), tamper-proof / cheat-proof / fraud-proof validation, 100%-verified, or certified mastery.

Phase 49 placed an enforcement guard on the `/how-atlas-grades` disclosure page (DOM-level banned-phrase scan). That guard only covered one page. This phase extends coverage to every other high-visibility learner surface, tightens four ambiguous copy fragments, and adds four new entry-point links so a learner forming an overclaim impression at the cert/portfolio/workspace moment can reach the disclosure in one click.

---

## What landed

### 1. Shared banned-phrase module (NEW)

`artifacts/atlas/src/lib/banned-h1h2-phrases.ts` — single source of truth for the 16-phrase H1/H2 banned list. Identical to the Phase 49 inline list, now extracted so two test suites consume the same canonical array.

Phrases (frozen, unchanged from Phase 49):
`tamper-proof`, `tamperproof`, `cheat-proof`, `cheatproof`, `fraud-proof`, `verified authorship`, `proven authorship`, `proves you wrote`, `guarantees you wrote`, `guaranteed authentic`, `proven mastery`, `certifies mastery`, `anti-cheat`, `plagiarism-proof`, `100% verified`, `independently verified`.

### 2. Phase 49 DOM-scan guard rewired

`artifacts/atlas/src/pages/how-atlas-grades.test.tsx` now imports `BANNED_H1H2_PHRASES` instead of inlining the list. Test semantics unchanged.

### 3. Source-level banned-phrase guard (NEW)

`artifacts/atlas/src/lib/banned-h1h2-phrases.test.ts` — reads 7 user-facing source files via Node `fs` (jsdom env preserves Node API access) and asserts each banned phrase is absent. On hit, the failure message includes the offending phrase, a 40-char context window, the file path, and a remediation pointer.

Files guarded (one assertion per file × 16 phrases = 112 substring checks, plus 1 sanity-check that asserts all 7 surface categories remain in the guarded list — catches refactor drift):

| Surface | File |
|---|---|
| certificate-print page | `src/pages/certificate-print.tsx` |
| certificate verify page | `src/pages/verify.tsx` |
| certificates listing page | `src/pages/certificates.tsx` |
| marketing home page | `src/pages/home.tsx` |
| workspace validation panel | `src/components/studio/ValidationFeedbackPanel.tsx` |
| onboarding page | `src/pages/onboarding.tsx` |
| api-server email templates | `../../../api-server/src/lib/email.ts` |

Documented trade-off (in the test header): source-level grep won't catch runtime-composed strings (server-returned copy, i18n keys, string concatenation). Rendering each page would require mocking Clerk, react-query, and fetch — too brittle for a copy guard. Hardcoded literals are the highest-risk category and the one this guard catches.

### 4. Copy tightening — 4 AMBIGUOUS phrases reworded

| File | Before | After | Reason |
|---|---|---|---|
| `certificate-print.tsx` | "Skills demonstrated:" | "Skills practiced in this project:" | "demonstrated" can imply mastery |
| `verify.tsx` | "Verified certificate" | "Verified completion record" | "verified certificate" reads like third-party-audited authorship |
| `home.tsx` | "Earn proof" / "earn XP and a certificate" | "Earn the record" / "earn XP and an evidence-backed completion certificate" | "proof" implies authorship/no-help proof, which Atlas does not offer |
| `certificates.tsx` | "roles you're now ready for" | "roles this project prepares you for" | "ready for" implies certified job-readiness; "prepares you for" matches H3 |

### 5. Disclosure entry points — 4 new `/how-atlas-grades` links

Every high-risk moment where a learner might form an overclaim impression now has a one-click path to the disclosure:

| Surface | Placement | testid | Mechanism |
|---|---|---|---|
| Certificate print page | no-print header row, next to Print button | `cert-print-how-grading-works` | `wouter` Link |
| Certificate verify page | inline with the existing evidence-band tail copy | `verify-how-grading-works` | `wouter` Link |
| Certificates listing page | inline with the page subtitle | `certs-how-grading-works` | `wouter` Link |
| Workspace completion celebration | top-right of the completion block | `completion-how-grading-works` | `<a target="_blank" rel="noopener noreferrer">` — opens new tab to preserve workspace state |

Marketing home already had a `/how-atlas-grades` footer link from Phase 49b — left as-is.

---

## Files changed (8 total)

| # | File | Change |
|---|---|---|
| 1 | `artifacts/atlas/src/lib/banned-h1h2-phrases.ts` | NEW — shared phrase list |
| 2 | `artifacts/atlas/src/lib/banned-h1h2-phrases.test.ts` | NEW — source-level grep guard (+8 tests) |
| 3 | `artifacts/atlas/src/pages/how-atlas-grades.test.tsx` | EDIT — import shared list |
| 4 | `artifacts/atlas/src/pages/certificate-print.tsx` | EDIT — copy + link |
| 5 | `artifacts/atlas/src/pages/verify.tsx` | EDIT — copy + link |
| 6 | `artifacts/atlas/src/pages/certificates.tsx` | EDIT — copy + link |
| 7 | `artifacts/atlas/src/pages/home.tsx` | EDIT — copy only |
| 8 | `artifacts/atlas/src/components/studio/ValidationFeedbackPanel.tsx` | EDIT — link only |

`git diff --stat` (tracked edits only): 6 files changed, 51 insertions(+), 33 deletions(-). Two NEW files add the shared module + new test.

---

## Gates

| Gate | Result | Delta |
|---|---|---|
| `pnpm run typecheck` (libs + 4 artifacts + check:no-heuristic-runtime) | OK | unchanged |
| `@workspace/atlas` vitest | **136 / 136** | **+8** (was 128) |
| `@workspace/api-server` vitest | unchanged 395 / 395 | — |
| `@workspace/execution-core` vitest | unchanged 83 / 83 | — |
| `@workspace/curriculum-quality` vitest | unchanged 93 / 93 | — |
| `audit:authoring` | unchanged 58 / 58 | — |
| `audit:pedagogy` | unchanged 58 / 58 | — |
| `check:no-heuristic-runtime` | OK — no runtime mapToCourse callers outside the 4-entry allowlist | unchanged |
| Honest-claim ceiling | H3 preserved AND tightened (4 AMBIGUOUS fragments removed; 4 new disclosure links) | tighter |

---

## Hard stops respected

| Surface | Touched? |
|---|---|
| Signed-envelope canary path (`envelopeSubmit.ts`, `envelopeMetrics.ts`, `envelopeGrade.ts`) | NO |
| Production env vars (`ATLAS_ENVELOPE_*`, `RUN_ENVELOPE_SIGNING_SECRET`) | NO |
| `/check` route | NO |
| Grading logic / `lib/grading.ts` / `lib/execution-core` | NO |
| Schema / migrations | NO |
| Project content / seed / pedagogy / rubric | NO |
| Cert / portfolio evidence semantics (counts, hashes, durations) | NO — wording only |
| OpenAPI / codegen | NO |
| Production deploy | NO |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| Phase 52 status | UNCHANGED — operator flip kit prepared, flip not executed |

---

## Architect review

Final verdict: **PASS** — "no blocking defects" across all six review questions (new copy still ≤ H3, guard sound, links discoverable, `_blank` trade-off correct, no P0 surface missed). Three explicitly non-blocking recommendations are recorded as Phase 54+ candidates below.

---

## Remaining launch-readiness gaps (non-blocking, Phase 54+ candidates)

These are explicit non-P0 hardening items the architect raised. Recording them here so they are not lost.

1. **Regex/normalized pattern banned-phrase matching.** Current guard is exact-substring. Bypasses include Unicode hyphens (`tamper‑proof`), whitespace variants, and lexical synonyms not in the list (`session-verified solver`, `machine-verified authorship`, `authorship verified`, `outside-help-free`). Upgrade to normalized regex patterns + stem-matching would tighten the net.
2. **Server-side learner-visible string scan.** If a future API response builder ever returns user-facing copy in a `message` / `summary` / `description` field, the source-grep guard won't catch it. Adding `cert-verify.ts` response builder + any new SSE/streamed-message routes to the scan list would close that gap.
3. **Tone-alignment sweep for adjacent career phrasing.** Phrases like "roles unlocked", "qualifies you for", "now closer to" remain on cert + portfolio + workspace surfaces. None cross H3 today, but a tone-alignment pass with the newly tightened wording would be consistent. Out of scope for Phase 53 (minimal-edit constraint).
4. **Public profile / portfolio share surface.** `public-profile.tsx` was not in this audit's high-risk list because the explorer subagent found no claim language on it, but if a future redesign adds employer-facing grading/evidence framing, it should join the source-grep guard.

Phase 52 (production canary flip) remains the higher-priority blocker for any envelope-related work. Phase 53 should not be conflated with the 10% ramp evaluation.

---

## What unblocks Phase 54+ envelope work

Unchanged from Phase 52 close-out — Phase 53 does not satisfy any operator-side prerequisite:

1. Operator runs `docs/phases/phase-52-canary-1pct-flip-kit.md` §§1–10.
2. 48h / 500-success hold confirmed at kit §10.
3. Operator records sign-off + recommendation (hold / rollback / 10% ramp evaluation).

Only then does the 10% ramp evaluation phase open.

---

## Commits

- `efa4ddf` — phase-52: operator flip kit (parent)
- _(this commit)_ — phase-53: launch-readiness H3 audit + banned-phrase guard expansion to user-facing surfaces
