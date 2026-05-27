# HANDOFF

**Latest shipped phase:** Phase 44 — Runtime Validation Trust Model + Signed RunResult Plan (docs-only).
**Working tree:** clean after `phase-44: runtime validation threat model + signed RunResult design + implementation plan`.
**Parent commit:** `bc0fd51` (Phase 43B-prime close) → `3e84ede` (Phase 43B audit) → `78d9cc1` (Phase 43A compaction) → `84f733c` (Phase 42 close).

---

## Phase 44 summary

Planning-first phase. No code, no types, no routes, no schema, no OpenAPI/codegen, no frontend, no content edits. Establishes the trust model + signed-envelope design that must precede any Shape γ implementation.

### What landed

1. **`docs/runtime-validation-threat-model.md` (new)** — trust boundaries, actors, assets, attacker capabilities (C1-C8), nine concrete attacks (A1-A9), mitigations Shape γ would deliver, residual risks Atlas accepts, three candidate honest-claim levels (H1/H2/H3) with H3 as the recommended ceiling, required disclosure work (public "How Atlas Grades" page, certificate-copy review, admin/hiring-partner brief).

2. **`docs/signed-run-result-design.md` (new)** — full `RunCapture` + `RunEnvelope` shape, canonical serialization, signing topology (separate `POST /api/runs/sign` endpoint that mints binding + signs but never grades or echoes expected output), replay protection (postgres-backed nonce table with 10-min TTL), `gradeSubmission` evolution to a polymorphic `Submission` union (legacy bare-string arm preserved verbatim), per-validation-kind allow-list rollout, backward compatibility for the 43 enforced steps, ten failure modes with error codes, twelve open questions for the implementation phase, explicit list of what the design does NOT do.

3. **`docs/phases/phase-44-runtime-validation-plan.md` (new)** — read-only audit findings, deliverable summary, Phase 45-50 implementation sequence (envelope types → `/sign` endpoint → grading arm → frontend plumbing → controlled rollout per kind), files Phase 45+ will touch, OpenAPI / frontend / execution-core / `grading.ts` implications, cross-cut test plan, rollout strategy, hard stops, and the recommended Phase 45 ticket scope.

4. **Deferred:** optional pure types in `execution-core`. Promoting `RunCapture` / `RunEnvelope` without a consumer would be dead code; better landed in Phase 45 alongside the canonicalizer + signer + tests.

### Honest claim ceiling

H3 — **"Atlas verified that the runtime output submitted for this step matched the expected result."**

Stronger claims (H1 "learner independently wrote the code", H2 "learner's code produced the output") are **unachievable in a browser-runtime model** and must not appear on certificates, marketing copy, or admin reports. Threat model §7 + §10.

### Trust-boundary summary

The HTTPS request body is the trust boundary. Everything in the browser (Pyodide VM, React UI, learner code, DevTools) is untrusted. A signed envelope proves authenticity + binding + non-replay; it does NOT prove the learner ran their own code. Attacks A2 (ran someone else's code) and A5 (forge then sign) are accepted residuals — same residual every browser-runtime coding platform carries.

### Unacceptable claims (must not ship with Shape γ)

- "Atlas verified the learner wrote this code."
- "Atlas proved the learner solved this independently."
- "Tamper-proof completion record."
- "Cheat-proof certificate."
- Anything implying execution provenance Atlas does not have.

### Recommended implementation sequence

| Phase | Scope | Behavior change? |
|---|---|---|
| **45** | Envelope types + canonicalizer + signer + verifier in `lib/execution-core` + tests. | None |
| **46** | `POST /api/runs/sign` endpoint + `run_envelope_nonces` table/migration/janitor. | None (no caller yet) |
| **47** | Captured-submission arm in `gradeSubmission`; `VALIDATION_KINDS_REQUIRING_ENVELOPE` env-driven allow-list (default empty). | None until allow-list populated |
| **48** | Frontend Run→sign→Submit plumbing + "How Atlas Grades" public page + cert-copy review. | None until §49 |
| **49** | Flip `json_equal` to envelope-required for 1% then 100% over 1-2 weeks. | Real enforcement on `json_equal` |
| **50+** | Repeat §49 for `numeric_tolerance`, `sql_resultset`, `csv_set_equal`, `csv_ordered`. | Real enforcement, one kind per phase |

### Files changed in Phase 44

- `docs/runtime-validation-threat-model.md` (new)
- `docs/signed-run-result-design.md` (new)
- `docs/phases/phase-44-runtime-validation-plan.md` (new)
- `docs/phases/INDEX.md` (+1 entry)
- `replit.md` (Phase History prepend)
- `HANDOFF.md` (this file)

### Hard stops respected in Phase 44

| Surface | Touched? |
|---|---|
| `lib/grading.ts` | NO |
| `/check`, `/submit`, route handlers | NO |
| Frontend code | NO |
| OpenAPI spec / codegen | NO |
| `execution-core` types or runtime | NO |
| DB schema / migrations | NO |
| Seed / content / project files | NO |
| Pedagogy / rubric / taxonomy | NO |
| Deployment / production DB | NO |
| Billing / Stripe / certs / portfolio | NO |
| `publishReady` count | UNCHANGED (58/58) |

### Gates

Phase 44 is docs-only. Gates inherited from Phase 43B-prime (no source files changed, nothing to re-run beyond a sanity typecheck):

| Gate | Result |
|---|---|
| typecheck (full repo) | ✓ (inherited — no source files changed) |
| check:no-heuristic-runtime | ✓ (inherited) |
| curriculum-quality tests | ✓ 93 / 93 (inherited) |
| audit:authoring | ✓ 58 / 58 visible publish-ready (inherited) |
| audit:pedagogy | ✓ 58 / 58 (inherited) |

### Risks remaining after Phase 44

1. **Disclosure-surface drift.** Shape γ technical work without the "How Atlas Grades" page + cert-copy review = honest code, dishonest product surface. Phase 48 explicitly couples them.
2. **Allow-list rollout coordination.** Mis-flipped env var on prod could 400 every active learner mid-step. Phase 49+ requires gradual rollout with a kill-switch runbook.
3. **Twelve open questions in design doc §11** are deferred to Phase 45+ (TTL length, `/check` envelope policy, nonce janitor mechanism, schema-version bump policy, etc.). None block Phase 45 but several block Phase 47.
4. **Residual A2 / A5 risk is intentional.** Product team must internalize that H3 is the ceiling. Future pressure to claim more must be redirected to "build a server-side execution layer" rather than "tighten the envelope further."
5. **Pyodide / DuckDB-WASM version drift.** Capture shape is tied to what these runtimes emit. Pinning version + smoke test on capture shape per release would prevent silent breakage. Phase 45 spike candidate.

### Recommended Phase 45

**`RunCapture` / `RunEnvelope` types + canonicalizer + signer + verifier in `lib/execution-core`, server-only, no behavior change.** Single-package surface, isolated test matrix, zero route or frontend touch, zero migration. Reversible by deleting the lib exports. Architect review on completion.

### Commit

`phase-44: runtime validation threat model + signed RunResult design + implementation plan`
