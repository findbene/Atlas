/**
 * Phase 8 regression — `GET /api/admin/quality` must be gated by
 * `requireAdmin`. Locks in three outcomes:
 *   - anonymous (no req.localUser)        → 401 via underlying requireAuth
 *   - authed non-admin (role='learner')   → 403
 *   - authed admin    (role='admin')      → 200 with summary shape
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

const projectsFindMany = vi.fn();
const candidatesFindMany = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: { findMany: (...a: unknown[]) => projectsFindMany(...a) },
      projectCandidates: { findMany: (...a: unknown[]) => candidatesFindMany(...a) },
    },
  },
  projects: {},
  projectCandidates: {},
}));
vi.mock("drizzle-orm", () => ({ asc: (a: unknown) => ({ asc: a }) }));

// Stub the auth module so the test fully owns the auth state injected
// into each request — no Clerk roundtrips.
let currentRole: "anon" | "learner" | "admin" = "anon";
vi.mock("../lib/auth", () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    if (currentRole === "anon") return res.status(401).json({ error: "unauthorized" });
    (req as Request & { localUser?: { id: string; role: string } }).localUser = {
      id: "u-1", role: currentRole,
    };
    next();
  },
  requireAdmin: (req: Request, res: Response, next: NextFunction) => {
    if (currentRole === "anon") return res.status(401).json({ error: "unauthorized" });
    (req as Request & { localUser?: { id: string; role: string } }).localUser = {
      id: "u-1", role: currentRole,
    };
    if (currentRole !== "admin") return res.status(403).json({ error: "admin role required" });
    next();
  },
}));

async function buildApp() {
  const router = (await import("./admin")).default;
  const app = express();
  app.use((req, _res, next) => {
    (req as Request & { log: unknown }).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(router);
  return app;
}

beforeEach(() => {
  projectsFindMany.mockReset().mockResolvedValue([]);
  candidatesFindMany.mockReset().mockResolvedValue([]);
});

describe("GET /api/admin/quality (Phase 8 authz)", () => {
  it("returns 401 for anonymous requests", async () => {
    currentRole = "anon";
    const app = await buildApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(401);
  });

  it("returns 403 for authenticated non-admin requests", async () => {
    currentRole = "learner";
    const app = await buildApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it("returns 200 with the summary shape for admin requests", async () => {
    currentRole = "admin";
    const app = await buildApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totals: { projects: 0, candidates: 0 },
      statusFunnel: expect.any(Object),
      courseSourceFunnel: { authored: 0, heuristic_legacy: 0, unset: 0 },
      lineage: [],
    });
  });
});
