# Phase 35 — Project Authoring Template + Content Factory

**Parent:** Phase 34 — Ada Tutor Step Contract + Mode Telemetry at `9f6edb7`.
**Status:** SHIPPED. Docs-first, schema-free deliverables; zero runtime behavior change.

---

## Goal

Standardize how new Atlas projects are authored so they are, by construction:

- **Mode-compatible** (Phase 32) — render correctly under all 4 learner modes (`guided` / `hint` / `independent` / `dynamic_ai_adaptive`).
- **Tutor-compatible** (Phase 33 + 34) — provide the per-step signals the Tutor Contract needs (`expectedOutputs`, hint ladder, `misconceptionToWatchFor`) without leaking solutions.
- **Validation-ready** — every step is machine-verifiable OR has a justified `self_attest`; at least one step in every project must be machine-verifiable.
- **Portfolio-ready** — concrete deliverable + `portfolioRelevance` distinct from `meta.hiringRelevance2026`.
- **Recruiter-relevant** — 2026 hiring framing baked into `meta`.

This phase does NOT introduce new schema, new runtime gates, or new product surfaces. It codifies the **de-facto contract** already enforced by `AuthoredProject` + `assertAuthoredProjectComplete` + the scoring lib, and gives content authors a paved path.

---

## Deliverables

### A. `docs/project-authoring-spec.md` (v1.0)

14 sections covering: scope, the `AuthoredProject` shape (with hard `assertAuthoredProjectComplete` invariants quoted verbatim from `lib/curriculum-quality/src/authoring.ts:206`), `meta`, `portfolio`, per-step contract (incl. the project-level invariant that at least one step must be machine-verifiable), pedagogy contract (5-level hint ladder + `misconceptionToWatchFor` + `portfolioRelevance` + feedback pair + `finalExplanation`), validation kinds, mode compatibility (P32), tutor compatibility (P33+P34), portfolio surface, end-to-end authoring flow, anti-patterns, FAQs, and the gate matrix (typecheck vs runtime `assertAuthoredProjectComplete` vs `audit:authoring` vs `audit:pedagogy`).

### B. `docs/templates/project-template.md`

Copy-paste authoring template anchored on the `AuthoredProject` TS shape — every field labeled REQUIRED / OPTIONAL with example fillings and validation-kind chooser guide. Author fills it out, then translates into a `scripts/src/authored/<course>__<slug>.ts` file.

### C. `docs/templates/project-publish-readiness-checklist.md`

14 lettered binary gates (A–N): meta, portfolio, steps, validation, pedagogy, fixtures, mode-compatibility manual sweep (all 4 modes), tutor-compatibility manual sweep, anti-leak self-audit, recruiter framing, rubric compatibility, automated gates, existing tests still green, doc updates. Distinguishes runtime gates (the asserter, `audit:authoring`) from typecheck (static `AuthoredProject` shape only).

### D. `scripts/src/audit-project-authoring.ts` + `audit:authoring` npm script

New READ-ONLY DB audit (exit 0 always — reporting tool, not CI gate). Distinct from `audit:pedagogy`: this audit checks the **project-level** authoring contract, not per-step pedagogy density.

Checks per visible project:

- `fewer-than-four-steps`
- `non-sequential-step-numbers` (1..N enforcement; the asserter only catches uniqueness)
- `step-missing-instruction`
- `step-missing-expected-outputs`
- `step-missing-validation-type`
- `all-steps-self-attest` (project-level: at least one step must be machine-verifiable)
- `hint-leak-suspected` (heuristic — see helper below)
- `meta-field-missing` (title, description, course, course_source='authored')

Findings deduplicated per project. Histogram + per-slug summary printed.

**`hintLeakSuspected` extracted to `lib/curriculum-quality/src/authoringAudit.ts`** (pure helper, exported from the lib's barrel) + `authoringAudit.test.ts` (8 unit tests). The lib has vitest infra; the `@workspace/scripts` package does not, matching the `audit:pedagogy` precedent.

The heuristic is a windowed substring match between L4/L5 hint text and a stringified `expectedOutputs`, with a JSON-syntax-density false-positive guard so a hint that legitimately discusses output *shape* doesn't trip. Best-effort by design; the real anti-leak guarantee lives in the publish-readiness checklist + human review.

### E. Admin endpoint — **DEFERRED**

The existing `GET /api/admin/quality` already exposes the lineage-integrity signals (`promotedProjects`, `candidatesWithInverse`, `mismatches`, `inverseMismatches`, `duplicateCandidatePromotions`) and `hiddenCount` / `hiddenSlugs`. Adding a parallel `/api/admin/authoring-audit` endpoint would duplicate that surface for marginal value and would expand the admin route's responsibility. Per user's scope-risk guidance, deferred. `audit:authoring` is invoked from the CLI; operators can still get DB-derived signal whenever they want.

---

## Strategy decisions

1. **Anchor on the existing `AuthoredProject` type, not a new contract.** Codifying the de-facto shape eliminates the risk of two contracts drifting apart. Every spec field cites its line in `lib/curriculum-quality/src/authoring.ts`.

2. **Project-level invariant promoted to a documented gate.** `all-steps-self-attest` was already implicitly bad (no machine-verifiable signal → no real evidence for portfolio / cert-verify), but it wasn't documented. Spec §5.1 + checklist §D + audit script all align on: at least one step must be machine-verifiable.

3. **`audit:authoring` is a reporting tool, not a CI gate.** Exit 0 always. Distinct from `audit:pedagogy` (which is a hard 100%-visible gate). The two complement each other: pedagogy audits per-step enrichment density; authoring audits project-level shape.

4. **`hintLeakSuspected` is a heuristic, explicitly labeled as such.** The cheap windowed substring match catches obvious leaks (L5 = literal expected JSON) but cannot catch semantic leaks. Documented in the audit header + spec — the real anti-leak guarantee is in the publish-readiness checklist + human review.

5. **Extracted heuristic to `lib/curriculum-quality`** so it can be tested without adding a vitest config to `@workspace/scripts` (matches the audit:pedagogy precedent of zero tests in scripts).

6. **Runtime vs typecheck distinction documented carefully.** `assertAuthoredProjectComplete` is a **runtime function** invoked by the promote flow; `pnpm run typecheck` validates the `AuthoredProject` static type only. Spec §13 and checklist §K + §L now make this explicit — earlier drafts conflated them, which would have given authors false confidence in CI coverage. Architect caught this twice during fix-up.

7. **Deliverable E (admin endpoint) deferred** to avoid scope creep. `audit:authoring` is the canonical surface; `/api/admin/quality` continues to expose lineage integrity. Future phase can add an admin UI for `audit:authoring` output if operator demand emerges.

---

## What this phase finds

Running `audit:authoring` against the live dev DB:

```text
Total projects:                  88
Visible projects:                56
Visible publish-ready:           54 / 56

Finding histogram (visible):
  2 × step-missing-expected-outputs
  2 × all-steps-self-attest
  1 × fewer-than-four-steps

Visible projects with gaps:
  - csv-to-postgres-pipeline  (2 findings)
  - dbt-data-models           (3 findings)
```

**Both flagged slugs are exactly the pre-Phase-7 grandfathered originals** (the two entries in `GRANDFATHERED_CANDIDATE_FOR_SLUG`). They predate the `AuthoredProject` contract. The audit is correctly identifying real shape gaps, not false positives. **Natural Phase 36 recommendation:** upgrade these 2 to the modern AuthoredProject shape, or archive (`learner_visible=false`) and replace with new authored equivalents.

---

## Files

**New**

- `docs/project-authoring-spec.md`
- `docs/templates/project-template.md`
- `docs/templates/project-publish-readiness-checklist.md`
- `scripts/src/audit-project-authoring.ts`
- `lib/curriculum-quality/src/authoringAudit.ts`
- `lib/curriculum-quality/src/authoringAudit.test.ts`
- `docs/phases/phase-35-project-authoring-spec.md` (this file)

**Modified**

- `lib/curriculum-quality/src/index.ts` — exports `hintLeakSuspected`.
- `scripts/package.json` — adds `audit:authoring` npm script.
- `HANDOFF.md`, `replit.md`, `docs/phases/INDEX.md` — Phase 35 entries.

**Unchanged:** every schema file, every migration, every backend route, every frontend file, OpenAPI spec, all codegen output, seed/content/rubric/anchor/wave files, deployment checklist, AI tutor prompt, hint policy, `assertAuthoredProjectComplete` itself.

---

## Final gate summary

| Gate | Result |
| ---- | ------ |
| `pnpm --filter @workspace/curriculum-quality run test` | **69/69** (8 new authoringAudit cases) |
| `pnpm --filter @workspace/execution-core run test` | **34/34** (unchanged) |
| `pnpm --filter @workspace/api-server run test` | **273/273** (unchanged) |
| `pnpm --filter @workspace/atlas run test` | **102/102** (unchanged) |
| `pnpm --filter @workspace/api-server run test:integration` | **3/3** (real-PG concurrency unchanged) |
| `pnpm run typecheck` | clean across all 4 leaf packages + libs |
| `pnpm run check:no-heuristic-runtime` | OK — 4-file allowlist unchanged |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | **56/56 visible** (unchanged) |
| `pnpm --filter @workspace/scripts run audit:authoring` (NEW) | 54/56 visible publish-ready; 2 grandfathered slugs flagged with real gaps |
| Architect review | **PASS** after 3 fix-up rounds (portfolio.kind enum mismatch; validation.config→validation.spec; assertAuthoredProjectComplete runtime-vs-typecheck; all-steps-self-attest spec/code mismatch). All 4 sets of doc-vs-code contradictions resolved before sign-off. |

## Hard-rule re-verification

- Schema / migration changes: **none**.
- `/check`, `/submit`, cert-verify, portfolio, billing, deployment, Stripe, OpenAPI codegen: **untouched**.
- `learner_visible = TRUE` filter on learner-facing routes: **unchanged** (404-not-403 privacy intact).
- Bidirectional candidate ↔ project lineage: **untouched**.
- RUBRIC_VERSION='1.0.1': **frozen**.
- 4-file no-heuristic allowlist: **not expanded** (`check:no-heuristic-runtime` green).
- AI tutor prompt, hint policy, learner-mode endpoints: **untouched**.
- 9 Atlas courses + "Atlas is a project-based learning platform for Data Engineering" framing: **unchanged**.

## Known follow-ups (Phase 36 candidates)

- Upgrade `csv-to-postgres-pipeline` and `dbt-data-models` to the modern `AuthoredProject` shape — or archive them and replace with new authored equivalents. These are the only 2 visible slugs not currently publish-ready.
- Optional: add an admin UI surface for `audit:authoring` output if operator demand emerges (deliverable E was deferred).
- Optional: extend `hintLeakSuspected` with a semantic (embedding-based) check for cases the substring heuristic misses.
- Author 1–2 net-new projects using the new spec end-to-end as a smoke test of the paved path.
