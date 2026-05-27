# Signed RunResult — Design

**Status:** Phase 44 — Planning. No runtime behavior implied by this doc.
**Companion docs:** [runtime-validation-threat-model.md](runtime-validation-threat-model.md), [validation-kind-matrix.md](validation-kind-matrix.md).
**Honest claim ceiling:** H3 in the threat model — "Atlas verified that the runtime output submitted for this step matched the expected result." Nothing stronger.

---

## 1. Goal of the envelope

Close attacks A3 (cross-step replay), A4 (cross-user replay), A7 (schema downgrade), A8 (stale-after-edit) from the threat model. Make it possible for the server to run real `json_equal` / `numeric_tolerance` / `sql_resultset` / `csv_set_equal` grading against captured runtime output without trusting an unbound client payload.

Explicit non-goal: solving A2 / A5 / A6. Those are documented residual risks; the design must not pretend otherwise.

---

## 2. Envelope shape (proposed)

The envelope is the payload `POST .../submit` (and optionally `POST .../check`) carries instead of the bare string `submission` it carries today. The shape lives in `lib/execution-core/src/types.ts` (today's home for `RunResult`) and is exported as a Zod schema from `lib/api-spec` so the OpenAPI contract + Orval-generated client share a single source of truth.

```ts
export interface RunCapture {
  /** Schema version. Bump on any shape change. Server rejects unknown versions. */
  version: 1;

  /** What was actually executed and what came out. */
  language: "python" | "sql";
  /** Raw source the client claims to have executed. Server is the only authority on the hash — it recomputes sha256(code) and compares to `binding.submissionSha256`. The raw `code` is preserved in the capture (not just the hash) so the server can also audit-log it, store evidence, and never has to trust a client-supplied digest. */
  code: string;
  /** Length-capped raw stdout. */
  stdout: string;
  /** Length-capped raw stderr. */
  stderr: string;
  /** Pyodide / DuckDB exit code (0 = success). */
  exitCode: number;
  /** Wall-clock duration in ms (informational; not graded). */
  durationMs: number;
  /** True iff the runtime aborted (timeout / OOM). */
  timedOut: boolean;

  /** Tabular results (DuckDB / SQL adapters). Empty for pure Python steps. */
  columns?: string[];
  rows?: Array<Array<string | number | boolean | null>>;
}

export interface RunEnvelope {
  capture: RunCapture;

  /** Binding — every field is validated server-side on Submit. */
  binding: {
    userId: string;     // must match req.user.id
    projectId: string;  // must match route param
    stepId: string;     // must match route param
    submissionSha256: string;  // sha256(captured code); recomputed server-side
    validationType: string;    // must match step.validationType at submit time
    issuedAt: string;   // ISO-8601 UTC, server clock
    expiresAt: string;  // issuedAt + TTL (proposed: 10 min)
    nonce: string;      // ULID, single-use within TTL window
  };

  /** HMAC-SHA256 over canonical(capture + binding), keyed with SIGNING_SECRET. */
  signature: string;
}
```

Notes:

- `RunCapture` is today's Pyodide `ExecResult` + DuckDB tabular output, plus the executed `code` itself in one neutral shape. The server-side derivation `sha256(code)` is the only authoritative hash anywhere in the pipeline; the client never sends a pre-computed digest. This keeps the A8 stale-after-edit check honest and removes a class of "client lied about its own hash" failure modes.
- `binding` is server-issued and server-verified. Client never gets to populate it freely — see §4.
- `signature` is over the *canonical serialization* (see §3). Any byte-level mutation invalidates it.
- Schema version is mandatory; bump-on-change avoids the "silent shape drift" trap Phase 43B-prime documented for `json_equal`.

---

## 3. Canonical serialization

`sign` and `verify` must produce byte-identical input to HMAC regardless of object-key insertion order, whitespace, or unicode normalization. Proposal:

1. Build a `RunCapture` and `binding` object with **explicit field order** in code (not JSON-stringify of an unordered object). Use a `canonicalizeRunCapture(capture)` and `canonicalizeBinding(binding)` helper that returns a fixed-shape object literal.
2. JSON.stringify with no spacing, UTF-8 encode, NFC-normalize unicode in string fields.
3. Concatenate: `version || "\n" || canonical(capture) || "\n" || canonical(binding)`.
4. HMAC-SHA256 with `SIGNING_SECRET` (Replit-managed secret, new). Output: lowercase hex.

Trade-off: a custom canonical form is fragile but small and auditable. The alternative (JCS / RFC 8785) is overkill for this surface and adds a dep. Audit the canonicalizer with a property test in `lib/execution-core/src/runCapture.test.ts` once implementation lands.

---

## 4. Where signing and verification live

```
                  ┌──────────────────────────────────────────┐
                  │ Browser                                  │
                  │                                          │
   Run button ─▶  │ runPython / runSql                       │
                  │       │                                  │
                  │       ▼                                  │
                  │ RunCapture (in memory)                   │
                  │       │                                  │
                  │       ▼                                  │
                  │ POST /api/runs/sign  (NEW)               │
                  │       │   body = { projectId, stepId,    │
                  │       │            capture }             │
                  └───────┼──────────────────────────────────┘
                          │ HTTPS
                  ┌───────▼──────────────────────────────────┐
                  │ API server                               │
                  │                                          │
                  │ POST /api/runs/sign                      │
                  │   - requireAuth                          │
                  │   - validate (projectId, stepId) belong  │
                  │     to an enrolled user                  │
                  │   - look up step.validationType          │
                  │   - mint binding {userId, projectId,     │
                  │     stepId, sha256(capture.code),        │
                  │     validationType, issuedAt,            │
                  │     expiresAt, nonce}                    │
                  │   - HMAC over canonical(capture+binding) │
                  │   - return { capture, binding, signature}│
                  │   - DOES NOT grade, DOES NOT reveal      │
                  │     expected output                      │
                  └──────────────────────────────────────────┘

         Submit button ─▶ POST /api/user/.../submit
                          body = { envelope: RunEnvelope, submissionType: "envelope" }
                                       │
                                       ▼
                          - requireAuth, enrollment check (same as today)
                          - verifyEnvelope(envelope):
                              * signature is valid over canonical bytes
                              * issuedAt ≤ now ≤ expiresAt
                              * nonce not seen before in the TTL window
                                (postgres unique constraint or
                                 in-memory LRU; see §6)
                              * binding.userId === req.user.id
                              * binding.projectId === route projectId
                              * binding.stepId === route stepId
                              * binding.validationType === step.validationType
                              * sha256(capture.code) === binding.submissionSha256
                          - on any failure: 400 with explicit reason
                          - on success: hand (step, capture) to gradeSubmission()
                            which now has a real arm for json_equal /
                            numeric_tolerance / sql_resultset / csv_set_equal
```

Signing happens **only on `/api/runs/sign`**. The Run button calls it after a successful local run. Submit re-verifies. `/check` either accepts envelopes too (preferred — keeps parity) or stays legacy-shape and is documented as "no envelope, contract-shaped only" — TBD in implementation phase.

**Why a separate `/sign` endpoint and not "sign inline in /submit"?** Because the moment of capture (right after `runPython` returns) is *not* the moment of submission. Learners read remediation, look at the diff, maybe re-Run. The signed envelope persists across that gap. Inline signing would force re-Run on every Submit and double Pyodide load times.

---

## 5. How `gradeSubmission` would consume the envelope

The current `gradeSubmission(step, submission: string)` signature becomes either polymorphic or has a parallel `gradeSubmissionWithCapture(step, capture: RunCapture)` for envelope-shaped submissions. Proposal:

```ts
type LegacySubmission = { kind: "legacy"; submission: string | null };
type CapturedSubmission = { kind: "captured"; capture: RunCapture };
type Submission = LegacySubmission | CapturedSubmission;

export function gradeSubmission(step: GradableStep, submission: Submission): GradingOutcome {
  if (submission.kind === "legacy") {
    // ── today's switch — preserved verbatim ──
    return gradeLegacy(step, submission.submission);
  }

  // ── new arm: real validation against captured runtime output ──
  switch (step.validationType) {
    case "json_equal": {
      const want = parseExpected(step);  // JSON.parse(step.expectedOutput) with config-error path
      const got = parseStdoutJson(submission.capture.stdout);  // single trailing JSON value
      return deepEquals(want, got)
        ? { passed: true, feedback: "Output matches expected JSON." }
        : { passed: false, feedback: structuredDiff(want, got) };
    }
    case "numeric_tolerance": { /* per-key epsilon over JSON */ }
    case "sql_resultset":     { /* validateExpected(capture, expected.rows) */ }
    case "csv_set_equal":     { /* multiset compare on parsed CSV */ }
    case "csv_ordered":       { /* ordered compare */ }
    // self_attest / exact / contains / regex — fall back to legacy arm by
    // composing on `capture.stdout` as the "submission string".
    default:
      return gradeLegacy(step, submission.capture.stdout);
  }
}
```

The legacy arm is preserved byte-for-byte. The captured arm only activates when an envelope is supplied AND `validationType` is one of the four currently-non-enforced kinds. This preserves Phase 43B-prime's contract-shaped pass behavior for any step that hasn't migrated yet.

---

## 6. Replay protection

Nonce uniqueness within the TTL window is enforced server-side. Two options, ranked:

1. **Postgres-backed** — new `run_envelope_nonces (nonce text primary key, expires_at timestamptz not null)` with an idx on `expires_at` for a periodic janitor. Pro: durable across multi-instance deploys, exact-once. Con: a write per submit (small; one row per pass).
2. **In-memory LRU** — single-instance only, lost on restart. Pro: zero schema change. Con: doesn't survive horizontal scale or rolling deploys; brief replay window during restart.

**Recommendation:** ship Postgres-backed. The 10-minute TTL keeps the table tiny; janitor can prune nightly.

---

## 7. Existing-project migration

Three classes of step today:

| Class | Visible-step count (Phase 43B-prime numbers) | Behavior pre-Shape γ | Behavior post-Shape γ |
|---|---|---|---|
| `self_attest` / `exact` / `contains` / `regex` (enforced today) | 43 | Real grader on `submission: string` | Unchanged — legacy arm. Envelope optional; if supplied, `capture.stdout` is used as the submission string for parity. |
| `json_equal` / `numeric_tolerance` (contract-shaped today; **largest population**) | 210 | Auto-pass on bare-string submission | Requires envelope; real grader on `capture.stdout` parsed as JSON / per-key epsilon. |
| `sql_resultset` / `csv_set_equal` / `csv_ordered` (client-provisional today) | 35 | Auto-pass | Requires envelope with `columns + rows`; `validateExpected` is invoked. |

Per-step migration switch: nothing today blocks introducing envelope-shape submissions on a per-`validationType` basis. Recommended rollout:

1. Ship `/api/runs/sign` + envelope verification + the new `gradeSubmission` arm, all behind a server-side allow-list keyed on `validationType`. Initial allow-list: empty. No behavior change.
2. Frontend: when allow-list includes a step's `validationType`, post the envelope on Submit instead of bare `submission`. Otherwise post bare-string as today.
3. Flip the allow-list one validation-kind at a time: `json_equal` first (largest population, 174 advisories), measure pass-rate impact for 2 weeks, then `numeric_tolerance`, then SQL.
4. Authoring spec §5.1.1 evolves: once `json_equal` is allow-listed, the Phase 43B-prime advisory for `json_equal` on `code_python` flips from informational → eligible-for-promotion-to-finding. The audit doc carries the flip-flag.
5. Hidden / archived projects are unaffected because they aren't user-visible.

---

## 8. Backward compatibility

- Bare-string submissions stay valid forever for the four enforced kinds (`self_attest` / `exact` / `contains` / `regex`). No client change required for those steps.
- Bare-string submissions on allow-listed kinds → server returns 400 with reason `envelope-required` AND an informational `legacy-shape-deprecated` field. Frontend treats this as "click Run again, then Submit."
- Old clients (pre-deploy cached SPAs) hitting an allow-listed step will see 400. Mitigated by: (a) deploy SPA + API in tandem (already standard); (b) short SPA cache TTL.
- `/check` may stay legacy-shape during the rollout — it's low-stakes and the contract-shaped pass it already returns is honest about not committing anything.

---

## 9. Failure modes (design-time)

| Failure | Server response | UX |
|---|---|---|
| Envelope missing on allow-listed step | 400 `envelope-required` | "Click Run, then Submit." |
| Signature invalid | 400 `envelope-bad-signature` | "Your run wasn't recorded properly. Click Run, then Submit." |
| Envelope expired | 400 `envelope-expired` | "Your last run is too old. Click Run, then Submit." |
| Nonce reused | 400 `envelope-replay` | Same copy as `bad-signature`; we don't reveal the cheating signal. |
| Binding mismatch (`userId` / `projectId` / `stepId` / `validationType`) | 400 `envelope-binding-mismatch` | Same generic copy. |
| `sha256(capture.code) !== binding.submissionSha256` | 400 `envelope-tampered` | Same generic copy. |
| Stdout not parseable as expected shape (e.g. invalid JSON for `json_equal`) | 200 `{ passed: false, feedback: "Your output isn't valid JSON: <message>" }` | Educational — this is a real grading outcome, not an attack. |
| Network failure mid-Run-mid-sign | Run completes locally; sign fails. Frontend shows "Couldn't sign your run — Atlas may be offline. Try again." Learner can re-Run. | Run still feels useful (output shown locally). Submit blocked until sign succeeds. |

---

## 10. Tests required

When Shape γ implementation starts (not in this phase):

- `lib/execution-core` — canonicalization round-trip + property test that any object-key insertion order produces the same canonical bytes.
- `lib/execution-core` — `verifyEnvelope` unit tests for every failure mode in §9.
- `artifacts/api-server` — `/api/runs/sign` integration tests: happy path, expired step, foreign step (different project), unauthenticated.
- `artifacts/api-server` — `/submit` integration tests for each allow-listed `validationType`: pass / fail / tampered code / replay / cross-user.
- `artifacts/api-server` — schema migration test for `run_envelope_nonces`.
- `artifacts/atlas` — submit-flow happy path + 400-handling for each failure code in §9.
- `lib/curriculum-quality` — Phase 43B-prime advisory flip-test: once `json_equal` is in the server allow-list, the advisory promotes to a finding for `code_python` steps that haven't been migrated.

---

## 11. Open questions for the implementation phase

These are intentionally not answered here — they require implementation-phase architect review:

- **Does `/check` accept envelopes, or stay legacy-shape?** Argument for: parity, learner gets real validation feedback in low-stakes UX. Argument against: extra signing round-trip on every Check click; learners click Check more than Submit.
- **What's the TTL?** 10 min is a guess. Too short → re-Run on every distracted learner. Too long → wider replay window for stolen envelopes.
- **Nonce store TTL janitor — pg_cron vs scheduled script?** Project already has scripts package; scheduled script is consistent.
- **Per-step migration rollout — feature flag or DB column?** A `validation_kinds_requiring_envelope` ENV array is simpler than a per-step DB column and matches the per-validation-kind rollout granularity from §7.
- **What happens to `userCodeRuns` (the existing debug-aid table at `POST /runs`)?** Likely stays as-is — it's a separate logging surface, not a grading surface. Could be merged into a richer events table later but isn't on the Shape γ critical path.
- **Schema-version bump policy** — when does `version: 1` → `version: 2` happen, and what's the server's posture during the transition?

---

## 12. What this design does NOT do

Restating from the threat model so it's never lost:

- Does not prove the learner wrote the code (H1).
- Does not prove the learner executed *their* code (H2 / attack A2).
- Does not stop a learner from running the answer in another Python interpreter and posting the output via the legitimate envelope path (A5 + A2 composition).
- Does not detect LLM-assisted answers.
- Does not provide a credentialing guarantee. Atlas's value sits on the portfolio artifacts, not the binary pass flag.

These are intentional. Any future phase that claims to address them must add the corresponding execution-layer change (server-side sandbox), not a stronger envelope.
