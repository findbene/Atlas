# HANDOFF

**Latest shipped phase:** Phase 51 — Canary Operational Readiness (metrics endpoint + runbook §6-7; no production flip).
**Working tree:** clean after `phase-51: canary operational readiness — metrics endpoint + runbook`.
**Parent commit chain:** Phase 51 ← `5278fec` (phase-50 canary wrapper) ← `b119bc7` (phase-49b disclosure) ← `24055ed` (phase-49a runtime wiring) ← `54ef8fe` (phase-48 pilot grader) ← `844934e` (phase-47 envelope submit arm) ← `51df3ca` (phase-46 sign endpoint).

---

## Phase 51 summary

Closes the operational-readiness gap from Phase 50 without flipping production. Adds an admin-gated read-only metrics endpoint, hardens the runbook with an explicit pre-flight checklist + go/no-go gate, and documents the durable log queries. **No production env var changed; no grading/control-flow change.**

### What landed

| File | Role |
|---|---|
| `artifacts/api-server/src/lib/envelopeMetrics.ts` | NEW — in-process counter module (verify ok/failed-by-reason, fallback-by-reason, bounded 1000-sample reservoir for `verifyDurationMs` p50/p95/p99, snapshot deep-copy, open failure-reason bucketing). |
| `artifacts/api-server/src/lib/envelopeMetrics.test.ts` | NEW — 17 unit tests + 1 module banned-phrase guard. |
| `artifacts/api-server/src/routes/user.ts` | EDITED — three new counter calls at existing log sites. No control-flow change. |
| `artifacts/api-server/src/routes/admin.ts` | EDITED — added `GET /api/admin/envelope/metrics` (requireAdmin, lazy import). |
| `artifacts/api-server/src/routes/admin.envelope-metrics.test.ts` | NEW — 5 supertest cases (401/403/200 + counter reflection + no-PII assertion). |
| `docs/runbooks/envelope-canary.md` | EDITED — added §6 (metrics endpoint payload + caveats + curl/watch + log-aggregator queries) and §7 (pre-flight checklist + DO-NOT-flip list + literal flip command). H3 boundary renumbered to §8. |
| `docs/phases/phase-51-canary-operational-readiness.md` | NEW — phase close-out. |
| `docs/phases/INDEX.md` | EDITED — +1 entry. |
| `replit.md` | EDITED — Phase History rotated to 51/50/49. |

### Observability added

**Endpoint:** `GET /api/admin/envelope/metrics` (admin-gated). Process-local snapshot:

```
uptimeMs, windowMs
verify { ok, failed{<reason>: n}, total, successRate, durationMs{p50,p95,p99,samples} }
fallback { kind_not_enabled, canary_bucket_skip }
envelopesObserved, fallbackRate
```

**Properties:**
- No DB query, no nonce-table peek, no PII (no userId/projectId/stepId/nonce).
- Counters reset on API restart/deploy — multi-instance deploys see per-instance slices. Cross-deploy history belongs in the log aggregator.
- Failure-reason map is open: any unknown reason string gets its own bucket, surfacing dashboard drift.
- `durationMs` uses 1000-sample reservoir sampling; p95 bias < 1 ms.

**Log queries** for durable history documented in runbook §6 (verify success rate, failure-by-reason, p95, fallback split, bad-signature alarm, nonce-cron health).

### Smoke evidence status

The 6-scenario dev/staging smoke (runbook §2) is operator-runnable only — requires browser + Pyodide + Clerk session. Phase 51 hardens it into the §7 pre-flight gate: every smoke must produce log excerpts in the flip PR before any prod env var is touched.

### Cron / cleanup status

Janitor `pnpm --filter @workspace/scripts run cleanup:run-envelope-nonces` ships since Phase 46. Runbook §3 documents the cron entry; §7 makes "ran successfully at least once in production" a hard pre-flight gate.

### Gates (all green)

| Gate | Result |
|---|---|
| `pnpm run typecheck` (full workspace) | ✓ clean |
| `check:no-heuristic-runtime` | ✓ |
| `@workspace/api-server` tests | ✓ **395 / 395** (+22 from Phase 50: 17 envelopeMetrics + 5 admin route) |
| `@workspace/atlas` tests | ✓ **128 / 128** UNCHANGED (no FE touched) |
| `@workspace/execution-core` tests | ✓ **83 / 83** UNCHANGED |
| `@workspace/curriculum-quality` tests | ✓ **93 / 93** UNCHANGED |
| `audit:authoring` | ✓ **58 / 58** UNCHANGED |
| `audit:pedagogy` | ✓ **58 / 58** UNCHANGED |

### Hard stops respected

| Surface | Touched? |
|---|---|
| `/check` route | NO |
| `lib/grading.ts` | NO |
| `lib/envelopeGrade.ts` | NO |
| `lib/execution-core/runEnvelope.ts` | NO |
| `lib/envelopeSubmit.ts` decision tree | NO |
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

### Go / no-go for the first 1% production canary

**Recommendation: NO-GO until 6 operator-side prerequisites are satisfied** (full list in `docs/phases/phase-51-canary-operational-readiness.md` and runbook §7):

1. Staging smoke (§2) — all 6 scenarios passed, log excerpts captured in flip PR.
2. Production nonce-janitor cron registered + ran ≥1 success.
3. `GET /api/admin/envelope/metrics` returns 200 with expected pre-flip shape in production, asserted only after `envelopesObserved > 0`: `verify.total = 0`, `fallback.kind_not_enabled > 0` (normal Phase 49+ client traffic), `fallback.canary_bucket_skip = 0` (zero does NOT prove canary vars are unset — inspect env directly), `fallbackRate = 1.0`. See runbook §7.
4. Log-aggregator `evt:envelope.*` filter validated.
5. Architect review of Phase 50 + 51 PRs signed off.
6. On-call coverage confirmed for next 48h.

The code path is ready; the operational evidence isn't yet collected. Phase 51 deliberately does not unblock the flip — it gives the operator the tools to safely do so on their own schedule.

### Risks remaining after Phase 51

1. **Metrics are process-local + reset on deploy.** Operators must use the log aggregator for cross-deploy/historical data. Documented in §6 caveats.
2. **No alerting wired** on `envelope_bad_signature`. The metric is observable; auto-paging is operator-side. Runbook calls this out as a "stop the watch and rollback" trigger.
3. **Multi-instance percentile bias.** Hitting one instance gives that instance's reservoir; the aggregated view requires the log aggregator's `stats p95(verifyDurationMs)`.
4. **Cert / portfolio copy unchanged** (intentional — H3 ceiling preserved).

### Rollback summary (from runbook §5)

Unchanged from Phase 50:

- **Soft:** `ATLAS_ENVELOPE_CANARY_PERCENT=0` → all envelopes fall back with `reason: "canary_bucket_skip"`.
- **Hard:** `ATLAS_ENVELOPE_REQUIRED_KINDS=` → verify path unreachable.
- **Nuclear:** revert to Phase 49 commit `b119bc7`, OR strip `envelope` field at route entry.

### Commits

- `844934e` — phase-47: envelope submit arm
- `54ef8fe` — phase-48: pilot envelope grader
- `24055ed` — phase-49a: frontend runtime wiring + soft-fail server fallback
- `b119bc7` — phase-49b: how-atlas-grades disclosure page
- `5278fec` — phase-50: json_equal signed-envelope canary wrapper + runbook
- _(Phase 51, this commit)_ — phase-51: canary operational readiness — metrics endpoint + runbook §6-7
