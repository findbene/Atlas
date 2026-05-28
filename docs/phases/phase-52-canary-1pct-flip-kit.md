# Phase 52 — First 1% Production Canary Flip (Operator Kit)

**Status:** **KIT PREPARED — FLIP NOT EXECUTED BY AGENT.**
**Type:** Operator-execution phase (no agent code changes).
**Parent:** Phase 51 (canary operational readiness, commit `27e70c6`).
**Honest claim ceiling:** H3 — UNCHANGED.

---

## How to use this document

This is a single linear runbook. **Read top to bottom. Fill in every `OPERATOR FILLS:` block as you go.** Do not skip ahead. Every section ends with a sign-off line that the operator dates + initials before moving on.

If any check fails, **STOP** at that check and refer to the matching rollback section. Do not "fix it later" — the canary's value is in the small blast radius of stopping early.

The flip is authorized only when **every** sign-off line in §§ 1-4 is completed. The flip itself is § 5. Post-flip work is §§ 6-8.

**Time budget (typical):** ~3 hours of operator attention split across ~52 hours of wall-clock (smoke + cron setup + flip + 48-hour hold).

---

## 0. Pre-requisites at a glance

| # | What | Where it lives | Sign-off |
|---|---|---|---|
| 1 | Staging smoke (6 scenarios) | § 1 of this doc | operator initials + date |
| 2 | Production nonce-janitor cron registered + ran ≥1 success | § 2 | operator initials + date |
| 3 | Production metrics endpoint returns expected pre-flip shape | § 3 | operator initials + date |
| 4 | Log-aggregator `evt:envelope.*` filter validated | § 4 | operator initials + date |
| 5 | On-call coverage confirmed for 48h | § 5 pre-flight | operator initials + date |
| 6 | Architect / operator sign-off on Phase 50 + 51 PRs | § 5 pre-flight | reviewer name + date |

When all 6 are signed off, execute § 5 (the flip), then hold per §§ 6-8.

---

## 1. Staging smoke evidence

Run these against a non-production environment with:

```bash
export RUN_ENVELOPE_SIGNING_SECRET=$(openssl rand -hex 32)
export ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal
export ATLAS_ENVELOPE_CANARY_KINDS=json_equal
export ATLAS_ENVELOPE_CANARY_PERCENT=100   # staging only — forces 100% for smoke
pnpm --filter @workspace/api-server run dev
```

Boot should log **no** `assertRunEnvelopeSigningSecret` warning. If you see `RUN_ENVELOPE_SIGNING_SECRET unset`, fix the export before continuing.

Pick a fixture step: any visible `json_equal` Python step in the catalog (`audit:authoring` reports 174 such steps as of Phase 49) that you can solve in < 2 minutes.

For each scenario, paste the relevant log line(s) and the HTTP status code observed.

### Smoke 1 — happy path (pass)

**Steps:** 1) Open the step. 2) Write code that produces the expected JSON output. 3) Click Run, wait for Pyodide. 4) Click Submit.

**Expected:** HTTP 200 `passed:true`; API log `evt:"envelope.verify.ok"` with `verifyDurationMs` < 50 ms typical; +1 row in `run_envelope_nonces`; `POST /submit` body has `envelope.binding.userId == your user id`.

```
OPERATOR FILLS:
  Date / time (UTC):
  Step slug used:
  HTTP status:
  Log line (evt:envelope.verify.ok):
  Nonce table row count before / after:
  PASS / FAIL:
```

### Smoke 2 — happy path (fail)

**Steps:** 1) Reset the step. 2) Write code that produces a wrong JSON value. 3) Run → Submit.

**Expected:** HTTP 200 `passed:false`, feedback like `Output didn't match. Expected …, got ….`; API log `evt:"envelope.verify.ok"` (verify succeeds; only the comparator decides the grade); +1 nonce row (verify still consumed it).

```
OPERATOR FILLS:
  Date / time (UTC):
  HTTP status:
  passed value:
  Log line (evt:envelope.verify.ok):
  PASS / FAIL:
```

### Smoke 3 — replay rejection

**Steps:** 1) DevTools → Network → set offline. 2) "Resend" / copy-as-curl the previous `/submit` request (body still contains the same envelope) and re-fire it online.

**Expected:** HTTP 400 `{"error":"envelope_replay"}`; API log `evt:"envelope.verify.failed" reason:"envelope_replay"`; `run_envelope_nonces` row count unchanged from Smoke 2.

```
OPERATOR FILLS:
  Date / time (UTC):
  HTTP status:
  Error body:
  Log line (evt:envelope.verify.failed):
  PASS / FAIL:
```

### Smoke 4 — stale-after-edit

**Steps:** 1) Run the step (mints envelope A in browser state). 2) Edit the code in the editor — do NOT re-run. 3) Click Submit.

**Expected:** Browser console logs `evt:"envelope.sign.skipped"` (the run-gen counter bumped on edit, so the stashed envelope was cleared); `/submit` is sent WITHOUT an `envelope` field; API server falls through to legacy grading with NO `envelope.verify.*` log line for this request.

```
OPERATOR FILLS:
  Date / time (UTC):
  Browser console line:
  Server log for this request:
  PASS / FAIL:
```

### Smoke 5 — non-`json_equal` kind fallback

**Steps:** 1) Open a `numeric_tolerance` or `csv_set_equal` step. 2) Run → Submit. (The FE will still try to sign for any eligible kind: `json_equal`, `numeric_tolerance`, `sql_resultset`, `csv_set_equal`, `csv_ordered`.)

**Expected:** API log `evt:"envelope.submit.kind_not_enabled.fallback" reason:"kind_not_enabled"`; HTTP 200 with legacy grading result; NO `envelope_*` error; `run_envelope_nonces` row count unchanged.

```
OPERATOR FILLS:
  Date / time (UTC):
  Kind tested:
  Server log line:
  PASS / FAIL:
```

### Smoke 6 — canary bucket skip

**Steps:** 1) Set `ATLAS_ENVELOPE_CANARY_KINDS=json_equal` and `ATLAS_ENVELOPE_CANARY_PERCENT=0`, restart API. 2) Open a `json_equal` step. Run → Submit. 3) Then set `ATLAS_ENVELOPE_CANARY_PERCENT=100`, restart, and re-run the same step.

**Expected:** Step 2 logs `evt:"envelope.submit.kind_not_enabled.fallback" reason:"canary_bucket_skip"` (note different `reason` vs Smoke 5) and returns HTTP 200 with legacy grading; Step 3 behaves like Smoke 1 (verify path runs).

```
OPERATOR FILLS:
  Date / time (UTC):
  Server log line:
  PASS / FAIL:
```

### Section 1 sign-off

```
All 6 smokes PASS:   [ ] yes  [ ] no
No HTTP 5xx during any smoke:   [ ] yes
No envelope_signing_unavailable errors:   [ ] yes
No banned-phrase copy in any UI surface:   [ ] yes
Browser console clean beyond expected envelope.sign.skipped lines:   [ ] yes

Operator initials:                       Date (UTC):
```

If any `no`: **STOP**. Do not proceed to § 2.

---

## 2. Production nonce-janitor cron

Janitor script: `pnpm --filter @workspace/scripts run cleanup:run-envelope-nonces`. Ships since Phase 46. Idempotent. Output: `[cleanup-run-envelope-nonces] deleted N expired nonce(s) in Mms`.

### Step 2a — Register the cron

Cron entry (UTC):

```cron
0 3 * * *  cd /app && pnpm --filter @workspace/scripts run cleanup:run-envelope-nonces
```

Adapt to your scheduler (Replit Scheduled Deployments, Kubernetes CronJob, Vercel Cron, etc.). Document the exact registration mechanism here:

```
OPERATOR FILLS:
  Scheduler used (e.g. Replit Scheduled Deployment):
  Registration timestamp (UTC):
  Schedule expression:
  Identifier / URL of the registered job:
```

### Step 2b — Confirm one successful run against production

Manually trigger the job (or wait for the first scheduled run) and capture the output line.

```
OPERATOR FILLS:
  Trigger method (manual / scheduled):
  Run timestamp (UTC):
  Output line (must contain "[cleanup-run-envelope-nonces] deleted"):
  Deletion count (0 is acceptable — proves the wiring works):
  Exit code:
```

### Section 2 sign-off

```
Cron registered:   [ ] yes
First successful run captured:   [ ] yes
No errors in the run output:   [ ] yes

Operator initials:                       Date (UTC):
```

If any `no`: **STOP**. Do not proceed to § 3.

---

## 3. Production metrics endpoint pre-flip check

The endpoint is `GET /api/admin/envelope/metrics`, gated by `requireAdmin`. Process-local counters. Phase 49+ clients already send signed envelopes on every eligible-kind submit, so non-zero `fallback.*` counters are **expected** pre-flip.

### Step 3a — Endpoint reachable + admin-gated

```bash
# Anonymous → 401
curl -i https://$HOST/api/admin/envelope/metrics

# Admin → 200
curl -i -H "Authorization: Bearer $ADMIN_TOKEN" https://$HOST/api/admin/envelope/metrics
```

```
OPERATOR FILLS:
  Date / time (UTC):
  Anonymous HTTP status (expect 401):
  Admin HTTP status (expect 200):
  Payload body (paste full JSON):
```

### Step 3b — Wait for real traffic + assert pre-flip shape

The endpoint is process-local. On a fresh deploy all counters read 0. **Wait at least one normal-traffic minute** and confirm `envelopesObserved > 0` before asserting the invariant below — otherwise you can't distinguish "no traffic yet" from "all counters zero because flip already happened in error".

```
OPERATOR FILLS:
  Date / time of re-check (UTC):
  envelopesObserved:
  verify.total:                  (MUST be 0 — non-zero = stale prior flip → STOP)
  verify.ok:                     (MUST be 0)
  verify.failed:                 (MUST be {})
  verify.durationMs.samples:     (MUST be 0)
  fallback.kind_not_enabled:     (expected > 0 — Phase 49+ client traffic)
  fallback.canary_bucket_skip:   (MUST be 0 → if non-zero, stale canary config → STOP)
  fallbackRate:                  (MUST be exactly 1.0 once envelopesObserved > 0)
```

### Step 3c — Inspect production env vars directly (authoritative check)

A zero `canary_bucket_skip` does NOT prove the canary vars are unset — when `ATLAS_ENVELOPE_REQUIRED_KINDS` is empty, the decision tree's rule-1 short-circuits before the bucket check. Inspect the vars directly:

```
OPERATOR FILLS:
  RUN_ENVELOPE_SIGNING_SECRET present?    [ ] yes  [ ] no   (must be yes)
  ATLAS_ENVELOPE_REQUIRED_KINDS value:                       (must be empty / unset)
  ATLAS_ENVELOPE_CANARY_KINDS value:                         (must be empty / unset)
  ATLAS_ENVELOPE_CANARY_PERCENT value:                       (must be empty / unset)
```

### Section 3 sign-off

```
Endpoint reachable + correctly gated:   [ ] yes
Pre-flip counter invariants hold:        [ ] yes
Env-var inspection matches expected:     [ ] yes
No PII observed in response:             [ ] yes  (no userId / projectId / stepId / nonce)

Operator initials:                       Date (UTC):
```

If any `no`: **STOP**. Do not proceed to § 4.

---

## 4. Log-aggregator filter validation

Validate that `evt:envelope.*` events are reaching your log aggregator and you can drill down by `reason`, `verifyDurationMs`, etc. Without this, post-flip monitoring is blind.

Emit a smoke ping from a dev shell against production (admin endpoint already logs a structured event on each hit — easiest way to generate a known `evt:`):

```bash
# Each call logs evt:"admin.envelope.metrics.served"
for i in 1 2 3; do
  curl -s -H "Authorization: Bearer $ADMIN_TOKEN" https://$HOST/api/admin/envelope/metrics > /dev/null
done
```

Then query the aggregator:

| Query | Expected pre-flip result |
|---|---|
| `evt:admin.envelope.metrics.served` | 3 hits matching the ping |
| `evt:envelope.submit.kind_not_enabled.fallback` | non-zero hits from real traffic |
| `evt:envelope.verify.ok` | 0 hits (kind not enforced) |
| `evt:envelope.verify.failed` | 0 hits |
| `[cleanup-run-envelope-nonces] deleted` | ≥ 1 hit in last 25h (matches § 2b) |

```
OPERATOR FILLS:
  Date / time (UTC):
  Aggregator name (e.g. Datadog, Grafana Cloud, BetterStack):
  evt:admin.envelope.metrics.served — hits in last 5 min:   (expect 3)
  evt:envelope.submit.kind_not_enabled.fallback — hits in last 1h:   (expect > 0)
  evt:envelope.verify.ok — hits in last 24h:                          (expect 0)
  evt:envelope.verify.failed — hits in last 24h:                       (expect 0)
  Janitor log line found:   [ ] yes  [ ] no
```

### Section 4 sign-off

```
All five queries return expected counts:   [ ] yes
Can filter by `reason` field:               [ ] yes
`verifyDurationMs` is a structured numeric field on `evt:envelope.verify.*` log lines (verified by inspecting a staging-smoke log line from §1 Smoke 1, since prod `verify.*` events are 0 pre-flip):   [ ] yes
   (This proves the field will be extractable when production verify events start arriving post-flip — re-confirm in §6 +30 min using the first real prod events.)
Alert configured on `evt:envelope.verify.failed AND reason:envelope_bad_signature`:   [ ] yes
   (Even a single such event must page on-call.)

Operator initials:                       Date (UTC):
```

If any `no`: **STOP**. Do not proceed to § 5.

---

## 5. The flip

### 5a — Final pre-flight (re-confirm)

```
OPERATOR FILLS (the exact instant before the flip — re-tick):
  Sections 1-4 all signed off above:    [ ] yes
  On-call rotation has a named human for the next 48h:   __________
  Rollback owner identified and reachable:               __________
  Architect / operator reviewer name + date:             __________
  Day of week (must be Mon-Thu, business hours):         __________
  No other deploy in flight on the API service:          [ ] yes
  Current API deploy SHA (record for nuclear rollback):  __________
  Rollback commands pasted into a scratch buffer:        [ ] yes
```

If any `no`: **STOP**. This is the last chance to back out cheaply.

### 5b — Execute

Set, in this exact order, in the production environment of the API service:

```
ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal
ATLAS_ENVELOPE_CANARY_KINDS=json_equal
ATLAS_ENVELOPE_CANARY_PERCENT=1
```

Confirm `RUN_ENVELOPE_SIGNING_SECRET` is unchanged from § 3c (its rotation invalidates outstanding envelopes — do NOT rotate as part of the flip).

Roll the API deploy. Wait for the new pods/instances to pass health checks.

```
OPERATOR FILLS:
  Env-var change applied at (UTC):         __________
  Deploy rolled at (UTC):                  __________
  All API instances reporting healthy at (UTC):   __________
  FLIP TIMESTAMP (UTC, exact instant traffic first hit new config):   __________
```

### 5c — Immediate post-deploy smoke (within 5 min of healthy)

Run one quick admin-endpoint probe + one log-aggregator probe:

```
OPERATOR FILLS:
  /api/admin/envelope/metrics HTTP status:    (expect 200)
  envelopesObserved:                          (expect > 0 within ~60s)
  verify.total:                                (expect > 0 within ~5 min if any 1%-bucket user submits)
  verify.failed:                               (expect {} or near-empty)
  fallback.canary_bucket_skip:                 (expect > 0 — bulk of bucket)
  fallback.kind_not_enabled:                   (expect 0 NEW growth for json_equal — older counters carry over)
  Any envelope_bad_signature in last 5 min?    [ ] no  ← if YES, HARD rollback NOW (see § 8 — bad-signature is a signature-correctness failure and always escalates to hard, never soft)
```

---

## 6. First-hour monitoring

Two data sources, used for different things:

- **Admin endpoint** (`GET /api/admin/envelope/metrics`) — **immediate liveness only**. Process-local, per-instance, resets on every restart/deploy. Good for the first 10 minutes when the log aggregator hasn't yet ingested enough events. Treat the numbers as one instance's view, not the fleet.
- **Log aggregator** — **source of truth for all band decisions**. Use it for the +30 min and +60 min rows, and for any go/no-go reasoning. If the endpoint and the aggregator disagree, **trust the aggregator**.

Immediate-liveness watch loop (endpoint, +0 to +10 min):

```bash
watch -n 10 'curl -s -H "Authorization: Bearer $ADMIN_TOKEN" https://$HOST/api/admin/envelope/metrics | jq "{ok: .verify.ok, failed: .verify.failed, p95: .verify.durationMs.p95, fallbackRate: .fallbackRate, envelopesObserved: .envelopesObserved}"'
```

Aggregator queries (use for +30 / +60 min and beyond — adapt to your aggregator's syntax):

```text
verify success rate    = count(evt:envelope.verify.ok) / count(evt:envelope.verify.*)
verify failure reasons = count(evt:envelope.verify.failed) group by reason
verifyDurationMs p95   = stats p95(verifyDurationMs) on evt:envelope.verify.*
```

Capture metrics at the three checkpoints — note which source each row came from:

| Time | Source | verify.ok | verify.failed | p95 (ms) | fallback.canary_bucket_skip | envelopesObserved | Notes |
|---|---|---|---|---|---|---|---|
| +10 min | endpoint (liveness) | | | | | | |
| +30 min | **aggregator** | | | | | | |
| +60 min | **aggregator** | | | | | | |

### Health bands (must hold throughout the first hour)

- [ ] Verify success rate ≥ 99% (computed as `verify.ok / verify.total` once `verify.total ≥ 20`).
- [ ] `verify.durationMs.p95` < 100 ms.
- [ ] Zero `envelope_bad_signature` events.
- [ ] `envelope_replay` count consistent with manual replay smokes only (typically 0 in normal user traffic).
- [ ] `/submit` p95 latency not regressed by > 50 ms vs pre-flip baseline (compare to log-aggregator history).
- [ ] No spike in learner support tickets mentioning "submit", "wrong grade", or "stuck".
- [ ] Admin metrics endpoint stays reachable (no 5xx from `/api/admin/envelope/metrics`).
- [ ] `run_envelope_nonces` row count is growing under traffic (verify path is writing nonces). Note: nonces are NOT auto-drained by TTL — the janitor (registered in § 2) is the only thing that deletes them. Do not treat lack of decline as a failure; the test for janitor health is "scheduled run output line was logged in the last 25 h", which is covered by the cron alert in § 4 and the Day-1 / Day-2 checkpoints in § 7.

```
OPERATOR FILLS:
  Hour-1 sign-off (UTC):     __________
  All eight bands held:      [ ] yes  [ ] no
  Operator initials:         __________
```

If any band fails: see § 8 (rollback triggers + commands).

---

## 7. 48-hour hold criteria

Hold at 1% for at least **48 hours of real traffic OR 500 successful `envelope.verify.ok` events**, whichever comes later. During the hold, take a daily checkpoint:

### Day 1 checkpoint (24h post-flip)

| Metric | Source | Value | Band |
|---|---|---|---|
| Verify success rate | **log aggregator** (source of truth for cross-instance views) | | ≥ 99% |
| `envelope.verify.ok` cumulative count | log aggregator | | trending toward ≥ 500 by 48h |
| Worst verify failure reason | log aggregator | | not `envelope_bad_signature` |
| `verifyDurationMs` p95 | log aggregator stats (NOT the admin endpoint — the endpoint reservoir is per-instance and resets on every deploy/restart) | | < 100 ms |
| `/submit` p95 vs pre-flip baseline | log aggregator | | delta < 50 ms |
| Nonce-janitor ran successfully overnight | scheduler logs | | yes |
| Learner support tickets attributable to envelope path | support inbox | | 0 |
| `envelope_bad_signature` count | log aggregator | | exactly 0 |

**Observability note:** `GET /api/admin/envelope/metrics` is **process-local** — multi-instance deployments show only one instance's slice, and counters reset on every restart/deploy. Use the endpoint as a spot-check during the flip and for the §5c +5min smoke. For cross-instance / multi-hour aggregates (everything in this checkpoint table and the +30/+60 min monitoring in § 6), the log aggregator is the source of truth.

```
OPERATOR FILLS:
  24h checkpoint timestamp (UTC):  __________
  All bands held:                  [ ] yes  [ ] no
  Operator initials:               __________
```

### Day 2 checkpoint (48h post-flip)

Same table as Day 1. The 48h checkpoint is when the operator decides whether to **hold longer at 1%** or **proceed to the 10% ramp** (10% ramp is OUT OF SCOPE for Phase 52 — that is the next phase's decision).

```
OPERATOR FILLS:
  48h checkpoint timestamp (UTC):  __________
  All bands held:                  [ ] yes  [ ] no
  Cumulative envelope.verify.ok:   __________  (≥ 500?)
  Operator initials:               __________

Decision for Phase 53 (operator's call, NOT this kit's):
  [ ] HOLD at 1% for another window — concerns noted: __________
  [ ] PROCEED to evaluate 10% ramp under a fresh phase
  [ ] ROLLBACK and root-cause before any further work
```

---

## 8. Rollback triggers + commands

### Immediate-rollback triggers (no debate, execute now)

- Any `envelope_bad_signature` event.
- Verify failure rate spike beyond ~1% sustained over 5 min (excluding manual replay tests).
- `verifyDurationMs` p95 > 100 ms sustained over 5 min.
- `/submit` p95 regression > 50 ms sustained over 5 min.
- `envelope_replay` failures beyond expected manual replay tests.
- Spike in learner-facing confusion or support tickets attributable to envelope path.
- Admin metrics endpoint unavailable (any 5xx from `/api/admin/envelope/metrics`).
- Nonce-janitor failure on scheduled run.
- Any banned-phrase copy accidentally introduced anywhere user-facing (H1/H2 claim drift).

### Soft rollback (preferred — drain canary, keep kind allow-listed)

```
ATLAS_ENVELOPE_CANARY_PERCENT=0
```

Roll the API. Effect: every `json_equal` envelope falls back to legacy grading with `reason:"canary_bucket_skip"`. No FE change, no nonce churn beyond TTL.

Use this when the failure mode is bounded (latency, transient verify failure) and you want to keep the kind allow-listed for a quick recovery.

### Hard rollback (disable kind entirely)

```
ATLAS_ENVELOPE_REQUIRED_KINDS=
```

Roll the API. Effect: verify path unreachable. All envelopes fall back with `reason:"kind_not_enabled"`.

Use this when the failure mode involves crypto/signature correctness (`envelope_bad_signature`) or a signing-secret incident.

### Nuclear rollback (last resort — soft + hard did not take effect)

**Important:** environment variables persist across deploys in most platforms. A deploy revert alone does NOT neutralize the flip — the new (old) binary will still read `ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal` from the environment. **You must first** apply the hard rollback (`ATLAS_ENVELOPE_REQUIRED_KINDS=`) AND `ATLAS_ENVELOPE_CANARY_KINDS=` AND `ATLAS_ENVELOPE_CANARY_PERCENT=`, THEN revert the deploy to the SHA recorded in § 5a's "Current API deploy SHA" field.

If even the env-var change isn't propagating (control-plane outage, etc.), the last-resort code-side neutralizer is: add `delete req.body.envelope;` above the branch in `artifacts/api-server/src/routes/user.ts` and emergency-deploy. That makes every request look like a non-envelope submit and forces the legacy path.

Use this section only if the soft + hard rollbacks somehow did not take effect (env-var propagation failure, signing-secret rotation incident, etc.).

### Rollback evidence

```
OPERATOR FILLS (only if rollback was executed):
  Rollback type:     [ ] soft  [ ] hard  [ ] nuclear
  Trigger observed:                                  __________
  Rollback applied at (UTC):                         __________
  First metrics observation post-rollback:           __________
  Soft rollback: fallback.canary_bucket_skip rising? [ ] yes
  Hard rollback: fallback.kind_not_enabled rising?   [ ] yes
  Operator initials:                                 __________
  Root-cause issue / PR opened:                      __________
```

---

## 9. Honest-claim boundary (DO NOT CROSS)

Even at successful 1% canary hold, Atlas's claim ceiling is unchanged:

> Atlas verified that the runtime output submitted for this step matched the expected result. The signature confirms the record came from your session and was not modified in flight.

The signed-envelope path does **not** prove the learner wrote the code (H1), does **not** prove the learner did not use outside help (H2 / A2), and does **not** prevent forge-then-sign (A5). Certificate copy, portfolio language, internal comms, and any post-Phase-52 announcement must continue to say "evidence-backed completion record" — never "verified authorship", "cheat-proof", "tamper-proof", "100% verified", or any equivalent.

If you catch yourself or another team member describing the canary in stronger language while writing release notes / changelogs / marketing copy, **stop and re-read this section**. The Phase 49 `/how-atlas-grades` banned-phrase guard enforces this on the user-facing disclosure page; the same discipline applies to every other surface.

---

## 10. Final operator sign-off

Once §§ 5-7 are complete and the 48h checkpoint shows all bands holding, sign off:

```
Phase 52 outcome:
  [ ] 1% canary flipped successfully and held for ≥ 48h with all health bands green.
  [ ] 1% canary flipped but rolled back at:  __________  (root cause:  __________ )
  [ ] Flip never executed — blocked at section __________ on:  __________

Cumulative envelope.verify.ok at sign-off:   __________
Cumulative envelope_bad_signature count:     __________ (MUST be 0 for clean sign-off)
Operator name:                                __________
Date (UTC):                                   __________
Architect / reviewer name + sign-off date:    __________

Recommendation for Phase 53 (10% evaluation):
  [ ] GREEN — proceed to evaluate 10% ramp criteria
  [ ] YELLOW — hold at 1% longer; reasons:  __________
  [ ] RED — do not ramp; remediation required:  __________
```

---

## Agent-side delivery summary

This document is the Phase 52 deliverable. **No production env var was changed by the agent. No deploy was rolled by the agent. No real production traffic has been observed by the agent.** Every "OPERATOR FILLS" block above is intentionally blank — those are operator-execution artifacts.

The code path required for the flip has been in place since Phase 50 (canary wrapper) and Phase 51 (observability). Phase 52 added zero source-code lines. The only artifacts changed are this document and the meta files (`HANDOFF.md`, `replit.md`, `docs/phases/INDEX.md`).

### Files changed in this phase

| File | Change |
|---|---|
| `docs/phases/phase-52-canary-1pct-flip-kit.md` | NEW — this kit |
| `docs/phases/INDEX.md` | EDITED — +1 entry |
| `HANDOFF.md` | EDITED — latest phase → 52 (kit prepared, flip not executed) |
| `replit.md` | EDITED — Phase History rotated to 52/51/50 |

### Gates

| Gate | Result |
|---|---|
| `pnpm run typecheck` | not re-run (no code changes; last green at Phase 51) |
| All test suites | unchanged from Phase 51 (api-server 395/395) |
| `audit:authoring` / `audit:pedagogy` | unchanged |
| Honest-claim ceiling | H3 preserved |

### Hard stops respected

No code changes, no broad `json_equal` flip, no ramp beyond 1%, no new validation kinds, no `/check` change, no cert/portfolio language change, no anti-cheat overclaim, no production DB mutation by the agent, rollback documented before the flip in § 8. Production env vars remain unchanged by the agent.

### Commits

- `27e70c6` — Phase 51 (parent)
- _(Phase 52, this commit)_ — phase-52: 1% canary flip operator kit (no code changes)
