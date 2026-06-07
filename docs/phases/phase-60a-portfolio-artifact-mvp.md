# Phase 60A — Evidence-safe portfolio artifact MVP foundation (close-out)

**Status:** SHIPPED (DARK foundation). A pure, deterministic portfolio-artifact
**generator** + tests + this doc. **No route, no schema, no GitHub OAuth, no
publishing, no new `serverGrade`/opt-ins, no envelope enforcement, Phase 52
untouched.** This is the "dark foundation" half of Epic E2 — the same
dark→expose discipline used for the graders (57A→57B, 58A→58B). The route that
serves the bundle is deferred to Phase 60B.

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer`
→ SHIP**, no P0/P1 (see §10).

---

## 1. What was built

A pure module `artifacts/api-server/src/lib/portfolioArtifact.ts` with:

- `generatePortfolioArtifact(input): PortfolioArtifactBundle` — renders the
  artifact files from a **safe input model** (no DB / network / env access).
- `classifyEvidenceStatus(kind, serverGradeFlag)` — the single source of truth
  for the per-step evidence label; logically identical to the runtime
  `deriveServerGrade` predicate (only `csv_set_equal | sql_resultset` opted in
  → `server-graded`; `self_attest` → `self-attested`; everything else →
  `client-provisional`). 60B's route reuses this so the label can never drift
  from what the server actually re-grades.
- `PortfolioArtifactInput` / `PortfolioStepEvidence` types — the safe input
  contract (see §3).

Tests: `artifacts/api-server/src/lib/portfolioArtifact.test.ts` — 42 cases
across no-leak, evidence-honesty, determinism, and the classifier table.

## 2. Existing data inventory (what can be generated safely today)

Source-of-truth scan of `lib/db/src/schema/*`, `routes/user-portfolio.ts`,
`routes/cert-verify.ts`, `routes/user.ts`, and `domains.ts`.

**Already-safe, already-assembled (reuse):** `routes/user-portfolio.ts` (Phase
29) already produces one safe completion-evidence row per completed project for
the authenticated user, with the exact anti-leak posture we need (userId from
session only; `learner_visible=true AND deleted_at IS NULL` gate; aggregates
scoped to user+project). Fields: `certId`, `projectSlug`, `projectTitle`,
`course`, `difficulty`, `completedAt`, `firstStepCompletedAt`, `durationSeconds`,
`stepsCompleted`, `totalSteps`, `evidenceHashCount`, `totalXpEarned`,
`verifyUrl`, `topRole`. `cert-verify.ts` (Phase 28) is the public symmetric view.

**Safe project/step metadata (available, used by the generator):**

| Need | Source | Safe? |
|---|---|---|
| Project title / slug / summary | `projects.title` / `slug` / `short_description` | yes |
| Skills practiced | `projects.learning_objectives[]` | yes |
| Tools / runtime | `projects.tech_stack[]` | yes |
| Role | `projects.job_outcomes.roles[0]` | yes |
| Course / difficulty / totalSteps | `projects.course` / `difficulty_level` / `total_steps` | yes |
| Per-step validation **kind** | `project_steps.validation_type` (enum) | yes — a label, not a spec |
| Per-step **server-graded** status | derived: kind ∈ rowset **and** `validation_config.spec.serverGrade === true` (the flag is nested under `.spec`, matching `deriveServerGrade`) | yes — narrow boolean only |
| Per-step skill | `project_steps.required_skill` | yes |
| Per-step pass + completedAt | `user_step_completions.passed` / `completed_at` | yes |
| Durable evidence hash present | `user_step_completions.submission_sha256 IS NOT NULL` | yes — count/boolean only |

## 3. What CANNOT be generated yet (the 60B storage gap)

- **The learner's submitted code is not durably stored in a canonical form.**
  `user_step_completions.submission_excerpt` is a truncated first-N-bytes excerpt
  (and `routes/user-portfolio.ts` forbids exposing it); `submission_sha256` is a
  one-way hash (evidence, not content); `user_code_sessions.files` is the latest
  editor snapshot, one row per (user, project), **overwritten** on each save (not
  per passing step); `user_code_runs.code` is run history that the background
  sweep prunes. None of these is a durable, complete, per-step record of the
  passing submission.
- **The learner's submitted runtime output is not durably stored** either
  (`user_step_completions.validation_output` is the grader message, not a
  reliable canonical output; `user_code_runs.stdout/stderr` is pruned).

Consequence: 60A sets `submittedCodeAvailable` / `submittedOutputAvailable` to
**false** and the artifact says so plainly. Exporting real code/output requires
a new durable, append-only "submitted artifact" store written at passing
`/submit` (full code + output, no overwrite, retained) — **a Phase 60B task**
(schema change, hence out of 60A's no-schema scope).

## 4. Generated artifact files

Always: `README.md`, `VALIDATION_EVIDENCE.md`, `LIMITATIONS.md`,
`LEARNER_REFLECTION_TEMPLATE.md` (pure boilerplate, no learner data).
Conditional: `DATASET_NOTES.md` (only when safe dataset descriptions are passed).

- **README.md** — title, role/path, course, level, summary, skills, tools,
  completion summary (steps, evidence-hash count, XP, duration, verify URL), and
  the single allowed Atlas-verified statement.
- **VALIDATION_EVIDENCE.md** — per-step table (step, title, **kind**,
  server-graded vs client-provisional vs self-attested, pass, completedAt), a
  legend, and the evidence-integrity rollup. Durable `/submit` framed as the
  source; provisional `/check` explicitly excluded.
- **LIMITATIONS.md** — the non-claims (see §6), the honest "what it does
  reflect", and data scope/freshness incl. the submitted-code-unavailable note.

## 5. Allowed claim

Exactly one verification claim, reused verbatim in README + VALIDATION_EVIDENCE:

> "Atlas verified that submitted runtime output or artifacts matched the enabled
> validation checks for the steps marked **server-graded** below."

## 6. Forbidden claims (H3) — never emitted

Independent authorship · learner worked with no outside help · cheat-proof ·
tamper-proof · guaranteed job / job-readiness · certified professional
competence · verified honest SQL/code authorship. The copy is worded so these
phrasings never appear **even in negation** (e.g. "produced the solution without
assistance", "who wrote the code or SQL", "does not certify the learner's
competence"), which lets the honesty audit be a simple substring check.

## 7. No-leak & honesty guarantees

- **No-leak by construction:** the input model has **no field** that can carry a
  `validationConfig`, `expectedRows`, `expectedRowsHash`, reference query,
  comparator diagnostic, raw submission, or secret. The only validation fact per
  step is the `validation_type` enum + a derived narrow status. There is no
  channel for an answer key. The 42 tests assert (belt-and-suspenders, on a
  realistic C2-shaped input carrying both opted-in rowset steps) that no spec
  token, C2 query/expected fragment, raw-submission key, or secret-like string
  appears in any file.
- **Honesty by construction:** tests assert the allowed claim is present and the
  forbidden over-claims are absent.

## 8. Why GitHub OAuth / direct publishing were deferred

Intentionally out of 60A scope (hard stops). OAuth + push + public publishing
are the highest-risk, highest-surface parts of E2 (third-party tokens, write
scope to a learner's account, irreversible public exposure of generated text).
The disciplined path mirrors the grader rollout: build the deterministic
artifact **dark and provable first**, then expose it behind an authenticated
read-only preview (60B), then a learner-initiated export (60/61 = `/atlas-phase
60`, `61`). Publishing is only as trustworthy as the artifact it publishes — so
the artifact is hardened first.

## 9. What Phase 60B should build next

1. **Authenticated read-only preview/download route** (the deferred Task-5
   option). Design: `GET /user/portfolio/:slug/artifact`, `requireAuth`, userId
   from session only; gate on a completed `user_progress` for THIS user + a
   `learner_visible=true AND deleted_at IS NULL` project (404 not 403, no
   existence leak — same as `user-portfolio.ts`); SELECT only the safe columns in
   §2 + compute `serverGradeFlag` inline from `validation_config->'spec'->>'serverGrade'`
   (the flag is nested under `.spec` — `deriveServerGrade` reads
   `validationConfig.spec.serverGrade`; a top-level read would silently downgrade
   every server-graded step) and never select the whole config; reuse the
   `user-portfolio.ts` defensive clamps (`stepsCompleted <= totalSteps`,
   `evidenceHashCount <= stepsCompleted`) BEFORE calling the generator; call
   `classifyEvidenceStatus` + `generatePortfolioArtifact`; return the bundle.
   Fully testable via supertest with a mocked db (precedent:
   `user-check-submit-parity.test.ts`). **Add the path to `openapi.yaml` on the
   next legitimate orval regen** (bundle it with the deferred
   `serverGrade`-description regen to avoid a standalone ~95-file CRLF churn).
2. **Durable submission store** (schema) so code/output can actually be
   exported — see §3.
3. **Wire the generated copy into the canonical H3 guard.** 60A added a local
   honesty denylist (incl. dash/unicode variants) to the generator test and was
   verified against the canonical `BANNED_H1H2_PATTERNS` + `normalize()`
   (`artifacts/atlas/src/lib/banned-h1h2-phrases.ts`) by the architect review
   (0 hits). The clean wiring (add a `portfolioArtifact` case to that guard's
   `GUARDED_FILES`, or lift the patterns into a shared lib) is cross-package and
   belongs with 60B's route work. Markdown-cell escaping for author fields was
   added in 60A (`mdCell`/`mdHeading`).
4. Only after 1–3: GitHub export + publishing (60/61).

## 10. Independent reviews

- **architect-reviewer: PASS** — verified empirically (ran the suite 42/42; ran
  the generated bundle through the canonical `BANNED_H1H2_PATTERNS`+`normalize()`
  guard → 0 hits; confirmed the module is an unreferenced leaf with zero external
  callers; confirmed no-leak-by-construction, predicate parity with
  `deriveServerGrade`, and inventory accuracy). No P0/P1. P2s actioned in 60A:
  P2-1 close-out used the wrong spec path (`->>'serverGrade'`) → **FIXED** to
  `->'spec'->>'serverGrade'` (§2, §9); P2-3 dead fields → **FIXED** (generator now
  derives status incl. `unavailable`; renders `requiredSkill`; dropped unused
  `evidenceStatus`/`hasDurableEvidenceHash`/`firstStepCompletedAt`); P2-4 §10
  placeholder vs header → **FIXED** (this section). P2-2 canonical-guard wiring →
  **DEFERRED to 60B** (cross-package; guard passes today). P2-5 clamp reuse →
  documented as a 60B route requirement (§9).
- **code-reviewer: SHIP** — no P0/P1. Verified the classifier table exhaustively,
  determinism, and that the no-leak/honesty tests are non-vacuous. P2s actioned:
  markdown-injection on author fields → **FIXED** (`mdCell`/`mdHeading` escaping
  + test); no-leak "structural" gap → **FIXED** (added a test proving extra
  spec-like props on the input never surface); dead `unavailable` + unrendered
  fields → **FIXED** (see above). Deferred to 60B: durable submission store +
  the canonical-guard wiring.

## 11. Tests & gates

See the mini-report. Generator suite **42/42**. Full gate chain green on Node 24
+ Docker PG; no behavior change to any existing route/grader/audit (the module is
a new, unreferenced leaf).

## 12. Final invariants (confirmed)

Exactly 1 `csv_set_equal` + 1 `sql_resultset` opted in (unchanged); no new
validation rows flipped; no new kinds enabled; no envelope enforcement; Phase 52
untouched; C2 visible+approved; no schema/env/canary/production/cloud/GitHub
OAuth/cert-marketing change. `RUBRIC_VERSION` frozen. Phase 60B not started.
