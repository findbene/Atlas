# Phase 54 — Copy-Safety Hardening

**Status:** CLOSED.
**Type:** Small follow-up to Phase 53. Pure Atlas-side edits + test infra. Zero canary-path edits.
**Parent commit:** Phase 53 (`b0667ec`).
**Phase 52 status (unchanged):** operator flip kit prepared, flip not executed. Phase 54 is **not** the 10% ramp evaluation and does not satisfy any Phase 52 operator-side prerequisite.

---

## Why this phase

Phase 53's architect review flagged three non-blocking copy-safety follow-ups:

1. Banned-phrase matching was exact-substring → trivially evadable with Unicode hyphens, NBSP, ZWJ, fullwidth letters, or obvious phrase variants.
2. Adjacent career phrasing ("roles unlocked", "qualified for", "job-ready", "guaranteed") had not been scanned for tone alignment with the newly tightened wording.
3. Server-side response builders had not been scanned for learner-visible literal strings.

Phase 54 picks up #1 and #2 within a narrow, low-risk scope. #3 was audited and deliberately not extended (see "Server-side scan — deliberate skip" below).

---

## Architect review history

| Round | Result | Findings → disposition |
|---|---|---|
| v1 | FAIL | (a) `normalize()` missed ZWJ U+200D + fullwidth letters → bypasses verified. (b) `stem()` `[-\s]*` with no boundaries → `stamper proofreader` matched `tamper-proof`. (c) Needed regression tests for both classes. + Non-blocking: "qualifies you for" on home.tsx. |
| v2 | FAIL | (a)(b)(c) all closed. New gap: `100% verified` regex still unbounded; could overmatch inside larger digit tokens. |
| v3 | PASS | `100% verified` regex now wrapped with same Unicode word-boundary lookarounds. Negative regression test added. |

---

## Risk list (Phase 53 review → Phase 54 disposition)

| Phase 53 risk | Phase 54 disposition |
|---|---|
| Unicode hyphen evasion (`tamper‑proof` with U+2011) | FIXED — `normalize()` maps dash variants to ASCII `-`; `[-\s]*` stem pattern matches |
| Whitespace evasion (NBSP, zero-width, line wraps) | FIXED — `normalize()` maps whitespace variants to regular space; zero-width handled by `\p{Cf}` strip |
| Hyphen-vs-space evasion (`tamper proof` vs `tamper-proof`) | FIXED — stem patterns use `[-\s]*` so both forms match |
| Case evasion | FIXED — `normalize()` lowercases |
| Phrase variants (`authorship verified`, `machine-verified authorship`, etc.) | FIXED — 6 new patterns added |
| Zero-width / format-control evasion (ZWJ U+200D, ZWNJ U+200C, BOM U+FEFF, soft hyphen U+00AD, bidi marks) | FIXED (v2) — `\p{Cf}` stripped before any other matching |
| Fullwidth-letter evasion (`ｔａｍｐｅｒ－ｐｒｏｏｆ` with U+FF54.. / U+FF0D) | FIXED (v2) — NFKC normalization first |
| Boundary overmatch (`stamper proofreader` matching `tamper-proof`) | FIXED (v2) — `(?<![\p{L}\p{N}])...(?![\p{L}\p{N}])` Unicode lookarounds |
| `100% verified` unbounded overmatch inside digit tokens | FIXED (v3) — same Unicode boundary lookarounds applied |
| Tone drift on "roles unlocked" / "qualifies you for" surfaces | FIXED on 4 most overclaim-shaped surfaces; 4 forward-tense surfaces deliberately left alone |
| Server-route learner-visible copy | NO ACTION — audit found only structured error strings (no copy to guard) |

---

## Files changed (7 total)

| # | File | Change |
|---|---|---|
| 1 | `artifacts/atlas/src/lib/banned-h1h2-phrases.ts` | REWRITE — adds `normalize()` (NFKC + Cf strip + dash + whitespace) + `BANNED_H1H2_PATTERNS` (20 patterns, 6 new) with Unicode word-boundary lookarounds; back-compat `BANNED_H1H2_LABELS` retained |
| 2 | `artifacts/atlas/src/lib/banned-h1h2-phrases.test.ts` | REWRITE — uses patterns + normalized source scan; adds 7 positive/negative test suites including v2 evasion regressions and v3 100%-boundary negatives |
| 3 | `artifacts/atlas/src/pages/how-atlas-grades.test.tsx` | REWRITE — uses patterns + `normalize(document.body.textContent)` for DOM scan |
| 4 | `artifacts/atlas/src/pages/certificates.tsx` | EDIT — "Role unlocked" → "Role this project prepares you for" |
| 5 | `artifacts/atlas/src/pages/profile.tsx` | EDIT — "Career Roles Unlocked" → "Career roles in your portfolio" |
| 6 | `artifacts/atlas/src/components/studio/ValidationFeedbackPanel.tsx` | EDIT — "What you just unlocked" → "What this project prepares you for" |
| 7 | `artifacts/atlas/src/pages/home.tsx` | EDIT — "qualifies you for" → "prepares you for" (v2 architect note) |

---

## Exact guard improvements

### `normalize(input: string): string` — 5-step pipeline

| # | Step | Why |
|---|---|---|
| 1 | `.normalize("NFKC")` | Collapses fullwidth letters/digits/hyphen (U+FF0D, U+FF21..FF5A) and ligatures onto ASCII. Closes the `ｔａｍｐｅｒ－ｐｒｏｏｆ` bypass. |
| 2 | `.replace(/\p{Cf}/gu, "")` | Strips every Unicode format-control char: ZWJ U+200D, ZWNJ U+200C, word joiner U+2060, BOM U+FEFF, soft hyphen U+00AD, LRM/RLM U+200E/F, bidi controls U+202A..U+202E, isolates U+2066..U+2069, ZWSP U+200B. Closes the `tamper\u200dproof` bypass. |
| 3 | `.toLowerCase()` | Case insensitivity. |
| 4 | Dash family → ASCII `-` | U+002D, U+2010..U+2015, U+2212 (and FE58/FE63/FF0D defense-in-depth even though NFKC handles them). |
| 5 | Whitespace family → ASCII space | U+00A0 NBSP, U+2000..U+200A en/em spaces, U+2028/U+2029 line/para separators, U+202F narrow NBSP, U+205F medium math space, U+3000 ideographic space. |

### `stem(...words)` helper — bounded match

```ts
new RegExp(
  `(?<![\\p{L}\\p{N}])${escaped.join("[-\\s]*")}(?![\\p{L}\\p{N}])`,
  "u",
);
```

Zero-or-more between stems so `tamperproof`, `tamper proof`, and `tamper-proof` all match with a single rule. Unicode lookaround boundaries so `stamper proofreader` / `anticheating` / `uncheatproofly` / `improven masteryless` / `verifies authorship-tracking workflows` correctly do NOT match.

### `BANNED_H1H2_PATTERNS` — 20 entries (6 new vs Phase 49/53)

| Category | Patterns |
|---|---|
| Tamper / cheat / fraud / plagiarism | tamper-proof, cheat-proof, fraud-proof, plagiarism-proof, anti-cheat |
| Authorship (H1) | verified authorship, **authorship verified** (NEW), proven authorship, **machine-verified authorship** (NEW), **session-verified solver** (NEW), proves you wrote, **verified that you wrote** (NEW), guarantees you wrote, guaranteed authentic |
| Mastery | proven mastery, certifies mastery, **certified mastery** (NEW) |
| Outside-help (H2) | **outside-help-free** (NEW) |
| Third-party / independent | independently verified |
| Percentage | 100% verified — bounded regex `/(?<![\p{L}\p{N}])100\s*(%|percent)\s*verified(?![\p{L}\p{N}])/u` |

### Tests added in `banned-h1h2-phrases.test.ts`

| Suite | Cases |
|---|---|
| User-facing surface scan | 7 files × 20 patterns = 140 normalized checks |
| Refactor-drift sentinel | asserts all 7 surface categories remain guarded |
| normalize() defenses | lowercase, 8 dash variants, NBSP/narrow NBSP/ZWSP behavior |
| normalize() format-control strip (v2) | 16 Cf chars: ZWJ, ZWNJ, LRM, RLM, word joiner, BOM, soft hyphen, all bidi controls, isolates |
| normalize() NFKC fullwidth (v2) | full fullwidth `ｔａｍｐｅｒ－ｐｒｏｏｆ` and uppercase `ＴＡＭＰＥＲ` |
| Phase 49 regression | every original phrase still caught |
| Unicode dash variants | 4 dash chars × `tamper proof` |
| Hyphen-vs-space | `tamper proof`, double-space, NBSP |
| Phase 54 new phrases | 6 new patterns, both hyphen and space forms |
| 100% variants | `100 % verified`, `100  percent  verified`, `100%verified` |
| 100% boundary negatives (v3) | `score2100% verifiedly tested`, `v100% verifiedness` — NOT matched |
| Negative: disclosure phrasing | "does not prove that you wrote", "does not certify mastery" — NOT flagged |
| Negative: boundary overmatch (v2) | `stamper proofreader`, `uncheatproofly`, `anticheating`, `improven masteryless`, `verifies authorship-tracking workflows` — NOT matched |
| v2 evasion positives | ZWJ, ZWNJ, full fullwidth, BOM, soft hyphen — all caught |

---

## Tone-alignment sweep

### Edits (4)

| File | Before | After | Reason |
|---|---|---|---|
| `certificates.tsx` | "Role unlocked" | "Role this project prepares you for" | "unlocked" implies earned qualification |
| `profile.tsx` | "Career Roles Unlocked" | "Career roles in your portfolio" | same; subtitle already honest ("portfolio evidence for") |
| `ValidationFeedbackPanel.tsx` | "What you just unlocked" | "What this project prepares you for" | "unlocked" on completion celebration overstates |
| `home.tsx` (v2 architect note) | "which roles it qualifies you for" | "which roles it prepares you for" | "qualifies" is stronger than the tightened "prepares" tone elsewhere |

### Deliberate omissions (out of scope for a narrow phase)

| Surface | Phrase | Why left alone |
|---|---|---|
| `home.tsx` (hero) | "Roles you'll be ready for" | Future-tense; not a present-qualification claim |
| `home.tsx` (badge) | "READY FOR" | Same context as above |
| `JobOutcomesPanel.tsx` | "Roles you'll be ready for" / "Interview questions you'll be ready for" | Future-tense forward-looking |
| `certificate-print.tsx` | "Portfolio-ready for" | Standard career-prep phrasing |
| `ValidationFeedbackPanel.tsx` (sibling block) | "Roles you're now closer to:" | "closer to" already softened — explicitly not a qualification claim |

Targets the user listed ("roles unlocked", "qualified for", "job-ready", "guaranteed", "just unlocked") were grepped across `artifacts/atlas/src/`. `qualified for`, `job-ready`, `guaranteed` returned ZERO learner-facing hits ("guaranteed" appears only inside the existing banned-list label `guaranteed authentic`). `roles unlocked` / `just unlocked` returned the 3 hits above, all now fixed.

---

## Server-side scan — deliberate skip

The Phase 53 architect recommendation was to extend the source-grep to learner-visible API response builders if obvious. Audited the 3 candidate route files:

| Route | Literal strings present | Decision |
|---|---|---|
| `cert-verify.ts` | Only `"Certificate not found"`, `"Failed to verify certificate"`, `"Atlas Projects"` (issuer), `"Atlas Learner"` (fallback display name) | NO scan target — structured error/identity strings, no claim language |
| `user-portfolio.ts` | Only `"Unauthorized"`, `"Failed to load portfolio"` | NO scan target |
| `public-profile.ts` | Only `"Invalid username"`, `"Profile not found"`, `"Failed to load public profile"` | NO scan target |

No server route returns learner-visible copy in a `message` / `description` / `title` field today. Re-evaluate if a future route adds such fields.

---

## Tests / gates

| Gate | Result | Delta |
|---|---|---|
| `pnpm run typecheck` (libs + 4 artifacts + check:no-heuristic-runtime) | OK | unchanged |
| `@workspace/atlas` vitest | **150 / 150** | **+14** (was 136 — added Phase 54 normalize / pattern / regression / Unicode / NFKC / Cf / boundary / negative / evasion suites) |
| `@workspace/api-server` vitest | unchanged 395 / 395 | — |
| `@workspace/execution-core` vitest | unchanged 83 / 83 | — |
| `@workspace/curriculum-quality` vitest | unchanged 93 / 93 | — |
| `audit:authoring` | unchanged 58 / 58 | — |
| `audit:pedagogy` | unchanged 58 / 58 | — |
| `check:no-heuristic-runtime` | OK | unchanged |
| Honest-claim ceiling | H3 preserved AND further tightened (4 tone fixes; guard upgraded; 6 new patterns; ZWJ/fullwidth/boundary defenses) | tighter |

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

## Remaining copy-safety gaps (non-blocking, Phase 55+ candidates)

1. **Forward-tense career phrasing tone pass.** "Roles you'll be ready for" / "Portfolio-ready for" / "READY FOR" badge remain on home, certificate-print, and JobOutcomesPanel. None cross H3 today (forward-tense, not present-claim). A consistent tone pass to "Roles this project prepares you for" / "Practiced for" would align with the Phase 53/54 wording but is a stylistic choice, not a safety fix.
2. **Server-side response-builder watch.** If a future API route starts returning learner-visible copy in a `message` / `description` / `summary` field, add that file to the source-grep guard. Today: no such field exists.
3. **i18n boundary.** Source-grep cannot catch translated strings or strings composed at runtime from i18n keys. Atlas has no i18n layer today; if introduced, the catalog files (`en.json`, etc.) become the new high-risk source and need their own scan.
4. **Marketing surfaces outside `src/pages/`.** This audit covered `src/pages/` + `src/components/studio/ValidationFeedbackPanel.tsx` + `api-server/src/lib/email.ts`. Any future landing pages, blog posts, or marketing campaigns rendered from MDX/CMS would need their own guard.
5. **Identifier-spelling caveat.** Word-boundary lookarounds use `\p{L}\p{N}` which excludes `_`. An identifier literally named `BANNED_TAMPER_PROOF` in a guarded file would trip the guard. No such identifiers exist in the 7 guarded files today; if added intentionally (e.g. an export name), it must be moved to a non-guarded module or the constant must use a different spelling.

---

## What unblocks Phase 55+ envelope work

Unchanged from Phase 52/53 close-outs — Phase 54 does not satisfy any operator-side prerequisite:

1. Operator runs `docs/phases/phase-52-canary-1pct-flip-kit.md` §§1–10.
2. 48h / 500-success hold confirmed at kit §10.
3. Operator records sign-off + recommendation (hold / rollback / 10% ramp evaluation).

Only then does the 10% ramp evaluation phase open.

---

## Commits

- `b0667ec` — phase-53: launch-readiness H3 audit (parent)
- _(this commit)_ — phase-54: copy-safety hardening — normalized banned-pattern guard (NFKC + Cf strip + Unicode word boundaries) + tone-alignment sweep
