# HANDOFF

**Latest shipped phase:** Phase 52 — First 1% Production Canary Flip (Operator Kit). **KIT PREPARED — FLIP NOT EXECUTED BY AGENT.**
**Working tree:** clean after `phase-52: 1% canary flip operator kit (no code changes)`.
**Parent commit chain:** Phase 52 ← `27e70c6` (phase-51 ops readiness) ← `5278fec` (phase-50 canary wrapper) ← `b119bc7` (phase-49b disclosure) ← `24055ed` (phase-49a runtime wiring) ← `54ef8fe` (phase-48 pilot grader) ← `844934e` (phase-47 envelope submit arm) ← `51df3ca` (phase-46 sign endpoint).

---

## Phase 52 summary

Phase 52 is an **operator-execution phase**, not a feature phase. The agent cannot:

- Set production environment variables.
- Roll a production deploy.
- Run a real browser + Pyodide + Clerk smoke session.
- Register a production cron.
- Observe real production traffic.

So the agent's deliverable is a single self-contained operator runbook — `docs/phases/phase-52-canary-1pct-flip-kit.md` — that turns every Phase 51 prerequisite, the flip itself, and the 48-hour 1% hold into a linear fill-in-the-blank script. **Zero source code lines changed in this phase.**

### What landed

| File | Role |
|---|---|
| `docs/phases/phase-52-canary-1pct-flip-kit.md` | NEW — the operator flip kit (sections 0-10). |
| `docs/phases/INDEX.md` | EDITED — +1 entry. |
| `HANDOFF.md` | EDITED — latest phase → 52. |
| `replit.md` | EDITED — Phase History rotated to 52/51/50. |

### The flip kit structure

| § | Title | Operator output |
|---|---|---|
| 0 | Pre-requisites at a glance | 6-row checklist |
| 1 | Staging smoke evidence | 6 scenarios × HTTP status + log line + PASS/FAIL |
| 2 | Production nonce-janitor cron | registration entry + first successful-run output line |
| 3 | Production metrics endpoint pre-flip check | curl outputs at fresh + after envelopesObserved > 0 + env-var direct inspection |
| 4 | Log-aggregator filter validation | 5 query results + alert configuration |
| 5 | The flip | re-confirm + exact env-var commands + deploy SHA + flip timestamp + 5-min smoke |
| 6 | First-hour monitoring | watch loop output at +10/+30/+60 min + 8 health bands |
| 7 | 48-hour hold criteria | 24h and 48h checkpoint tables |
| 8 | Rollback triggers + commands | immediate-trigger list + soft/hard/nuclear procedures + rollback evidence template |
| 9 | Honest-claim boundary | H3 restated for release notes / marketing copy |
| 10 | Final operator sign-off | outcome + cumulative metrics + reviewer + Phase 53 recommendation |

### Gates

| Gate | Result |
|---|---|
| `pnpm run typecheck` | not re-run (no code changes; last green at Phase 51) |
| `@workspace/api-server` tests | unchanged at **395 / 395** |
| `@workspace/atlas` tests | unchanged at 128 / 128 |
| `@workspace/execution-core` tests | unchanged at 83 / 83 |
| `@workspace/curriculum-quality` tests | unchanged at 93 / 93 |
| `audit:authoring` | unchanged at 58 / 58 |
| `audit:pedagogy` | unchanged at 58 / 58 |
| Honest-claim ceiling | H3 preserved (kit § 9) |

### Hard stops respected

| Surface | Touched? |
|---|---|
| Source code (any file) | NO |
| `/check` route | NO |
| `lib/grading.ts` / `lib/envelopeGrade.ts` / `lib/execution-core` | NO |
| OpenAPI / codegen | NO |
| Schema / migration | NO |
| Atlas frontend | NO |
| Seed / pedagogy / rubric / content | NO |
| Cert / portfolio / marketing language | NO |
| Production DB | NO |
| Production env vars (`ATLAS_ENVELOPE_*`, `RUN_ENVELOPE_SIGNING_SECRET`) | NO (agent cannot; operator action in kit § 5) |
| New validation kinds | NONE |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| Ramp beyond 1% | NO (out of scope; decision deferred to Phase 53) |
| Rollback documented before flip | YES — kit § 8 |

### Risks remaining after Phase 52

1. **The flip has not happened.** The agent prepared the kit; the operator runs it. Until § 5 of the kit is executed in production, the entire Phase 47-52 stack is dormant on real user traffic.
2. **No automated alert on `envelope_bad_signature`** is wired by the agent. Kit § 4 makes "alert configured on `evt:envelope.verify.failed AND reason:envelope_bad_signature`" a hard pre-flight box; the operator must configure it in their aggregator.
3. **Multi-instance percentile aggregation is operator-side.** Kit § 7 directs the operator to use the log aggregator's `stats p95` rather than the per-instance metrics endpoint for cross-instance views.
4. **Phase 53 (10% ramp evaluation) deliberately out of scope.** A separate phase opens only after the operator signs off on the 48h 1% hold per kit § 10.

### Rollback (unchanged from Phase 50/51, restated in kit § 8)

- **Soft:** `ATLAS_ENVELOPE_CANARY_PERCENT=0` → all `json_equal` envelopes fall back with `reason:"canary_bucket_skip"`.
- **Hard:** `ATLAS_ENVELOPE_REQUIRED_KINDS=` → verify path unreachable, all envelopes fall back with `reason:"kind_not_enabled"`.
- **Nuclear:** revert to the deploy SHA recorded in kit § 5a, OR strip `envelope` field at route entry.

### What the agent did NOT do (explicit non-claims)

- The agent did NOT set any production environment variable.
- The agent did NOT roll any production deploy.
- The agent did NOT run any staging smoke (cannot drive a real browser + Pyodide + Clerk session).
- The agent did NOT register any production cron.
- The agent did NOT observe any real production metrics.
- The "OPERATOR FILLS" blocks in the kit are deliberately blank — those are operator-execution artifacts and the agent inventing values would violate the H3 honest-claim ceiling.

### Commits

- `844934e` — phase-47: envelope submit arm
- `54ef8fe` — phase-48: pilot envelope grader
- `24055ed` — phase-49a: frontend runtime wiring + soft-fail server fallback
- `b119bc7` — phase-49b: how-atlas-grades disclosure page
- `5278fec` — phase-50: json_equal signed-envelope canary wrapper + runbook
- `27e70c6` — phase-51: canary operational readiness — metrics endpoint + runbook §6-7
- _(Phase 52, this commit)_ — phase-52: 1% canary flip operator kit (no code changes)
