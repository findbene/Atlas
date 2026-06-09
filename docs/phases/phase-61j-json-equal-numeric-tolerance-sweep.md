# Phase 61J — json_equal + numeric_tolerance validation contract + catalog-wide downgrade sweep (close-out)

**Status:** SHIPPED (pending the two review verdicts in §28). Closes the last two
catalog-wide validation dead-gate families from the 61I close-out: `json_equal`
and `numeric_tolerance`. Both had NO commit-path runtime branch → they fell
through to the generic auto-pass (silent dead gates). 61J (1) gives each kind a
real, fail-closed commit-path contract reading `validationConfig.spec`, (2) adds
strict authoring guards + extends the catalog audit, and (3) converts **every**
authored json_equal/numeric_tolerance step to honest `self_attest` — because the
platform's submission for these steps is the learner's editor **code**, which
neither comparator can grade. The contracts ship built + tested but unexercised
(the 61I exact precedent), ready for a future genuine paste-the-answer step.

**No `serverGrade` flip (live count stays 10), no `sql_resultset` /
`csv_set_equal` comparator change, no schema/migration, and — critically — NO
Phase-48/52 envelope/canary change (`envelopeGrade.ts` is byte-frozen).**

---

## 1. Baseline preflight
Branch `main`; 61I tip `89a38c5`. `check:db-baseline` OK; serverGrade `sql` 8 +
`csv` 2 = **10**; C2 + SaaS + FinOps visible+approved; DB census **0 visible**
json_equal/numeric_tolerance/exact/regex steps (all un-promoted → latent
hardening, no live behavior change).

## 2. json_equal root cause (§13)
`gradeSubmission` had no `json_equal` case → json_equal fell through to the
generic `{passed:true,"Step completed."}` auto-pass (a dead gate). The
Phase-48/52 ENVELOPE comparator (`envelopeGrade.ts`) DOES deep-equal json_equal,
but it reads the `expected_output` text column (never populated by promote), is
gated by the empty `ATLAS_ENVELOPE_REQUIRED_KINDS`, and is operator-pending — so
it never grades in prod and is out of scope here (byte-frozen).

## 3. json_equal shape inventory (§14)
49 authored files use json_equal. Dominant shape `{ expected: <object> }` where
the expected mixes exact ints/bools/strings, `*_approx` floats, behavioral
booleans, and per-scenario `cases`; plus bespoke `{assertLength, mockedScores,
expectStatus, …}` keys the runtime never reads. 0 visible json_equal steps.

## 4. json_equal contract fix (§15)
Canonical authored shape `validationConfig("json_equal", …, { expected: <json> })`.
Runtime (`grading.ts`): parse the submission as JSON, **deep-compare** vs
`spec.expected` (object key order insignificant, array order significant, numbers
exact). **Fails CLOSED** when `spec.expected` is absent or the submission is not
valid JSON / empty. Reads `spec.expected` (NOT `expected_output`) so the envelope
canary is untouched. A local `deepEqualJson` copy keeps `envelopeGrade.ts`
byte-frozen. Authoring guard `assertValidJsonEqualSpec`: require `expected`
present; allowlist `{expected}` only.

## 5. json_equal known-bad proof (§16)
`grading.test.ts` (+ via the real `gradeSubmission`): matching JSON passes
(key-order-insensitive); wrong value fails; array reorder fails; non-JSON
submission fails closed; empty fails closed; missing `spec.expected` fails closed;
legacy top-level `{expected}` works. All fail on pre-61J code (no branch →
auto-pass).

## 6. numeric_tolerance root cause (§17)
No `numeric_tolerance` case in `gradeSubmission` (and none anywhere) → fell
through to the generic auto-pass (dead gate).

## 7. numeric_tolerance shape inventory (§18)
21 authored files. Dominant `{ expected: <object of numbers>, tolerance: <scalar> }`
with **mixed ≥/≤/≈ threshold semantics** (e.g. `{recall:0.78, mrr:0.62}, tol:0.02`),
plus bespoke `{toleranceFraction, expectedUniques, floors, speedupRatio, …}`. A
symmetric ± band cannot honestly express a threshold or a multi-field object. 0
visible numeric_tolerance steps.

## 8. numeric_tolerance contract fix (§19)
Canonical `validationConfig("numeric_tolerance", …, { expected: <number>,
tolerance: <number> })` (SCALAR). Runtime: parse the submission as one number,
pass iff `|n − expected| ≤ tolerance`. **Fails CLOSED** on missing/non-finite
expected, missing/non-finite/negative tolerance, or non-numeric submission.
Reads `spec`. Guard `assertValidNumericToleranceSpec`: require finite numeric
`expected` + finite non-negative numeric `tolerance`; allowlist `{expected,
tolerance}` only (rejects multi-field objects / `floors` / bespoke keys).

## 9. numeric_tolerance known-bad proof (§20)
`grading.test.ts`: in-tolerance passes; boundary (|Δ|==tol) passes;
out-of-tolerance fails; non-numeric fails; empty fails; missing expected fails
closed; missing/negative tolerance fails closed. All fail on pre-61J code.

## 10. Catalog sweep result (§21)
**ALL authored json_equal + numeric_tolerance steps → `self_attest`. 0 remain**
(grep-verified). Two passes: (a) an initial discipline-by-shape sweep (8 parallel
Sonnet workers across 52 files) downgraded the bespoke/multi-field/approx/threshold
majority; (b) a correction pass (3 workers, 16 files, 38 steps) downgraded the
remainder — including the ~30 steps an early pass had "kept" as integer-exact
json_equal and 2 scalar numeric_tolerance — once the submission model was
confirmed (§11). Honest self_attest copy + non-empty `attestationCriteria` on
every converted step; Opus reviewed the worker reports.

## 11. Promotion / runtime mapping result (§22) — the pivotal finding
json_equal/numeric_tolerance read `validationConfig.spec`, which `promote` already
persists, so **no promote mapping change was needed** (unlike 61I exact). And the
decisive fact: the FE submits the learner's **editor code** for these steps —
`artifacts/atlas/src/pages/project-workspace.tsx:675-694`
(`decideCsvSetEqualSubmission` returns the raw editor contents for everything
except `csv_set_equal` serverGrade SQL rows), corroborated by 61I's contains
needles matching code substrings. So `JSON.parse(code)` / `Number(code)` can never
match a `spec.expected` for a code step → keeping ANY json_equal/numeric_tolerance
on the current catalog would be a *broken* gate (fail-everyone), not auto-pass.
Hence the all-to-self_attest downgrade: it is faithful to "keep only where
genuinely gradeable" — none are, on the real submission model. The contracts +
guards + audit + tests remain as the built-but-unexercised forward path for a
future paste-the-answer (writeup) step.

## 12. Copy / honesty cleanup (§23)
Converted steps use the honest self_attest line ("a learner attestation — Atlas
does not run your code or grade this; verify it yourself against the criteria").
Workers additionally repaired false prose ("verified via numeric_tolerance",
"Validator: …", "Every step is verified set-equal") in several files. No
server-enforced / verified / tamper-proof / cheat-proof / job-ready / certified
claim introduced. `check:authored-c2`/`-saas`/`-finops` green.

## 13. Phase 52 / canary non-drift verification (§24)
`envelopeGrade.ts` is **byte-unchanged** (git diff shows no edit);
`PILOT_RUNTIME_KINDS = {json_equal}` and `ATLAS_ENVELOPE_REQUIRED_KINDS` (empty)
untouched; `expected_output` is NOT populated for json_equal (so the canary's
authoring-gap → fallback posture, when activated, is unchanged). The only
interaction: envelopeGrade's authoring-gap fallback delegates to `gradeSubmission`,
which now has a json_equal branch — but the envelope path is gated OFF and
operator-pending, so production behavior is unchanged today. Documented for the
operator; flagged for the architect.

## 14. ServerGrade count before/after (§25)
Unchanged: `sql_resultset` 8 + `csv_set_equal` 2 = **10** (DB-confirmed). json_equal
/ numeric_tolerance / self_attest are not serverGrade kinds; no flip; C2 set
`[1,2,3,5]`; no rowset/comparator drift.

## 15. Contains / exact / regex regression (§26)
61G `audit:contains-bc` 6/6; 61H `audit:exact-bc` PASS; 61I `audit:validation-keys`
0 violations (now also covers json_equal/numeric_tolerance). The contains/exact/
regex/rowset runtime branches are byte-untouched.

## 16. Export / no-leak (§27)
Runtime changes are server-side in `gradeSubmission`; projection unchanged. 0
authored json_equal/numeric_tolerance steps → no spec.expected leak surface; the
deep-equal feedback echoes the configured expected only for a kept json_equal step
(there are none). Export stack: api-server 677/677 (incl. export-unit +
portfolioZip) + integration 4/4.

## 17. Gates (Node 24 + Docker PG :5434)
typecheck(4)+no-heuristic · **api-server 677/677** (+15) · **atlas 170/170** ·
**integration 4/4** · curriculum-quality 190/191 (the 1 failure is the
pre-existing env-only `.local/course-skill-maps.md`, untouched by 61J) ·
**audit:validation-keys 0** · audit:contains-bc 6/6 · audit:exact-bc PASS ·
audit:sql-resultset-bc + csv-set-equal-bc no drift · check:authored-{c2 [1,2,3,5],
saas,finops} · check:db-baseline **serverGrade=10** · audit:authoring + pedagogy
exit 0. (`check:boot` is not a script in this workspace.)

## 18. Commits
Sweep + correction + tests bulk in pushed session wips `174d434`..`91cc449`; the
runtime/guards residual + audit message in `21626ff`. Close-out + mini-report
archive follow.

## 19. Independent reviews (§28)
- **atlas-architect-reviewer → _pending_**.
- **code-reviewer → _pending_**.

## 20. Tracked follow-ups / remaining risk (§29)
- The json_equal/numeric_tolerance contracts are **unexercised** — a future
  writeup step that genuinely asks the learner to paste a JSON value or a single
  number can use them (and would enforce). The audit + guards prevent a bespoke
  one from shipping.
- The catalog's enforcement now leans heavily on `self_attest` for code_python
  steps — honest, but a reminder that real code grading needs a Pyodide/execution
  harness (a future "runtime-grade learner code" epic), not a thin comparator.
- `.gitattributes` EOL-normalize (recurring CRLF churn, P2).

## 21. Invariants
serverGrade **= 10**; json_equal + numeric_tolerance now fail-closed + authorable;
0 authored json_equal/numeric_tolerance steps; `envelopeGrade.ts` + Phase-52
canary byte-frozen; `matchContains` + exact + regex + rowset comparators
unchanged; no schema/migration; RUBRIC frozen; C2 + SaaS + FinOps visible+approved;
61G/61H/61I regressions green. **Next phase not started.**
