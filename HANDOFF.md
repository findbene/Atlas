# Atlas — Session Handoff

**HEAD:** Phase 35 — Project Authoring Template + Content Factory.
**Last shipped:** Phase 35 (parent: Phase 34 at `9f6edb7`).
**Status:** Phase 35 **SHIPPED**. Docs-first, schema-free. Working tree carries only the Phase-35 additions (4 docs + 1 audit script + 1 pure helper + 1 test file + 3 small modifications: lib barrel export, scripts package.json, this HANDOFF + replit.md Phase History + docs/phases/INDEX.md).

Atlas remains deploy-ready (Phase 31 unchanged). **No deployment has occurred. No production DB has been touched.**

---

## Phase 35 working-tree changes

**New files**

- `docs/project-authoring-spec.md` — canonical v1.0 spec, 14 sections, anchored on the existing `AuthoredProject` type. Quotes `assertAuthoredProjectComplete` invariants verbatim from `lib/curriculum-quality/src/authoring.ts:206`.
- `docs/templates/project-template.md` — copy-paste fillable template, every field labeled REQUIRED / OPTIONAL.
- `docs/templates/project-publish-readiness-checklist.md` — 14 lettered binary gates (A–N). Distinguishes runtime gates (asserter, `audit:authoring`) from typecheck (static type only).
- `scripts/src/audit-project-authoring.ts` — READ-ONLY DB audit (exit 0 always). Distinct from `audit:pedagogy` — checks project-level shape, not per-step density. Checks: `fewer-than-four-steps`, `non-sequential-step-numbers`, `step-missing-instruction`, `step-missing-expected-outputs`, `step-missing-validation-type`, `all-steps-self-attest`, `hint-leak-suspected`, `meta-field-missing`. Findings deduplicated per project.
- `lib/curriculum-quality/src/authoringAudit.ts` — pure `hintLeakSuspected(pedagogy, expectedOutputs)` helper. Windowed substring match between L4/L5 hint text and stringified expectedOutputs, with a JSON-syntax-density false-positive guard. Extracted here (not in `@workspace/scripts`) so it can be unit-tested without adding vitest to scripts — matches audit:pedagogy precedent.
- `lib/curriculum-quality/src/authoringAudit.test.ts` — 8 unit cases covering: null/empty inputs, L4 leak, L5 leak, shape-only hint (no flag), JSON-syntax false-positive guard, very short hints, very long expectedOutputs window slicing.
- `docs/phases/phase-35-project-authoring-spec.md` — close-out.

**Modified files**

- `lib/curriculum-quality/src/index.ts` — exports `hintLeakSuspected`.
- `scripts/package.json` — adds `audit:authoring` npm script.
- `replit.md` — Phase History prepended with P35, P29 trimmed off the latest-5 window.
- `docs/phases/INDEX.md` — P35 entry appended.
- `HANDOFF.md` — this file.

**Unchanged:** every schema file, every migration, every backend route (incl. `/check`, `/submit`, cert-verify, portfolio, billing, AI tutor, hints, learner-mode, admin, dashboard, onboarding, enrollment), every frontend file (atlas + mockup-sandbox), OpenAPI spec, all codegen output, seed/content/rubric/anchor/wave files, deployment checklist, `assertAuthoredProjectComplete` itself, the 4-file no-heuristic allowlist. Deliverable E (parallel admin endpoint) deferred — `/api/admin/quality` already exposes lineage signals, and `audit:authoring` is the canonical surface.

---

## Strategy decisions

1. **Anchor on the existing `AuthoredProject` type.** Codifying the de-facto contract (rather than inventing a new one) means there can never be two contracts drifting apart. Every spec field cites its line in `lib/curriculum-quality/src/authoring.ts`.
2. **Project-level invariant promoted to a documented gate.** A project where every step is `self_attest` provides no real evidence for the portfolio / cert-verify surface. `audit:authoring` flags this as `all-steps-self-attest`; spec §5.1 + checklist §D document the invariant.
3. **`audit:authoring` is a reporting tool, not a CI gate** (exit 0 always). Distinct from `audit:pedagogy`, which is a hard 100%-visible gate. The two are complementary.
4. **`hintLeakSuspected` is a heuristic, explicitly labeled.** Cheap windowed substring match with JSON-syntax false-positive guard; can't catch semantic leaks. Real anti-leak guarantee lives in the publish-readiness checklist + human review.
5. **Heuristic lives in `lib/curriculum-quality`**, not in scripts, so it can be unit-tested without adding vitest to the scripts package (mirrors the audit:pedagogy precedent).
6. **Runtime vs typecheck explicitly distinguished.** `assertAuthoredProjectComplete` is a **runtime function** invoked by the promote flow; `pnpm run typecheck` validates the `AuthoredProject` static type only. Spec §13 and checklist §K + §L make this explicit — earlier drafts conflated them, which would have given authors false confidence in CI coverage. Architect caught this twice during fix-up.
7. **Deliverable E (admin endpoint) deferred** to avoid scope creep. `/api/admin/quality` already exposes lineage integrity; `audit:authoring` is the operator-facing surface.

---

## What the new audit finds today

54 of 56 visible projects are publish-ready. The 2 with gaps are exactly `csv-to-postgres-pipeline` and `dbt-data-models` — the pre-Phase-7 grandfathered originals listed in `GRANDFATHERED_CANDIDATE_FOR_SLUG`. They predate the `AuthoredProject` contract. Real signal, not false positives.

---

## Final gate summary (Phase 35)

| Gate | Result |
| ---- | ------ |
| `pnpm --filter @workspace/curriculum-quality run test` | **69/69** (8 new authoringAudit cases) |
| `pnpm --filter @workspace/execution-core run test` | **34/34** (unchanged) |
| `pnpm --filter @workspace/api-server run test` | **273/273** (unchanged) |
| `pnpm --filter @workspace/atlas run test` | **102/102** (unchanged) |
| `pnpm --filter @workspace/api-server run test:integration` | **3/3** (real-PG concurrency unchanged) |
| `pnpm run typecheck` | clean (libs build + 4 leaf packages) |
| `pnpm run check:no-heuristic-runtime` | OK — 4-file allowlist unchanged |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | **56/56 visible** (unchanged) |
| `pnpm --filter @workspace/scripts run audit:authoring` (NEW) | 54/56 visible publish-ready; 2 grandfathered slugs flagged |
| Architect review | **PASS** after 3 fix-up rounds (portfolio.kind enum; validation.spec rename; runtime-vs-typecheck; all-steps-self-attest spec/code alignment) |

## Hard-rule re-verification

- Schema / migration changes: **none**.
- `/check`, `/submit`, cert-verify, portfolio, billing, deployment, Stripe, OpenAPI codegen: **untouched**.
- `learner_visible = TRUE` filter on learner-facing routes: **unchanged** (404-not-403 privacy intact).
- Bidirectional candidate ↔ project lineage: **untouched**.
- RUBRIC_VERSION='1.0.1': **frozen**.
- 4-file no-heuristic allowlist: **not expanded**.
- AI tutor prompt, hint policy, learner-mode endpoints: **untouched**.
- 9 Atlas courses + "Atlas is a project-based learning platform for Data Engineering" framing: **unchanged**.

## Untracked scratch

- `attached_assets/Pasted-*.txt` from prior sessions remain untracked. **Do not commit.**

## Known follow-ups (Phase 36 candidates)

- Upgrade `csv-to-postgres-pipeline` + `dbt-data-models` to the modern `AuthoredProject` shape, or archive (`learner_visible=false`) + replace with new authored equivalents. These are the only 2 visible slugs not currently publish-ready by the Phase 35 contract.
- Optional: admin UI surface for `audit:authoring` output (deferred deliverable E).
- Optional: extend `hintLeakSuspected` with an embedding-based semantic check.
- Author 1–2 net-new projects using the new spec end-to-end as a paved-path smoke test.
- Phase 34 follow-ups still open: surface `mode-usage` in admin UI; add `evt:'ai.tutor.response'` log; structured-log → time-series for `mode_usage_daily`; aggregate `hint.escalate` into per-step difficulty signal.
