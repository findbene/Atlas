---
name: atlas-conventions
description: Atlas project invariants, gate chain, phase ritual, and the dark-ship grading pattern. Consult whenever working on the Atlas codebase — authoring projects, changing a validation grader, touching learner-facing copy, archiving content, modifying schema, or closing a phase. These rules are inherited from a 57-phase reviewed build and breaking one is a P0/P1 review failure.
---

# Atlas Conventions

The non-negotiable rules that keep Atlas trustworthy as it scales. Inherited from the Replit-era build (Phases 4–57A) and enforced by `atlas-architect-reviewer` + the `audit:*`/`check:*` scripts. Each rule has a *why* — honor the intent, not just the letter.

## 1. Trust & honesty (H3 boundary)

Atlas can verify *that an enabled runtime output matched an expected result*. It CANNOT prove independent authorship or absence of outside help. Therefore learner-facing copy must never say **"verified authorship", "tamper-proof", "cheat-proof", "100% verified", or "job guaranteed."** Allowed: "verified completion record", "evidence-backed project completion". A banned-phrase guard (Unicode NFKC-normalized, word-boundary) enforces this. *Why: overclaiming is the fastest way to lose recruiter trust, the entire product thesis.*

## 2. Validation graders ship DARK

A new or changed grader (the `validation_type` kinds: `exact`, `contains`, `regex`, `numeric_tolerance`, `csv_set_equal`, `csv_ordered`, `json_equal`, `sql_resultset`, `self_attest`) must:
1. Gate real grading behind an explicit opt-in flag (e.g. `spec.serverGrade === true`); non-`true` values are treated as opt-out (defense in depth).
2. Leave every existing live row **byte-for-byte identical** — proven by a one-shot BC audit script (`audit:contains-bc`, `audit:csv-set-equal-bc`, …) that diffs new-grader output vs an inlined pre-change reference across curated synthetic submissions, over every visible step of that kind.
3. Add a symmetric authoring guard in `lib/curriculum-quality/src/authoring.ts` so malformed specs are rejected at construction time, and malformed runtime input **fails closed** with learner-readable feedback.
*Why: grading is the load-bearing trust surface; a silent behavior change on a live step corrupts earned evidence.*

## 3. Content is archived, never deleted

Archive = set `learner_visible=false`. Never delete rows from `projects` or `project_candidates`. Archive gates must assert `enrolled_count=0` via the LIVE `user_progress` count (helper `getActualEnrollmentCount`), not the denormalized column, and that any superseding project exists+visible. *Why: enrollments, lineage, and evidence references must survive catalog churn.*

## 4. Visibility & no existence leak

Learner-facing routes filter `learner_visible=TRUE`. A hidden or non-existent slug returns **404, never 403** — 403 would leak that the slug exists. Admin routes (`/api/admin/*`) may see hidden content. *Why: pre-launch and hidden-first content must not be discoverable.*

## 5. Curriculum lineage

Every promoted project links bidirectionally to its `project_candidate` (`promote()` writes both FK directions atomically and hard-fails if the inverse UPDATE ≠ 1 row). `RUBRIC_VERSION='1.0.1'` is frozen — no weight edits, no band changes. Course is read from `projects.course` directly; `mapToCourse` is NEVER called at runtime (`check:no-heuristic-runtime` enforces, chained into `typecheck`). 9 courses exactly. *Why: lineage + a frozen rubric make quality auditable and reproducible.*

## 6. Hidden-first publishing

New projects land `learner_visible=false`, pass `audit:authoring` (publish-ready) + `audit:pedagogy`, get a manual publish-readiness checklist sign-off, THEN an explicit visibility flip. Agents never auto-flip visibility. *Why: a human gate before anything reaches a learner.*

## 7. Evidence integrity

`/check` = practice, zero DB writes. `/submit` = durable evidence: XP/streak/completion writes wrapped in a transaction, serialized per-learner via `pg_advisory_xact_lock('atlas-submit:'||userId)`; idempotent (no double-XP on re-submit). Any new writer to reward tables MUST use the same lock key. *Why: concurrent submits must not double-credit or corrupt the ledger.*

## 8. The gate chain (run via `/atlas-validate`)

`pnpm run typecheck` (+ `check:no-heuristic-runtime`) · vitest for `api-server`/`atlas`/`execution-core`/`curriculum-quality` · `audit:authoring` · `audit:pedagogy` · BC audits when a grader/seed changed. Green-with-a-skipped-BC-audit is NOT a pass when the grader changed. *Why: the mechanical floor under every phase.*

## 9. Phase ritual

`/atlas-phase-plan <id>` (brief + plan + acceptance + hard-stops) → build the minimum the phase needs → `/atlas-validate` → `atlas-architect-reviewer` (fix all P0/P1) → `/code-review` → `/atlas-phase-close` (close-out doc + rotate `HANDOFF.md` / `docs/phases/INDEX.md` / `replit.md`) → update `.agentic/progress.md`. One logical change per commit. *Why: this ritual is exactly what carried 57 phases without a trust regression.*

## 10. Scope discipline

Touch only what the phase requires. No unrequested refactors, no renames for taste, no new top-level folders without owner approval. State hard-stops in the plan and respect them. *Why: small reviewable diffs are why the architect gate stays effective.*
