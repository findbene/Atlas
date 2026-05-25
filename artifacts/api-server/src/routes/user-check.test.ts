/**
 * Phase 24 — Server-side tests for POST /user/projects/:projectId/steps/:stepId/check.
 *
 * Locks in the no-commit contract: the endpoint must never mutate
 * user_step_completions, userProgress, userXp, or userStreaks; never
 * fire a completion email; and never include xpEarned/attempt/
 * isFirstPass/projectComplete in the response.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

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

const insertSpy = vi.fn();
const updateSpy = vi.fn();
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
    insert: vi.fn(() => ({ values: insertSpy })),
    update: vi.fn(() => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) })),
  },
  users: {},
  userProgress: { userId: "u", projectId: "p", id: "id", status: "status" },
  userXp: { userId: "u" },
  userStreaks: { userId: "u" },
  xpTransactions: {},
  projects: { id: "id" },
  projectSteps: { id: "id", projectId: "projectId" },
  userStepCompletions: { userId: "u", projectId: "p", stepNumber: "n", id: "id" },
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
const OTHER_PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const STEP_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  userProgressFindFirst.mockReset();
  projectStepsFindFirst.mockReset();
  userStepCompletionsFindFirst.mockReset();
  projectsFindFirst.mockReset();
  userXpFindFirst.mockReset();
  insertSpy.mockReset();
  updateSpy.mockReset();
  sendEmailSpy.mockClear();
  bumpStreakSpy.mockClear();
});

describe("POST /user/projects/:projectId/steps/:stepId/check", () => {
  it("passes for a matching `exact` step and returns no commit fields", async () => {
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
    const app = await buildApp();

    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/check`)
      .send({ submission: "42", submissionType: "text" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("passed");
    expect(res.body.feedback).toBe("Correct!");
    // Contract: NONE of these fields may appear on a check response.
    expect(res.body).not.toHaveProperty("xpEarned");
    expect(res.body).not.toHaveProperty("attempt");
    expect(res.body).not.toHaveProperty("isFirstPass");
    expect(res.body).not.toHaveProperty("projectComplete");
  });

  it("fails for a non-matching `contains` step", async () => {
    userProgressFindFirst.mockResolvedValue({ id: "prog-1" });
    projectStepsFindFirst.mockResolvedValue({
      id: STEP_ID,
      projectId: PROJECT_ID,
      validationType: "contains",
      validationConfig: { needle: "hello" },
      expectedOutput: null,
      stepNumber: 1,
    });
    const app = await buildApp();

    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/check`)
      .send({ submission: "goodbye" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.feedback).toMatch(/hello/);
  });

  it("invariant: 5 consecutive checks perform ZERO DB writes and ZERO side effects", async () => {
    userProgressFindFirst.mockResolvedValue({ id: "prog-1" });
    projectStepsFindFirst.mockResolvedValue({
      id: STEP_ID,
      projectId: PROJECT_ID,
      validationType: "exact",
      expectedOutput: "42",
      validationConfig: null,
      stepNumber: 1,
    });
    const app = await buildApp();

    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/check`)
        .send({ submission: i === 4 ? "42" : "nope" });
      expect(r.status).toBe(200);
    }

    expect(insertSpy).not.toHaveBeenCalled();
    // `db.update` is a vi.fn() in the mock; assert it was never called either.
    const { db } = await import("@workspace/db");
    expect((db as any).update).not.toHaveBeenCalled();
    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(bumpStreakSpy).not.toHaveBeenCalled();
    // user_step_completions is never even queried by /check (only /submit needs it).
    expect(userStepCompletionsFindFirst).not.toHaveBeenCalled();
  });

  it("403 when learner is not enrolled in the project", async () => {
    userProgressFindFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/check`)
      .send({ submission: "x" });
    expect(res.status).toBe(403);
    // Step lookup must NOT happen before the enrollment gate (no leak of step existence).
    expect(projectStepsFindFirst).not.toHaveBeenCalled();
  });

  it("404 when the step belongs to a different project", async () => {
    userProgressFindFirst.mockResolvedValue({ id: "prog-1" });
    projectStepsFindFirst.mockResolvedValue({
      id: STEP_ID,
      projectId: OTHER_PROJECT_ID, // mismatch
      validationType: "exact",
      expectedOutput: "42",
    });
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/check`)
      .send({ submission: "42" });
    expect(res.status).toBe(404);
  });

  it("404 when the step does not exist", async () => {
    userProgressFindFirst.mockResolvedValue({ id: "prog-1" });
    projectStepsFindFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/check`)
      .send({ submission: "42" });
    expect(res.status).toBe(404);
  });
});
