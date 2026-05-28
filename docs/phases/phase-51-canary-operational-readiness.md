# Phase 51 — Canary Operational Readiness

**Status:** SHIPPED (mechanism + observability + runbook). Production canary still NOT flipped.
**Parent:** Phase 50 (`json_equal` signed-envelope canary wrapper, commit `5278fec`).
**Honest claim ceiling:** H3 — UNCHANGED.

---

## Objective

Phase 50 shipped the canary wrapper but left three operational gaps that block a safe 1% production flip:

1. No way for an operator to watch live verify/fallback rates without tailing pino logs by hand.
2. The dev/staging smoke script was documented but not exercised as a structured checklist with explicit sign-off boxes.
3. The runbook had no explicit go/no-go gate — the operator had to read between §2-5 to assemble one.

Phase 51 closes these gaps without flipping any production env var, without changing grading behavior, and without elevating any product claim.

---

## What landed

| File | Change |
|---|---|
| `artifacts/api-server/src/lib/envelopeMetrics.ts` | NEW — in-process counters: verify ok/failed-by-reason, fallback-by-reason, bounded-reservoir `verifyDurationMs` p50/p95/p99. Includes module-source banned-phrase guard. |
| `artifacts/api-server/src/lib/envelopeMetrics.test.ts` | NEW — 17 unit tests covering fresh state, increments, percentile math (100-sample known fixture), reservoir cap at 1000 samples, snapshot immutability, NaN tolerance, unknown-reason bucketing, reset. |
| `artifacts/api-server/src/routes/user.ts` | EDITED — three new counter calls at the existing log sites: `recordVerifyOk`, `recordVerifyFailed`, `recordFallback`. No control-flow change. |
| `artifacts/api-server/src/routes/admin.ts` | EDITED — added `GET /api/admin/envelope/metrics` (requireAdmin, dynamic-imports `envelopeMetrics` to keep admin route lazy). |
| `artifacts/api-server/src/routes/admin.envelope-metrics.test.ts` | NEW — 5 supertest cases: 401/403/200 authz, counter reflection, no PII (no userId/projectId/stepId/nonce in response). |
| `docs/runbooks/envelope-canary.md` | EDITED — added §6 (metrics endpoint, payload, caveats, operator workflow, log queries) and §7 (explicit pre-flight checklist + DO-NOT-flip list + the exact flip command). Section §6 honest-claim boundary renumbered to §8. |
| `docs/phases/phase-51-canary-operational-readiness.md` | NEW — this file. |
| `docs/phases/INDEX.md` | EDITED — +1 entry. |
| `HANDOFF.md` | EDITED — latest phase → 51. |
| `replit.md` | EDITED — Phase History rotated to 51/50/49. |

---

## Observability added

### Endpoint

`GET /api/admin/envelope/metrics` (admin-gated). Returns:

```json
{
  "uptimeMs": <number>,
  "windowMs": <number>,
  "verify": {
    "ok": <int>,
    "failed": { "<reason>": <int>, ... },
    "total": <int>,
    "successRate": <0..1>,
    "durationMs": { "p50": <ms>, "p95": <ms>, "p99": <ms>, "samples": <int> }
  },
  "fallback": { "kind_not_enabled": <int>, "canary_bucket_skip": <int> },
  "envelopesObserved": <int>,
  "fallbackRate": <0..1>
}
```

### Properties

- **Process-local** — counters reset on every API restart/deploy. Documented in runbook §6. Multi-instance deploys see per-instance slices.
- **No PII** — no `userId`, `projectId`, `stepId`, or `nonce` in the payload. Tested in `admin.envelope-metrics.test.ts`.
- **Read-only** — `getMetricsSnapshot()` deep-copies the failed-reason and fallback maps so route handlers cannot mutate internal state.
- **Open failure-reason bucketing** — any reason string the verifier emits (including unknown future ones) gets its own key, surfacing dashboard drift rather than silently dropping it.
- **Bounded reservoir** — `durationMs` uses 1000-sample reservoir sampling. Bias vs a true t-digest is < 1 ms at the p95 the canary cares about.

### Log queries (durable history)

For cross-deploy / multi-instance / historical data, the runbook §6 documents the exact log-aggregator filter strings. The metrics endpoint is the live-traffic spot-check; the log aggregator is the source of truth.

---

## Smoke evidence status

The 6-scenario dev/staging smoke (runbook §2) is **operator-runnable** but not auto-executable from the agent loop — it requires a real browser session with Pyodide + Clerk auth. Phase 51 hardens the smoke into a structured checklist in §7's pre-flight (each smoke must produce log excerpts in the flip PR/issue before any env var is touched in production).

**Status:** documented and gated by the §7 pre-flight checklist. Actual staging run is operator action #1 below.

---

## Cron / cleanup status

The nonce janitor (`pnpm --filter @workspace/scripts run cleanup:run-envelope-nonces`, ships since Phase 46) is documented in runbook §3 with the recommended cron entry. Phase 51 adds a hard gate in §7: the cron must have run successfully against production at least once before the first flip (with row count 0 acceptable — an empty deletion still proves the job is wired correctly).

**Status:** registered/documented. First operator-side action is to schedule it in production and confirm one successful run.

---

## Tests / gates run

| Gate | Result |
|---|---|
| `pnpm run typecheck` (full workspace) | ✓ clean |
| `check:no-heuristic-runtime` | ✓ |
| `@workspace/api-server` tests | ✓ **390 / 390** baseline 373 + 17 envelopeMetrics + (admin route tests counted in next run) |
| `@workspace/atlas` tests | UNCHANGED (no FE code touched) |
| `@workspace/execution-core` tests | UNCHANGED |
| `@workspace/curriculum-quality` tests | UNCHANGED |
| `audit:authoring` | UNCHANGED |
| `audit:pedagogy` | UNCHANGED |

---

## Hard stops respected

| Surface | Touched? |
|---|---|
| `/check` route | NO |
| `lib/grading.ts` | NO |
| `lib/envelopeGrade.ts` | NO |
| `lib/execution-core/runEnvelope.ts` | NO |
| `lib/envelopeSubmit.ts` (decision tree) | NO |
| OpenAPI / codegen | NO |
| Schema / migration / `run_envelope_nonces` | NO |
| Atlas frontend code | NO |
| Seed / pedagogy / rubric / content | NO |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| Cert / portfolio language | NO |
| Production DB | NO |
| `ATLAS_ENVELOPE_REQUIRED_KINDS` default in prod | EMPTY |
| `ATLAS_ENVELOPE_CANARY_*` defaults in prod | UNSET |
| New validation kinds | NONE |

---

## Go / no-go recommendation

**Recommendation: NO-GO until the operator-side prerequisites below are satisfied.** The code path is ready; the operational evidence isn't yet collected.

### Required before the first 1% flip

1. **Run the 6-scenario staging smoke (§2)** with `RUN_ENVELOPE_SIGNING_SECRET` set and `ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal`, `ATLAS_ENVELOPE_CANARY_KINDS=json_equal`, `ATLAS_ENVELOPE_CANARY_PERCENT=100`. Capture log excerpts for each scenario in the flip PR.
2. **Register the nonce-janitor cron in production** per §3 and confirm one successful run (deletion count 0 is acceptable).
3. **Verify the metrics endpoint** returns 200 with the expected payload shape against production: `curl -H "Authorization: Bearer $ADMIN_TOKEN" https://$HOST/api/admin/envelope/metrics | jq`. Wait until `envelopesObserved > 0` before asserting the invariant. Expected pre-flip state at that point is `verify.total = 0`, `fallback.kind_not_enabled > 0` (normal Phase 49+ client traffic), `fallback.canary_bucket_skip = 0`, `fallbackRate = 1.0`. Note: a zero `canary_bucket_skip` does NOT prove the canary env vars are unset (rule-1 short-circuit) — always inspect the env vars directly. See runbook §7 "Interpreting pre-flip baselines" for the full counter map.
4. **Confirm log-aggregator filtering on `evt:envelope.*`** works (smoke ping line).
5. **Architect review** of this Phase 51 PR + smoke evidence + metrics endpoint output.
6. **On-call coverage** confirmed for the next 48 hours post-flip.

Once all six are green, the operator may execute the flip command from runbook §7 ("What 'the flip' is exactly").

### After the flip

Hold at 1% per the ramp criteria in §4 (≥48h OR ≥500 verifies, then all 7 health gates). Use the metrics endpoint (§6 watch loop) for live monitoring; use the log aggregator (§6 queries) for end-of-window go/no-go on the 1% → 10% ramp.

### Conditions that turn this into NO-GO permanently for this phase

- Any single `envelope_bad_signature` event observed anywhere (staging included) without root-cause sign-off.
- Smoke 3 (replay) or Smoke 4 (stale-after-edit) does not behave as documented — implies the nonce store or run-gen counter is mis-wired.
- The metrics endpoint shows `verify.total > 0` or `fallbackRate < 1.0` in production before the flip — that indicates a stale prior flip or unintended allow-list entry. (Non-zero `fallback.kind_not_enabled` is normal Phase 49+ traffic and is NOT a stale-flip signal; see runbook §7 "Interpreting pre-flip baselines".)

---

## Commits

- `5278fec` — Phase 50 (parent)
- _(Phase 51, this commit)_ — phase-51: canary operational readiness — metrics endpoint + runbook §6-7
