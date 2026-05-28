# Runbook — Signed-envelope canary (json_equal)

**Owner:** Atlas platform
**Honest claim ceiling:** H3 only (see `docs/runtime-validation-threat-model.md`).
**Default behavior:** signed-envelope enforcement is OFF for every learner on every kind. This runbook describes the controls that turn it on incrementally.

---

## 1. The four control surfaces

| Env var | Purpose | Default | Safe values |
|---|---|---|---|
| `RUN_ENVELOPE_SIGNING_SECRET` | HMAC key the server uses to sign + verify envelopes. Boot-time hard-fail in deploys if unset. | unset (dev: warn + 503; prod: deploy fails) | `openssl rand -hex 32` |
| `ATLAS_ENVELOPE_REQUIRED_KINDS` | Comma-separated allow-list of `validationType` values that opt into envelope enforcement. | `""` (empty — pre-Phase-47 behavior for all kinds) | `json_equal` (Phase 50 starting point) |
| `ATLAS_ENVELOPE_CANARY_KINDS` | Comma-separated subset of the allow-list that should be bucketed instead of running at 100%. | `""` (unset — allow-list runs at 100% for listed kinds) | `json_equal` during ramp; clear once kind is at 100% |
| `ATLAS_ENVELOPE_CANARY_PERCENT` | Integer in `[0, 100]`. Out-of-range values clamp. Non-numeric → 0. | `""` (unset → no bucketing) | `1` → `10` → `50` → `100` |

The canary gate `isEnvelopeEnforcedFor(kind, userId)` (in `artifacts/api-server/src/lib/envelopeSubmit.ts`) evaluates these in a fixed order:

1. Kind not in `ATLAS_ENVELOPE_REQUIRED_KINDS` → **false** (legacy path).
2. Canary env vars absent → **true** (kind runs at 100%, pre-Phase-50 behavior).
3. Kind not in `ATLAS_ENVELOPE_CANARY_KINDS` → **true** (canary controls only the listed kinds).
4. Otherwise → `bucketForUserKind(userId, kind) < percent`.

**Operator note — empty strings vs unset.** The code treats `ATLAS_ENVELOPE_CANARY_KINDS=""` (empty string) and `ATLAS_ENVELOPE_CANARY_PERCENT=""` (empty string) the same as unset. Both fall through rule 2 and the kind runs at **100% enforcement**, not 0%. If your intent is "drain the canary to 0%", set `ATLAS_ENVELOPE_CANARY_PERCENT=0` explicitly while leaving `ATLAS_ENVELOPE_CANARY_KINDS=json_equal` populated. If your intent is "remove canary control entirely so the allow-list runs at 100%", unset both vars (or leave both empty). The soft-rollback procedure in §5 uses the explicit `=0` form for exactly this reason.

Bucket is `sha256(userId + ":" + kind)[0..2] % 100`, deterministic per (user, kind). A given user is consistently in or out of the canary for the life of their user record. Each kind has its own independent bucket — a user in the `json_equal` canary is not automatically in the `numeric_tolerance` canary when that kind ramps later.

---

## 2. Dev/staging manual smoke checklist

Run this before flipping ANY env var in production.

### Setup

```bash
# 1. Mint a signing secret (one-time per environment)
export RUN_ENVELOPE_SIGNING_SECRET=$(openssl rand -hex 32)

# 2. Enable json_equal envelope enforcement for all users (no canary yet)
export ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal

# 3. Boot the API server
pnpm --filter @workspace/api-server run dev
```

Boot should log **no** `assertRunEnvelopeSigningSecret` warning. If you see `RUN_ENVELOPE_SIGNING_SECRET unset`, fix step 1 before continuing.

### Pick a fixture step

Any visible `json_equal` Python step in the catalog. (`audit:authoring` reports 174 such steps as of Phase 49.) Pick one you can solve in <2 minutes.

### Smoke 1 — happy path (pass)

1. Open the step in the workspace.
2. Write code that produces the expected JSON output.
3. Click Run. Wait for Pyodide to finish.
4. Click Submit.

**Expected:**
- HTTP 200 from `/submit` with `passed: true`.
- API server logs `evt: "envelope.verify.ok"` with `verifyDurationMs` < 50 ms typical.
- One row added to `run_envelope_nonces`:
  ```sql
  SELECT count(*) FROM run_envelope_nonces;  -- +1
  SELECT nonce, expires_at FROM run_envelope_nonces ORDER BY created_at DESC LIMIT 1;
  ```
- Browser network tab shows the `POST /submit` body has an `envelope` field with `binding.userId == your user id`.

### Smoke 2 — happy path (fail)

1. Reset the step.
2. Write code that produces a wrong JSON value.
3. Run → Submit.

**Expected:**
- HTTP 200 from `/submit` with `passed: false`, feedback like `Output didn't match. Expected …, got ….`
- API server logs `evt: "envelope.verify.ok"` (the envelope is still authentic — only the comparator decides the grade).
- One additional `run_envelope_nonces` row (the verify still succeeded; nonce is consumed regardless of grading outcome).

### Smoke 3 — replay rejection

1. Disable the FE temporarily (open DevTools, set network throttling to offline).
2. Re-fire the last `/submit` request from DevTools "Resend" (or copy as curl). The request body still contains the same envelope.

**Expected:**
- HTTP 400 from `/submit` with `{ "error": "envelope_replay" }`.
- API server logs `evt: "envelope.verify.failed"` with `reason: "envelope_replay"`.
- `run_envelope_nonces` row count unchanged from Smoke 2.

### Smoke 4 — stale-after-edit

1. Run the step (mints envelope A in browser state).
2. Edit the code in the editor (do NOT re-run).
3. Click Submit.

**Expected (Phase 49 client behavior):**
- Browser console logs `evt: "envelope.sign.skipped"` (the run-gen counter bumped on edit, so the stashed envelope was cleared).
- `/submit` is sent WITHOUT an `envelope` field.
- API server falls through to legacy grading (no `envelope.verify.*` log line for this request).

### Smoke 5 — non-allow-listed kind fallback

1. Open a `numeric_tolerance` or `csv_set_equal` step.
2. Run → Submit.

**Expected:**
- The FE will still attempt to sign and stash an envelope (eligible kinds: `json_equal`, `numeric_tolerance`, `sql_resultset`, `csv_set_equal`, `csv_ordered`).
- API server logs `evt: "envelope.submit.kind_not_enabled.fallback"` with `reason: "kind_not_enabled"`.
- HTTP 200 from `/submit` with the legacy grading result (whatever the bare-string grader returns for that kind today). NO `envelope_*` error.
- `run_envelope_nonces` row count unchanged.

### Smoke 6 — canary bucket skip

1. Set `ATLAS_ENVELOPE_CANARY_KINDS=json_equal` and `ATLAS_ENVELOPE_CANARY_PERCENT=0`. Restart the API server.
2. Open a `json_equal` step. Run → Submit.

**Expected:**
- API server logs `evt: "envelope.submit.kind_not_enabled.fallback"` with `reason: "canary_bucket_skip"` (note the different reason vs Smoke 5).
- HTTP 200 with legacy grading result. NO `envelope_*` error.

3. Set `ATLAS_ENVELOPE_CANARY_PERCENT=100`. Restart. Re-run the smoke.

**Expected:** behaves like Smoke 1 (verify path runs).

### Sign-off

All 6 smoke results match. Confirm:
- [ ] No HTTP 5xx in the API logs during any smoke.
- [ ] No `envelope_signing_unavailable` errors.
- [ ] No banned-phrase copy in any new UI surface.
- [ ] Browser console contains no warnings/errors beyond the expected `envelope.sign.skipped` debug lines.

---

## 3. Production nonce-janitor cron

The janitor is idempotent and safe to run nightly. The 10-minute envelope TTL keeps the working set tiny.

```bash
# As a cron job in the production environment:
0 3 * * *  cd /app && pnpm --filter @workspace/scripts run cleanup:run-envelope-nonces
```

Successful run logs:

```
[cleanup-run-envelope-nonces] deleted N expired nonce(s) in Mms
```

Register the cron BEFORE flipping `ATLAS_ENVELOPE_REQUIRED_KINDS` in production. While the allow-list is empty no rows are written, but the cron is the only mechanism that prevents the table from growing once a kind goes live.

Manual one-off invocation (e.g. after a long outage):

```bash
DATABASE_URL=<prod-url> pnpm --filter @workspace/scripts run cleanup:run-envelope-nonces
```

---

## 4. Canary ramp procedure (json_equal)

### Pre-flight checklist (all must be true)

- [ ] Section 2 smoke completed in staging, sign-off in PR/issue.
- [ ] Section 3 cron registered + ran at least once in production with row count = 0.
- [ ] `RUN_ENVELOPE_SIGNING_SECRET` set in production (deploy will fail otherwise).
- [ ] Production logs ingestion can filter on `evt: "envelope.*"` (verify with a `logger.info({evt: "envelope.smoketest"})` test ping if needed).
- [ ] Architect review of Phase 50 PR signed off.

### Step 1 — enable 1% canary

```
ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal
ATLAS_ENVELOPE_CANARY_KINDS=json_equal
ATLAS_ENVELOPE_CANARY_PERCENT=1
```

Roll the API deployment. Watch for ~30 minutes of normal traffic.

### Metrics to monitor

| Metric | Source | Healthy band |
|---|---|---|
| Verify success rate | `evt: "envelope.verify.ok"` / (`.ok` + `.failed`) | ≥ 99% |
| Verify failure by reason | `evt: "envelope.verify.failed"` group by `reason` | `envelope_replay` should be near 0; `envelope_expired` should be near 0; any `envelope_bad_signature` is a red flag |
| `verifyDurationMs` p95 | `evt: "envelope.verify.*"` field | < 100 ms |
| `/submit` p95 latency | existing route metrics | not worse than pre-canary baseline by more than 50 ms |
| Fallback rate (canary-skip) | `evt: "envelope.submit.kind_not_enabled.fallback"` with `reason: "canary_bucket_skip"` | should be ~99% of `json_equal` submits at 1% canary |
| Fallback rate (kind-not-enabled) | same evt with `reason: "kind_not_enabled"` | should be 100% of submits for non-`json_equal` kinds; 0 for `json_equal` once allow-list includes it |
| Support tickets mentioning "submit fails" / "wrong grade" | learner support inbox | no spike above baseline |
| Nonce table row count | `SELECT count(*) FROM run_envelope_nonces;` | strictly increases during the day, drops to ~0 within 10 min of last submit + after janitor run |

### Ramp criteria — 1% → 10%

Hold at 1% for at least **48 hours** of real traffic OR **500 successful `envelope.verify.ok` events**, whichever is later. Then ALL of the following must be true:

- [ ] Verify success rate ≥ 99% over the canary window.
- [ ] No `envelope_bad_signature` events (any single one stops the ramp pending root cause).
- [ ] `verifyDurationMs` p95 < 100 ms.
- [ ] `/submit` p95 latency not regressed by >50 ms versus pre-canary baseline.
- [ ] Zero unresolved learner support tickets attributed to envelope path.
- [ ] Nonce janitor has run successfully at least once with deletion count > 0.
- [ ] Architect spot-check sign-off on the canary metrics dashboard.

If all green: bump `ATLAS_ENVELOPE_CANARY_PERCENT=10`. Roll.

### Subsequent ramps

| Step | Hold time | Required signal |
|---|---|---|
| 10% → 50% | 5 days OR 5k verifies | Same checklist as 1% → 10% |
| 50% → 100% (still canary) | 7 days OR 25k verifies | Same checklist, plus architect review |
| Remove canary | After 100% holds for 7 days | Unset `ATLAS_ENVELOPE_CANARY_KINDS` + `ATLAS_ENVELOPE_CANARY_PERCENT`. Allow-list-only enforcement (rule 2) takes over. |

DO NOT skip steps. DO NOT ramp on weekends. DO NOT ramp during a deploy of any other system.

---

## 5. Rollback

The canary is designed for one-line rollback.

### Soft rollback (drain canary, keep kind allow-listed)

```
ATLAS_ENVELOPE_CANARY_PERCENT=0
```

Roll the API. Effect: every `json_equal` envelope falls back to legacy grading with `reason: "canary_bucket_skip"`. No FE change needed. Nonce table stops growing within 10 min (TTL). Verify with grep for `envelope.verify.ok` going to zero.

Use this when verify-failure rate spikes but the kind is otherwise fine.

### Hard rollback (disable kind entirely)

```
ATLAS_ENVELOPE_REQUIRED_KINDS=
```

Roll the API. Effect: behaves as Phase 46 — the verify path is unreachable. FE will still try to sign (it has no awareness of the server's allow-list), but every `/submit` falls through with `reason: "kind_not_enabled"`. No nonce inserts, no crypto.

Use this if `envelope_bad_signature` events appear (signature implementation bug) or signing secret was rotated incorrectly.

### Nuclear rollback (revert envelope branch entirely)

The `/submit` envelope branch is gated by the presence of a top-level `envelope` field in the request body. If you need to disable it even for clients that send an envelope:

1. Revert the deploy to the last commit before Phase 47 (`6818cc5`).
2. OR temporarily strip the `envelope` field server-side at the route entry (add `delete req.body.envelope;` above the branch).

Then root-cause and re-deploy.

### Rotation

Rotating `RUN_ENVELOPE_SIGNING_SECRET` invalidates every outstanding envelope. Old envelopes in flight will return `envelope_bad_signature`. Always rotate during a low-traffic window, and follow with the soft rollback if learner reports spike.

Future: the verifier library already supports a `kid` field (Phase 45) for graceful rotation — wire two secrets in tandem during Phase 51 if rotation cadence becomes a real concern.

---

## 6. Read-only canary metrics endpoint (Phase 51)

`GET /api/admin/envelope/metrics` (auth: `requireAdmin`) returns a process-local snapshot of the canary counters. No DB query, no nonce-table peek, no per-user data — safe to poll at 5-15s cadence during a flip.

### Payload shape

```json
{
  "uptimeMs":     1234567,
  "windowMs":    1234567,
  "verify": {
    "ok": 312,
    "failed": { "envelope_replay": 1, "envelope_expired": 0 },
    "total": 313,
    "successRate": 0.9968,
    "durationMs": { "p50": 14, "p95": 42, "p99": 73, "samples": 313 }
  },
  "fallback": { "kind_not_enabled": 8421, "canary_bucket_skip": 31075 },
  "envelopesObserved": 39809,
  "fallbackRate": 0.9921
}
```

### Important caveats

- **Process-local.** Counters reset on every API restart/deploy. For multi-instance deploys, each instance reports only its own slice — divide your expectations accordingly, or hit each instance separately. Cross-instance historical metrics belong in the durable log aggregator, not here.
- **Reservoir-sampled percentiles.** `durationMs` is computed over a bounded 1000-sample reservoir. Bias vs a true t-digest is < 1 ms in practice — adequate for the < 100 ms p95 gate but not for sub-ms latency budgets.
- **Failure-reason map is open.** Any reason string the verifier emits gets its own bucket key, including unknown future strings. Dashboard drift surfaces here rather than being silently dropped.

### Operator workflow during a flip

```bash
# Quick health check (any admin token):
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://$HOST/api/admin/envelope/metrics | jq

# Watch loop during ramp:
watch -n 10 'curl -s -H "Authorization: Bearer $ADMIN_TOKEN" https://$HOST/api/admin/envelope/metrics | jq "{ok: .verify.ok, failed: .verify.failed, p95: .verify.durationMs.p95, fallbackRate: .fallbackRate}"'
```

If `verify.failed.envelope_bad_signature > 0` at any point, **stop the watch and execute soft rollback (§5) immediately.** That counter is the canary's single most important red-flag signal.

### Log-aggregator queries (durable history)

For windows longer than the current process uptime, query the log aggregator:

| What you want | Query (logfmt-ish; adapt to your tool) |
|---|---|
| Verify success rate over last 24h | `evt:envelope.verify.* | stats count by evt` then `ok / (ok+failed)` |
| Verify failures by reason | `evt:envelope.verify.failed | stats count by reason` |
| Verify duration p95 | `evt:envelope.verify.ok | stats p95(verifyDurationMs)` |
| Fallback split | `evt:envelope.submit.kind_not_enabled.fallback | stats count by reason` |
| Bad-signature alarm (zero-tolerance) | `evt:envelope.verify.failed AND reason:envelope_bad_signature` → page on any non-zero rate |
| Nonce-cron health | `[cleanup-run-envelope-nonces] deleted` last 25h → must be non-empty |

---

## 7. Go / no-go for the first 1% production canary

The flip is authorized only when **every** statement below is true. Tick each box; do NOT flip on a yellow.

### Pre-flight (verified before touching prod env vars)

- [ ] All 6 staging smokes (§2) passed and log excerpts captured in the flip PR/issue.
- [ ] `RUN_ENVELOPE_SIGNING_SECRET` set in production (validate by checking deploy doesn't fail at boot).
- [ ] `ATLAS_ENVELOPE_REQUIRED_KINDS` currently **empty** in production (the flip is what changes it).
- [ ] `ATLAS_ENVELOPE_CANARY_KINDS` and `ATLAS_ENVELOPE_CANARY_PERCENT` currently **unset** in production.
- [ ] Nonce-janitor cron (§3) registered in production and ran successfully at least once (output line `[cleanup-run-envelope-nonces] deleted 0 expired nonce(s)` is expected and counts as success).
- [ ] Log-aggregator filters for `evt:envelope.*` confirmed working (a `logger.info({evt:"envelope.smoketest"})` ping shows up).
- [ ] `GET /api/admin/envelope/metrics` returns **200 with the expected payload shape** in production (admin token validated). The endpoint MUST be reachable, but counters are NOT expected to be zero — see "Interpreting pre-flip baselines" below.
- [ ] Architect review of Phase 50 + Phase 51 signed off.
- [ ] Rollback commands (§5) pasted into a scratch buffer and the operator confirms they can execute them in < 60 seconds.
- [ ] Flip is happening Mon-Thu, business hours, and no other deploy is in flight.

### Do NOT flip if any of the following

- A staging smoke failed or was skipped.
- The nonce cron has never run successfully against production.
- `envelope_bad_signature` has appeared in any environment in the last 7 days without root-cause sign-off.
- Customer support has any open ticket mentioning grading/submit issues.
- The on-call rotation has no human owner for the next 48 hours.
- **`verify.total > 0` in the production metrics endpoint before the flip.** This DOES indicate a stale prior flip and must be investigated. (Non-zero `fallback.*` counters are normal — see below.)

### Interpreting pre-flip baselines

Because Phase 49 clients send a signed envelope on every eligible-kind submit regardless of server-side enforcement, the production metrics endpoint will report **non-zero values even before any canary flip**. This is expected and is NOT a stale-flip signal. Specifically:

| Counter | Pre-flip expected value | What non-zero means |
|---|---|---|
| `verify.ok` | **0** | Stale prior flip OR allow-list accidentally contains `json_equal`. **STOP and investigate.** |
| `verify.failed.*` | **0** | Same as above. **STOP and investigate.** |
| `verify.total` | **0** | Same — must be zero. |
| `verify.durationMs.samples` | **0** | Same — must be zero. |
| `fallback.kind_not_enabled` | **non-zero, growing** | Normal — every envelope-bearing `/submit` for a kind that is NOT allow-listed lands here. With Phase 49+ FE, this matches every successful `/runs/sign`-then-`/submit` round-trip on eligible kinds. |
| `fallback.canary_bucket_skip` | **0** | Stale canary config — `ATLAS_ENVELOPE_CANARY_KINDS` and `ATLAS_ENVELOPE_CANARY_PERCENT` should both be unset pre-flip. **STOP and investigate.** Note: a zero here does NOT prove the canary vars are unset — when `ATLAS_ENVELOPE_REQUIRED_KINDS` is empty, the canary gate's rule-1 short-circuits before the bucket check, so a misconfigured canary var would still report zero here. Always inspect the env vars directly as the authoritative check. |
| `envelopesObserved` | **non-zero, growing** | Equals `fallback.kind_not_enabled` pre-flip. |
| `fallbackRate` | **exactly `1.0` once `envelopesObserved > 0`** | Every observed envelope falls back when `ATLAS_ENVELOPE_REQUIRED_KINDS` is empty (`fallbackTotal / (0 + fallbackTotal) === 1`). Anything `< 1.0` AFTER `envelopesObserved > 0` means some kind is already enforced. **STOP and investigate.** On a freshly-deployed instance with `envelopesObserved = 0`, this reports `0`, not `1.0` — wait for traffic before asserting the invariant. |

Counters are **process-local** — each API instance reports its own slice and resets on every restart/deploy. A freshly-deployed instance may briefly show all zeros before traffic warms up; wait at least one normal-traffic minute (and confirm `envelopesObserved > 0`) before drawing pre-flight conclusions.

### What "the flip" is exactly

```bash
# In prod env (one operator, recorded in PR):
ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal
ATLAS_ENVELOPE_CANARY_KINDS=json_equal
ATLAS_ENVELOPE_CANARY_PERCENT=1
```

Roll the API deploy. Start the watch loop from §6. Hold per §4 ramp criteria.

---

## 8. Honest-claim boundary (DO NOT CROSS)

Even at 100% enforcement on every pilot kind, the only claim Atlas can make is:

> Atlas verified that the runtime output submitted for this step matched the expected result. The signature confirms the record came from your session and was not modified in flight.

The signed-envelope path does **not** prove the learner wrote the code (H1), does **not** prove the learner did not use outside help (H2 / A2), and does **not** prevent forge-then-sign (A5). Certificate copy, portfolio language, and admin reports must continue to say "evidence-backed completion record" — never "verified authorship", "cheat-proof", "tamper-proof", or "100% verified". The `/how-atlas-grades` page banned-phrase guard (Phase 49) enforces this on the disclosure page; the same restraint applies to internal comms.
