/**
 * Phase 12A — Phase-11 replaced legacy twin archive regression.
 *
 * Pins:
 *   - The 7 legacy slugs (ai-eng-llm-eval-harness, mlops-model-serving-canary,
 *     delta-lake-lakehouse, snowflake-data-warehouse, airflow-etl-dag,
 *     api-to-warehouse-ingestion, data-quality-framework) return 404 on
 *     `GET /projects/:slug` once `learner_visible=false` is set.
 *   - The 7 upgraded P11 twins still return 200.
 *   - `GET /api/admin/quality` still lists all 7 legacy slugs in `hiddenSlugs`
 *     (admin DOES see archived rows).
 *   - `hiddenCount` delta from the Phase-10 baseline is exactly +7.
 *   - `legacyReplacements` surface returns `{upgradedSlug, legacySlug, legacyHidden:true}`
 *     for each of the 7 pairs.
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

const LEGACY_SLUGS = [
  "ai-eng-llm-eval-harness",
  "mlops-model-serving-canary",
  "delta-lake-lakehouse",
  "snowflake-data-warehouse",
  "airflow-etl-dag",
  "api-to-warehouse-ingestion",
  "data-quality-framework",
] as const;

const UPGRADED_SLUGS = [
  "ai-engineer-llm-eval-harness",
  "ai-engineer-model-serving-canary",
  "cloud-data-engineer-delta-lake-lakehouse",
  "cloud-data-engineer-snowflake-data-warehouse",
  "data-engineering-airflow-etl-dag",
  "data-engineering-api-to-warehouse-ingestion",
  "data-engineering-data-quality-framework",
] as const;

const PAIRS = LEGACY_SLUGS.map((legacy, i) => ({ legacy, upgraded: UPGRADED_SLUGS[i] }));

const PHASE10_HIDDEN_BASELINE = 22;

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
    totalSteps: 0,
    enrolledCount: 0,
    completionRate: 0,
    tags: [],
    orderIndex: 0,
    learningObjectives: [],
    prerequisites: [],
    domainId: "d1",
    course: "data-engineering",
    courseSource: "heuristic_legacy",
    qualityStatus: "approved",
    qualityBreakdown: null,
    sourceCandidateId: null,
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

describe("Phase 12A — replaced legacy twins return 404", () => {
  for (const slug of LEGACY_SLUGS) {
    it(`GET /projects/${slug} returns 404 (no existence leak) after archive`, async () => {
      projectsFindFirst.mockResolvedValue(projectRow(slug, /* learnerVisible */ false));
      const app = await buildProjectsApp();
      const res = await request(app).get(`/projects/${slug}`);
      expect(res.status).toBe(404);
      expect(res.body).not.toHaveProperty("title");
      expect(res.body.error).toBe("Not found");
    });
  }
});

describe("Phase 12A — upgraded twins remain reachable (200)", () => {
  for (const slug of UPGRADED_SLUGS) {
    it(`GET /projects/${slug} returns 200`, async () => {
      projectsFindFirst.mockResolvedValue(projectRow(slug, /* learnerVisible */ true));
      const app = await buildProjectsApp();
      const res = await request(app).get(`/projects/${slug}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(slug);
    });
  }
});

describe("Phase 12A — admin still sees archived legacy rows", () => {
  it("hiddenSlugs contains all 7 legacy slugs and hiddenCount = baseline + 7", async () => {
    // Simulate the Phase-10 baseline (22 unrelated hidden stubs) + Phase-12A's 7 newly archived
    // legacy twins + the 7 upgraded twins still visible.
    const phase10Hidden = Array.from({ length: PHASE10_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`phase10-thin-${i}`, false),
    );
    const phase12aHidden = LEGACY_SLUGS.map(s => projectRow(s, false));
    const visibleUpgraded = PAIRS.map(p =>
      projectRow(p.upgraded, true, { replaceCandidateSlug: p.legacy }),
    );
    projectsFindMany.mockResolvedValueOnce([...phase10Hidden, ...phase12aHidden, ...visibleUpgraded]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(200);
    expect(res.body.hiddenCount).toBe(PHASE10_HIDDEN_BASELINE + 7);
    for (const legacy of LEGACY_SLUGS) {
      expect(res.body.hiddenSlugs).toContain(legacy);
    }
    // None of the upgraded twins should be in hiddenSlugs.
    for (const up of UPGRADED_SLUGS) {
      expect(res.body.hiddenSlugs).not.toContain(up);
    }
  });

  it("legacyReplacements surfaces all 7 pairs with legacyHidden=true", async () => {
    const phase10Hidden = Array.from({ length: PHASE10_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`phase10-thin-${i}`, false),
    );
    const phase12aHidden = LEGACY_SLUGS.map(s => projectRow(s, false));
    const visibleUpgraded = PAIRS.map(p =>
      projectRow(p.upgraded, true, { replaceCandidateSlug: p.legacy }),
    );
    projectsFindMany.mockResolvedValueOnce([...phase10Hidden, ...phase12aHidden, ...visibleUpgraded]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.legacyReplacements.count).toBe(7);
    const pairsBySlug = new Map<string, { upgradedSlug: string; legacySlug: string; legacyHidden: boolean }>(
      (res.body.legacyReplacements.pairs as Array<{ upgradedSlug: string; legacySlug: string; legacyHidden: boolean }>)
        .map(p => [p.legacySlug, p]),
    );
    for (const { legacy, upgraded } of PAIRS) {
      const pair = pairsBySlug.get(legacy);
      expect(pair).toBeDefined();
      expect(pair!.upgradedSlug).toBe(upgraded);
      expect(pair!.legacyHidden).toBe(true);
    }
  });

  it("legacyReplacements shows legacyHidden=false if the legacy row is still visible (pre-archive state)", async () => {
    // Sanity: if archive didn't run, legacyHidden must report false so ops can see the drift.
    const visibleLegacy = LEGACY_SLUGS.map(s => projectRow(s, true));
    const visibleUpgraded = PAIRS.map(p =>
      projectRow(p.upgraded, true, { replaceCandidateSlug: p.legacy }),
    );
    projectsFindMany.mockResolvedValueOnce([...visibleLegacy, ...visibleUpgraded]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.legacyReplacements.count).toBe(7);
    for (const pair of res.body.legacyReplacements.pairs as Array<{ legacyHidden: boolean }>) {
      expect(pair.legacyHidden).toBe(false);
    }
  });
});
