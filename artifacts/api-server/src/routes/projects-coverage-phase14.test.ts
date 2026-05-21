/**
 * Phase 14 — Beginner-Tier Seeding.
 *
 * Pins:
 *   - The 5 new P14 beginner-tier slugs return 200 on `GET /projects/:slug`.
 *   - `GET /api/admin/quality` exposes `difficultyDistribution.visible.beginner >= 6`
 *     and `visibleBeginnerSlugs` contains all 5 P14 slugs.
 *   - `anchorCount=2` is unchanged (no new anchors flipped).
 *   - `hiddenCount=32` baseline (Phase 13 end state) is unchanged by P14.
 *   - Total visible 47 → 52, total projects 79 → 84.
 *   - `lineageIntegrity` counters remain 0.
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

const NEW_P14_SLUGS = [
  { slug: "sql-beginner-select-where-join-essentials", course: "sql" },
  { slug: "python-libraries-beginner-pandas-essentials", course: "python-libraries" },
  { slug: "data-engineering-beginner-csv-cleanup-pipeline", course: "data-engineering" },
  { slug: "analytics-engineer-beginner-spreadsheet-to-sql-models", course: "analytics-engineer" },
  { slug: "data-scientist-beginner-eda-and-summary-stats", course: "data-scientist" },
] as const;

const ANCHOR_SLUGS = ["csv-to-postgres-pipeline", "dbt-data-models"] as const;

/** Phase-13 end state: 32 hidden rows (unchanged across P14). */
const PHASE13_HIDDEN_BASELINE = 32;
/** Phase-13 end state: 47 visible. P14 adds 5 → 52. */
const PHASE13_VISIBLE_BASELINE = 47;
const PHASE14_VISIBLE_TARGET = 52;

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

describe("Phase 14 — 5 new beginner-tier slugs reachable (200)", () => {
  for (const { slug, course } of NEW_P14_SLUGS) {
    it(`GET /projects/${slug} returns 200 (${course})`, async () => {
      projectsFindFirst.mockResolvedValue(projectRow(slug, true, { course, difficultyLevel: "beginner" }));
      const app = await buildProjectsApp();
      const res = await request(app).get(`/projects/${slug}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(slug);
    });
  }
});

describe("Phase 14 — admin route surfaces difficulty distribution", () => {
  it("difficultyDistribution.visible.beginner counts all visible beginner rows + lists their slugs", async () => {
    const rows = [
      // 1 pre-existing P13 anchor (csv-to-postgres-pipeline is beginner per the snapshot).
      projectRow("csv-to-postgres-pipeline", true, { isAnchor: true, totalSteps: 1, difficultyLevel: "beginner", course: "data-engineering" }),
      // 5 new P14 beginner-tier rows.
      ...NEW_P14_SLUGS.map(({ slug, course }) =>
        projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner" }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(200);
    expect(res.body.difficultyDistribution.visible.beginner).toBe(6);
    const beginnerSlugs = new Set(
      (res.body.difficultyDistribution.visibleBeginnerSlugs as Array<{ slug: string }>).map(s => s.slug),
    );
    for (const { slug } of NEW_P14_SLUGS) {
      expect(beginnerSlugs.has(slug)).toBe(true);
    }
  });

  it("difficultyDistribution.visible aggregates across all 3 buckets", async () => {
    const rows = [
      projectRow("beg-1", true, { difficultyLevel: "beginner" }),
      projectRow("beg-2", true, { difficultyLevel: "beginner" }),
      projectRow("int-1", true, { difficultyLevel: "intermediate" }),
      projectRow("int-2", true, { difficultyLevel: "intermediate" }),
      projectRow("int-3", true, { difficultyLevel: "intermediate" }),
      projectRow("adv-1", true, { difficultyLevel: "advanced" }),
      projectRow("adv-2", true, { difficultyLevel: "advanced" }),
      projectRow("adv-3", true, { difficultyLevel: "advanced" }),
      projectRow("adv-4", true, { difficultyLevel: "advanced" }),
      // Hidden row must NOT be counted in the visible distribution.
      projectRow("hidden-adv", false, { difficultyLevel: "advanced" }),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.difficultyDistribution.visible.beginner).toBe(2);
    expect(res.body.difficultyDistribution.visible.intermediate).toBe(3);
    expect(res.body.difficultyDistribution.visible.advanced).toBe(4);
  });

  it("anchorCount=2 stays at 2 across P14 (no new anchors flipped)", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1, difficultyLevel: "beginner" })),
      ...NEW_P14_SLUGS.map(({ slug, course }) =>
        projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner", isAnchor: false }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.anchorCount).toBe(2);
    expect(new Set(res.body.anchorSlugs)).toEqual(new Set(ANCHOR_SLUGS));
  });

  it("hiddenCount baseline (32) is unchanged by P14 — no new archives", async () => {
    const hidden = Array.from({ length: PHASE13_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p13-hidden-${i}`, false),
    );
    const rows = [
      ...hidden,
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      ...NEW_P14_SLUGS.map(({ slug, course }) => projectRow(slug, true, { course, totalSteps: 5 })),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.hiddenCount).toBe(PHASE13_HIDDEN_BASELINE);
  });

  it("total visible 47 → 52 and hidden stays at 32 (Phase 14 net effect)", async () => {
    // Phase 13 end state: 47 visible + 32 hidden = 79. Phase 14 adds 5 visible (no archives) → 52 + 32 = 84.
    const hidden = Array.from({ length: PHASE13_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p13-hidden-${i}`, false),
    );
    const preVisible = Array.from({ length: PHASE13_VISIBLE_BASELINE }, (_, i) => projectRow(`pre-visible-${i}`, true));
    const newP14 = NEW_P14_SLUGS.map(({ slug, course }) =>
      projectRow(slug, true, { course, difficultyLevel: "beginner" }),
    );
    projectsFindMany.mockResolvedValueOnce([...hidden, ...preVisible, ...newP14]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.hiddenCount).toBe(PHASE13_HIDDEN_BASELINE);
    expect(res.body.totals.projects).toBe(PHASE13_HIDDEN_BASELINE + PHASE13_VISIBLE_BASELINE + NEW_P14_SLUGS.length);
    expect(res.body.totals.projects - res.body.hiddenCount).toBe(PHASE14_VISIBLE_TARGET);
  });

  it("lineageIntegrity all counters remain 0 — no regression from P14 changes", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      ...NEW_P14_SLUGS.map(({ slug, course }) =>
        projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner" }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.lineageIntegrity.mismatches).toBe(0);
    expect(res.body.lineageIntegrity.inverseMismatches).toBe(0);
    expect(res.body.lineageIntegrity.duplicateCandidatePromotions).toBe(0);
  });

  it("each Phase-14 beginner slug is attributed to its declared course in visibleBeginnerSlugs", async () => {
    const rows = NEW_P14_SLUGS.map(({ slug, course }) =>
      projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner" }),
    );
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    const bySlug = new Map(
      (res.body.difficultyDistribution.visibleBeginnerSlugs as Array<{ slug: string; course: string }>)
        .map(e => [e.slug, e.course]),
    );
    for (const { slug, course } of NEW_P14_SLUGS) {
      expect(bySlug.get(slug)).toBe(course);
    }
  });
});
