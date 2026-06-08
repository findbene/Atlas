/**
 * Phase 61E — local DB baseline guard.
 *
 * Catches the exact failure class 61D/61E hit: an under-migrated or wiped local
 * DB that silently drops tables and server-graded rows, leaving integration
 * env-blocked and the global serverGrade state un-observable.
 *
 *   DATABASE_URL=... pnpm --filter @workspace/scripts run check:db-baseline
 *
 * Asserts, read-only:
 *   1. Every migration in the drizzle journal is applied (the 61E root cause —
 *      a poisoned baseline `created_at` made `pnpm migrate` skip 0002).
 *   2. The migration-created tables exist (run_envelope_nonces 0001,
 *      portfolio_submission_snapshots 0002) plus the core authoring tables.
 *   3. C2 + SaaS Mart are present, learner_visible, approved, with their exact
 *      server-graded step sets.
 *   4. The global serverGrade count matches the post-61E baseline
 *      (sql_resultset 8 + csv_set_equal 2 = 10).
 *
 * Exits non-zero on the first failed assertion so CI / a phase gate can block.
 * Bump EXPECTED_* below in lockstep with any future intentional flip.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  ok   ${name}`);
  else {
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failures++;
  }
}

// Post-61E baseline expectations (update in lockstep with any intentional flip).
const REQUIRED_TABLES = [
  "users",
  "projects",
  "project_steps",
  "project_candidates",
  "run_envelope_nonces", // migration 0001
  "portfolio_submission_snapshots", // migration 0002
];
const C2_SLUG = "analytics-engineer-semantic-layer-with-dbt-and-duckdb";
const MART_SLUG = "data-engineering-saas-usage-revenue-quality-mart";
const C2_SERVER_GRADED_STEPS = [1, 2, 3, 5]; // sql 1,2,5 + csv 3 (step 8 stays dark)
const MART_SERVER_GRADED_STEPS = [1, 2, 3, 4, 5, 6];
const EXPECTED_SQL = 8;
const EXPECTED_CSV = 2;
const EXPECTED_TOTAL = 10;

async function scalar(q: ReturnType<typeof sql>): Promise<number> {
  const r = (await db.execute(q)) as unknown as { rows: Array<Record<string, unknown>> };
  return Number(Object.values(r.rows[0])[0]);
}

async function serverGradedSteps(slug: string): Promise<number[]> {
  const r = (await db.execute(sql`
    select s.step_number as n
    from project_steps s join projects p on p.id = s.project_id
    where p.slug = ${slug}
      and s.validation_type in ('sql_resultset', 'csv_set_equal')
      and s.validation_config->'spec'->>'serverGrade' = 'true'
    order by s.step_number
  `)) as unknown as { rows: Array<{ n: number }> };
  return r.rows.map((x) => Number(x.n));
}

async function projectFlags(slug: string): Promise<{ visible: boolean; approved: boolean } | null> {
  const r = (await db.execute(sql`
    select learner_visible as v, quality_status as q from projects where slug = ${slug}
  `)) as unknown as { rows: Array<{ v: boolean; q: string }> };
  if (r.rows.length === 0) return null;
  return { visible: r.rows[0].v === true, approved: r.rows[0].q === "approved" };
}

async function main(): Promise<void> {
  // 1. Every journal migration applied.
  const journal = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "../../lib/db/drizzle/meta/_journal.json"), "utf8"),
  ) as { entries: unknown[] };
  const journalCount = journal.entries.length;
  const appliedCount = await scalar(sql`select count(*) from drizzle.__drizzle_migrations`);
  check(
    `all ${journalCount} journal migrations applied`,
    appliedCount === journalCount,
    `applied=${appliedCount}, journal=${journalCount} (run 'pnpm migrate')`,
  );

  // 2. Required tables exist.
  for (const t of REQUIRED_TABLES) {
    const present = await scalar(sql`select (to_regclass(${"public." + t}) is not null)::int`);
    check(`table public.${t} exists`, present === 1);
  }

  // 3. C2 + Mart present, visible, approved, with exact server-graded sets.
  for (const [label, slug, expected] of [
    ["C2", C2_SLUG, C2_SERVER_GRADED_STEPS],
    ["Mart", MART_SLUG, MART_SERVER_GRADED_STEPS],
  ] as const) {
    const flags = await projectFlags(slug);
    check(`${label} present in DB`, flags !== null);
    if (flags) {
      check(`${label} learner_visible`, flags.visible);
      check(`${label} approved`, flags.approved);
    }
    const steps = await serverGradedSteps(slug);
    check(
      `${label} server-graded steps = [${expected.join(",")}]`,
      JSON.stringify(steps) === JSON.stringify(expected),
      `got [${steps.join(",")}]`,
    );
  }

  // 4. Global serverGrade counts.
  const sqlCount = await scalar(sql`
    select count(*) from project_steps
    where validation_type = 'sql_resultset' and validation_config->'spec'->>'serverGrade' = 'true'
  `);
  const csvCount = await scalar(sql`
    select count(*) from project_steps
    where validation_type = 'csv_set_equal' and validation_config->'spec'->>'serverGrade' = 'true'
  `);
  check(`global sql_resultset serverGrade = ${EXPECTED_SQL}`, sqlCount === EXPECTED_SQL, `got ${sqlCount}`);
  check(`global csv_set_equal serverGrade = ${EXPECTED_CSV}`, csvCount === EXPECTED_CSV, `got ${csvCount}`);
  check(`global serverGrade total = ${EXPECTED_TOTAL}`, sqlCount + csvCount === EXPECTED_TOTAL, `got ${sqlCount + csvCount}`);

  if (failures > 0) {
    console.error(`\n[check:db-baseline] ${failures} failure(s) — baseline NOT restored.`);
    process.exit(1);
  }
  console.log("\n[check:db-baseline] OK — migrated, tables present, C2 + Mart approved, serverGrade = 10.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[check:db-baseline] FATAL:", err);
  process.exit(2);
});
