/**
 * Phase 32 — learner-mode endpoints.
 *
 * Pins:
 *   - 401 anonymous on both endpoints.
 *   - PATCH valid mode → 200 + UPDATE called with caller's userId + correct projectId.
 *   - PATCH invalid mode → 400, no UPDATE.
 *   - PATCH non-enrolled → 404, no UPDATE.
 *   - PATCH unknown slug → 404, no UPDATE.
 *   - GET recommendation flows signals through recommendLearnerMode.
 *   - GET non-enrolled → 404.
 *   - userId never sourced from path/body.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import request from "supertest";

const projectsFindFirst = vi.fn();
const userProgressFindFirst = vi.fn();

const updateWhere = vi.fn();
const updateSet = vi.fn(() => ({ where: updateWhere }));
const updateFn = vi.fn(() => ({ set: updateSet }));

// chainable select() → from() → where() that resolves to an array
function makeSelect(rows: unknown[]) {
  return {
    from: () => ({ where: () => Promise.resolve(rows) }),
  };
}
let priorRows: unknown[] = [];
let stepRows: unknown[] = [];
let hintRows: unknown[] = [];
let selectCallIdx = 0;
const selectFn = vi.fn(() => {
  const idx = selectCallIdx++;
  if (idx === 0) return makeSelect(priorRows);
  if (idx === 1) return makeSelect(stepRows);
  return makeSelect(hintRows);
});

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
      userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
    },
    update: (_t: unknown) => updateFn(),
    select: (_a?: unknown) => selectFn(),
  },
  projects: { slug: "slug", id: "id" },
  userProgress: { userId: "userId", projectId: "projectId", status: "status", learningMode: "learningMode" },
  userStepCompletions: { userId: "userId", projectId: "projectId", passed: "passed", attemptCount: "attemptCount" },
  userProjectStepHints: { userId: "userId", projectId: "projectId", hintLevel: "hintLevel" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => ({ sql: strings.join("?") }),
    { raw: (s: string) => ({ raw: s }) },
  ),
}));

let currentUser: { id: string; clerkId: string } | null = null;
const requireAuth: RequestHandler = (req, res, next) => {
  if (!currentUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as Request & { localUser?: typeof currentUser }).localUser = currentUser;
  next();
};
vi.mock("../lib/auth", () => ({
  requireAuth,
  getCurrentUser: vi.fn(async () => currentUser),
}));

async function buildApp() {
  const router = (await import("./learner-mode")).default;
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
  currentUser = { id: "user-1", clerkId: "clerk_1" };
  projectsFindFirst.mockReset().mockResolvedValue({ id: "proj-A", slug: "csv-to-postgres-pipeline" });
  userProgressFindFirst.mockReset().mockResolvedValue({ learningMode: "guided" });
  updateWhere.mockReset().mockResolvedValue(undefined);
  updateSet.mockClear();
  updateFn.mockClear();
  selectFn.mockClear();
  selectCallIdx = 0;
  priorRows = [{ n: 0 }];
  stepRows = [{ passedCount: 0, attemptsSum: 0 }];
  hintRows = [{ maxLevel: 0 }];
});

describe("PATCH /user/projects/:slug/learning-mode", () => {
  it("401 when anonymous", async () => {
    currentUser = null;
    const app = await buildApp();
    const r = await request(app).patch("/user/projects/x/learning-mode").send({ mode: "hint" });
    expect(r.status).toBe(401);
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("400 on invalid mode value, no UPDATE", async () => {
    const app = await buildApp();
    const r = await request(app).patch("/user/projects/x/learning-mode").send({ mode: "TURBO" });
    expect(r.status).toBe(400);
    expect(r.body.validModes).toEqual(["guided", "hint", "independent", "dynamic_ai_adaptive"]);
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("400 on missing mode body, no UPDATE", async () => {
    const app = await buildApp();
    const r = await request(app).patch("/user/projects/x/learning-mode").send({});
    expect(r.status).toBe(400);
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("404 on unknown slug, no UPDATE", async () => {
    projectsFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const r = await request(app).patch("/user/projects/nope/learning-mode").send({ mode: "hint" });
    expect(r.status).toBe(404);
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("404 when not enrolled, no UPDATE", async () => {
    userProgressFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const r = await request(app).patch("/user/projects/x/learning-mode").send({ mode: "hint" });
    expect(r.status).toBe(404);
    expect(updateFn).not.toHaveBeenCalled();
  });

  it.each(["guided", "hint", "independent", "dynamic_ai_adaptive"] as const)(
    "accepts %s and persists via UPDATE scoped to caller + project",
    async (mode) => {
      const app = await buildApp();
      const r = await request(app).patch("/user/projects/csv-to-postgres-pipeline/learning-mode").send({ mode });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ slug: "csv-to-postgres-pipeline", learningMode: mode });
      expect(updateSet).toHaveBeenCalledTimes(1);
      const setArg = (updateSet.mock.calls[0] as unknown as [{ learningMode: string }])[0];
      expect(setArg.learningMode).toBe(mode);
      // WHERE clause must reference caller's userId and the resolved projectId.
      expect(updateWhere).toHaveBeenCalledTimes(1);
      const whereArg = JSON.stringify((updateWhere.mock.calls[0] as unknown as [unknown])[0]);
      expect(whereArg).toContain("user-1");
      expect(whereArg).toContain("proj-A");
    },
  );
});

describe("GET /user/projects/:slug/learning-mode/recommendation", () => {
  it("401 when anonymous", async () => {
    currentUser = null;
    const app = await buildApp();
    expect((await request(app).get("/user/projects/x/learning-mode/recommendation")).status).toBe(401);
  });

  it("404 on unknown slug", async () => {
    projectsFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    expect((await request(app).get("/user/projects/nope/learning-mode/recommendation")).status).toBe(404);
  });

  it("404 when not enrolled", async () => {
    userProgressFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    expect((await request(app).get("/user/projects/x/learning-mode/recommendation")).status).toBe(404);
  });

  it("fresh learner → guided / fresh-start with echoed signals", async () => {
    const app = await buildApp();
    const r = await request(app).get("/user/projects/csv-to-postgres-pipeline/learning-mode/recommendation");
    expect(r.status).toBe(200);
    expect(r.body.recommendedMode).toBe("guided");
    expect(r.body.reasonCode).toBe("fresh-start");
    expect(r.body.signals).toEqual({
      priorCompletedProjects: 0,
      currentProjectAttempts: 0,
      currentProjectStepsCompleted: 0,
      currentProjectHintLevelMax: 0,
      currentMode: "guided",
    });
  });

  it("experienced + struggling-in-independent → recommends hint", async () => {
    userProgressFindFirst.mockResolvedValueOnce({ learningMode: "independent" });
    priorRows = [{ n: 4 }];
    stepRows = [{ passedCount: 3, attemptsSum: 20 }];
    hintRows = [{ maxLevel: 0 }];
    const app = await buildApp();
    const r = await request(app).get("/user/projects/x/learning-mode/recommendation");
    expect(r.status).toBe(200);
    expect(r.body.recommendedMode).toBe("hint");
    expect(r.body.reasonCode).toBe("struggling-step-back");
    // failedAttempts = totalAttempts(20) - stepsCompleted(3) = 17.
    expect(r.body.signals.currentProjectAttempts).toBe(17);
  });

  it("clamps negative attempt math at zero (never goes below 0)", async () => {
    priorRows = [{ n: 0 }];
    stepRows = [{ passedCount: 5, attemptsSum: 2 }]; // pathological: more passes than attempts
    hintRows = [{ maxLevel: 0 }];
    const app = await buildApp();
    const r = await request(app).get("/user/projects/x/learning-mode/recommendation");
    expect(r.status).toBe(200);
    expect(r.body.signals.currentProjectAttempts).toBe(0);
  });
});
