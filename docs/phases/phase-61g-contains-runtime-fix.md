# Phase 61G — Contains runtime contract fix + live honesty cleanup (close-out)

**Status:** SHIPPED. Fixed the `contains` validation runtime dead-gate (the
defect Phase 61F surfaced), converted the two LIVE affected projects (C2 + SaaS
mart) from the dead `mustContainAll` shape to the canonical `needles` shape,
removed the false "server-enforced" copy, and proved enforcement with new unit
tests + a rewritten enforcement audit. **No `serverGrade` flip (live count stays
10), no sql_resultset/csv_set_equal comparator change, no envelope, no Phase 52,
no schema/migration.** Reviews: **`atlas-architect-reviewer` → PASS** +
**`code-reviewer` → SHIP** (§ below).

---

## 1. Baseline preflight
`check:db-baseline` OK; serverGrade sql 8 + csv 2 = 10; C2 + SaaS + FinOps
visible+approved; integration 4/4; tree clean + pushed. Changed code only on a
green baseline.

## 2. Contains defect root cause (§13)
The `contains` runtime branch (`grading.ts:104-105`) passed the **WRAPPED**
`step.validationConfig` (`{kind, spec, description}`) to `matchContains`, which
reads the matcher fields off the **top level** (`needle`/`needles`, line 210/215).
The authored fields live under `spec`, so they were never read; with no
`expected_output`, `matchContains` falls to its legacy `needle = expectedOutput
?? ""` branch → `submission.includes("")` → **auto-passes ANY submission**. The
csv/sql branches already pass `cfg.spec`; only the contains (and the latent
`regex`) branch did not. Additionally, the authored key `mustContainAll` is **not
a key `matchContains` reads** (it reads `needle`/`needles`) — so those steps were
doubly dead.

## 3. Existing contains shape inventory (§14)
4 VISIBLE contains steps before 61G:
| Project · step | Shape | Pre-61G behavior |
|---|---|---|
| C2 (`analytics-engineer-semantic-layer…`) s7 | wrapped `{spec:{mustContainAll:[6]}}` | DEAD (auto-pass) |
| SaaS mart s7 | wrapped `{spec:{mustContainAll:[5]}}` | DEAD (auto-pass) + false "server-enforced" copy |
| csv-to-postgres-pipeline s4 | top-level `{needle:"copy_expert"}` (legacy seed) | WORKS |
| dbt-data-models s2 | top-level `{needle:"GROUP BY"}` (legacy seed) | WORKS |

Both shapes are preserved by the fix (see §4). **Broader discovery (tracked
follow-up, NOT fixed here):** ~15 *authored* (mostly un-promoted) projects use
OTHER bespoke contains keys the runtime also ignores (`mustContain`,
`userMsgMustContain`, `reportMustContain`, `expected`, …) — catalog-wide dead
gates. A hard authoring reject of all unrecognized keys breaks importing the
authored index, so 61G rejects only the named `mustContainAll` alias and
documents the rest for a content sweep (§11).

## 4. Runtime contract fix (§15)
`grading.ts` contains branch now extracts the inner spec, BC-safe:
```ts
const cfg = step.validationConfig as { spec?: unknown };
const containsSpec = cfg.spec && typeof cfg.spec === "object" ? cfg.spec : step.validationConfig;
return matchContains(containsSpec, submission, expected);
```
- Wrapped `{kind, spec:{…}, description}` → reads `spec` (the authored shape).
- Legacy top-level `{needle}` (the live seed steps) → no `.spec` → uses the config
  itself → **unchanged**.
`matchContains` is byte-unchanged. Authoring (`authoring.ts`
`assertValidContainsSpec`) now **rejects the `mustContainAll` alias** at
construction time (pointing authors to `needles`); other bespoke keys are
tolerated (a hard reject would break the index import) and surfaced by the audit.

## 5. Known-bad submission proof (§16)
`audit:contains-bc` was rewritten from a "BC-vs-auto-pass" audit (whose premise
the fix invalidates) into an **enforcement audit** that drives every visible
contains step through the REAL `gradeSubmission`:
```
=== Phase 61G — contains ENFORCEMENT audit ===
Visible contains steps: 4 · Marker-enforcing steps: 4 / 4 · Assertions: 21 · Failures: 0
PASS — a complete submission passes; an empty submission and dropping ANY single
required marker fail closed.
```
Plus 6 new `grading.test.ts` unit tests (api-server **654/654**, +6): wrapped
`needles` enforces (all present → pass; missing marker → fail w/ the marker in
feedback; empty → fail; garbage → fail); wrapped single `needle`; and the legacy
top-level `{needle}` BC.

## 6. C2 copy / honesty cleanup (§17)
C2 s7 `mustContainAll`→`needles` (6 markers: the stakeholder section headers +
the 3 named exposures). C2 s7 copy was already honest (it disclosed the "thin
needle-substring check" + "the substantive value is that you wrote it") — updated
to reflect it now genuinely checks the required markers, with explicit "confirms
the markers are present, not that your prose is complete or expert-level, and
Atlas does not verify independent authorship or professional competence." Promote
→ **85.3 approved**. Server-graded rowset set unchanged `[1,2,3,5]`
(`check:authored-c2` pins it).

> **Separate C2 defect (tracked, NOT fixed here):** C2's `exact` steps 4 + 6 have
> `expected_output = NULL` → the `exact` runtime (`grading.ts:99` `&& expected`)
> skips → auto-pass; their copy claims "the server commit-grader does an
> exact-match check." Same dead-gate class as contains, but in the `exact` kind —
> out of 61G's "narrowly fix contains" scope. Documented in §11 for the follow-up.

## 7. SaaS mart copy / honesty cleanup (§18)
SaaS s7 `mustContainAll`→`needles` (5 markers). **Removed the false** "This is
server-enforced (the commit-grader evaluates your submission body)" sentence →
honest "Atlas checks the runbook for the required marker phrases … This confirms
the markers are present, not that your prose is complete or expert-level, and
Atlas does not verify independent authorship or professional competence." Promote
→ **80.6 approved** (was 81.4 — the honest copy scores marginally lower).
`check:authored-saas-mart` now pins the `needles` shape + a false-enforcement
guard (deliberately NOT scanning the honest live-rowset "server re-grades" copy).

## 8. FinOps self-attest regression (§19)
FinOps step 7 remains `self_attest` (unchanged by 61G); `check:authored-finops-mart`
green (6 dark + 1 self_attest + 0 contains + no false-enforcement). No re-promote
needed.

## 9. ServerGrade count before/after (§20)
Unchanged: **sql_resultset 8 + csv_set_equal 2 = 10** before AND after
(DB-confirmed). The contains fix does not touch `serverGrade` (contains is not a
serverGrade kind). No accidental flips; no rowset/comparator drift
(`audit:sql-resultset-bc` 8 opted + 6 dark, `audit:csv-set-equal-bc` 2 opted + 1
dark — both unchanged).

## 10. No-leak + export stack (§21)
The fix is entirely in `gradeSubmission` (server-side grading). The project
projection (`routes/projects.ts`) is unchanged — no `spec`/`needles`/`expectedRows`
reaches the client. Contains-failure feedback names only a missing **required
marker**, which is a learner-facing requirement stated in the instruction (the
exposure/check names) — not a computed answer key. Export assembly unchanged:
api-server **654/654** (incl. export-unit + portfolioZip) + integration **4/4**
green; `/check` + `/submit` now enforce contains via the same fixed path.

## 11. Tracked follow-ups (NOT fixed in 61G — scope discipline)
1. **Catalog-wide bespoke-key contains:** ~15 authored (mostly un-promoted)
   projects use `mustContain`/`userMsgMustContain`/`reportMustContain`/`expected`
   etc. — dead gates. Convert each to canonical `needles` (a content sweep) +
   then a hard authoring reject of all unrecognized keys becomes feasible.
2. **`exact` dead-gate:** authored `exact` steps with `expected_output = NULL`
   (e.g. C2 steps 4, 6) auto-pass while claiming an "exact-match check." The
   `exact` runtime needs the same spec-extraction-or-population fix + copy
   cleanup. Same class as contains; deferred to keep 61G narrow.
3. **`regex`** branch has the identical wrapper bug (latent — 0 live regex steps).

## 12. Gates (Node 24 + Docker PG :5434)
typecheck(4)+no-heuristic · check:boot · check:db-baseline (10) · check:authored-c2
(needles, no false claim, set [1,2,3,5]) · check:authored-saas-mart (needles +
false-enforcement guard) · check:authored-finops-mart · **audit:contains-bc
ENFORCEMENT PASS (4/4, 21 assertions, 0 fail)** · audit:sql-resultset-bc PASS (8
opted + 6 dark) · audit:csv-set-equal-bc PASS (2 + 1 dark) · audit:authoring (C2
85.3 + SaaS 80.6 + FinOps publish-ready) · audit:pedagogy (C2 + SaaS enriched) ·
api-server **654/654** · atlas **170/170** · integration **4/4**.

## 13. Reviews
- **atlas-architect-reviewer → PASS** (0 P0/P1). Independently reproduced the
  dead-gate on the old contract (garbage + empty → `passed:true`), confirmed the
  fix is a single one-line→13-line hunk in the contains branch only
  (`matchContains`/`gradeCsvSetEqual`/`gradeSqlResultset` byte-unchanged), BC for
  all 4 live contains steps (DB-verified the 2 legacy seed steps have no `.spec`),
  enforcement audit 4/4, serverGrade=10, copy honest, no leak, scope defensible.
  - **P2 (ADDRESSED):** the `mustContainAll` reject had no direct unit test —
    added 2 cases to `authoring.test.ts` (rejects `{mustContainAll}`, accepts
    `{needles}`); authoring suite 59/59.
  - **P2 (noted):** pre-existing `COURSE_TAXONOMY.test.ts` ENOENT on a gitignored
    `.local` file (unrelated to 61G; owner to confirm in CI). Latent benign
    fallback edge (`spec:[]`) — fails closed, note for the regex/exact follow-up.
- **code-reviewer → SHIP** (0 P0/P1). Verified root cause, BC-safe extraction,
  enforcement proven by the real grader (not just asserted), honest copy, zero
  drift (serverGrade/sql/csv/Phase-52/envelope/schema), guard scoped to
  `mustContainAll` only.
  - **P2 (prioritize next):** the C2 `exact` steps 4 + 6 remain dead gates
    (`expected_output NULL` → auto-pass) with inaccurate "exact-match check" copy —
    live, learner-facing; the highest-priority follow-up (§11.2).
  - **P2 (noted):** latent `regex` wrapper bug (0 live, §11.3); catalog-wide
    bespoke-key contains content sweep (§11.1).

## 14. Invariants
Live serverGrade **= 10** (unchanged); `matchContains` byte-unchanged; only the
contains spec-EXTRACTION fixed; sql/csv comparators byte-unchanged; envelope OFF;
Phase 52 untouched; no schema/migration; RUBRIC frozen; C2 + SaaS + FinOps
visible+approved; no rowset behavior drift; no leak. **Phase 61H not started.**
