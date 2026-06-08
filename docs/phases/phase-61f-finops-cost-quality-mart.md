# Phase 61F — Author Cloud FinOps cost-quality mart (close-out)

**Status:** SHIPPED. Authored ONE net-new intermediate **Cloud-Data-Engineer**
project — `cloud-data-engineer-finops-cost-quality-mart` — creating **6 fresh DARK
rowset candidates** (5 `sql_resultset` + 1 `csv_set_equal`, ALL `serverGrade:false`)
plus 1 `contains` runbook, each **real-browser DuckDB-WASM byte-verified**. This
expands future server-grade rowset supply into a THIRD discipline (beyond C2 +
the SaaS mart). **The live serverGrade count is UNCHANGED at 10** (sql 8 + csv 2).
**No serverGrade flip, no comparator/validation-kind/envelope/Phase-52/schema
change.** Reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer` →
SHIP** (§ below).

---

## 1. Baseline preflight (before authoring)

`check:db-baseline` **OK**; global serverGrade **sql 8 + csv 2 = 10**; C2 + SaaS
Mart both `learner_visible` + `approved`; integration not env-blocked; working
tree clean + pushed. Authored only on a green baseline.

## 2. The project

`cloud-data-engineer-finops-cost-quality-mart` (course `cloud-data-engineer`,
intermediate). 7 steps: raw daily cloud billing exports → dedupe (latest-load-wins)
→ clean (positive cost) → normalize environment + allocate to teams → surface
untagged/unallocated spend → cost-quality audit → FinOps runbook. Fully
DuckDB-WASM-native over 3 committed CSV fixtures; **no AWS/Azure/GCP calls, no
SDKs, no credentials, no network**. Money modelled in **integer cents**; every SUM
is `cast(... as bigint)` (proactively avoids the Phase 61C HUGEINT→string class).
Promote → `audit --commit` → **qualityScore 79.1, status approved, visible**.

> **Slug note:** the brief recommended `cloud-data-engineering-…`; the repo's
> 9-course taxonomy uses the course slug `cloud-data-engineer` and existing cloud
> projects are slugged `cloud-data-engineer-*`. Used `cloud-data-engineer-finops-
> cost-quality-mart` for consistency with that convention + the "9 courses exactly"
> invariant.

## 3. Dataset + fixtures

`artifacts/atlas/public/datasets/finops-cost-mart/`:
- `raw_cloud_billing.csv` (15 rows) — duplicate resource-day loads (3 dup groups),
  missing team tags, mixed env labels (prod/Prod/PROD/Production, dev/Dev,
  staging/Staging), an unknown account (A-999, anomalous 99000-cent row), and 2
  invalid-cost rows (negative + zero).
- `account_owners.csv` (4 accounts → owner_team + business_unit).
- `service_catalog.csv` (5 services → family + criticality).

All deterministic, integer cents, dateable-by-string timestamps (no tz ambiguity).

## 4. Step flow

1. **Dedupe** (latest-load-wins on account+service+resource+date) — `sql` —
   `[[12,8]]`.
2. **Normalize environment** — `sql` — `[[dev,2],[prod,7],[staging,1]]`.
3. **Daily service spend mart** (integer cents) — `sql` —
   `[[cloudfront,99000],[ec2,24300],[lambda,1050],[rds,16200],[s3,7800]]`.
4. **Team allocation mart** — `csv_set_equal` —
   `[[data,6200],[ml,16200],[platform,25900],[web,1050]]`.
5. **Untagged + unallocated spend** — `sql` —
   `[[unallocated_account_cents,99000],[untagged_cents,16200],[untagged_rows,2]]`.
6. **Cost-quality audit (CI gate)** — `sql` —
   `[[dup_resource_day_loads,3],[invalid_cost_rows,2],[unknown_account_rows,1],[untagged_rows,2]]`.
7. **FinOps runbook** — `contains` (names the 4 checks + "latest load wins" +
   "cost quality").

## 5. Dark rowset candidate inventory

6 rowset candidates, ALL `serverGrade:false` (dark): steps 1,2,3,5,6 `sql_resultset`
+ step 4 `csv_set_equal`. Step 7 `contains`. The `check:authored-finops-mart` pins
`darkCount === 6`, `liveCount === 0`. The DB confirms every rowset row's
`serverGrade=false`. 61F flips nothing live.

## 6. Browser-WASM verification

Real Chromium (playwright-cli) · real atlas Vite (Node 24) · real
`@/lib/duckdb/duckdbRunner` `duckdbAdapter` (`@duckdb/duckdb-wasm@1.33.1-dev45.0`)
+ `normalizeSqlRows` · committed seed CSVs · queries extracted from the authored
file · the exact FE capture→submit transform. **All 6 byte-matched** the committed
`columns`/`expectedRows`:

| Step | kind | cell types | byteMatch |
|---|---|---|---|
| 1 | sql | number,number | ✅ |
| 2 | sql | string,number ×3 | ✅ |
| 3 | sql | string,**number** ×5 | ✅ |
| 4 | csv | string,number ×4 | ✅ |
| 5 | sql | string,**number** ×3 | ✅ |
| 6 | sql | string,number ×4 | ✅ |

**Steps 3 + 5 cent totals are `number`, not the HUGEINT→string surprise** —
because every SUM is `cast(... as bigint)` (BIGINT → lossless Number in the
adapter). Harness deleted after capture. Even though all 6 byte-match, they stay
DARK (the brief: keep every rowset dark even if it byte-matches).

## 7. Type-stability decisions

Money is **integer cents** (no decimal dollars → no float/tolerance). Every SUM is
`cast(... as bigint)` so the WASM capture is a lossless Number rather than a
HUGEINT string. Counts are `count(*)`/`count(distinct)` → BIGINT → Number.
Categorical outputs are exact normalized strings (env labels, team labels, check
names, metric names). Timestamps are ordered via `cast(load_timestamp as
timestamp)` but never returned. Every multi-row query has a deterministic `ORDER
BY`. `check:authored-finops-mart` asserts every `expectedRows` cell is an integer
or string (no floats).

## 8. No-leak + evidence honesty

The 6 rowset rows are dark (`serverGrade:false`) → the project projection emits
`serverGrade:false`; no `validationConfig`/`spec`/`expectedRows`/`query` reaches
the client (projection unchanged). `check:authored-finops-mart` additionally
asserts no distinctive `expectedRows` cent-total appears verbatim in any
learner-facing instruction/hint. Learner copy never claims the server
verifies/re-grades these dark steps, and carries no authorship/tamper/cheat/job/
certification claims (H3 scan = none).

## 9. ServerGrade count (before / after)

Unchanged: **sql_resultset 8 + csv_set_equal 2 = 10** before AND after 61F
(DB-confirmed; `check:db-baseline` green). The 6 new finops rowset rows are dark →
they add to candidate SUPPLY, not to the live count.

## 10. DB baseline postflight

`check:db-baseline` **OK** (3/3 migrations, required tables, C2 + Mart
visible/approved with their server-graded sets, global = 10). Integration **4/4**.
serverGrade count = 10.

## 11. Export-stack compatibility

Export assembly unchanged (no export-code edit). api-server **648/648** (incl.
export-unit + `portfolioZip` ZIP-validity) + integration **4/4** (the `/submit`
snapshot round-trip) green with the new project in the DB. Portfolio artifact /
repository JSON / repository ZIP routes assemble from the same unchanged path; the
new project's dark steps classify as non-server-graded, leak-free. No new learner
completion seeded (no snapshot created), so no live finops ZIP — the unit +
integration coverage stands in.

## 12. Gates (Node 24.16.0 + Docker PG :5434)

typecheck (4) + check:no-heuristic **OK** · check:boot **OK** · check:db-baseline
**OK (10)** · **check:authored-finops-mart OK (6 dark)** · check:authored-saas-mart
**OK** · audit:sql-resultset-bc **PASS** (8 opted-in + **6 dark byte-identical to
legacy**, 0 fail) · audit:csv-set-equal-bc **PASS** (2 opted-in + 1 dark) ·
audit:contains-bc **PASS** (5/5) · audit:authoring **finops ✓ publish-ready** ·
audit:pedagogy **finops ✓ fully enriched** · audit:quality finops **79.1 approved**
· api-server **648/648** · atlas **170/170** · integration **4/4**.

## 13. Reviews

- **atlas-architect-reviewer → PASS** — _(recorded at close.)_
- **code-reviewer → SHIP** — _(recorded at close.)_

## 14. Invariants

Live serverGrade **= 10** (unchanged); only sql_resultset/csv_set_equal/contains
kinds used; comparator byte-unchanged; envelope OFF; Phase 52 untouched; **no
schema/migration**; RUBRIC frozen; archive=hide; C2 + Mart unchanged; 9-course
taxonomy respected (`cloud-data-engineer`); additive-only registry edits. **Phase
61G not started.**

## 15. Remaining / next

- 6 new dark finops candidates are ready for a FUTURE controlled flip (re-verify
  in-browser at flip time per the established gate).
- `.gitattributes` CRLF follow-up standing.
- Phase 61G (owner-gated): next density / authoring / flip work.
