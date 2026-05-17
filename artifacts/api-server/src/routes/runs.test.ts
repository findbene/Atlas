/**
 * Server-side tests for POST/GET/DELETE /runs. Locks in auth scoping (a user
 * can never read or delete another user's runs), payload-size clipping, and
 * the cross-project step validation added alongside this test.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  subscriptionTier: "free",
  aiTutorLastReadAt: null,
};
vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCurrentUser: vi.fn().mockResolvedValue(TEST_USER),
  invalidateUserCache: vi.fn(),
}));

// Spies the tests reach into to assert what was written / read.
const projectsFindFirst = vi.fn();
const projectStepsFindFirst = vi.fn();
const userCodeRunsFindMany = vi.fn();
const insertValuesSpy = vi.fn().mockResolvedValue(undefined);
const executeSpy = vi.fn().mockResolvedValue({ rowCount: 1 });

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
      projectSteps: { findFirst: (...a: unknown[]) => projectStepsFindFirst(...a) },
      userCodeRuns: { findMany: (...a: unknown[]) => userCodeRunsFindMany(...a) },
    },
    insert: vi.fn(() => ({ values: insertValuesSpy })),
    execute: (...a: unknown[]) => executeSpy(...a),
  },
  userCodeRuns: {
    userId: "userId",
    projectId: "projectId",
    stepId: "stepId",
    createdAt: "createdAt",
  },
  projects: { id: "id" },
  projectSteps: { id: "id", projectId: "projectId" },
}));

// drizzle-orm helpers are referenced but not introspected — opaque sentinels.
vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({ sql: { strings, vals } }),
    {},
  ),
}));

async function buildApp() {
  const runsRouter = (await import("./runs")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  app.use(runsRouter);
  return app;
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const STEP_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_STEP_ID = "33333333-3333-3333-3333-333333333333";
const RUN_ID = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  projectsFindFirst.mockReset().mockResolvedValue({ id: PROJECT_ID });
  projectStepsFindFirst.mockReset().mockResolvedValue({ id: STEP_ID });
  userCodeRunsFindMany.mockReset().mockResolvedValue([]);
  insertValuesSpy.mockClear();
  executeSpy.mockClear().mockResolvedValue({ rowCount: 1 });
});

describe("POST /runs", () => {
  it("rejects an invalid projectId UUID", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/runs")
      .send({ projectId: "not-a-uuid", code: "print(1)", ok: true });
    expect(res.status).toBe(400);
    expect(insertValuesSpy).not.toHaveBeenCalled();
  });

  it("rejects a request with no code", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/runs")
      .send({ projectId: PROJECT_ID, code: "", ok: true });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the project doesn't exist", async () => {
    projectsFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await request(app)
      .post("/runs")
      .send({ projectId: PROJECT_ID, code: "print(1)", ok: true });
    expect(res.status).toBe(404);
    expect(insertValuesSpy).not.toHaveBeenCalled();
  });

  it("clips oversized code/stdout/stderr payloads", async () => {
    const app = await buildApp();
    const huge = "x".repeat(20_000);
    const res = await request(app)
      .post("/runs")
      .send({
        projectId: PROJECT_ID, stepId: STEP_ID,
        code: huge, stdout: huge, stderr: huge, ok: false,
      });
    expect(res.status).toBe(201);
    expect(insertValuesSpy).toHaveBeenCalledTimes(1);
    const payload = insertValuesSpy.mock.calls[0][0] as { code: string; stdout: string; stderr: string };
    expect(payload.code.length).toBeLessThan(huge.length);
    expect(payload.stdout.length).toBeLessThan(huge.length);
    expect(payload.stderr.length).toBeLessThan(huge.length);
    expect(payload.code).toMatch(/truncated/);
  });

  it("nulls a stepId that belongs to a different project", async () => {
    // Step lookup with (id, projectId) returns nothing => stepId is sanitized to null.
    projectStepsFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await request(app)
      .post("/runs")
      .send({
        projectId: PROJECT_ID, stepId: OTHER_STEP_ID,
        code: "print(1)", ok: true,
      });
    expect(res.status).toBe(201);
    const payload = insertValuesSpy.mock.calls[0][0] as { stepId: string | null };
    expect(payload.stepId).toBeNull();
  });

  it("records a valid run with the supplied stepId when it matches the project", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/runs")
      .send({
        projectId: PROJECT_ID, stepId: STEP_ID,
        code: "print(1)", stdout: "1\n", stderr: "", ok: true,
      });
    expect(res.status).toBe(201);
    const payload = insertValuesSpy.mock.calls[0][0] as {
      userId: string; projectId: string; stepId: string | null; ok: boolean;
    };
    expect(payload).toMatchObject({
      userId: TEST_USER.id,
      projectId: PROJECT_ID,
      stepId: STEP_ID,
      ok: true,
    });
  });
});

describe("GET /runs", () => {
  it("requires stepId or projectId", async () => {
    const app = await buildApp();
    const res = await request(app).get("/runs");
    expect(res.status).toBe(400);
  });

  it("scopes the query to the current user when projectId is supplied", async () => {
    userCodeRunsFindMany.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await request(app).get(`/runs?projectId=${PROJECT_ID}`);
    expect(res.status).toBe(200);
    const args = userCodeRunsFindMany.mock.calls[0][0] as { where: unknown };
    const stringified = JSON.stringify(args.where);
    expect(stringified).toContain("userId");
    expect(stringified).toContain("projectId");
  });

  it("scopes the query to the current user when stepId is supplied", async () => {
    const sample = [{
      id: RUN_ID,
      code: "print(1)",
      stdout: "1\n",
      stderr: "",
      ok: true,
      createdAt: new Date("2026-05-16T00:00:00.000Z"),
    }];
    userCodeRunsFindMany.mockResolvedValueOnce(sample);
    const app = await buildApp();
    const res = await request(app).get(`/runs?stepId=${STEP_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: RUN_ID, ok: true });
    // The where clause passed to findMany should reference both userId and stepId.
    const args = userCodeRunsFindMany.mock.calls[0][0] as { where: { and: unknown[] } };
    const stringified = JSON.stringify(args.where);
    expect(stringified).toContain("userId");
    expect(stringified).toContain("stepId");
  });
});

describe("DELETE /runs/:id", () => {
  it("rejects an invalid uuid without hitting the DB", async () => {
    const app = await buildApp();
    const res = await request(app).delete("/runs/not-a-uuid");
    expect(res.status).toBe(400);
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("scopes the DELETE to the current user's id", async () => {
    const app = await buildApp();
    const res = await request(app).delete(`/runs/${RUN_ID}`);
    expect(res.status).toBe(200);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    // The SQL fragment built by `sql` carries the bound values — verify the
    // current user's id is in there so another user can't delete this row.
    const sqlFrag = executeSpy.mock.calls[0][0] as { sql: { vals: unknown[] } };
    expect(sqlFrag.sql.vals).toContain(TEST_USER.id);
    expect(sqlFrag.sql.vals).toContain(RUN_ID);
  });
});
