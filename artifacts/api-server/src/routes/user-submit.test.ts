/**
 * Phase 26 — Server-side tests for POST /user/projects/:projectId/steps/:stepId/submit.
 *
 * Pins the four reward-integrity invariants:
 *
 *   H1. XP idempotency on re-submit of an already-passed step:
 *       - response `xpEarned === 0`
 *       - response `isFirstPass === false`
 *       - NO `user_xp` increment
 *       - NO new `xp_transactions` row
 *
 *   H2. Project completion gate:
 *       - passing the LAST step while earlier steps are still unpassed
 *         must NOT flip `user_progress.status` to 'completed', must NOT
 *         send the completion email, and must return
 *         `projectComplete: false`.
 *       - the transition fires exactly once when the final remaining
 *         step actually passes.
 *
 *   H3. xp_transactions ledger:
 *       - exactly one append-only ledger row per real award.
 *       - amount + reason + metadata captured.
 *
 *   H4. Submission evidence:
 *       - excerpt + sha256 populated on first pass.
 *       - NOT overwritten by later re-submits of an already-passed step.
 *       - sha256 deterministic + stable for identical submissions.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createHash } from "node:crypto";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "u@example.com",
  name: "U",
  timezone: "UTC",
  subscriptionTier: "free",
};

vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCurrentUser: vi.fn().mockResolvedValue(TEST_USER),
  getOrCreateUser: vi.fn(),
  invalidateUserCache: vi.fn(),
}));

const userProgressFindFirst = vi.fn();
const projectStepsFindFirst = vi.fn();
const userStepCompletionsFindFirst = vi.fn();
const projectsFindFirst = vi.fn();
const userXpFindFirst = vi.fn();

// Capture EVERY insert + update operation with the *table-marker object*
// passed at .insert(table) / .update(table) so tests can assert what was
// written where without having to walk Drizzle's builder.
const insertCalls: Array<{ table: unknown; values: unknown }> = [];
const updateCalls: Array<{ table: unknown; values: unknown; conditional: boolean }> = [];

// Configurable response for the post-write COUNT(passed) query.
let nextPassedCount = 0;

const sendEmailSpy = vi.fn().mockResolvedValue(undefined);
const bumpStreakSpy = vi.fn().mockResolvedValue(undefined);

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
      projectSteps: { findFirst: (...a: unknown[]) => projectStepsFindFirst(...a) },
      userStepCompletions: { findFirst: (...a: unknown[]) => userStepCompletionsFindFirst(...a) },
      projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
      userXp: { findFirst: (...a: unknown[]) => userXpFindFirst(...a) },
    },
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        insertCalls.push({ table, values });
        return Promise.resolve();
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: unknown) => {
        // Drizzle chain: .set().where(...).returning(...) OR .set().where(...)
        // The conditional UPDATE path uses .returning(); the unconditional
        // path doesn't. We track both shapes; `returning` resolves to
        // an empty array (= "row no longer matched" = already completed).
        return {
          where: (_w: unknown) => {
            updateCalls.push({ table, values, conditional: false });
            return {
              returning: () => {
                // Mark this as a conditional update (the only call site that
                // appends .returning is the status flip with `ne(status,'completed')`).
                const last = updateCalls[updateCalls.length - 1];
                if (last) last.conditional = true;
                // Default: row WAS updated (transition happened). Tests can
                // override via overrideReturning hook below if needed.
                return Promise.resolve(returningOverride());
              },
            };
          },
        };
      },
    })),
    // Used for the post-write COUNT query for `allStepsPassed`.
    select: vi.fn(() => ({
      from: () => ({
        where: () => Promise.resolve([{ passedCount: nextPassedCount }]),
      }),
    })),
  },
  users: {},
  userProgress: { _t: "userProgress", userId: "u", projectId: "p", id: "id", status: "status" },
  userXp: { _t: "userXp", userId: "u" },
  userStreaks: { _t: "userStreaks", userId: "u" },
  xpTransactions: { _t: "xpTransactions" },
  projects: { _t: "projects", id: "id" },
  projectSteps: { _t: "projectSteps", id: "id", projectId: "projectId" },
  userStepCompletions: {
    _t: "userStepCompletions",
    userId: "u",
    projectId: "p",
    stepNumber: "n",
    id: "id",
    passed: "passed",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  isNull: (...a: unknown[]) => ({ isNull: a }),
  ne: (...a: unknown[]) => ({ ne: a }),
  sql: Object.assign(() => ({}), {}),
}));

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));
vi.mock("../lib/email", () => ({
  sendEmail: (...a: unknown[]) => sendEmailSpy(...a),
  renderProjectCompletionEmail: vi.fn(() => ({ subject: "s", html: "h", text: "t" })),
}));
vi.mock("../lib/streak", () => ({ bumpStreak: (...a: unknown[]) => bumpStreakSpy(...a) }));

// Allow tests to mutate the conditional-update .returning() outcome
// (defaults to "1 row" = transition happened).
let returningOverride: () => Array<{ id: string }> = () => [{ id: "prog-1" }];

async function buildApp() {
  const router = (await import("./user")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  app.use(router);
  return app;
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const STEP_ID = "22222222-2222-2222-2222-222222222222";

function tableName(t: unknown): string {
  return (t as { _t?: string })?._t ?? "?";
}
function rowsInsertedInto(name: string) {
  return insertCalls.filter((c) => tableName(c.table) === name);
}
function rowsUpdatedIn(name: string) {
  return updateCalls.filter((c) => tableName(c.table) === name);
}

beforeEach(() => {
  userProgressFindFirst.mockReset();
  projectStepsFindFirst.mockReset();
  userStepCompletionsFindFirst.mockReset();
  projectsFindFirst.mockReset();
  userXpFindFirst.mockReset();
  insertCalls.length = 0;
  updateCalls.length = 0;
  sendEmailSpy.mockClear();
  bumpStreakSpy.mockClear();
  nextPassedCount = 0;
  returningOverride = () => [{ id: "prog-1" }];
});

describe("POST /user/projects/:projectId/steps/:stepId/submit — Phase 26 integrity", () => {
  // -----------------------------------------------------------------
  // H1 — XP idempotency
  // -----------------------------------------------------------------
  describe("H1. XP idempotency on re-submit of already-passed step", () => {
    it("re-submit returns xpEarned=0, isFirstPass=false, writes NO xp/ledger rows", async () => {
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID, completedAt: new Date() });
      projectStepsFindFirst.mockResolvedValue({
        id: STEP_ID,
        projectId: PROJECT_ID,
        validationType: "exact",
        expectedOutput: "42",
        validationConfig: null,
        stepNumber: 1,
        xpReward: 50,
      });
      // existing row already has passed=true → this is a re-submit
      userStepCompletionsFindFirst.mockResolvedValue({
        id: "uc-1",
        userId: TEST_USER.id,
        projectId: PROJECT_ID,
        stepNumber: 1,
        passed: true,
        attemptCount: 3,
      });
      projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 1, title: "T", slug: "s", jobOutcomes: [] });
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 100, level: 2 });
      nextPassedCount = 1;

      const app = await buildApp();
      const res = await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "42", submissionType: "text" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("passed");
      expect(res.body.xpEarned).toBe(0);
      expect(res.body.isFirstPass).toBe(false);

      // Persisted behavior must match the returned `xpEarned: 0` — no
      // user_xp UPDATE and no xp_transactions INSERT.
      expect(rowsUpdatedIn("userXp")).toHaveLength(0);
      expect(rowsInsertedInto("userXp")).toHaveLength(0);
      expect(rowsInsertedInto("xpTransactions")).toHaveLength(0);
    });

    it("MONOTONIC pass state — pass→fail→pass on same step awards XP exactly ONCE and keeps original evidence", async () => {
      // This is the architect R1 regression. Before the monotonic-passed
      // fix, a failing attempt downgraded `passed` to false, so the next
      // passing attempt was treated as fresh and double-awarded XP.
      const baseStep = {
        id: STEP_ID,
        projectId: PROJECT_ID,
        validationType: "exact" as const,
        expectedOutput: "42",
        validationConfig: null,
        stepNumber: 1,
        xpReward: 50,
      };
      const baseProject = { id: PROJECT_ID, totalSteps: 1, title: "T", slug: "s", jobOutcomes: [] };
      const app = await buildApp();

      // ── Attempt 1: PASS (first attempt, row didn't exist) ──
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID, completedAt: null });
      projectStepsFindFirst.mockResolvedValue(baseStep);
      userStepCompletionsFindFirst.mockResolvedValue(undefined);
      projectsFindFirst.mockResolvedValue(baseProject);
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
      nextPassedCount = 1;
      let res = await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "42", submissionType: "text" });
      expect(res.body.xpEarned).toBe(50);
      expect(res.body.isFirstPass).toBe(true);
      const firstInsert = rowsInsertedInto("userStepCompletions")[0]!.values as any;
      const firstEvidenceHash = firstInsert.submissionSha256;
      expect(rowsInsertedInto("xpTransactions")).toHaveLength(1);

      insertCalls.length = 0;
      updateCalls.length = 0;

      // ── Attempt 2: FAIL (row exists, passed=true; this attempt grades fail) ──
      userStepCompletionsFindFirst.mockResolvedValue({
        id: "uc-1",
        passed: true, // already passed
        attemptCount: 1,
      });
      // Reset other mocks so the route can re-query.
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID, completedAt: new Date() });
      projectStepsFindFirst.mockResolvedValue(baseStep);
      projectsFindFirst.mockResolvedValue(baseProject);
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 50, level: 1 });
      res = await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "wrong", submissionType: "text" });
      expect(res.body.status).toBe("failed");
      // Monotonic guarantee: the UPDATE preserves passed=true.
      const failUpdate = rowsUpdatedIn("userStepCompletions")[0]!.values as any;
      expect(failUpdate.passed).toBe(true);
      // A failing submission to an already-passed step must NOT overwrite evidence.
      expect(failUpdate).not.toHaveProperty("submissionExcerpt");
      expect(failUpdate).not.toHaveProperty("submissionSha256");
      // And must NOT issue XP / ledger writes.
      expect(rowsUpdatedIn("userXp")).toHaveLength(0);
      expect(rowsInsertedInto("xpTransactions")).toHaveLength(0);

      insertCalls.length = 0;
      updateCalls.length = 0;

      // ── Attempt 3: PASS again (row should STILL show passed=true thanks to monotonicity) ──
      userStepCompletionsFindFirst.mockResolvedValue({
        id: "uc-1",
        passed: true, // monotonic invariant — stays true after attempt 2's fail
        attemptCount: 2,
      });
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID, completedAt: new Date() });
      projectStepsFindFirst.mockResolvedValue(baseStep);
      projectsFindFirst.mockResolvedValue(baseProject);
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 50, level: 1 });
      res = await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "42", submissionType: "text" });
      expect(res.body.xpEarned).toBe(0); // NO double-award
      expect(res.body.isFirstPass).toBe(false);
      expect(rowsUpdatedIn("userXp")).toHaveLength(0);
      expect(rowsInsertedInto("xpTransactions")).toHaveLength(0);
      // Original evidence hash unchanged (UPDATE didn't touch evidence keys).
      const repassUpdate = rowsUpdatedIn("userStepCompletions")[0]!.values as any;
      expect(repassUpdate).not.toHaveProperty("submissionExcerpt");
      expect(repassUpdate).not.toHaveProperty("submissionSha256");
      // Sanity: hash from attempt 1 is still our reference.
      expect(firstEvidenceHash).toBe(createHash("sha256").update("42").digest("hex"));
    });

    it("first-pass writes user_xp + exactly ONE xp_transactions ledger row", async () => {
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID });
      projectStepsFindFirst.mockResolvedValue({
        id: STEP_ID,
        projectId: PROJECT_ID,
        validationType: "exact",
        expectedOutput: "42",
        validationConfig: null,
        stepNumber: 1,
        xpReward: 50,
      });
      userStepCompletionsFindFirst.mockResolvedValue(undefined); // first attempt
      projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 2, title: "T", slug: "s", jobOutcomes: [] });
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
      nextPassedCount = 1; // 1 of 2 — not yet complete

      const app = await buildApp();
      const res = await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "42", submissionType: "text" });

      expect(res.status).toBe(200);
      expect(res.body.xpEarned).toBe(50);
      expect(res.body.isFirstPass).toBe(true);
      expect(res.body.projectComplete).toBe(false);

      expect(rowsUpdatedIn("userXp")).toHaveLength(1);
      const ledger = rowsInsertedInto("xpTransactions");
      expect(ledger).toHaveLength(1);
      const ledgerRow = ledger[0]!.values as any;
      expect(ledgerRow.amount).toBe(50);
      expect(ledgerRow.reason).toBe("step_pass");
      expect(ledgerRow.metadata.stepNumber).toBe(1);
      expect(ledgerRow.metadata.projectId).toBe(PROJECT_ID);
    });
  });

  // -----------------------------------------------------------------
  // H2 — projectComplete gating
  // -----------------------------------------------------------------
  describe("H2. projectComplete requires ALL steps passed", () => {
    it("passing the LAST step while earlier steps are unpassed does NOT complete the project", async () => {
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID, status: "in_progress" });
      projectStepsFindFirst.mockResolvedValue({
        id: STEP_ID,
        projectId: PROJECT_ID,
        validationType: "exact",
        expectedOutput: "42",
        validationConfig: null,
        stepNumber: 5, // last step
        xpReward: 50,
      });
      userStepCompletionsFindFirst.mockResolvedValue(undefined);
      projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 5, title: "T", slug: "s", jobOutcomes: [] });
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
      // After writing this step's pass, only 1 of 5 steps passed (learner
      // skipped 4 earlier steps via deep-link).
      nextPassedCount = 1;

      const app = await buildApp();
      const res = await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "42", submissionType: "text" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("passed");
      expect(res.body.projectComplete).toBe(false);

      // Completion email must NOT fire.
      expect(sendEmailSpy).not.toHaveBeenCalled();

      // The conditional status-flip UPDATE must NOT have been issued — the
      // route should have taken the in_progress branch, which uses
      // unconditional UPDATE (no .returning()).
      const progressUpdates = rowsUpdatedIn("userProgress");
      expect(progressUpdates.length).toBeGreaterThan(0);
      const v = progressUpdates[0]!.values as any;
      expect(v.status).toBe("in_progress");
      expect(v.completedAt).toBeNull();
    });

    it("passing the FINAL remaining step DOES complete the project and emails ONCE", async () => {
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID, status: "in_progress", completedAt: null });
      projectStepsFindFirst.mockResolvedValue({
        id: STEP_ID,
        projectId: PROJECT_ID,
        validationType: "exact",
        expectedOutput: "42",
        validationConfig: null,
        stepNumber: 3,
        xpReward: 50,
      });
      userStepCompletionsFindFirst.mockResolvedValue(undefined);
      projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 3, title: "T", slug: "s", jobOutcomes: [] });
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
      nextPassedCount = 3; // all 3 passed

      const app = await buildApp();
      const res = await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "42", submissionType: "text" });

      expect(res.status).toBe(200);
      expect(res.body.projectComplete).toBe(true);
      // Email fires exactly once on the actual completion transition.
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    });

    it("re-submit of last step when project already completed does NOT re-send email", async () => {
      const alreadyCompletedAt = new Date("2026-01-01T00:00:00Z");
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID, status: "completed", completedAt: alreadyCompletedAt });
      projectStepsFindFirst.mockResolvedValue({
        id: STEP_ID,
        projectId: PROJECT_ID,
        validationType: "exact",
        expectedOutput: "42",
        validationConfig: null,
        stepNumber: 2,
        xpReward: 50,
      });
      userStepCompletionsFindFirst.mockResolvedValue({
        id: "uc-1",
        passed: true,
        attemptCount: 1,
      });
      projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 2, title: "T", slug: "s", jobOutcomes: [] });
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 100, level: 2 });
      nextPassedCount = 2;
      // Conditional UPDATE finds nothing (already completed) → empty array.
      returningOverride = () => [];

      const app = await buildApp();
      const res = await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "42", submissionType: "text" });

      expect(res.status).toBe(200);
      expect(res.body.projectComplete).toBe(false);
      expect(sendEmailSpy).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // H4 — submission evidence
  // -----------------------------------------------------------------
  describe("H4. submission evidence (excerpt + sha256)", () => {
    it("first-pass INSERT carries excerpt + sha256 matching crypto.sha256(submission)", async () => {
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID });
      projectStepsFindFirst.mockResolvedValue({
        id: STEP_ID,
        projectId: PROJECT_ID,
        validationType: "exact",
        expectedOutput: "hello",
        validationConfig: null,
        stepNumber: 1,
        xpReward: 10,
      });
      userStepCompletionsFindFirst.mockResolvedValue(undefined);
      projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 1, title: "T", slug: "s", jobOutcomes: [] });
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
      nextPassedCount = 1;

      const app = await buildApp();
      await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "hello", submissionType: "text" });

      const inserts = rowsInsertedInto("userStepCompletions");
      expect(inserts).toHaveLength(1);
      const v = inserts[0]!.values as any;
      expect(v.submissionExcerpt).toBe("hello");
      expect(v.submissionSha256).toBe(createHash("sha256").update("hello").digest("hex"));
    });

    it("re-submit of already-passed step does NOT overwrite original evidence (UPDATE has no excerpt/sha keys)", async () => {
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID, completedAt: new Date() });
      projectStepsFindFirst.mockResolvedValue({
        id: STEP_ID,
        projectId: PROJECT_ID,
        validationType: "exact",
        expectedOutput: "42",
        validationConfig: null,
        stepNumber: 1,
        xpReward: 10,
      });
      userStepCompletionsFindFirst.mockResolvedValue({
        id: "uc-1",
        passed: true,
        attemptCount: 1,
      });
      projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 1, title: "T", slug: "s", jobOutcomes: [] });
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
      nextPassedCount = 1;

      const app = await buildApp();
      await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "42", submissionType: "text" });

      const completionUpdates = rowsUpdatedIn("userStepCompletions");
      expect(completionUpdates).toHaveLength(1);
      const v = completionUpdates[0]!.values as any;
      // Evidence keys MUST be absent on a re-submit of an already-passed
      // row — the original first-pass evidence stays canonical.
      expect(v).not.toHaveProperty("submissionExcerpt");
      expect(v).not.toHaveProperty("submissionSha256");
    });

    it("re-submit of a previously-FAILED row that now passes DOES populate evidence", async () => {
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID });
      projectStepsFindFirst.mockResolvedValue({
        id: STEP_ID,
        projectId: PROJECT_ID,
        validationType: "exact",
        expectedOutput: "42",
        validationConfig: null,
        stepNumber: 1,
        xpReward: 10,
      });
      userStepCompletionsFindFirst.mockResolvedValue({
        id: "uc-1",
        passed: false, // prior attempt failed
        attemptCount: 2,
      });
      projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 1, title: "T", slug: "s", jobOutcomes: [] });
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
      nextPassedCount = 1;

      const app = await buildApp();
      await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "42", submissionType: "text" });

      const updates = rowsUpdatedIn("userStepCompletions");
      expect(updates).toHaveLength(1);
      const v = updates[0]!.values as any;
      expect(v.submissionExcerpt).toBe("42");
      expect(v.submissionSha256).toBe(createHash("sha256").update("42").digest("hex"));
    });

    it("excerpt is byte-capped at 4 KB but sha256 hashes the FULL submission", async () => {
      const big = "x".repeat(10_000);
      userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID });
      projectStepsFindFirst.mockResolvedValue({
        id: STEP_ID,
        projectId: PROJECT_ID,
        validationType: "contains",
        validationConfig: { needle: "x" },
        expectedOutput: null,
        stepNumber: 1,
        xpReward: 10,
      });
      userStepCompletionsFindFirst.mockResolvedValue(undefined);
      projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 1, title: "T", slug: "s", jobOutcomes: [] });
      userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
      nextPassedCount = 1;

      const app = await buildApp();
      await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: big, submissionType: "text" });

      const inserts = rowsInsertedInto("userStepCompletions");
      const v = inserts[0]!.values as any;
      expect(Buffer.byteLength(v.submissionExcerpt, "utf8")).toBe(4096);
      expect(v.submissionSha256).toBe(createHash("sha256").update(big).digest("hex"));
    });

    it("identical submissions hash to the same sha256 across requests", async () => {
      const setup = () => {
        userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID });
        projectStepsFindFirst.mockResolvedValue({
          id: STEP_ID,
          projectId: PROJECT_ID,
          validationType: "exact",
          expectedOutput: "hello world",
          validationConfig: null,
          stepNumber: 1,
          xpReward: 10,
        });
        userStepCompletionsFindFirst.mockResolvedValue(undefined);
        projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 1, title: "T", slug: "s", jobOutcomes: [] });
        userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
        nextPassedCount = 1;
      };

      setup();
      const app = await buildApp();
      await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "hello world", submissionType: "text" });
      const h1 = (rowsInsertedInto("userStepCompletions")[0]!.values as any).submissionSha256;

      insertCalls.length = 0;
      setup();
      await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
        .send({ submission: "hello world", submissionType: "text" });
      const h2 = (rowsInsertedInto("userStepCompletions")[0]!.values as any).submissionSha256;

      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
