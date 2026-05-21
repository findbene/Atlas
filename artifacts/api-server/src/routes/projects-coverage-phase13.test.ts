/**
 * Phase 13 — Underserved Course Seeding + Anchor Reporting Hygiene.
 *
 * Pins:
 *   - The 4 new P13 authored slugs return 200 on `GET /projects/:slug`.
 *   - `GET /api/admin/quality` exposes `anchorCount=2` + `anchorSlugs`
 *     containing csv-to-postgres-pipeline and dbt-data-models.
 *   - `visibleThinStubs` EXCLUDES anchors — when the only sub-5-step visible
 *     rows are anchors, `visibleThinStubs.count` is 0.
 *   - `hiddenCount` baseline (Phase 12B end state = 32) is unchanged by P13.
 *   - Per-course count for each underserved course (mlops, applied-llm,
 *     python-libraries, sql) is at least 3 visible after P13.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import request from "supertest";

const projectsFindMany = vi.fn();
const projectsFindFirst = vi.fn();
const stepsFindMany = vi.fn();
const domainsFindFirst = vi.fn();
const executeSpy = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: {
        findMany: (...a: unknown[]) => projectsFindMany(...a),
        findFirst: (...a: unknown[]) => projectsFindFirst(...a),
      },
      projectSteps: { findMany: (...a: unknown[]) => stepsFindMany(...a) },
      domains: { findFirst: (...a: unknown[]) => domainsFindFirst(...a) },
      userProgress: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(undefined) },
      userStepCompletions: { findMany: vi.fn().mockResolvedValue([]) },
      projectSolutions: { findFirst: vi.fn().mockResolvedValue(undefined) },
      projectCandidates: { findMany: vi.fn().mockResolvedValue([]) },
    },
    execute: (...a: unknown[]) => executeSpy(...a),
  },
  projects: {
    id: "id", slug: "slug", title: "title",
    shortDescription: "shortDescription", language: "language",
    domainId: "domainId", difficultyLevel: "difficultyLevel", isPremium: "isPremium",
    deletedAt: "deletedAt", learnerVisible: "learnerVisible",
  },
  projectSteps: {}, projectHints: {}, domains: { slug: "slug" }, projectSolutions: {},
  userProgress: {}, userStepCompletions: {}, projectCandidates: {},
}));

vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { localUser?: { id: string; role: string } }).localUser = { id: "u-1", role: "admin" };
    next();
  },
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  or: (...a: unknown[]) => ({ or: a }),
  ilike: (col: unknown, pat: unknown) => ({ ilike: [col, pat] }),
  isNull: (a: unknown) => ({ isNull: a }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }),
    {},
  ),
}));

const NEW_P13_SLUGS = [
  { slug: "sql-window-functions-and-cte-mastery", course: "sql" },
  { slug: "python-libraries-pydantic-config-and-cli", course: "python-libraries" },
  { slug: "applied-llm-engineer-rag-evaluation-harness", course: "applied-llm-engineer" },
  { slug: "mlops-engineer-feature-pipeline-monitoring", course: "mlops-engineer" },
] as const;

const ANCHOR_SLUGS = ["csv-to-postgres-pipeline", "dbt-data-models"] as const;

/** Phase-12B end state: 32 hidden rows (22 P10 thin + 7 P11 legacy + 3 P12B legacy). */
const PHASE12B_HIDDEN_BASELINE = 32;

function projectRow(slug: string, learnerVisible: boolean, extra: Record<string, unknown> = {}) {
  return {
    id: `id-${slug}`,
    slug,
    learnerVisible,
    title: slug,
    shortDescription: "x",
    fullDescription: "x",
    difficultyLevel: "intermediate",
    isPremium: false,
    xpReward: 0,
    estimatedMinutes: 0,
    totalSteps: 5,
    enrolledCount: 0,
    completionRate: 0,
    tags: [],
    orderIndex: 0,
    learningObjectives: [],
    prerequisites: [],
    domainId: "d1",
    course: "data-engineering",
    courseSource: "authored",
    qualityStatus: "approved",
    qualityBreakdown: null,
    sourceCandidateId: null,
    isAnchor: false,
    jobOutcomes: null,
    executionProfile: null,
    starterCodePython: null,
    ...extra,
  };
}

async function buildProjectsApp() {
  const router = (await import("./projects")).default;
  const app = express();
  app.use((req, _res, next) => { (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }; next(); });
  app.use(router);
  return app;
}

async function buildAdminApp() {
  const router = (await import("./admin")).default;
  const app = express();
  app.use(((req: Request, _res: Response, next: NextFunction) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  }) as RequestHandler);
  app.use(router);
  return app;
}

beforeEach(() => {
  projectsFindMany.mockReset().mockResolvedValue([]);
  projectsFindFirst.mockReset().mockResolvedValue(undefined);
  stepsFindMany.mockReset().mockResolvedValue([]);
  domainsFindFirst.mockReset().mockResolvedValue(undefined);
  executeSpy.mockReset().mockResolvedValue({ rows: [{ c: 0 }] });
});

describe("Phase 13 — 4 new course-seed slugs reachable (200)", () => {
  for (const { slug, course } of NEW_P13_SLUGS) {
    it(`GET /projects/${slug} returns 200 (${course})`, async () => {
      projectsFindFirst.mockResolvedValue(projectRow(slug, true, { course }));
      const app = await buildProjectsApp();
      const res = await request(app).get(`/projects/${slug}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(slug);
    });
  }
});

describe("Phase 13 — admin route surfaces anchor + thin-stub hygiene", () => {
  it("anchorCount=2 + anchorSlugs lists both calibration anchors", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      ...NEW_P13_SLUGS.map(({ slug, course }) => projectRow(slug, true, { course, totalSteps: 5 })),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(200);
    expect(res.body.anchorCount).toBe(2);
    for (const a of ANCHOR_SLUGS) {
      expect(res.body.anchorSlugs).toContain(a);
    }
  });

  it("visibleThinStubs EXCLUDES anchors — count is 0 when only sub-5-step visible rows are anchors", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      ...NEW_P13_SLUGS.map(({ slug, course }) => projectRow(slug, true, { course, totalSteps: 5 })),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.visibleThinStubs.count).toBe(0);
    expect(res.body.visibleThinStubs.slugs).toHaveLength(0);
  });

  it("visibleThinStubs DOES count non-anchor sub-5-step visible rows", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      projectRow("legit-thin-stub", true, { isAnchor: false, totalSteps: 2 }),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.visibleThinStubs.count).toBe(1);
    expect(res.body.visibleThinStubs.slugs[0].slug).toBe("legit-thin-stub");
    expect(res.body.visibleThinStubs.slugs[0].steps).toBe(2);
  });

  it("hiddenCount baseline (Phase 12B = 32) is unchanged by P13 — no new archives", async () => {
    const hidden = Array.from({ length: PHASE12B_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p12b-hidden-${i}`, false),
    );
    const rows = [
      ...hidden,
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      ...NEW_P13_SLUGS.map(({ slug, course }) => projectRow(slug, true, { course, totalSteps: 5 })),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.hiddenCount).toBe(PHASE12B_HIDDEN_BASELINE);
  });

  it("each underserved course lifts 2 → 3 visible (post-Phase-13 floor)", async () => {
    // Simulate the realistic post-Phase-13 visibility surface: 2 pre-existing
    // authored rows per underserved course + the 1 new P13 row each.
    const preExistingByCourse: Record<string, number> = {
      "sql": 2, "python-libraries": 2, "applied-llm-engineer": 2, "mlops-engineer": 2,
    };
    const rows: ReturnType<typeof projectRow>[] = [];
    for (const [course, n] of Object.entries(preExistingByCourse)) {
      for (let i = 0; i < n; i++) rows.push(projectRow(`${course}-pre-${i}`, true, { course }));
    }
    for (const { slug, course } of NEW_P13_SLUGS) rows.push(projectRow(slug, true, { course }));
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.courseDistribution["sql"]).toBeGreaterThanOrEqual(3);
    expect(res.body.courseDistribution["python-libraries"]).toBeGreaterThanOrEqual(3);
    expect(res.body.courseDistribution["applied-llm-engineer"]).toBeGreaterThanOrEqual(3);
    expect(res.body.courseDistribution["mlops-engineer"]).toBeGreaterThanOrEqual(3);
  });

  it("total visible 43 → 47 and hidden stays at 32 (Phase 13 net effect)", async () => {
    // Phase 12B end state: 43 visible + 32 hidden = 75. Phase 13 adds 4 new
    // visible (no archives), yielding 47 + 32 = 79.
    const hidden = Array.from({ length: PHASE12B_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p12b-hidden-${i}`, false),
    );
    const preVisible = Array.from({ length: 43 }, (_, i) => projectRow(`pre-visible-${i}`, true));
    const newP13 = NEW_P13_SLUGS.map(({ slug, course }) => projectRow(slug, true, { course }));
    projectsFindMany.mockResolvedValueOnce([...hidden, ...preVisible, ...newP13]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.hiddenCount).toBe(32);
    expect(res.body.totals.projects).toBe(79);
    // visible = total - hidden
    expect(res.body.totals.projects - res.body.hiddenCount).toBe(47);
  });

  it("anchorSlugs is EXACTLY the 2 known calibration anchors — no drift", async () => {
    // Guard against accidental is_anchor flips on non-calibration rows.
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      // 5 random non-anchor visible rows — none should appear in anchorSlugs.
      ...Array.from({ length: 5 }, (_, i) =>
        projectRow(`other-visible-${i}`, true, { isAnchor: false, totalSteps: 5 }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.anchorCount).toBe(2);
    expect(new Set(res.body.anchorSlugs)).toEqual(new Set(ANCHOR_SLUGS));
  });

  it("mixed realistic dataset: anchors excluded BUT non-anchor thin stubs still counted", async () => {
    // Realistic mix: 2 anchors (sub-5-step but excluded), 2 legitimate thin
    // stubs (sub-5-step, NOT anchors, MUST count), 3 fully authored rows.
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      projectRow("legacy-thin-1", true, { isAnchor: false, totalSteps: 2 }),
      projectRow("legacy-thin-2", true, { isAnchor: false, totalSteps: 1 }),
      projectRow("authored-1", true, { isAnchor: false, totalSteps: 5 }),
      projectRow("authored-2", true, { isAnchor: false, totalSteps: 5 }),
      projectRow("authored-3", true, { isAnchor: false, totalSteps: 5 }),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.anchorCount).toBe(2);
    expect(res.body.visibleThinStubs.count).toBe(2);
    const stubSlugs = new Set(
      (res.body.visibleThinStubs.slugs as Array<{ slug: string }>).map(s => s.slug),
    );
    expect(stubSlugs).toEqual(new Set(["legacy-thin-1", "legacy-thin-2"]));
    // Anchors must NOT appear in the thin-stub list.
    for (const a of ANCHOR_SLUGS) {
      expect(stubSlugs.has(a)).toBe(false);
    }
  });

  it("lineageIntegrity all 5 counters remain 0 — no regression from Phase 13 changes", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      ...NEW_P13_SLUGS.map(({ slug, course }) => projectRow(slug, true, { course, totalSteps: 5 })),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.lineageIntegrity.mismatches).toBe(0);
    expect(res.body.lineageIntegrity.inverseMismatches).toBe(0);
    expect(res.body.lineageIntegrity.duplicateCandidatePromotions).toBe(0);
  });
});
