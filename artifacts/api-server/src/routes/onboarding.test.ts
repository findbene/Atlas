/**
 * Phase 21 — GET /api/onboarding/state + POST /api/onboarding/complete.
 *
 * Pins:
 *   - Fresh user (no enrollments, !completed) → lastSeenStep=pick_course.
 *   - User with enrollments, !completed       → lastSeenStep=first_enroll.
 *   - User completed                          → lastSeenStep=null.
 *   - POST /complete on uncompleted user updates DB + invalidates cache.
 *   - POST /complete on already-completed user is a no-op (no UPDATE).
 *   - Anonymous → 401.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import request from "supertest";

const userProgressFindFirst = vi.fn();
const updateWhere = vi.fn();
const updateSet = vi.fn(() => ({ where: updateWhere }));
const updateFn = vi.fn(() => ({ set: updateSet }));
const invalidateCache = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
    },
    update: (...a: unknown[]) => updateFn(...a),
  },
  users: { id: "id" },
  userProgress: { userId: "userId" },
}));

let currentUser: { id: string; clerkId: string; onboardingCompleted: boolean } | null = null;
const requireAuth: RequestHandler = (req, res, next) => {
  if (!currentUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as Request & { localUser?: typeof currentUser }).localUser = currentUser;
  next();
};
vi.mock("../lib/auth", () => ({
  requireAuth,
  getCurrentUser: vi.fn(async () => currentUser),
  invalidateUserCache: (...a: string[]) => invalidateCache(...a),
}));

vi.mock("drizzle-orm", () => ({ eq: (...a: unknown[]) => ({ eq: a }) }));

async function buildApp() {
  const router = (await import("./onboarding")).default;
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
  currentUser = { id: "u-1", clerkId: "clerk_1", onboardingCompleted: false };
  userProgressFindFirst.mockReset().mockResolvedValue(undefined);
  updateWhere.mockReset().mockResolvedValue(undefined);
  updateSet.mockClear();
  updateFn.mockClear();
  invalidateCache.mockReset();
});

describe("GET /api/onboarding/state", () => {
  it("returns 401 when anonymous", async () => {
    currentUser = null;
    const app = await buildApp();
    expect((await request(app).get("/onboarding/state")).status).toBe(401);
  });

  it("fresh user → pick_course", async () => {
    const app = await buildApp();
    const res = await request(app).get("/onboarding/state");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ completed: false, hasEnrollments: false, lastSeenStep: "pick_course" });
  });

  it("user with enrollments but not completed → first_enroll", async () => {
    userProgressFindFirst.mockResolvedValueOnce({ id: "p-1" });
    const app = await buildApp();
    const res = await request(app).get("/onboarding/state");
    expect(res.body).toEqual({ completed: false, hasEnrollments: true, lastSeenStep: "first_enroll" });
  });

  it("completed user → lastSeenStep=null", async () => {
    currentUser = { id: "u-1", clerkId: "clerk_1", onboardingCompleted: true };
    userProgressFindFirst.mockResolvedValueOnce({ id: "p-1" });
    const app = await buildApp();
    const res = await request(app).get("/onboarding/state");
    expect(res.body).toEqual({ completed: true, hasEnrollments: true, lastSeenStep: null });
  });
});

describe("POST /api/onboarding/complete", () => {
  it("returns 401 when anonymous", async () => {
    currentUser = null;
    const app = await buildApp();
    expect((await request(app).post("/onboarding/complete")).status).toBe(401);
  });

  it("flips uncompleted user to completed; invalidates cache", async () => {
    const app = await buildApp();
    const res = await request(app).post("/onboarding/complete");
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
    expect(res.body.lastSeenStep).toBeNull();
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(invalidateCache).toHaveBeenCalledWith("clerk_1");
  });

  it("is idempotent for already-completed user (no UPDATE, no cache invalidate)", async () => {
    currentUser = { id: "u-1", clerkId: "clerk_1", onboardingCompleted: true };
    const app = await buildApp();
    const res = await request(app).post("/onboarding/complete");
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
    expect(updateFn).not.toHaveBeenCalled();
    expect(invalidateCache).not.toHaveBeenCalled();
  });
});
