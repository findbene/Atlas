/**
 * Phase 51 — `GET /api/admin/envelope/metrics` authz + payload shape.
 *
 * Mirrors the `admin.test.ts` mocking pattern: stubs `requireAdmin`,
 * isolates the route, asserts:
 *   - anonymous → 401
 *   - non-admin → 403
 *   - admin → 200 with the expected metrics snapshot shape
 *   - counters wired to the route reflect prior in-process records
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import request from "supertest";

vi.mock("@workspace/db", () => ({
  db: { execute: vi.fn(), query: {
    projects: { findMany: vi.fn().mockResolvedValue([]) },
    projectCandidates: { findMany: vi.fn().mockResolvedValue([]) },
  }},
  projects: {}, projectCandidates: {}, userProgress: {},
}));
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return { ...actual, asc: (a: unknown) => ({ asc: a }) };
});

let currentRole: "anon" | "learner" | "admin" = "anon";
const requireAuth: RequestHandler = (req, res, next) => {
  if (currentRole === "anon") { res.status(401).json({ error: "unauthorized" }); return; }
  (req as Request & { localUser?: { id: string; role: string } }).localUser = { id: "u-1", role: currentRole };
  next();
};
const requireAdmin: RequestHandler = (req, res, next) => {
  if (currentRole === "anon") { res.status(401).json({ error: "unauthorized" }); return; }
  (req as Request & { localUser?: { id: string; role: string } }).localUser = { id: "u-1", role: currentRole };
  if (currentRole !== "admin") { res.status(403).json({ error: "admin role required" }); return; }
  next();
};
vi.mock("../lib/auth", () => ({ requireAuth, requireAdmin }));

async function buildApp() {
  const router = (await import("./admin")).default;
  const app = express();
  const fakeLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  app.use(((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: typeof fakeLog }).log = fakeLog;
    next();
  }) as RequestHandler);
  app.use(router);
  return app;
}

beforeEach(async () => {
  const { __resetMetricsForTests } = await import("../lib/envelopeMetrics");
  __resetMetricsForTests();
});

describe("GET /api/admin/envelope/metrics — authz", () => {
  it("anonymous → 401", async () => {
    currentRole = "anon";
    const res = await request(await buildApp()).get("/api/admin/envelope/metrics");
    expect(res.status).toBe(401);
  });

  it("authed non-admin → 403", async () => {
    currentRole = "learner";
    const res = await request(await buildApp()).get("/api/admin/envelope/metrics");
    expect(res.status).toBe(403);
  });

  it("admin → 200 with zeroed metrics shape", async () => {
    currentRole = "admin";
    const res = await request(await buildApp()).get("/api/admin/envelope/metrics");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uptimeMs: expect.any(Number),
      windowMs: expect.any(Number),
      verify: {
        ok: 0,
        failed: {},
        total: 0,
        successRate: 0,
        durationMs: { p50: 0, p95: 0, p99: 0, samples: 0 },
      },
      fallback: { kind_not_enabled: 0, canary_bucket_skip: 0 },
      envelopesObserved: 0,
      fallbackRate: 0,
    });
  });
});

describe("GET /api/admin/envelope/metrics — counter reflection", () => {
  beforeEach(() => { currentRole = "admin"; });

  it("reflects prior verify ok + failure + fallback records", async () => {
    const { recordVerifyOk, recordVerifyFailed, recordFallback } =
      await import("../lib/envelopeMetrics");
    recordVerifyOk(10);
    recordVerifyOk(20);
    recordVerifyOk(30);
    recordVerifyFailed("envelope_replay", 5);
    recordFallback("canary_bucket_skip");
    recordFallback("canary_bucket_skip");
    recordFallback("kind_not_enabled");

    const res = await request(await buildApp()).get("/api/admin/envelope/metrics");
    expect(res.status).toBe(200);
    expect(res.body.verify.ok).toBe(3);
    expect(res.body.verify.failed.envelope_replay).toBe(1);
    expect(res.body.verify.total).toBe(4);
    expect(res.body.verify.successRate).toBeCloseTo(0.75, 4);
    expect(res.body.verify.durationMs.samples).toBe(4);
    expect(res.body.fallback.canary_bucket_skip).toBe(2);
    expect(res.body.fallback.kind_not_enabled).toBe(1);
    expect(res.body.envelopesObserved).toBe(7);
  });

  it("response body contains no user/project/step identifiers", async () => {
    const { recordVerifyOk } = await import("../lib/envelopeMetrics");
    recordVerifyOk(10);
    const res = await request(await buildApp()).get("/api/admin/envelope/metrics");
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/userId/i);
    expect(body).not.toMatch(/projectId/i);
    expect(body).not.toMatch(/stepId/i);
    expect(body).not.toMatch(/nonce/i);
  });
});
