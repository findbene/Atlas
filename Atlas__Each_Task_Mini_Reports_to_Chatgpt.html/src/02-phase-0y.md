# Phase 0.y — local-baseline unblock + C2 fixture repair PROPOSAL
META: 2026-06-06 · DB audits GREEN (Docker PG) · proposal only (no fixtures authored)

> Compiled from the `.agentic/progress.md` Phase-0.y log + `docs/phases/phase-0y-c2-fixture-repair-proposal.md`.

Goal: get a real local DB-audit baseline + produce a READ-ONLY C2 fixture-repair proposal (do not author fixtures or change expectedRows yet).

## Completion status
DONE (proposal-only, as scoped). DB-gated audits run green on a local ephemeral Docker Postgres; C2 repair proposal delivered; no fixtures authored.

## What was done
- **Node 24 activated SHELL-SCOPED** (non-destructive PATH prepend; no `nvm use`, no admin, no clobber) → `node v24.16.0`, pnpm `9.15.0`.
- **Lockfile mismatch understood + fix identified, NOT committed** — `pnpm-lock.yaml` `overrides:` is a stale subset; `pnpm install --lockfile-only` reconciles (+1188/−94) but is Linux/CI-targeted (prune keeps only `linux-x64`) → regenerate on Linux/CI/WSL, not Windows. Working-tree change reverted.
- **DB-gated audits RAN GREEN** via local Docker Postgres (`atlas-pg`, postgres:16, port 5434, throwaway cred — not committed): migrate OK → seed OK → `audit:csv-set-equal-bc` PASS (0 visible — C2 hidden) · `audit:contains-bc` PASS 2/2, 14 subs · `audit:authoring` exit 0 (92 visible steps = 90 self_attest + 2 contains).

## C2 fixture repair proposal (read-only — nothing authored)
Found it is NOT a 1-file add. Bugs:
- **B1** datasetRef double-`.csv` (`seeds/subscriptions.csv` → fetched `…/subscriptions.csv.csv`).
- **B3** validation queries target dbt models (`mart_subscription_monthly`, `stg_*`) the DuckDB-WASM sandbox never builds → checks can't run.
- **B4** hand-authored expected values internally inconsistent (step 5 says $5,847 but its own breakdown = $3,891).
- **B5** existing `orders.csv` is the wrong shape.
- **Repair A (recommended):** author 3 seed fixtures + fix datasetRefs + re-architect checks to be WASM-native (inline CTEs over seeds) + regenerate ALL expected values from real execution + promote candidate.

## Scope / hard stops
No `serverGrade:true`, no opt-in, no fixtures authored, no expectedRows changed, no schema/migration, no production, no env/canary, Phase 52 untouched, no secrets, no force-push. All honored.

## Flip verdict
57B-flip STILL BLOCKED — 3 layers (candidate hidden · fixtures absent + path bug · queries target unbuilt dbt models + inconsistent expected values).

## Recommended next step
Approve a C2 repair phase (Repair A). → became Phase 0.z.
