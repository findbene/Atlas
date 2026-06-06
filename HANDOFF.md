# Session Handoff — Atlas (rich; written pre-compact 2026-06-06)

> Fresh session can continue from this file alone. Then read `.agentic/progress.md` (canonical live
> state), `docs/phases/INDEX.md`, `CLAUDE.md`. **This file is auto-clobbered by the session-end hook
> into a thin git-only summary** — the durable record is `.agentic/progress.md` + `docs/phases/*.md` + git.
>
> **Workflow:** ChatGPT directs on the owner's behalf → Claude Code is sole coder. In ChatGPT prompts
> "Replit" = Claude Code. In repo docs, "Replit" = the legacy build platform/connectors (Phase 0.2 target).
> **After every ChatGPT-requested task, return the 12-section Claude Code Mini-Report** (memory:
> `atlas-chatgpt-mini-report`). Verify ChatGPT handoff claims against the repo (it has drifted +1 phase twice).

---

## 1. The goal we're working towards

Finish + surpass the interrupted 57-phase build → shippable private beta. Atlas = project-based learning
PWA, zero→job-ready across **9 courses** (data-engineering, ai-engineer, mlops-engineer, data-scientist,
analytics-engineer, applied-llm-engineer, cloud-data-engineer, python-libraries, sql). Roadmap = 8 epics
E0–E7 in `.agentic/plan.md`. Catalog target **900–1000 premium projects** (~120/discipline); ~60 today.
**Harden validation first, project waves later** (hidden-first, never direct-publish). H3 honesty boundary
is law (never claim verified-authorship / tamper-proof / cheat-proof / job-guaranteed).

**Immediate arc:** ship `csv_set_equal` server-grading safely. 57C decided Option C (staged hybrid).
57B-prereq built the dark foundation. 0.x/0.y attacked the local-green baseline needed before the flip.

## 2. Current state of the code

- **Last shipped: Phase 57B-prereq (DARK).** `serverGrade` boolean on GET /projects/:slug; FE helper
  `csvSetEqualSubmit.ts`; per-step DuckDB capture in `project-workspace.tsx` (run-gen guarded, normalized,
  cleared on edit/reset/history/nav); dark `csv_set_equal` branch in `envelopeGrade.ts`; shared
  `normalizeSqlRows`; extended `audit:csv-set-equal-bc`. Architect PASS + code-review SHIP-ready.
- **`serverGrade=false` for ALL rows; 0 visible csv_set_equal steps** (the C2 project that uses it is a
  **hidden candidate**, not promoted). `csv_set_equal` NOT in `PILOT_RUNTIME_KINDS` nor
  `ATLAS_ENVELOPE_REQUIRED_KINDS`. Fully dark — verified byte-identical to `6c26cd2`.
- **Gates (Node 22 + local node_modules):** typecheck PASS · atlas 159/159 · api-server 440
  (envelopeGrade 28/28) · execution-core 83/83. **DB audits GREEN** via local Docker PG (this session):
  `csv-set-equal-bc` PASS (0 visible rows) · `contains-bc` PASS 2/2, 14 subs, 0 mismatch · `authoring`
  exit 0 (92 visible steps = 90 self_attest + 2 contains).
- **Node:** system Node **22.17.1** at `C:\Program Files\nodejs` (real dir, not nvm symlink). Node
  **24.16.0** installed via nvm at `C:\Users\findb\AppData\Local\nvm\v24.16.0`; activate **shell-scoped**
  by prepending that dir to `$env:PATH` (no `nvm use`, no admin, no clobber). pnpm 9.15.0.
- **Lockfile NOT frozen-clean.** `pnpm-workspace.yaml` `overrides:` expanded but `pnpm-lock.yaml`
  `overrides:` is a stale subset → `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. `pnpm install --lockfile-only`
  reconciles (+1188/−94) but it's **Linux/CI-targeted** (prune keeps only `linux-x64`) → must be
  regenerated + committed on **Linux/CI/WSL**, not Windows. Repo lockfile currently unchanged.
- **Local Docker Postgres** `atlas-pg` (postgres:16, port **5434**, throwaway `postgres:postgres`) is up +
  migrated + seeded. Ephemeral — `docker rm -f atlas-pg` to tear down (loses DB → re-seed needed).
  `DATABASE_URL` set in-shell only, never committed. No persistent `.env`.
- **`.env` now gitignored** (+ `!.env.example` template committed `f3256e1`). Still Replit-platform-coupled
  (blocks `pnpm dev` boot; Phase 0.2 decouples). Git: branch `main`, HEAD `8e8f6aa`, pushed.

## 3. Files actively editing

- **None mid-edit.** Last writes (all committed + pushed): `docs/phases/phase-0y-c2-fixture-repair-proposal.md`
  (NEW, the read-only C2 proposal), `.agentic/progress.md` (0.x + 0.y logs), `.gitignore` + `.env.example`
  (env setup), `CLAUDE.md` (status). 57B-prereq code (8 files) shipped earlier.
- **NOT to edit without approval:** any authored project (esp. `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts`),
  any fixture, any `expectedRows`, `pnpm-lock.yaml`, the Phase 52 canary.

## 4. Everything tried that failed / gotchas

1. **ChatGPT handoffs overstate progress (+1 phase, twice).** Always verify claims vs repo first.
2. **`serverGrade:true` flip is blocked at 3 layers** (discovered 0.y): (i) C2 is a hidden candidate
   (0 visible csv_set_equal); (ii) input fixtures absent + datasetRef double-`.csv` bug; (iii) C2's
   validation queries target dbt models (`mart_subscription_monthly`, `stg_*`) the DuckDB-WASM sandbox
   never builds, and the hand-authored expected values are internally inconsistent (step 5 says $5,847,
   its own breakdown = $3,891). See `docs/phases/phase-0y-c2-fixture-repair-proposal.md`.
3. **Missing C2 fixtures:** `public/datasets/` has only `orders.csv` (wrong shape for C2). Needs
   `seeds/{customers,subscriptions,orders}.csv`. DuckDB-WASM resolves `datasetUrl(ref)=datasets/<ref>.csv`.
4. **Lockfile mismatch** (above) — do NOT regen+commit from Windows.
5. **Node 24 `nvm use` is unsafe** (system Node is a real dir; needs admin, would clobber) → use PATH-scoped.
6. **HANDOFF.md auto-clobbered** by session-end hook; **auto-commit hooks** create verbose-message wip
   commits + push to main mid-session (can't relabel without force-push, which is forbidden). Durable
   record lives in `.agentic/` + `docs/phases/` + git.
7. **`docs/HANDOFF_Script.md`** — stray placeholder template, auto-committed by a hook (`3c2a68b`); not
   mine, left untouched; owner decides `git rm`.
8. **DB-gated audits / `envelopeSubmit` suite** throw without `DATABASE_URL`; **`COURSE_TAXONOMY` test**
   needs gitignored `.local/course-skill-maps.md` (absent). All environmental, not code defects.

## 5. Next step

**Awaiting owner approval** of a **C2 repair phase** (proposal §7): author 3 consistent fixtures under
`artifacts/atlas/public/datasets/seeds/` (`customers.csv` ~8 rows incl 1 dup + C-100; `subscriptions.csv`
encoding C-100's 99→199→99→churn arc; `orders.csv` matching the `stg_orders` contract); fix all C2
datasetRefs (drop `.csv`); re-architect C2's SQL checks to be **WASM-native** (inline CTEs over seeds,
no dbt refs); **regenerate every `expectedRows`/`expectedRow` from real DuckDB output** (fixes the
inconsistency); then decide candidate promotion. In parallel: regenerate `pnpm-lock.yaml` on Linux/CI/WSL.
Only after all that lands green → consider the single-row `serverGrade:true` flip. **Do not opt in any
row, author any fixture, or change any expectedRows until approved.**

**Inherited invariants (never break):** RUBRIC_VERSION 1.0.1 frozen · archive=hide (no row deletes) ·
hidden slugs → 404 not 403 · bidirectional candidate↔project lineage · no runtime `mapToCourse` ·
H3 honest-claims · graders ship dark + byte-for-byte BC audit · hidden-first publishing · Phase 52
canary operator-pending (never agent-flipped).
