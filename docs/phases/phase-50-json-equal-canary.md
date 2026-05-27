# Phase 50 — `json_equal` Signed-Envelope Canary Wrapper

**Parent phase**: 49 (Frontend RunCapture Wiring + Disclosure)
**Design spec**: `docs/signed-run-result-design.md`, `docs/runbooks/envelope-canary.md`
**Honest claim ceiling**: H3 (UNCHANGED)

---

## Goal

Make it possible to enable signed-envelope enforcement for `json_equal` on a small slice of real learners without flipping the whole catalog. Default behavior is unchanged: with no Phase 50 env vars set, every learner on every kind takes the legacy bare-string grading path exactly as in Phase 49.

This phase ships **only the mechanism**. It does NOT flip any kind in production. The first 1% canary is operator-driven via env var.

## What shipped

### `artifacts/api-server/src/lib/envelopeSubmit.ts` (edited)

Three new pure exports layered on top of the Phase 47 `parseEnvelopeAllowList` primitive:

- `parseCanaryPercent(raw)` — parses `ATLAS_ENVELOPE_CANARY_PERCENT` to an integer in `[0, 100]`. Non-numeric → 0. Negative → 0. >100 → 100. `parseInt` semantics for decimals (truncates — safer than accepting `1.9` and silently bucketing 1.9%).
- `bucketForUserKind(userId, kind)` — deterministic 0..99 bucket. `sha256(userId + ":" + kind)[0..2]` (big-endian uint16) `% 100`. No per-process salt, so a user lands in the same bucket regardless of which API node serves the request. Per-kind keying — a user in the `json_equal` canary is not automatically in the `numeric_tolerance` canary when that kind ramps later.
- `isEnvelopeEnforcedFor(kind, userId, env?)` — the actual decision tree:
  1. Kind not in `ATLAS_ENVELOPE_REQUIRED_KINDS` → **false** (legacy path; Phase 47 invariant preserved).
  2. Canary env vars absent → **true** (kind runs at 100%; pre-Phase-50 behavior).
  3. Kind not in `ATLAS_ENVELOPE_CANARY_KINDS` → **true** (canary only controls listed kinds; other allow-listed kinds run at 100%).
  4. Otherwise → `bucketForUserKind(userId, kind) < parsedPercent`.

Default behavior with no env vars set: rule 1 → false for every kind → no envelope enforcement anywhere. Identical to Phase 49.

### `artifacts/api-server/src/lib/envelopeSubmit.test.ts` (new, 26 tests)

- `parseEnvelopeAllowList` baseline (4 tests) — empty/single/multi/dedupe.
- `parseCanaryPercent` (5 tests) — defaults, clamp negative, clamp >100, in-range, decimal truncate.
- `bucketForUserKind` (4 tests) — output range, determinism across calls, per-kind independence (cross-kind agreement <5%), spread across 100 buckets within ±60 of expected 100 on 10k samples.
- `isEnvelopeEnforcedFor` (12 tests) — every rule of the decision tree, including: rule 1 holds even when canary fully configured; partial canary config (percent only) does not silently bucket; 0% canary excludes everyone; 100% canary includes everyone; 1% canary lands 0–30 of 1000 users; 10% canary lands 40–160; stable membership across calls; negative/oversize clamping.
- Banned-phrase guard (1 test) — `envelopeSubmit.ts` source contains none of: `tamper-proof`, `cheat-proof`, `verified authorship`, `proves you wrote`, `anti-cheat`, `100% verified`, …. Defense-in-depth so any future drift in module copy is caught at the lowest layer.

### `artifacts/api-server/src/routes/user.ts` (edited)

Replaced the Phase 49 `allowList.has(kind)` check with a single call to `isEnvelopeEnforcedFor(kind, user.id)`. The fallback log now distinguishes:

- `reason: "kind_not_enabled"` — kind not allow-listed (Phase 49 behavior).
- `reason: "canary_bucket_skip"` — kind allow-listed but user not in canary bucket (new Phase 50 outcome).

Both still log under `evt: "envelope.submit.kind_not_enabled.fallback"` so existing log-pipeline filters keep working — the `reason` field is the new dimension.

Added `verifyDurationMs` to both `envelope.verify.ok` and `envelope.verify.failed` log lines for canary observability. Computed as `Date.now()` delta around the `verifyEnvelopeForSubmit` call (covers both crypto and the nonce INSERT round-trip).

### `docs/runbooks/envelope-canary.md` (new)

The operator surface. Six sections:

1. The four control surfaces (env var table + decision tree).
2. Dev/staging manual smoke checklist — 6 scenarios (pass, fail, replay, stale-after-edit, kind-not-enabled fallback, canary-bucket-skip).
3. Production nonce-janitor cron registration.
4. Canary ramp procedure for `json_equal` with explicit metrics table and hold-time gates (48 h or 500 verifies @ 1%, 5 days or 5k @ 10%, 7 days or 25k @ 50%, 7 days @ 100% before removing canary entirely).
5. Three rollback modes — soft (drain canary), hard (disable kind), nuclear (revert deploy / strip envelope at route entry).
6. Honest-claim boundary restated verbatim.

## What did NOT change (hard stops)

| Surface | Touched? |
|---|---|
| `lib/execution-core/runEnvelope.ts` | NO |
| `routes/runs-sign.ts` | NO |
| `lib/grading.ts` | NO |
| `lib/envelopeGrade.ts` | NO |
| `/check` route | NO |
| Schema / migration / `run_envelope_nonces` | NO |
| OpenAPI / codegen | NO |
| Atlas frontend code | NO |
| Seed / content / pedagogy / rubric | NO |
| Billing / Stripe / cert / portfolio language | NO |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| `ATLAS_ENVELOPE_REQUIRED_KINDS` default | EMPTY in production |
| `ATLAS_ENVELOPE_CANARY_KINDS` default | UNSET in production |
| `ATLAS_ENVELOPE_CANARY_PERCENT` default | UNSET in production |
| Production DB | NO mutation |
| `audit:authoring` / `audit:pedagogy` | UNCHANGED |

## Gates (all green, post-change)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | ✓ clean |
| `check:no-heuristic-runtime` | ✓ |
| `@workspace/api-server` tests | ✓ baseline 347 + 26 new envelopeSubmit tests = **373 / 373** |
| `@workspace/atlas` tests | ✓ **128 / 128** UNCHANGED |
| `@workspace/execution-core` tests | ✓ **83 / 83** UNCHANGED |
| `@workspace/curriculum-quality` tests | ✓ **93 / 93** UNCHANGED |
| `audit:authoring` | ✓ **58 / 58** publish-ready (advisories 174 + 3 UNCHANGED) |
| `audit:pedagogy` | ✓ **58 / 58** UNCHANGED |

## Pre-existing tests that still hold the line

- `routes/user-submit-envelope.test.ts` (E1) and `routes/user-submit-envelope-pilot.test.ts` (P1) — both opt into `ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal` via `vi.stubEnv` per-describe. No canary env vars are set in these tests, so `isEnvelopeEnforcedFor` evaluates rule 2 → true → behavior identical to Phase 49. Tests pass unchanged.

## Trust model (unchanged)

H3 only. Even at 100% enforcement, the signed-envelope path does not prove independent authorship (H1), does not prove the absence of outside help (H2 / A2), and does not prevent forge-then-sign (A5). The runbook restates this in section 6.

## Risks remaining after Phase 50

1. **No live end-to-end smoke yet** against real production traffic — only dev/staging scenarios in the runbook. The 1% flip itself is the first real coverage.
2. **`/how-atlas-grades` disclosure only linked from home footer.** Workspace, onboarding, certificate pages still don't link it. Add-on for Phase 51+.
3. **Nonce janitor cron is documented but not yet registered in production.** Section 3 of the runbook is the registration procedure; must run at least once before any canary flip.
4. **Verifier-failure dashboards.** The log events are emitted (`envelope.verify.ok/.failed`, `envelope.submit.kind_not_enabled.fallback` with `reason`), but no dashboard panels exist yet. Build before the 1% flip so the ramp gates in section 4 are actually measurable.
5. **No `numeric_tolerance` / `sql_resultset` / `csv_*` pilot kinds yet.** `envelopeGrade.ts` (Phase 48) only implements `json_equal`. Phase 51+ extends the grader; canary wrapper is already kind-aware.
6. **Cert / portfolio language unchanged** (intentional — H3 ceiling preserved).

## Phase 51 candidate (next)

After `json_equal` reaches 100% + canary is removed: extend `envelopeGrade.ts` with `numeric_tolerance`, then repeat the ramp via the same canary wrapper. The wrapper is kind-keyed precisely so each kind's ramp is independent.

## Commit

`phase-50: json_equal signed-envelope canary wrapper + runbook`
