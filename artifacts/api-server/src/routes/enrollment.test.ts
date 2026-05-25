/**
 * Phase 21 — POST /api/enrollments (slug-based, idempotent).
 *
 * Pins:
 *   - 200 on success with currentStepId resolved from project_steps.
 *   - Idempotent: second call returns same payload, `created=false`, no second insert.
 *   - Hidden/archived (learner_visible=false) → 404 (no existence leak).
 *   - Missing slug → 404 (same shape as hidden, no distinguishing).
 *   - Missing/empty body → 400.
 *   - Premium project, free user → 403.
 *   - Anonymous → 401.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import request from "supertest";

const projectsFindFirst = vi.fn();
const userProgressFindFirst = vi.fn();
const stepsFindFirst = vi.fn();
const insertReturning = vi.fn();
const insertValues = vi.fn(() => ({ returning: insertReturning }));
const insertFn = vi.fn(() => ({ values: insertValues }));

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
      userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
      projectSteps: { findFirst: (...a: unknown[]) => stepsFindFirst(...a) },
    },
    insert: (_table: unknown) => insertFn(),
  },
  projects: { slug: "slug", id: "id" },
  projectSteps: { projectId: "projectId", stepNumber: "stepNumber" },
  userProgress: { userId: "userId", projectId: "projectId" },
}));

let currentUser: { id: string; subscriptionTier: "free" | "pro" } | null = null;
const requireAuth: RequestHandler = (req, res, next) => {
  if (!currentUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as Request & { localUser?: typeof currentUser }).localUser = currentUser;
  next();
};
vi.mock("../lib/auth", () => ({
  requireAuth,
  getCurrentUser: vi.fn(async () => currentUser),
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
}));

async function buildApp() {
  const router = (await import("./enrollment")).default;
  const app = express();
  app.use(express.json());
  const fakeLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  app.use(((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: typeof fakeLog }).log = fakeLog;
    next();
  }) as RequestHandler);
  app.use(router);
  return app;
}

beforeEach(() => {
  currentUser = { id: "u-1", subscriptionTier: "free" };
  projectsFindFirst.mockReset();
  userProgressFindFirst.mockReset();
  stepsFindFirst.mockReset();
  insertReturning.mockReset();
  insertValues.mockClear();
  insertFn.mockClear();
});

describe("POST /api/enrollments", () => {
  it("returns 401 when anonymous", async () => {
    currentUser = null;
    const app = await buildApp();
    const res = await request(app).post("/enrollments").send({ projectSlug: "foo" });
    expect(res.status).toBe(401);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("returns 400 when projectSlug missing", async () => {
    const app = await buildApp();
    const res = await request(app).post("/enrollments").send({});
    expect(res.status).toBe(400);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown slug (no existence leak)", async () => {
    projectsFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await request(app).post("/enrollments").send({ projectSlug: "does-not-exist" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 404 for hidden (learner_visible=false) project", async () => {
    projectsFindFirst.mockResolvedValueOnce({
      id: "p-hidden", slug: "hidden-stub", isPremium: false, learnerVisible: false, totalSteps: 1,
    });
    const app = await buildApp();
    const res = await request(app).post("/enrollments").send({ projectSlug: "hidden-stub" });
    expect(res.status).toBe(404);
    // Must be indistinguishable from a missing slug.
    expect(res.body.error).toMatch(/not found/i);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("returns 403 when free user enrolls in premium project", async () => {
    projectsFindFirst.mockResolvedValueOnce({
      id: "p-pro", slug: "pro-project", isPremium: true, learnerVisible: true, totalSteps: 5,
    });
    const app = await buildApp();
    const res = await request(app).post("/enrollments").send({ projectSlug: "pro-project" });
    expect(res.status).toBe(403);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("creates enrollment when none exists; returns currentStepId from project_steps", async () => {
    projectsFindFirst.mockResolvedValueOnce({
      id: "p-1", slug: "csv-to-postgres-pipeline", isPremium: false, learnerVisible: true, totalSteps: 4,
    });
    userProgressFindFirst.mockResolvedValueOnce(undefined);
    insertReturning.mockResolvedValueOnce([{ currentStep: 1 }]);
    stepsFindFirst.mockResolvedValueOnce({ id: "step-uuid-1" });
    const app = await buildApp();
    const res = await request(app).post("/enrollments").send({ projectSlug: "csv-to-postgres-pipeline" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      projectId: "p-1",
      projectSlug: "csv-to-postgres-pipeline",
      currentStepNumber: 1,
      currentStepId: "step-uuid-1",
      created: true,
    });
    expect(insertFn).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: second enrollment returns existing row with created=false; no insert", async () => {
    projectsFindFirst.mockResolvedValueOnce({
      id: "p-1", slug: "csv-to-postgres-pipeline", isPremium: false, learnerVisible: true, totalSteps: 4,
    });
    userProgressFindFirst.mockResolvedValueOnce({ id: "prog-1", currentStep: 3 });
    stepsFindFirst.mockResolvedValueOnce({ id: "step-uuid-3" });
    const app = await buildApp();
    const res = await request(app).post("/enrollments").send({ projectSlug: "csv-to-postgres-pipeline" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      projectId: "p-1",
      currentStepNumber: 3,
      currentStepId: "step-uuid-3",
      created: false,
    });
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("idempotent under concurrent insert race: 23505 unique violation → re-read → 200 created:false", async () => {
    projectsFindFirst.mockResolvedValueOnce({
      id: "p-1", slug: "csv-to-postgres-pipeline", isPremium: false, learnerVisible: true, totalSteps: 4,
    });
    // First findFirst: no row yet (the race window).
    userProgressFindFirst.mockResolvedValueOnce(undefined);
    // INSERT fails with the unique-index violation.
    insertReturning.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" }));
    // Second findFirst (recovery re-read): now sees the winning row.
    userProgressFindFirst.mockResolvedValueOnce({ id: "prog-1", currentStep: 2 });
    stepsFindFirst.mockResolvedValueOnce({ id: "step-uuid-2" });
    const app = await buildApp();
    const res = await request(app).post("/enrollments").send({ projectSlug: "csv-to-postgres-pipeline" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      projectId: "p-1",
      currentStepNumber: 2,
      currentStepId: "step-uuid-2",
      created: false,
    });
  });

  it("non-unique-violation insert errors still surface as 500 (regression guard)", async () => {
    projectsFindFirst.mockResolvedValueOnce({
      id: "p-1", slug: "csv-to-postgres-pipeline", isPremium: false, learnerVisible: true, totalSteps: 4,
    });
    userProgressFindFirst.mockResolvedValueOnce(undefined);
    insertReturning.mockRejectedValueOnce(Object.assign(new Error("boom"), { code: "42P01" }));
    const app = await buildApp();
    const res = await request(app).post("/enrollments").send({ projectSlug: "csv-to-postgres-pipeline" });
    expect(res.status).toBe(500);
  });

  it("missing-vs-hidden 404 body is byte-identical (no existence leak)", async () => {
    const app = await buildApp();
    projectsFindFirst.mockResolvedValueOnce(undefined);
    const missing = await request(app).post("/enrollments").send({ projectSlug: "does-not-exist" });
    projectsFindFirst.mockResolvedValueOnce({
      id: "p-hidden", slug: "hidden", isPremium: false, learnerVisible: false, totalSteps: 1,
    });
    const hidden = await request(app).post("/enrollments").send({ projectSlug: "hidden" });
    expect(missing.status).toBe(404);
    expect(hidden.status).toBe(404);
    expect(missing.body).toEqual(hidden.body);
  });

  it("returns currentStepId=null when project has no matching step row (defensive)", async () => {
    projectsFindFirst.mockResolvedValueOnce({
      id: "p-1", slug: "weird", isPremium: false, learnerVisible: true, totalSteps: 0,
    });
    userProgressFindFirst.mockResolvedValueOnce(undefined);
    insertReturning.mockResolvedValueOnce([{ currentStep: 1 }]);
    stepsFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await request(app).post("/enrollments").send({ projectSlug: "weird" });
    expect(res.status).toBe(200);
    expect(res.body.currentStepId).toBeNull();
  });
});
