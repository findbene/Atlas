/**
 * Phase 60F — Real-Postgres fresh-submit → portfolio-snapshot evidence loop.
 *
 * Proves, against a REAL Postgres backend (not a mock), the end-to-end chain
 * the portfolio artifact depends on:
 *
 *   successful /submit
 *     → durable portfolio_submission_snapshots row
 *     → artifact assembly sees snapshot availability
 *     → artifact route returns honest evidence
 *     → downloaded JSON is leak-free and claim-safe
 *
 * and the two negative guarantees:
 *   - /check writes NO snapshot (correct OR incorrect payload).
 *   - a repeat /submit is idempotent for XP/progress and writes no new snapshot.
 *
 * Fixture: a per-run namespaced schema (`p30b_test_<ts>_<rand>`, via the shared
 * `createTestSchema()`) inside the dev DB, cloned then DROPPED on teardown.
 * NEVER touches production and NEVER touches the live catalog — the opted-in
 * `sql_resultset` step seeded here is an EPHEMERAL fixture in the throwaway
 * schema, NOT a new catalog opt-in (the 2 live opted-in rows are untouched;
 * `audit:sql-resultset-bc` still reports 3 dark + 1 live).
 *
 * Opt-in: `pnpm --filter @workspace/api-server run test:integration`
 * (sets INTEGRATION_TEST_DB_ALLOW=1). Excluded from the default unit suite,
 * which still mocks @workspace/db.
 *
 * Behaviour under test is the PRODUCTION /submit, /check, and
 * /portfolio-artifact handlers — no route edits, no schema migration. Only the
 * auth/email/streak side surfaces are mocked so the test isolates the
 * grade → persist → assemble → render path.
 *
 * Leak-distinction note (Phase 60F task 10): the learner's correct submission
 * legitimately contains cell values that ALSO appear in the answer key — that
 * is allowed as learner evidence. To detect genuine spec/answer-key leakage
 * (as opposed to legitimate learner-evidence overlap) we plant a
 * `secretSentinel` key INSIDE the server-only validation spec — a value that
 * exists ONLY in validation_config and never in any learner submission — and
 * assert it never surfaces in the snapshot row, the artifact bundle, or any
 * response. Its absence is unambiguous proof no spec object leaked.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

import {
  createTestSchema,
  cleanupStaleTestSchemas,
  type TestDbContext,
} from "@workspace/db/test-helpers";

let testCtx: TestDbContext;

type FixtureUserRecord = {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  timezone: string;
  subscriptionTier: "free" | "pro";
};
const fixtureUsers = new Map<string, FixtureUserRecord>();

const sendEmailSpy = vi.fn().mockResolvedValue(undefined);
const bumpStreakSpy = vi.fn().mockResolvedValue(undefined);

// A sentinel that lives ONLY in the server-side validation spec. If any spec
// object ever leaks into a snapshot row or the recruiter-facing artifact, this
// string would appear. The learner submission never contains it.
const SPEC_LEAK_SENTINEL = "ATLAS_SPEC_LEAK_SENTINEL_DO_NOT_EXPORT";

beforeAll(async () => {
  try {
    await cleanupStaleTestSchemas(24);
  } catch {
    // janitor only
  }
  testCtx = await createTestSchema();

  vi.doMock("@workspace/db", async () => {
    const actual = await vi.importActual<typeof import("@workspace/db")>(
      "@workspace/db",
    );
    return { ...actual, db: testCtx.db, pool: testCtx.pool };
  });

  vi.doMock("../lib/auth", () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
    getCurrentUser: vi.fn(
      async (req: { headers?: Record<string, string | string[] | undefined> }) => {
        const raw = req.headers?.["x-test-user-id"];
        const id = Array.isArray(raw) ? raw[0] : raw;
        if (!id) return null;
        return fixtureUsers.get(id) ?? null;
      },
    ),
    getOrCreateUser: vi.fn(),
    invalidateUserCache: vi.fn(),
  }));

  vi.doMock("../lib/email", () => ({
    sendEmail: (...a: unknown[]) => sendEmailSpy(...a),
    renderProjectCompletionEmail: () => ({ subject: "s", html: "h", text: "t" }),
  }));
  vi.doMock("../lib/streak", () => ({
    bumpStreak: (...a: unknown[]) => bumpStreakSpy(...a),
  }));
}, 60_000);

afterAll(async () => {
  if (testCtx) await testCtx.cleanup();
});

async function buildApp() {
  const userRouter = (await import("./user")).default;
  const artifactRouter = (await import("./user-portfolio-artifact")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { log: unknown }).log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    next();
  });
  app.use(userRouter);
  app.use(artifactRouter);
  return app;
}

type Fixture = {
  userId: string;
  projectId: string;
  projectSlug: string;
  stepId: string;
  stepNumber: number;
  columns: string[];
  expectedRows: unknown[][];
  correctSubmission: string;
  wrongSubmission: string;
};

async function seedFixture(): Promise<Fixture> {
  const { db } = testCtx;
  const userId = randomUUID();
  const projectId = randomUUID();
  const domainId = randomUUID();
  const trackId = randomUUID();
  const stepId = randomUUID();
  const projectSlug = `p60f-${randomUUID().slice(0, 8)}`;

  const columns = ["customer_id", "plan"];
  const expectedRows: unknown[][] = [
    [1, "pro"],
    [2, "free"],
    [3, "pro"],
  ];
  // Server-only spec: serverGrade opt-in + answer key + the leak sentinel.
  const spec = {
    serverGrade: true,
    columns,
    expectedRows,
    secretSentinel: SPEC_LEAK_SENTINEL,
  };
  const validationConfig = JSON.stringify({ spec });

  await db.execute(sql`
    INSERT INTO domains (id, slug, title, description)
    VALUES (${domainId}, ${`d-${randomUUID()}`}, 'Test Domain', 'test')
  `);
  await db.execute(sql`
    INSERT INTO tracks (id, domain_id, slug, title, difficulty_level)
    VALUES (${trackId}, ${domainId}, ${`t-${randomUUID()}`}, 'Test Track', 'intermediate')
  `);
  await db.execute(sql`
    INSERT INTO users (id, clerk_id, email, name, subscription_tier, timezone)
    VALUES (${userId}, ${`clerk-${userId}`}, ${`u-${userId}@p60f.test`}, 'Learner', 'free', 'UTC')
  `);
  fixtureUsers.set(userId, {
    id: userId,
    clerkId: `clerk-${userId}`,
    email: `u-${userId}@p60f.test`,
    name: "Learner",
    timezone: "UTC",
    subscriptionTier: "free",
  });

  // learner_visible defaults TRUE → the artifact route can resolve it.
  await db.execute(sql`
    INSERT INTO projects (
      id, track_id, domain_id, slug, title, short_description, full_description,
      difficulty_level, tech_stack, learning_objectives, total_steps, xp_reward,
      course, course_source
    ) VALUES (
      ${projectId}, ${trackId}, ${domainId}, ${projectSlug}, 'Semantic Layer (test)',
      'A test project for the fresh-submit evidence loop.', 'full',
      'intermediate', ARRAY['DuckDB','SQL']::text[], ARRAY['Model a semantic layer']::text[],
      1, 100, 'analytics-engineer', 'authored'
    )
  `);

  await db.execute(sql`
    INSERT INTO project_steps (
      id, project_id, step_number, title, instruction_md,
      validation_type, validation_config, required_skill, xp_reward
    ) VALUES (
      ${stepId}, ${projectId}, 1, 'Compute the plan rollup', 'write the query',
      'sql_resultset', ${validationConfig}::jsonb, 'window functions', 50
    )
  `);

  // Enrolled, NOT completed — so the first /submit is a genuine fresh pass.
  await db.execute(sql`
    INSERT INTO user_progress (
      user_id, project_id, status, current_step, learning_mode,
      hints_used, revealed_answer, completion_percent
    ) VALUES (${userId}, ${projectId}, 'in_progress', 1, 'guided', 0, false, 0)
  `);
  await db.execute(sql`
    INSERT INTO user_xp (user_id, total_xp, level) VALUES (${userId}, 0, 1)
  `);

  return {
    userId,
    projectId,
    projectSlug,
    stepId,
    stepNumber: 1,
    columns,
    expectedRows,
    correctSubmission: JSON.stringify({ columns, rows: expectedRows }),
    wrongSubmission: JSON.stringify({ columns, rows: [[9, "enterprise"]] }),
  };
}

async function countSnapshots(userId: string, projectId: string): Promise<number> {
  const r = await testCtx.db.execute<{ c: string }>(
    sql`SELECT count(*)::text AS c FROM portfolio_submission_snapshots
        WHERE user_id = ${userId} AND project_id = ${projectId}`,
  );
  return parseInt(r.rows[0]!.c, 10);
}
async function getSnapshotRow(userId: string, projectId: string) {
  const r = await testCtx.db.execute(
    sql`SELECT * FROM portfolio_submission_snapshots
        WHERE user_id = ${userId} AND project_id = ${projectId}`,
  );
  return r.rows;
}
async function countCompletions(userId: string, projectId: string): Promise<number> {
  const r = await testCtx.db.execute<{ c: string }>(
    sql`SELECT count(*)::text AS c FROM user_step_completions
        WHERE user_id = ${userId} AND project_id = ${projectId}`,
  );
  return parseInt(r.rows[0]!.c, 10);
}
async function countXpTx(userId: string): Promise<number> {
  const r = await testCtx.db.execute<{ c: string }>(
    sql`SELECT count(*)::text AS c FROM xp_transactions WHERE user_id = ${userId}`,
  );
  return parseInt(r.rows[0]!.c, 10);
}
async function totalXp(userId: string): Promise<number> {
  const r = await testCtx.db.execute<{ t: number }>(
    sql`SELECT total_xp AS t FROM user_xp WHERE user_id = ${userId}`,
  );
  return r.rows[0]?.t ?? 0;
}

describe("Phase 60F — fresh /submit → portfolio snapshot evidence loop (real Postgres)", () => {
  it("proves the full /check-no-write → /submit-one-snapshot → idempotent → artifact-reflects → leak-free chain", async () => {
    const fx = await seedFixture();
    const app = await buildApp();
    const submitUrl = `/user/projects/${fx.projectId}/steps/${fx.stepId}/submit`;
    const checkUrl = `/user/projects/${fx.projectId}/steps/${fx.stepId}/check`;
    const artifactUrl = `/user/projects/${fx.projectSlug}/portfolio-artifact`;

    // ── Task 5: /check writes NO snapshot, on correct AND incorrect payload ──
    const checkOk = await request(app)
      .post(checkUrl)
      .set("x-test-user-id", fx.userId)
      .send({ submission: fx.correctSubmission });
    expect(checkOk.status).toBe(200);
    expect(checkOk.body.status).toBe("passed");
    expect(await countSnapshots(fx.userId, fx.projectId)).toBe(0);
    expect(await countCompletions(fx.userId, fx.projectId)).toBe(0);

    const checkBad = await request(app)
      .post(checkUrl)
      .set("x-test-user-id", fx.userId)
      .send({ submission: fx.wrongSubmission });
    expect(checkBad.status).toBe(200);
    expect(checkBad.body.status).toBe("failed");
    expect(await countSnapshots(fx.userId, fx.projectId)).toBe(0);
    expect(await countCompletions(fx.userId, fx.projectId)).toBe(0);

    // ── Task 8 (pre): artifact honestly degrades with NO snapshot yet ──
    const artBefore = await request(app)
      .get(artifactUrl)
      .set("x-test-user-id", fx.userId);
    expect(artBefore.status).toBe(200);
    expect(artBefore.body.files["LIMITATIONS.md"]).toContain(
      "submitted code is **not included**",
    );
    expect(JSON.stringify(artBefore.body)).not.toContain(SPEC_LEAK_SENTINEL);

    // ── Task 6: /submit fresh pass writes exactly ONE safe snapshot ──
    const submit1 = await request(app)
      .post(submitUrl)
      .set("x-test-user-id", fx.userId)
      .send({ submission: fx.correctSubmission, submissionType: "text" });
    expect(submit1.status).toBe(200);
    expect(submit1.body.status).toBe("passed");
    expect(submit1.body.isFirstPass).toBe(true);
    expect(submit1.body.xpEarned).toBe(50);
    expect(JSON.stringify(submit1.body)).not.toContain(SPEC_LEAK_SENTINEL);

    expect(await countSnapshots(fx.userId, fx.projectId)).toBe(1);
    const rows = await getSnapshotRow(fx.userId, fx.projectId);
    expect(rows).toHaveLength(1);
    const snap = rows[0] as Record<string, unknown>;
    expect(snap.passed).toBe(true);
    expect(snap.validation_kind).toBe("sql_resultset");
    expect(snap.is_server_graded).toBe(true);
    expect(typeof snap.submission_sha256).toBe("string");
    expect((snap.submission_sha256 as string).length).toBe(64);
    expect(snap.source).toBe("submit_legacy");
    // Legacy (non-envelope) path → no runtime-output evidence.
    expect(snap.runtime_output_sha256).toBeNull();

    // ── Task 10: the snapshot carries learner EVIDENCE, never the spec ──
    const snapJson = JSON.stringify(snap);
    // The learner's correct rows ARE present as evidence (allowed)…
    expect(snap.submission_excerpt).toContain("pro");
    // …but NO spec object / answer-key keys / sentinel leaked.
    expect(snapJson).not.toContain(SPEC_LEAK_SENTINEL);
    for (const specToken of [
      "serverGrade",
      "expectedRows",
      "expectedRowsHash",
      "validationConfig",
      "validation_config",
      "\"spec\"",
    ]) {
      expect(snapJson).not.toContain(specToken);
    }

    // ── Task 7: a repeat /submit is idempotent (no dup snapshot / XP) ──
    const xpTxBefore = await countXpTx(fx.userId);
    const totalXpBefore = await totalXp(fx.userId);
    const submit2 = await request(app)
      .post(submitUrl)
      .set("x-test-user-id", fx.userId)
      .send({ submission: fx.correctSubmission, submissionType: "text" });
    expect(submit2.status).toBe(200);
    expect(submit2.body.status).toBe("passed");
    expect(submit2.body.isFirstPass).not.toBe(true);
    expect(submit2.body.xpEarned).toBe(0);
    expect(await countSnapshots(fx.userId, fx.projectId)).toBe(1); // still one
    expect(await countXpTx(fx.userId)).toBe(xpTxBefore); // no new ledger row
    expect(await totalXp(fx.userId)).toBe(totalXpBefore); // no double award

    // ── monotonic pass: a later FAILING submit keeps the snapshot at one ──
    const submit3 = await request(app)
      .post(submitUrl)
      .set("x-test-user-id", fx.userId)
      .send({ submission: fx.wrongSubmission, submissionType: "text" });
    expect(submit3.status).toBe(200);
    expect(await countSnapshots(fx.userId, fx.projectId)).toBe(1);

    // ── Task 8 (post) + Task 11: artifact now reflects the snapshot honestly ──
    const artAfter = await request(app)
      .get(artifactUrl)
      .set("x-test-user-id", fx.userId);
    expect(artAfter.status).toBe(200);
    const files = artAfter.body.files as Record<string, string>;
    // Code availability flipped on — the "code not included" line is gone…
    expect(files["LIMITATIONS.md"]).not.toContain(
      "submitted code is **not included**",
    );
    // …but the legacy path still has no runtime OUTPUT, stated honestly.
    expect(files["LIMITATIONS.md"]).toContain(
      "submitted runtime output is **not included**",
    );
    // The server-graded step is reflected as server-graded.
    expect(files["VALIDATION_EVIDENCE.md"]).toContain("server-graded");
    expect(files["VALIDATION_EVIDENCE.md"]).toContain("`sql_resultset`");
    // The single allowed Atlas-verified claim is present.
    expect(files["README.md"]).toContain(
      "Atlas verified that submitted runtime output or artifacts matched",
    );
    // Honest non-claims present; forbidden claims absent.
    expect(files["LIMITATIONS.md"]).toMatch(/does \*\*not\*\* certify/i);
    const bundleJson = JSON.stringify(artAfter.body);
    expect(bundleJson).not.toContain(SPEC_LEAK_SENTINEL);
    for (const banned of [
      "tamper-proof",
      "cheat-proof",
      "guarantees a job",
      "job guaranteed",
      "verified authorship",
    ]) {
      expect(bundleJson.toLowerCase()).not.toContain(banned.toLowerCase());
    }
    // No answer-key spec leaked into the recruiter-facing bundle.
    for (const specToken of ["expectedRows", "serverGrade", "validation_config"]) {
      expect(bundleJson).not.toContain(specToken);
    }

    // ── 404, not 403, for an unknown slug (no hidden-project existence leak) ──
    const unknown = await request(app)
      .get(`/user/projects/does-not-exist-${randomUUID().slice(0, 6)}/portfolio-artifact`)
      .set("x-test-user-id", fx.userId);
    expect(unknown.status).toBe(404);
  });
});
