# Runtime Validation Threat Model

**Status:** Phase 44 — Planning. No runtime behavior changes implied by this doc.
**Owner:** Atlas curriculum / platform.
**Scope:** What Atlas can and cannot honestly claim about learner project completions when the runtime is the learner's own browser.

---

## 1. Why this document exists

Phase 43B-prime ([phase-43b-prime-json-equal-audit-warning.md](phases/phase-43b-prime-json-equal-audit-warning.md)) confirmed that all 174 visible `json_equal` steps + 36 `numeric_tolerance` steps are `code_python` — the server receives **learner source code as a string**, not a captured JSON value, on `POST /user/projects/:projectId/steps/:stepId/{check,submit}`. The submit-side switch in `artifacts/api-server/src/lib/grading.ts::gradeSubmission` only implements `self_attest`, `exact`, `contains`, `regex`. Everything else falls through to `{ passed: true, feedback: "Step completed." }` — a known, documented contract-shaped pass.

The intuitive fix — "ship the captured Pyodide stdout to the server and `deepEquals(expected, JSON.parse(submission))`" — has a load-bearing hidden assumption: that the payload arriving at the server **actually came from honestly executing the learner's source code in a known runtime**. That assumption is not free. It is the entire trust-model question.

This document defines that trust boundary BEFORE any code, so Shape γ (Phase 45+) cannot ship the *appearance* of enforcement while leaving the *substance* unchanged.

---

## 2. Trust boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│ LEARNER BROWSER (UNTRUSTED)                                             │
│                                                                         │
│  ┌────────────────────┐    ┌───────────────────┐    ┌────────────────┐  │
│  │  Pyodide /         │    │  React UI         │    │  DevTools /    │  │
│  │  DuckDB-WASM VM    │───▶│  (StudioShell,    │◀───│  user code     │  │
│  │                    │    │   EditorToolbar)  │    │  modification  │  │
│  └────────────────────┘    └────────┬──────────┘    └────────────────┘  │
│                                     │                                   │
└─────────────────────────────────────┼───────────────────────────────────┘
                                      │  HTTPS (Clerk-authed, same-origin)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ ATLAS API SERVER (TRUSTED)                                              │
│                                                                         │
│  POST /runs           ←  current: stores Pyodide stdout/stderr           │
│                          (debug aid — never read on submit)             │
│  POST .../check       ←  pure grader, no commits                        │
│  POST .../submit      ←  grader + XP/streak/completion commit           │
│                                                                         │
│  Postgres (TRUSTED) — users, completions, XP, runs, billing             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Trust boundary line:** the HTTPS request body. Everything above the line is under learner control. Everything below is under Atlas control.

**Crucial corollary:** Pyodide and DuckDB-WASM run in the *same JavaScript context* as the rest of the app. They are not sandboxes. A learner with DevTools open can:

- Monkey-patch `runPython` to ignore `code` and return a hard-coded passing `ExecResult`.
- Read the per-step `expected` payload out of memory / network responses and inject it.
- Replay a passing payload from a prior step or another user.
- Modify any signed envelope between signature receipt and submit.
- Run the same code in any other Python they like (local CPython, ChatGPT, a colleague's terminal) and paste the output in.

These are not edge cases. They are the default capabilities of any user with a browser. Any threat model that pretends otherwise will mislead product, marketing, and any future certification claim.

---

## 3. Actors

| Actor | Capabilities | Trust |
|---|---|---|
| **Honest learner** | Writes their own code, clicks Run, clicks Submit. | Trusted as far as their own learning goes — this is who Atlas optimises for. |
| **Cutting-corners learner** | Pastes ChatGPT output, asks a friend, copies from a forum. Wants the XP / cert without doing the work. | Untrusted for *completion claim*. Trusted not to be a security threat. |
| **Active cheater** | Modifies frontend JS, replays payloads, monkey-patches Pyodide. Wants to game leaderboards / portfolio / cert. | Fully untrusted. |
| **Malicious third party (XSS / supply chain)** | Compromises a learner's session and submits on their behalf. | Out of scope here — covered by general session-management threat model. |
| **Atlas insider** | Direct DB access. | Out of scope — covered by infra/ops controls. |
| **External cert verifier** | Inspects a cert + portfolio, decides whether to trust the completion. | The actor whose expectations bound what Atlas can honestly claim. |

---

## 4. Assets

Listed in rough order of how much damage a fabricated pass causes:

1. **External certificate of completion** (visible on portfolio, shareable). Highest stakes — third parties may make hiring decisions on this.
2. **Course completion percentage** + course-level cert.
3. **Project completion + XP ledger row** (`user_step_completions.passed=true`, `xp_transactions` ledger).
4. **Day-streak**, **leaderboard rank**, public profile counters.
5. **`user_progress.status='completed'`** — drives "you finished this!" UX, completion email.
6. **Submitted evidence** (`submissionExcerpt`, `submissionSha256`) — currently a copy of the learner's source code, not the runtime output.

The asset that drives the trust requirement is **(1) the external certificate**. Everything else can tolerate softer guarantees because the audience is the learner themselves.

---

## 5. Attacker capabilities (default, no special access)

A learner with a browser can, today:

| # | Capability | Effort | Detectable? |
|---|---|---|---|
| C1 | Edit code in the editor and click Run / Submit | — | n/a (intended) |
| C2 | Open DevTools, inspect any in-memory expected output | seconds | no |
| C3 | Replace `runPython` with a stub that returns a hard-coded `ExecResult` | minutes | no |
| C4 | Intercept the `/check` or `/submit` request body in DevTools and edit it | seconds | no |
| C5 | Run the step's source code in any other Python interpreter and paste the stdout in | minutes | no |
| C6 | Ask an LLM for the answer and paste it | seconds | no |
| C7 | Reuse a known-passing payload from a prior session / another step | minutes | partial (idempotency keys catch *exact* replays of completed steps) |
| C8 | Submit a payload claiming a different `(projectId, stepId)` than what was actually run | seconds | partial (route params bind the target step; payload claims are ignored today) |

C1, C2, C5, C6 are **unavoidable in any browser-runtime model**. They are not "vulnerabilities" — they are physics. The threat model must name them honestly so the product surface doesn't imply they're solved.

C3, C4, C7, C8 are addressable with various defenses; their cost and residual risk are what Shape γ trades off.

---

## 6. Attacks (concrete sequences)

### A1 — "I never ran the code"
Learner opens DevTools, calls `fetch('/api/user/projects/.../submit', { method:'POST', body: JSON.stringify({ submission: '<chatgpt answer>' }) })`. Server runs `gradeSubmission` against the source code; for `exact`/`contains`/`regex` steps with simple expected output, this can pass; for `json_equal`/`numeric_tolerance` steps it falls through to auto-pass today.
**Impact:** project completion with zero engagement.
**Today's mitigation:** none beyond Clerk auth + enrollment gate.

### A2 — "I ran something that wasn't my code"
Learner runs the step's reference solution (lifted from a public repo / LLM) in Pyodide, captures the real stdout, submits it. With Shape γ verification, the signature is valid because Pyodide really did execute *something* — just not the learner's authored work.
**Impact:** indistinguishable from honest completion.
**Mitigation:** none possible in a browser-runtime model. Must be acknowledged in product claims.

### A3 — "Signature replay"
After Shape γ ships, learner finishes step 1 honestly. They cache the signed envelope. On step 2 (which has the same `expected` JSON shape — common in scaffolded tutorials), they re-submit step 1's envelope.
**Impact:** silent skip of step 2.
**Mitigation:** envelope must bind `(userId, projectId, stepId, submissionSha256, validationType, issuedAt, expiresAt, nonce)` and the server must reject mismatched bindings + expired timestamps + reused nonces.

### A4 — "Cross-user envelope theft"
Learner B obtains learner A's signed envelope (from a forum, a screenshot, a leaked logfile). Submits it under their own Clerk session.
**Impact:** silent cross-user replay.
**Mitigation:** binding includes `userId`; server verifies it matches the authenticated `req.user.id`.

### A5 — "Forge then sign"
Shape γ exposes `POST /api/runs/sign` to take a client-provided `RunCapture` and return an HMAC-signed envelope. A motivated learner calls `runPython` with hand-crafted output (or skips Pyodide entirely), constructs the desired `RunCapture`, posts it to `/api/runs/sign`, gets a valid signature.
**Impact:** Shape γ's signature is valid; the underlying execution claim is false.
**Mitigation:** **none possible.** This is the central limitation. The signature proves "this RunResult was issued by Atlas with this binding at this timestamp" — it does NOT prove "this RunResult came from honestly executing the learner's code". Product surface MUST NOT imply otherwise.

### A6 — "Expected-output exfiltration via signing"
If `POST /api/runs/sign` echoes back a pass/fail or normalized `RunCapture`, a learner can brute-force the expected answer by submitting candidates and watching for the pass response.
**Mitigation:** the signing endpoint MUST be neutral — it signs whatever it's given without grading, and never reveals expected output. Grading happens only on `/submit` after envelope verification. (Trade-off: this means the Run button no longer gives a server-validated "is this right?" preview — same as today, where Run is local-only.)

### A7 — "Schema downgrade"
After Shape γ ships, a learner submits with the legacy `{ submission: "<source code>" }` shape against a `json_equal` step. Server falls back to today's contract-shaped behavior and auto-passes.
**Mitigation:** server must require the envelope shape for every step whose `validationType` is in the four currently-non-enforced enums, and reject legacy-shape submissions with a 400 once a project step is migrated.

### A8 — "Stale-after-edit"
Learner runs code, captures envelope, edits code to do something different, submits the *first* envelope.
**Mitigation:** envelope carries `capture.code` (the raw source the client claims to have executed) and the server-issued `binding.submissionSha256`. On Submit the server recomputes `sha256(capture.code)` and checks it equals `binding.submissionSha256` (the binding having itself been signed at `/sign` time). Any post-sign edit to `capture.code` invalidates the signature; any post-sign edit to `binding.submissionSha256` invalidates the signature; mid-flight learner code edits invalidate both. Learner must Run again to mint a fresh envelope.

### A9 — "Non-deterministic output"
A step uses `time.time()` / `random` without a seed. Honest runs produce different stdout each time. Even a correct implementation can fail `deepEquals`.
**Mitigation:** **content-level** — authoring spec must forbid non-deterministic stdout in `json_equal` steps. The audit added in Phase 43B-prime is the right home for a future check.

---

## 7. The minimum honest claim

There are three candidate claims, in decreasing strength:

| # | Claim | Achievable in browser-runtime model? |
|---|---|---|
| **H1** | "Atlas proved the learner *independently wrote* the code that passed this step." | **No.** Requires either proctored writing or behavioral analysis far beyond Atlas's scope. |
| **H2** | "Atlas proved the learner's submitted code, when executed in a known-honest runtime, produced output matching the expected result." | **No** in a browser model. Even with envelope signing, A2 + A5 above mean Atlas cannot distinguish "learner ran their code honestly" from "learner ran someone else's code and submitted that output." Requires either server-side execution or a tamper-proof runtime — neither exists today. |
| **H3** | "Atlas verified that the runtime output submitted for this step matched the expected result." | **Yes** with Shape γ. The claim is about the output payload, not the execution provenance. Honest. Useful. Modest. |

**Phase 44 recommends H3 as the only honest claim Atlas can make until a server-side execution layer exists.** Marketing copy, certificate text, and product surfaces MUST be reviewed against this constraint before Shape γ ships.

**Unacceptable claims** (must not appear on certificates, project completion screens, marketing, or admin reports):

- "Atlas verified the learner wrote this code."
- "Atlas proved the learner solved this independently."
- "Tamper-proof completion record."
- "Cheat-proof certificate."
- Anything that implies execution provenance Atlas does not have.

**Acceptable claims** (consistent with H3 + the residual-risk acceptance):

- "Verified output match."
- "Submission output matched the expected result for this step." (Phrasing must stay neutral on *who* produced the output.)
- "Atlas-graded project completion." (When paired with public disclosure of what Atlas-graded means — see §10.)

---

## 8. Mitigations Shape γ would actually deliver

Even with the trust-boundary caveat above, Shape γ is still a meaningful upgrade over today:

| Attack | Today | Shape γ | Residual |
|---|---|---|---|
| A1 (never ran the code) on `json_equal`/`numeric_tolerance` | passes silently (auto-pass) | rejected (envelope required, must contain real captured output that matches expected) | learner can still capture output by running the answer elsewhere (A2) |
| A3 (signature replay across steps) | n/a | rejected (binding mismatch) | — |
| A4 (cross-user replay) | n/a | rejected (`userId` binding) | — |
| A7 (schema downgrade) | n/a — current shape *is* legacy | rejected (envelope required on `json_equal`/`numeric_tolerance` steps) | — |
| A8 (stale-after-edit) | n/a | rejected (`binding.submissionSha256` recomputed server-side from `capture.code`) | — |
| Idempotent re-submit of the *same* passing envelope | already correct (Phase 26 monotonic-pass + advisory lock) | unchanged | — |
| A2 (ran someone else's code), A5 (forge then sign), A6 (exfiltration via signing) | possible | possible | **must be documented as residual** |

The Shape γ envelope therefore raises the floor from "no enforcement at all on 73% of visible steps" to "honest verified-output-match on those steps, with explicit residual risks named in product copy."

---

## 9. Out of scope for Phase 44 / Shape γ

These are real concerns and should be addressed in later phases or other doc tracks. Naming them so they don't bleed into Shape γ scope:

- **Anti-LLM detection.** Out of scope — H1 is unachievable in a browser model.
- **Behavioral proctoring** (keystroke cadence, paste detection, focus loss). Out of scope.
- **Server-side execution sandbox** (the only path to H2). Tracked separately as a Phase 45+ "managed sandbox" candidate — would be a major architectural shift (capacity, cost, security review, abuse handling).
- **Tamper-evident replay** (record the entire Pyodide session, replay server-side). Costly, slow, doesn't solve A2.
- **Reputation / trust-network signals** (peer review, instructor sampling). Different product mechanism, different doc.
- **Hash-based code-similarity detection** ("this submission matches a known cheat sheet"). Out of scope — false-positive risk too high without instructor review.

---

## 10. Required product / disclosure work that comes with Shape γ

Tied to H3 above, Shape γ cannot ship without:

1. **Public "How Atlas Grades" page** explaining the verified-output-match model in plain language. Honest about what it does and doesn't prove.
2. **Certificate language review** — strip any wording that implies H1 or H2.
3. **Admin / hiring-partner brief** explaining the same to anyone who consumes Atlas completions as a signal.
4. **Internal review of any marketing copy** that says "verified", "proof", "tamper-proof", "secure", "graded by Atlas" without qualification.

Without this work, Shape γ ships dishonest product surface even with honest code.

---

## 11. Residual risks Atlas accepts under Shape γ

By shipping Shape γ + H3 + the disclosure work in §10, Atlas accepts:

1. A motivated learner can still complete projects by running someone else's code (A2). This is the same residual risk every browser-runtime coding course has (LeetCode, HackerRank's free tier, DataCamp browser exercises). It is publicly documented and accepted by Atlas's product positioning as a *learning* platform, not a *credentialing* platform.
2. A determined cheater can still construct a valid Shape γ envelope from forged RunResults (A5). The honest signature-binding semantics make this no worse than A2.
3. Cross-user verbal answer-sharing remains undetectable. The same residual risk as any take-home homework.
4. Atlas's portfolio + cert value derives from the *project artifacts* the learner submits (code, written deliverables, designs) much more than from the binary pass flag. The pass flag is necessary but not sufficient for credential value.

These are the only acceptable residuals for a portfolio-grading product. Anything stronger (i.e. moving to H2) requires a server-side execution layer that does not exist today.

---

## 12. Decision log

- **2026-05-27** — Phase 44 planning. Adopt H3 as the maximum honest claim until a server-side execution layer exists. Shape γ implementation gated on this threat model + §10 disclosure work landing first.
