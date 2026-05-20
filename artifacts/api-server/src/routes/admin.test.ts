/**
 * Phase 8 regression — `GET /api/admin/quality` must be gated by
 * `requireAdmin`. Locks in three outcomes:
 *   - anonymous (no req.localUser)        → 401 via underlying requireAuth
 *   - authed non-admin (role='learner')   → 403
 *   - authed admin    (role='admin')      → 200 with summary shape
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
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
const requireAuth: RequestHandler = (req, res, next) => {
  if (currentRole === "anon") { res.status(401).json({ error: "unauthorized" }); return; }
  (req as Request & { localUser?: { id: string; role: string } }).localUser = {
    id: "u-1", role: currentRole,
  };
  next();
};
const requireAdmin: RequestHandler = (req, res, next) => {
  if (currentRole === "anon") { res.status(401).json({ error: "unauthorized" }); return; }
  (req as Request & { localUser?: { id: string; role: string } }).localUser = {
    id: "u-1", role: currentRole,
  };
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
      inverseLineage: [],
      lineageIntegrity: {
        promotedProjects: 0,
        candidatesWithInverse: 0,
        mismatches: 0,
        inverseMismatches: 0,
        duplicateCandidatePromotions: 0,
      },
    });
  });
});

// Phase 9 — bidirectional invariant assertions. The contract is:
//   projects.source_candidate_id  ↔  project_candidates.promoted_project_id
// must be a strict 1-to-1 mapping (or both NULL on either side).
//
// These tests drive the admin route with synthetic project/candidate rows
// and assert lineageIntegrity catches each failure mode the architect flagged.
describe("GET /api/admin/quality bidirectional lineage invariant (Phase 9)", () => {
  beforeEach(() => { currentRole = "admin"; });

  const baseProject = {
    qualityStatus: "approved", qualityBreakdown: null,
    course: "data-engineering", courseSource: "authored", orderIndex: 0,
  };
  const baseCandidate = {
    proposedTitle: "t", status: "approved", source: "phase9_upgrade",
  };

  it("reports zero mismatches when both directions agree (happy path)", async () => {
    projectsFindMany.mockResolvedValue([
      { id: "P1", slug: "alpha", ...baseProject, sourceCandidateId: "C1" },
      { id: "P2", slug: "beta",  ...baseProject, sourceCandidateId: "C2" },
    ]);
    candidatesFindMany.mockResolvedValue([
      { id: "C1", ...baseCandidate, promotedProjectId: "P1" },
      { id: "C2", ...baseCandidate, promotedProjectId: "P2" },
    ]);
    const res = await request(await buildApp()).get("/api/admin/quality");
    expect(res.status).toBe(200);
    expect(res.body.lineageIntegrity).toEqual({
      promotedProjects: 2, candidatesWithInverse: 2,
      mismatches: 0, inverseMismatches: 0, duplicateCandidatePromotions: 0,
    });
  });

  it("flags `mismatches` when project→candidate FK is broken", async () => {
    // Project P1 claims candidate C1, but C1 doesn't point back.
    projectsFindMany.mockResolvedValue([
      { id: "P1", slug: "alpha", ...baseProject, sourceCandidateId: "C1" },
    ]);
    candidatesFindMany.mockResolvedValue([
      { id: "C1", ...baseCandidate, promotedProjectId: null },
    ]);
    const res = await request(await buildApp()).get("/api/admin/quality");
    expect(res.body.lineageIntegrity.mismatches).toBe(1);
    // Also catches the inverse direction zero (candidate has no FK at all).
    expect(res.body.lineageIntegrity.inverseMismatches).toBe(0);
  });

  it("flags `inverseMismatches` when candidate→project FK points at the wrong project", async () => {
    // Candidate C1 claims project P1, but P1's source_candidate_id is different.
    projectsFindMany.mockResolvedValue([
      { id: "P1", slug: "alpha", ...baseProject, sourceCandidateId: "C_OTHER" },
    ]);
    candidatesFindMany.mockResolvedValue([
      { id: "C1", ...baseCandidate, promotedProjectId: "P1" },
      { id: "C_OTHER", ...baseCandidate, promotedProjectId: null },
    ]);
    const res = await request(await buildApp()).get("/api/admin/quality");
    expect(res.body.lineageIntegrity.inverseMismatches).toBe(1);
  });

  it("flags `duplicateCandidatePromotions` when 2+ candidates claim the same project", async () => {
    // Both C1 and C2 promoted to P1 — invariant violation.
    projectsFindMany.mockResolvedValue([
      { id: "P1", slug: "alpha", ...baseProject, sourceCandidateId: "C1" },
    ]);
    candidatesFindMany.mockResolvedValue([
      { id: "C1", ...baseCandidate, promotedProjectId: "P1" },
      { id: "C2", ...baseCandidate, promotedProjectId: "P1" },
    ]);
    const res = await request(await buildApp()).get("/api/admin/quality");
    expect(res.body.lineageIntegrity.duplicateCandidatePromotions).toBe(1);
    // C2's promotedProjectId points at P1, whose source_candidate_id is C1 — that's also an inverse mismatch.
    expect(res.body.lineageIntegrity.inverseMismatches).toBeGreaterThanOrEqual(1);
  });

  it("ignores projects with NULL source_candidate_id (grandfather edge case)", async () => {
    projectsFindMany.mockResolvedValue([
      { id: "P1", slug: "csv-to-postgres-pipeline", ...baseProject, sourceCandidateId: null },
    ]);
    candidatesFindMany.mockResolvedValue([]);
    const res = await request(await buildApp()).get("/api/admin/quality");
    expect(res.body.lineageIntegrity).toEqual({
      promotedProjects: 0, candidatesWithInverse: 0,
      mismatches: 0, inverseMismatches: 0, duplicateCandidatePromotions: 0,
    });
  });
});
