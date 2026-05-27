# HANDOFF

**Latest shipped phase:** Phase 50 — `json_equal` Signed-Envelope Canary Wrapper (no production flip; mechanism only).
**Working tree:** clean after `phase-50: json_equal signed-envelope canary wrapper + runbook`.
**Parent commit chain:** Phase 50 ← `b119bc7` (phase-49b disclosure) ← `24055ed` (phase-49a runtime wiring) ← `54ef8fe` (phase-48 pilot grader) ← `844934e` (phase-47 envelope submit arm) ← `51df3ca` (phase-46 sign endpoint).

---

## Phase 50 summary

Adds the control-plane mechanism for opting a small slice of real learners into signed-envelope enforcement on `json_equal`, plus the operator runbook. **No kind has been flipped in production.** The new env vars all default to unset, so live behavior is byte-identical to Phase 49.

### What landed

| File | Role |
|---|---|
| `artifacts/api-server/src/lib/envelopeSubmit.ts` (edited) | New pure exports: `parseCanaryPercent`, `bucketForUserKind`, `isEnvelopeEnforcedFor`. |
| `artifacts/api-server/src/lib/envelopeSubmit.test.ts` (new) | 26 unit tests + 1 module banned-phrase guard. |
| `artifacts/api-server/src/routes/user.ts` (edited) | Replaced `allowList.has(kind)` with `isEnvelopeEnforcedFor(kind, user.id)`. Fallback log gains `reason: "kind_not_enabled" \| "canary_bucket_skip"`. Verify path gains `verifyDurationMs`. |
| `docs/runbooks/envelope-canary.md` (new) | 4 control surfaces + 6-scenario dev/staging smoke + nonce-cron registration + ramp gates + 3-mode rollback + H3 boundary. |
| `docs/phases/phase-50-json-equal-canary.md` (new) | Phase close-out. |
| `docs/phases/INDEX.md` (edited) | +1 entry. |
| `replit.md` (edited) | Latest-3 rotated to 50/49/48. |

### The four control surfaces

| Env var | Default | First operator flip (1% canary) |
|---|---|---|
| `RUN_ENVELOPE_SIGNING_SECRET` | unset (prod boot fails) | `openssl rand -hex 32` |
| `ATLAS_ENVELOPE_REQUIRED_KINDS` | `""` (empty) | `json_equal` |
| `ATLAS_ENVELOPE_CANARY_KINDS` | unset | `json_equal` |
| `ATLAS_ENVELOPE_CANARY_PERCENT` | unset | `1` |

Decision tree (in `isEnvelopeEnforcedFor`):

1. Kind not allow-listed → **false** (legacy path; Phase 47 invariant preserved).
2. Canary env absent → **true** (allow-list runs at 100%; pre-Phase-50 behavior).
3. Kind not in canary-kinds → **true** (canary only controls listed kinds).
4. Otherwise → `bucketForUserKind(userId, kind) < parsedPercent`.

Bucket: `sha256(userId + ":" + kind)[0..2] uint16 % 100`. Deterministic per (user, kind). No per-process salt — stable across API instances + restarts. Per-kind keying so each kind ramps independently.

### Observability added

- `evt: "envelope.verify.ok"` — now includes `verifyDurationMs` (covers crypto + nonce INSERT).
- `evt: "envelope.verify.failed"` — same `verifyDurationMs` field + existing `reason` (from verifier).
- `evt: "envelope.submit.kind_not_enabled.fallback"` — now includes `reason: "kind_not_enabled" | "canary_bucket_skip"` discriminator so dashboards can split bucket-skip rate (expected ~99% at 1% canary) from genuine kind-not-enabled traffic.

### Honest claim ceiling (H3 — UNCHANGED)

Even at 100% enforcement on every pilot kind, the only claim Atlas can make is:

> Atlas verified that the runtime output submitted for this step matched the expected result. The signature confirms the record came from your session and was not modified in flight.

Signed-envelope does NOT prove independent authorship (H1), does NOT prove the absence of outside help (H2 / A2), does NOT prevent forge-then-sign (A5). The runbook restates this in section 6. `envelopeSubmit.ts` source-level banned-phrase guard (new in Phase 50) catches any future copy drift inside the canary control plane itself.

### Gates (all green)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | ✓ clean |
| `check:no-heuristic-runtime` | ✓ |
| `@workspace/api-server` tests | ✓ **373 / 373** (+26 envelopeSubmit unit tests) |
| `@workspace/atlas` tests | ✓ **128 / 128** UNCHANGED |
| `@workspace/execution-core` tests | ✓ **83 / 83** UNCHANGED |
| `@workspace/curriculum-quality` tests | ✓ **93 / 93** UNCHANGED |
| `audit:authoring` | ✓ **58 / 58** publish-ready (advisories 174 + 3 UNCHANGED) |
| `audit:pedagogy` | ✓ **58 / 58** UNCHANGED |

### Hard stops respected

| Surface | Touched? |
|---|---|
| `lib/grading.ts` | NO |
| `lib/execution-core/runEnvelope.ts` | NO (Phase 45 library frozen) |
| `lib/envelopeGrade.ts` | NO (Phase 48 grader unchanged) |
| `/check` route | NO |
| `routes/runs-sign.ts` | NO |
| Schema / migration / `run_envelope_nonces` | NO |
| OpenAPI / codegen | NO |
| Atlas frontend code | NO |
| Seed / content / pedagogy / rubric | NO |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| Billing / Stripe / cert / portfolio language | NO |
| Production DB | NO |
| `ATLAS_ENVELOPE_REQUIRED_KINDS` default in prod | EMPTY |
| `ATLAS_ENVELOPE_CANARY_*` defaults in prod | UNSET |

### Risks remaining after Phase 50

1. **No live production traffic on the verify path yet.** Section 2 of the runbook is dev/staging only; the 1% flip is the first real production coverage.
2. **Nonce janitor cron documented but not yet registered in production** — section 3 of the runbook. Must run at least once with zero rows before the first canary flip.
3. **Dashboards.** Log events emit cleanly; no dashboard panels exist yet. Build before the 1% flip so the ramp gates in section 4 are measurable.
4. **`/how-atlas-grades` only linked from home footer.** Workspace, onboarding, certificate pages still don't link it.
5. **Cert / portfolio language unchanged** (intentional — H3 ceiling preserved).
6. **Only one pilot kind implemented in `envelopeGrade.ts`** (`json_equal`). `numeric_tolerance` / SQL / CSV pilot kinds are Phase 51+. Canary wrapper is already kind-aware.

### Recommended next steps (operator-driven, NOT another phase)

1. **Build dashboard panels** for `evt: "envelope.verify.*"` success rate, `verifyDurationMs` p95, `/submit` p95 baseline vs canary, `reason: "canary_bucket_skip"` vs `"kind_not_enabled"` split, nonce-table row count.
2. **Register the nightly nonce janitor cron** in production per runbook §3. Verify it runs successfully against an empty table.
3. **Run dev/staging smoke** per runbook §2 (all 6 scenarios). Capture log excerpts in the smoke PR.
4. **Architect review** of Phase 50 PR + smoke evidence + dashboard screenshots BEFORE setting `ATLAS_ENVELOPE_REQUIRED_KINDS=json_equal` in production.
5. **Flip 1% canary** per runbook §4. Hold ≥48h or 500 verifies.
6. **Ramp 1% → 10% → 50% → 100%** per runbook §4 gates. Architect review at each step.
7. **Once 100% holds for 7 days**, unset `ATLAS_ENVELOPE_CANARY_*` (rule 2 takes over). `json_equal` is then permanently enforced via allow-list alone.

### Rollback summary (from runbook §5)

- **Soft:** `ATLAS_ENVELOPE_CANARY_PERCENT=0`. Drain canary, keep kind allow-listed. No FE change.
- **Hard:** `ATLAS_ENVELOPE_REQUIRED_KINDS=`. Disable kind. Verify path unreachable.
- **Nuclear:** Revert deploy to `b119bc7` (Phase 49) or strip `envelope` field at route entry.

### Commits

- `844934e` — phase-47: envelope submit arm
- `54ef8fe` — phase-48: pilot envelope grader
- `24055ed` — phase-49a: frontend runtime wiring + soft-fail server fallback
- `b119bc7` — phase-49b: how-atlas-grades disclosure page
- _(Phase 50, this commit)_ — phase-50: json_equal signed-envelope canary wrapper + runbook
