/**
 * Tests for GET /projects/:slug/solution — the Pro-gated, engagement-gated
 * reference solution endpoint. Locks in the 402 (non-Pro), 403 (engagement
 * gate), 404 (no solution row), 200 (success) ladder.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const currentUser: {
  id: string;
  subscriptionTier: "free" | "pro";
} = { id: "00000000-0000-0000-0000-000000000001", subscriptionTier: "free" };

vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCurrentUser: vi.fn(async () => currentUser),
  getOrCreateUser: vi.fn(async () => currentUser),
  invalidateUserCache: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(() => ({ userId: "clerk_test_user" })),
}));

const projectFindFirst = vi.fn();
const userProgressFindFirst = vi.fn();
const stepCompletionsFindMany = vi.fn();
const projectSolutionsFindFirst = vi.fn();
// Other route methods on projects.ts reach into these too — stubbed as no-ops
// so import-time `router.get("/projects", ...)` and friends don't throw.
const noop = vi.fn().mockResolvedValue([]);

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: unknown[]) => projectFindFirst(...a), findMany: noop },
      projectSteps: { findMany: noop, findFirst: noop },
      projectHints: { findMany: noop },
      domains: { findFirst: noop, findMany: noop },
      userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a), findMany: noop },
      userStepCompletions: {
        findFirst: noop,
        findMany: (...a: unknown[]) => stepCompletionsFindMany(...a),
      },
      projectSolutions: { findFirst: (...a: unknown[]) => projectSolutionsFindFirst(...a) },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
  },
  projects: {},
  projectSteps: {},
  projectHints: {},
  domains: {},
  userProgress: {},
  userStepCompletions: {},
  projectSolutions: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  isNull: (...a: unknown[]) => ({ isNull: a }),
}));

async function buildApp() {
  const router = (await import("./projects")).default;
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

beforeEach(() => {
  currentUser.subscriptionTier = "free";
  projectFindFirst.mockReset().mockResolvedValue({ id: PROJECT_ID });
  userProgressFindFirst.mockReset().mockResolvedValue(undefined);
  stepCompletionsFindMany.mockReset().mockResolvedValue([]);
  projectSolutionsFindFirst.mockReset().mockResolvedValue(undefined);
});

describe("GET /projects/:slug/solution", () => {
  it("returns 404 when the project doesn't exist", async () => {
    projectFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await request(app).get("/projects/missing/solution");
    expect(res.status).toBe(404);
  });

  it("returns 402 for free-tier users (Pro gate)", async () => {
    const app = await buildApp();
    const res = await request(app).get("/projects/ingest-pipeline/solution");
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/pro/i);
    // Critical: don't even hit the solutions table for non-Pro users.
    expect(projectSolutionsFindFirst).not.toHaveBeenCalled();
  });

  it("returns 403 for Pro users who haven't engaged with the project", async () => {
    currentUser.subscriptionTier = "pro";
    // No progress row + no completed steps => engagement gate fires.
    userProgressFindFirst.mockResolvedValueOnce(undefined);
    stepCompletionsFindMany.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await request(app).get("/projects/ingest-pipeline/solution");
    expect(res.status).toBe(403);
    expect(projectSolutionsFindFirst).not.toHaveBeenCalled();
  });

  it("allows Pro users with completions even when the progress row is missing", async () => {
    currentUser.subscriptionTier = "pro";
    userProgressFindFirst.mockResolvedValueOnce(undefined);
    stepCompletionsFindMany.mockResolvedValueOnce([{ id: "x" }]);
    projectSolutionsFindFirst.mockResolvedValueOnce({
      solutionCode: "print('ok')",
      solutionExplanationMd: "ok",
      videoExplanationUrl: null,
    });
    const app = await buildApp();
    const res = await request(app).get("/projects/ingest-pipeline/solution");
    expect(res.status).toBe(200);
  });

  it("returns 403 for Pro users still on step 1 with no completions", async () => {
    currentUser.subscriptionTier = "pro";
    userProgressFindFirst.mockResolvedValueOnce({ currentStep: 1 });
    stepCompletionsFindMany.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await request(app).get("/projects/ingest-pipeline/solution");
    expect(res.status).toBe(403);
  });

  it("allows Pro users past step 1 even without explicit completions", async () => {
    currentUser.subscriptionTier = "pro";
    userProgressFindFirst.mockResolvedValueOnce({ currentStep: 2 });
    stepCompletionsFindMany.mockResolvedValueOnce([]);
    projectSolutionsFindFirst.mockResolvedValueOnce({
      solutionCode: "print('ok')",
      solutionExplanationMd: "Use a generator.",
      videoExplanationUrl: null,
    });
    const app = await buildApp();
    const res = await request(app).get("/projects/ingest-pipeline/solution");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      solutionCode: "print('ok')",
      explanationMd: "Use a generator.",
      videoUrl: null,
    });
  });

  it("allows Pro users on step 1 if they have at least one completion", async () => {
    currentUser.subscriptionTier = "pro";
    userProgressFindFirst.mockResolvedValueOnce({ currentStep: 1 });
    stepCompletionsFindMany.mockResolvedValueOnce([{ id: "x" }]);
    projectSolutionsFindFirst.mockResolvedValueOnce({
      solutionCode: null,
      solutionExplanationMd: "Explanation only.",
      videoExplanationUrl: null,
    });
    const app = await buildApp();
    const res = await request(app).get("/projects/ingest-pipeline/solution");
    expect(res.status).toBe(200);
  });

  it("returns 404 when the project has no published solution row", async () => {
    currentUser.subscriptionTier = "pro";
    userProgressFindFirst.mockResolvedValueOnce({ currentStep: 5 });
    stepCompletionsFindMany.mockResolvedValueOnce([{ id: "x" }]);
    projectSolutionsFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await request(app).get("/projects/ingest-pipeline/solution");
    expect(res.status).toBe(404);
  });
});
