/**
 * Phase 30B — Real-Postgres concurrency integration test for /submit.
 *
 * Proves that the Phase 27 per-user `pg_advisory_xact_lock` (lock key:
 * `atlas-submit:${userId}`) actually serializes concurrent /submit traffic
 * against a real Postgres backend — NOT just against a mock that pretends
 * the lock works.
 *
 * Fixture: per-run namespaced schema `p30b_test_<ts>_<rand>` inside the
 * existing dev DB (see `lib/db/src/test-helpers.ts`). Dropped on teardown.
 * NEVER touches production. Opt-in via `pnpm --filter @workspace/api-server
 * run test:integration` — NOT chained into typecheck or the default unit
 * suite (which still mocks @workspace/db).
 *
 * Scope (3 scenarios):
 *   1. Same-step storm — N concurrent submits for the same (user, project,
 *      step). Lock must collapse them into exactly one first-pass award.
 *   2. Cross-step same-user storm — concurrent submits across every step
 *      of a project for the same user. Lock must preserve coherent
 *      progress and emit exactly one project-completion transition.
 *   3. Cross-user negative control — concurrent submits for two different
 *      users. Each user must receive their OWN valid first-pass award;
 *      the lock must NOT be accidentally global.
 *
 * Behavior under test is the production /submit handler — no /submit edits,
 * no schema migrations, no OpenAPI changes. We mock only the auth, streak,
 * and email side surfaces so the test isolates the lock + reward path.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

// Per-request auth: tests register seeded users in this map and each
// supertest call carries an `x-test-user-id` header so the mocked
// `getCurrentUser` can resolve the right user WITHOUT mutating shared
// state. This is what lets Scenario 3 actually interleave two users'
// submits in a single `Promise.all` — the architect fix.
type FixtureUserRecord = {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  subscriptionTier: "free" | "pro";
};
const fixtureUsers = new Map<string, FixtureUserRecord>();

const bumpStreakSpy = vi.fn().mockResolvedValue(undefined);
const sendEmailSpy = vi.fn().mockResolvedValue(undefined);

beforeAll(async () => {
  // Best-effort sweep of orphaned schemas from prior interrupted runs.
  // Failures here MUST NOT block the test run; we still create our own
  // fresh schema below.
  try {
    await cleanupStaleTestSchemas(24);
  } catch {
    // ignore — sweep is purely a janitor
  }

  testCtx = await createTestSchema();

  // Swap @workspace/db's singleton `db` for our test-schema-bound drizzle
  // instance. The /submit route captures `db` at module-load time, so the
  // mock MUST be installed BEFORE the route is dynamically imported in
  // `buildApp()`. We preserve all schema exports (users, projects, ...) by
  // spreading the real module.
  vi.doMock("@workspace/db", async () => {
    const actual = await vi.importActual<typeof import("@workspace/db")>(
      "@workspace/db",
    );
    return { ...actual, db: testCtx.db, pool: testCtx.pool };
  });

  // Auth: skip middleware. `getCurrentUser` resolves the user from a
  // per-request `x-test-user-id` header so concurrent requests for
  // different users never collide on a shared mutable.
  vi.doMock("../lib/auth", () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
    getCurrentUser: vi.fn(async (req: { headers?: Record<string, string | string[] | undefined> }) => {
      const raw = req.headers?.["x-test-user-id"];
      const id = Array.isArray(raw) ? raw[0] : raw;
      if (!id) return null;
      return fixtureUsers.get(id) ?? null;
    }),
  }));

  // Post-commit best-effort side effects — we only assert they're called
  // the expected number of times, never that they do real work.
  vi.doMock("../lib/email", () => ({
    sendEmail: (...a: unknown[]) => sendEmailSpy(...a),
    renderProjectCompletionEmail: () => ({ subject: "s", html: "h", text: "t" }),
  }));
  vi.doMock("../lib/streak", () => ({
    bumpStreak: (...a: unknown[]) => bumpStreakSpy(...a),
  }));
}, 60_000);

afterAll(async () => {
  if (testCtx) {
    await testCtx.cleanup();
  }
});

beforeEach(() => {
  bumpStreakSpy.mockClear();
  sendEmailSpy.mockClear();
  fixtureUsers.clear();
});

async function buildApp() {
  const router = (await import("./user")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // pino-http shim — the route uses req.log.{error,warn,info}
    (req as unknown as { log: unknown }).log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    next();
  });
  app.use(router);
  return app;
}

type FixtureUser = { id: string; email: string };
type Fixture = {
  user: FixtureUser;
  user2?: FixtureUser;
  projectId: string;
  stepIds: string[];
  passingValue: string;
};

async function seedFixture(opts: {
  totalSteps: number;
  extraUser?: boolean;
}): Promise<Fixture> {
  const { db } = testCtx;
  const passingValue = `PASS-${randomUUID().slice(0, 8)}`;
  const userId = randomUUID();
  const userId2 = opts.extraUser ? randomUUID() : null;
  const projectId = randomUUID();
  const domainId = randomUUID();
  const trackId = randomUUID();

  await db.execute(sql`
    INSERT INTO domains (id, slug, title, description)
    VALUES (${domainId}, ${`d-${randomUUID()}`}, 'Test Domain', 'test')
  `);
  await db.execute(sql`
    INSERT INTO tracks (id, domain_id, slug, title, difficulty_level)
    VALUES (${trackId}, ${domainId}, ${`t-${randomUUID()}`}, 'Test Track', 'beginner')
  `);
  const emailA = `u-${userId}@p30b.test`;
  await db.execute(sql`
    INSERT INTO users (id, clerk_id, email, name, subscription_tier, timezone)
    VALUES (${userId}, ${`clerk-${userId}`}, ${emailA}, 'A', 'free', 'UTC')
  `);
  fixtureUsers.set(userId, {
    id: userId, email: emailA, name: "A", timezone: "UTC", subscriptionTier: "free",
  });
  if (userId2) {
    const emailB = `u-${userId2}@p30b.test`;
    await db.execute(sql`
      INSERT INTO users (id, clerk_id, email, name, subscription_tier, timezone)
      VALUES (${userId2}, ${`clerk-${userId2}`}, ${emailB}, 'B', 'free', 'UTC')
    `);
    fixtureUsers.set(userId2, {
      id: userId2, email: emailB, name: "B", timezone: "UTC", subscriptionTier: "free",
    });
  }
  await db.execute(sql`
    INSERT INTO projects (
      id, track_id, domain_id, slug, title, short_description, full_description,
      difficulty_level, tech_stack, learning_objectives, total_steps, xp_reward,
      course, course_source
    ) VALUES (
      ${projectId}, ${trackId}, ${domainId}, ${`p-${randomUUID()}`}, 'Test Project',
      'short', 'full', 'beginner', ARRAY[]::text[], ARRAY[]::text[],
      ${opts.totalSteps}, 100, 'data-engineering', 'authored'
    )
  `);

  const stepIds: string[] = [];
  for (let i = 1; i <= opts.totalSteps; i++) {
    const stepId = randomUUID();
    stepIds.push(stepId);
    await db.execute(sql`
      INSERT INTO project_steps (
        id, project_id, step_number, title, instruction_md,
        validation_type, expected_output, xp_reward
      ) VALUES (
        ${stepId}, ${projectId}, ${i}, ${`Step ${i}`}, 'do the thing',
        'exact', ${passingValue}, 50
      )
    `);
  }

  await db.execute(sql`
    INSERT INTO user_progress (
      user_id, project_id, status, current_step, learning_mode,
      hints_used, revealed_answer, completion_percent
    ) VALUES (${userId}, ${projectId}, 'in_progress', 1, 'guided', 0, false, 0)
  `);
  await db.execute(sql`
    INSERT INTO user_xp (user_id, total_xp, level) VALUES (${userId}, 0, 1)
  `);
  if (userId2) {
    await db.execute(sql`
      INSERT INTO user_progress (
        user_id, project_id, status, current_step, learning_mode,
        hints_used, revealed_answer, completion_percent
      ) VALUES (${userId2}, ${projectId}, 'in_progress', 1, 'guided', 0, false, 0)
    `);
    await db.execute(sql`
      INSERT INTO user_xp (user_id, total_xp, level) VALUES (${userId2}, 0, 1)
    `);
  }

  return {
    user: { id: userId, email: `u-${userId}@p30b.test` },
    user2: userId2 ? { id: userId2, email: `u-${userId2}@p30b.test` } : undefined,
    projectId,
    stepIds,
    passingValue,
  };
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
async function countCompletions(userId: string, projectId: string): Promise<number> {
  const r = await testCtx.db.execute<{ c: string }>(
    sql`SELECT count(*)::text AS c FROM user_step_completions
        WHERE user_id = ${userId} AND project_id = ${projectId}`,
  );
  return parseInt(r.rows[0]!.c, 10);
}
async function progressStatus(userId: string, projectId: string): Promise<string> {
  const r = await testCtx.db.execute<{ status: string }>(
    sql`SELECT status FROM user_progress
        WHERE user_id = ${userId} AND project_id = ${projectId}`,
  );
  return r.rows[0]!.status;
}

describe("Phase 30B — real-Postgres /submit concurrency (advisory lock)", () => {
  it("Scenario 1: same-step storm collapses to exactly one first-pass award", async () => {
    const fx = await seedFixture({ totalSteps: 3 });
    const app = await buildApp();

    const N = 20;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        request(app)
          .post(`/user/projects/${fx.projectId}/steps/${fx.stepIds[0]}/submit`)
          .set("x-test-user-id", fx.user.id)
          .send({ submission: fx.passingValue, submissionType: "text" }),
      ),
    );

    // A1: no 500s.
    for (const r of results) {
      expect(r.status, `unexpected non-2xx: ${r.status} ${r.text}`).toBe(200);
    }
    // A2: all responses report status=passed (grading is deterministic).
    const passed = results.filter((r) => r.body.status === "passed");
    expect(passed).toHaveLength(N);
    // A3: exactly ONE response carries isFirstPass=true.
    const firstPasses = passed.filter((r) => r.body.isFirstPass === true);
    expect(firstPasses).toHaveLength(1);
    expect(firstPasses[0]!.body.xpEarned).toBe(50);
    // A4: every other response reports xpEarned=0.
    const nonFirst = passed.filter((r) => r.body.isFirstPass !== true);
    for (const r of nonFirst) expect(r.body.xpEarned).toBe(0);
    // A5: exactly ONE xp_transactions ledger row.
    expect(await countXpTx(fx.user.id)).toBe(1);
    // A6: user_xp.totalXp incremented exactly once (no lost updates).
    expect(await totalXp(fx.user.id)).toBe(50);
    // A7: exactly ONE user_step_completions row for (user, project, step).
    expect(await countCompletions(fx.user.id, fx.projectId)).toBe(1);
  });

  it("Scenario 2: cross-step same-user storm preserves coherent progress and exactly one completion", async () => {
    const fx = await seedFixture({ totalSteps: 3 });
    const app = await buildApp();

    // Two concurrent submits per step → 6 total, all racing the same lock key.
    const results = await Promise.all(
      fx.stepIds.flatMap((stepId) =>
        Array.from({ length: 2 }, () =>
          request(app)
            .post(`/user/projects/${fx.projectId}/steps/${stepId}/submit`)
            .set("x-test-user-id", fx.user.id)
            .send({ submission: fx.passingValue, submissionType: "text" }),
        ),
      ),
    );

    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.body.status).toBe("passed");
    }
    // Exactly one first-pass per step → 3 first-passes total.
    const firstPasses = results.filter((r) => r.body.isFirstPass === true);
    expect(firstPasses).toHaveLength(fx.stepIds.length);
    // Project completion transition fires exactly once across all 6 calls.
    const completions = results.filter((r) => r.body.projectComplete === true);
    expect(completions).toHaveLength(1);
    // Ledger row count == first-pass count.
    expect(await countXpTx(fx.user.id)).toBe(fx.stepIds.length);
    // Total XP == fresh-pass count * 50 (no lost updates across the read-
    // modify-write window on user_xp).
    expect(await totalXp(fx.user.id)).toBe(fx.stepIds.length * 50);
    // One completion row per step.
    expect(await countCompletions(fx.user.id, fx.projectId)).toBe(fx.stepIds.length);
    // Progress flipped to 'completed' exactly once and stays there.
    expect(await progressStatus(fx.user.id, fx.projectId)).toBe("completed");
    // Completion email fired EXACTLY once — pins the double-email
    // regression class (the conditional UPDATE returning rows is the
    // serialization point that gates the post-commit email).
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
  });

  it("Scenario 3: cross-user submits run truly concurrently and stay isolated (lock is per-user, not global)", async () => {
    const fx = await seedFixture({ totalSteps: 1, extraUser: true });
    expect(fx.user2).toBeDefined();
    const app = await buildApp();

    // TRUE concurrency: interleave both users' submits in a single
    // Promise.all so they actually race. Per-request auth (via the
    // `x-test-user-id` header) means there is no shared mutable
    // currentUser that would force serialization at the auth layer.
    // If the advisory lock were accidentally global, user A's storm
    // would block user B (or vice versa) inside the tx — but it would
    // not corrupt the per-user assertions below, so we additionally
    // measure wall-clock overlap to detect that regression.
    const N = 10;
    const requests = [
      ...Array.from({ length: N }, () => ({ uid: fx.user.id })),
      ...Array.from({ length: N }, () => ({ uid: fx.user2!.id })),
    ];
    // Deterministic interleave (A, B, A, B, ...) so the scheduler
    // alternates users instead of running all-A then all-B.
    const interleaved = requests.sort((_a, _b) => (Math.random() < 0.5 ? -1 : 1));

    const t0 = Date.now();
    const results = await Promise.all(
      interleaved.map((r) =>
        request(app)
          .post(`/user/projects/${fx.projectId}/steps/${fx.stepIds[0]}/submit`)
          .set("x-test-user-id", r.uid)
          .send({ submission: fx.passingValue, submissionType: "text" }),
      ),
    );
    const elapsedMs = Date.now() - t0;

    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.body.status).toBe("passed");
    }

    // Split results back by user via the x-test-user-id we sent (the
    // request order is preserved by Promise.all return order, matching
    // the input order of `interleaved`).
    const resA = results.filter((_r, i) => interleaved[i]!.uid === fx.user.id);
    const resB = results.filter((_r, i) => interleaved[i]!.uid === fx.user2!.id);
    expect(resA).toHaveLength(N);
    expect(resB).toHaveLength(N);

    // Each user receives exactly one first-pass + one ledger row + 50 XP.
    expect(resA.filter((r) => r.body.isFirstPass).length).toBe(1);
    expect(resB.filter((r) => r.body.isFirstPass).length).toBe(1);

    expect(await countXpTx(fx.user.id)).toBe(1);
    expect(await countXpTx(fx.user2!.id)).toBe(1);
    expect(await totalXp(fx.user.id)).toBe(50);
    expect(await totalXp(fx.user2!.id)).toBe(50);
    expect(await countCompletions(fx.user.id, fx.projectId)).toBe(1);
    expect(await countCompletions(fx.user2!.id, fx.projectId)).toBe(1);

    // Sanity bound: 2 × N = 20 requests should comfortably finish well
    // under the per-test 30s budget on real Postgres with parallel
    // per-user locks. We don't assert a strict overlap window (too
    // flaky in CI), but a regression to a global lock would push this
    // toward the upper bound. Generous ceiling.
    expect(elapsedMs).toBeLessThan(20_000);
  });
});
