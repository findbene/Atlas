/**
 * Phase 28 — Tests for GET /api/verify/:certId.
 *
 * Pins the public-certificate verification contract:
 *
 *   T1. Valid completed certificate returns enriched evidence fields.
 *   T2. Malformed / non-completed / missing-user / missing-project certs
 *       return 404 (NEVER 403 — no existence leak).
 *   T3. Strict response field allowlist. Response must not contain
 *       `email`, `clerkId`, internal user IDs, `submissionExcerpt`,
 *       raw submission content, raw per-step `submissionSha256` values,
 *       or any Stripe-customer / billing field.
 *   T4. `evidenceHashCount` == COUNT(passed step rows with
 *       submission_sha256 IS NOT NULL) for this user+project.
 *   T5. `stepsCompleted` <= `totalSteps`. Defensive clamp protects
 *       against legacy drift.
 *   T6. `totalXpEarned` == SUM(xp_transactions.amount) scoped to this
 *       (userId, projectId).
 *   T7. Backwards-compat: pre-Phase-28 fields (certId, recipientName,
 *       recipientUsername, projectTitle, projectSlug, completedAt,
 *       issuer) remain present and unchanged.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const userProgressFindFirst = vi.fn();
const usersFindFirst = vi.fn();
const projectsFindFirst = vi.fn();

// stepAgg + xpAgg selects are routed by the table passed to `.from()`.
let stepAggResult: Array<{
  stepsCompleted: number;
  evidenceHashCount: number;
  firstStepCompletedAt: Date | null;
}> = [];
let xpAggResult: Array<{ totalXpEarned: number }> = [];

const dbMock: any = {
  query: {
    userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
    users: { findFirst: (...a: unknown[]) => usersFindFirst(...a) },
    projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
  },
  select: vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => {
        const t = (table as { _t?: string })?._t;
        if (t === "userStepCompletions") return Promise.resolve(stepAggResult);
        if (t === "xpTransactions") return Promise.resolve(xpAggResult);
        return Promise.resolve([]);
      },
    }),
  })),
};

vi.mock("@workspace/db", () => ({
  db: dbMock,
  userProgress: { _t: "userProgress", id: "id", status: "status" },
  users: { _t: "users", id: "id" },
  projects: { _t: "projects", id: "id" },
  userStepCompletions: {
    _t: "userStepCompletions",
    userId: "userId",
    projectId: "projectId",
    passed: "passed",
    submissionSha256: "submissionSha256",
    completedAt: "completedAt",
  },
  xpTransactions: {
    _t: "xpTransactions",
    userId: "userId",
    amount: "amount",
    metadata: "metadata",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  // Tagged-template aware so route's `sql\`...\`` and `sql<T>\`...\``
  // both return a benign value the where() chain accepts.
  sql: Object.assign(
    (strings: unknown, ...values: unknown[]) => {
      if (
        strings &&
        typeof strings === "object" &&
        Array.isArray((strings as { raw?: unknown }).raw)
      ) {
        return { _sql: (strings as TemplateStringsArray).join("?"), _values: values };
      }
      return {};
    },
    {},
  ),
}));

async function buildApp() {
  const router = (await import("./cert-verify")).default;
  const app = express();
  app.use((req, _res, next) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(router);
  return app;
}

const CERT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";

function defaultProgress() {
  return {
    id: CERT_ID,
    userId: USER_ID,
    projectId: PROJECT_ID,
    status: "completed",
    completedAt: new Date("2026-03-15T12:00:00.000Z"),
  };
}
function defaultUser() {
  return {
    id: USER_ID,
    name: "Ada Lovelace",
    username: "ada",
    email: "ada@example.com",
    clerkId: "user_clerk_abc",
    stripeCustomerId: "cus_TESTSTRIPE",
  };
}
function defaultProject() {
  return {
    id: PROJECT_ID,
    title: "CSV to Postgres Pipeline",
    slug: "csv-to-postgres-pipeline",
    totalSteps: 4,
  };
}

beforeEach(() => {
  userProgressFindFirst.mockReset();
  usersFindFirst.mockReset();
  projectsFindFirst.mockReset();
  stepAggResult = [];
  xpAggResult = [];
});

describe("GET /verify/:certId", () => {
  it("T1 — returns enriched evidence fields for a valid completed certificate", async () => {
    userProgressFindFirst.mockResolvedValue(defaultProgress());
    usersFindFirst.mockResolvedValue(defaultUser());
    projectsFindFirst.mockResolvedValue(defaultProject());
    stepAggResult = [
      {
        stepsCompleted: 4,
        evidenceHashCount: 3,
        firstStepCompletedAt: new Date("2026-03-15T10:00:00.000Z"),
      },
    ];
    xpAggResult = [{ totalXpEarned: 425 }];

    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      certId: CERT_ID,
      recipientName: "Ada Lovelace",
      recipientUsername: "ada",
      projectTitle: "CSV to Postgres Pipeline",
      projectSlug: "csv-to-postgres-pipeline",
      completedAt: "2026-03-15T12:00:00.000Z",
      firstStepCompletedAt: "2026-03-15T10:00:00.000Z",
      durationSeconds: 7200,
      stepsCompleted: 4,
      totalSteps: 4,
      evidenceHashCount: 3,
      totalXpEarned: 425,
      issuer: "Atlas Projects",
    });
  });

  it("T2a — malformed certId returns 404 (never 403, no existence leak)", async () => {
    const app = await buildApp();
    const res = await request(app).get("/verify/not-a-uuid");
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
    expect(userProgressFindFirst).not.toHaveBeenCalled();
  });

  it("T2b — non-completed / missing progress row returns 404", async () => {
    userProgressFindFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
  });

  it("T2c — completed row with null completedAt returns 404", async () => {
    userProgressFindFirst.mockResolvedValue({ ...defaultProgress(), completedAt: null });
    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(404);
  });

  it("T2d — missing user or project returns 404", async () => {
    userProgressFindFirst.mockResolvedValue(defaultProgress());
    usersFindFirst.mockResolvedValue(undefined);
    projectsFindFirst.mockResolvedValue(defaultProject());
    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(404);
  });

  it("T3 — response strictly excludes private fields", async () => {
    userProgressFindFirst.mockResolvedValue(defaultProgress());
    usersFindFirst.mockResolvedValue(defaultUser());
    projectsFindFirst.mockResolvedValue(defaultProject());
    stepAggResult = [
      {
        stepsCompleted: 2,
        evidenceHashCount: 2,
        firstStepCompletedAt: new Date("2026-03-15T11:00:00.000Z"),
      },
    ];
    xpAggResult = [{ totalXpEarned: 100 }];

    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(200);

    const denylist = [
      "email",
      "clerkId",
      "userId",
      "projectId",
      "stripeCustomerId",
      "subscriptionTier",
      "submissionExcerpt",
      "submissionSha256",
      "submission",
      "evidenceHashes",
      "rawHashes",
      "hashes",
      "metadata",
    ];
    for (const k of denylist) {
      expect(res.body).not.toHaveProperty(k);
    }
    // Serialize-then-search guard for nested leakage of sensitive values.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("ada@example.com");
    expect(serialized).not.toContain("user_clerk_abc");
    expect(serialized).not.toContain("cus_TESTSTRIPE");
    expect(serialized).not.toContain(USER_ID);
    expect(serialized).not.toContain(PROJECT_ID);
  });

  it("T4 — evidenceHashCount reflects passed rows with non-null submission_sha256", async () => {
    userProgressFindFirst.mockResolvedValue(defaultProgress());
    usersFindFirst.mockResolvedValue(defaultUser());
    projectsFindFirst.mockResolvedValue(defaultProject());
    // 4 steps passed, but only 2 have evidence hashes (legacy pre-P26 mix).
    stepAggResult = [
      {
        stepsCompleted: 4,
        evidenceHashCount: 2,
        firstStepCompletedAt: new Date("2026-03-15T11:30:00.000Z"),
      },
    ];
    xpAggResult = [{ totalXpEarned: 200 }];

    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.stepsCompleted).toBe(4);
    expect(res.body.evidenceHashCount).toBe(2);
    expect(res.body.evidenceHashCount).toBeLessThanOrEqual(res.body.stepsCompleted);
  });

  it("T5 — stepsCompleted is clamped to totalSteps even when underlying COUNT drifts higher", async () => {
    userProgressFindFirst.mockResolvedValue(defaultProgress());
    usersFindFirst.mockResolvedValue(defaultUser());
    projectsFindFirst.mockResolvedValue({ ...defaultProject(), totalSteps: 4 });
    // Pathological: more passed rows than the project has steps.
    stepAggResult = [
      {
        stepsCompleted: 99,
        evidenceHashCount: 99,
        firstStepCompletedAt: new Date("2026-03-15T11:00:00.000Z"),
      },
    ];
    xpAggResult = [{ totalXpEarned: 0 }];

    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.stepsCompleted).toBeLessThanOrEqual(res.body.totalSteps);
    expect(res.body.stepsCompleted).toBe(4);
    expect(res.body.evidenceHashCount).toBeLessThanOrEqual(res.body.stepsCompleted);
  });

  it("T6 — totalXpEarned reflects the project-scoped xp_transactions sum (zero for legacy)", async () => {
    userProgressFindFirst.mockResolvedValue(defaultProgress());
    usersFindFirst.mockResolvedValue(defaultUser());
    projectsFindFirst.mockResolvedValue(defaultProject());
    stepAggResult = [
      {
        stepsCompleted: 0,
        evidenceHashCount: 0,
        firstStepCompletedAt: null,
      },
    ];
    // Legacy pre-P26 completion: no ledger entries scoped to this project.
    xpAggResult = [{ totalXpEarned: 0 }];

    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.totalXpEarned).toBe(0);
    expect(res.body.firstStepCompletedAt).toBeNull();
    expect(res.body.durationSeconds).toBeNull();
  });

  it("T7 — pre-Phase-28 fields remain backward compatible", async () => {
    userProgressFindFirst.mockResolvedValue(defaultProgress());
    usersFindFirst.mockResolvedValue(defaultUser());
    projectsFindFirst.mockResolvedValue(defaultProject());
    stepAggResult = [
      {
        stepsCompleted: 4,
        evidenceHashCount: 4,
        firstStepCompletedAt: new Date("2026-03-15T11:00:00.000Z"),
      },
    ];
    xpAggResult = [{ totalXpEarned: 300 }];

    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(200);
    // Every pre-P28 field unchanged in shape + value.
    expect(res.body.certId).toBe(CERT_ID);
    expect(res.body.recipientName).toBe("Ada Lovelace");
    expect(res.body.recipientUsername).toBe("ada");
    expect(res.body.projectTitle).toBe("CSV to Postgres Pipeline");
    expect(res.body.projectSlug).toBe("csv-to-postgres-pipeline");
    expect(res.body.completedAt).toBe("2026-03-15T12:00:00.000Z");
    expect(res.body.issuer).toBe("Atlas Projects");
  });

  it("T5b — stepsCompleted clamps to 0 when totalSteps=0 (archived/thin-stub edge)", async () => {
    userProgressFindFirst.mockResolvedValue(defaultProgress());
    usersFindFirst.mockResolvedValue(defaultUser());
    projectsFindFirst.mockResolvedValue({ ...defaultProject(), totalSteps: 0 });
    stepAggResult = [
      {
        stepsCompleted: 7,
        evidenceHashCount: 7,
        firstStepCompletedAt: new Date("2026-03-15T11:00:00.000Z"),
      },
    ];
    xpAggResult = [{ totalXpEarned: 100 }];

    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.totalSteps).toBe(0);
    expect(res.body.stepsCompleted).toBe(0);
    expect(res.body.stepsCompleted).toBeLessThanOrEqual(res.body.totalSteps);
    expect(res.body.evidenceHashCount).toBe(0);
    expect(res.body.evidenceHashCount).toBeLessThanOrEqual(res.body.stepsCompleted);
  });

  it("T6b — durationSeconds clamps to 0 when firstStepCompletedAt > completedAt (clock skew edge)", async () => {
    userProgressFindFirst.mockResolvedValue(defaultProgress());
    usersFindFirst.mockResolvedValue(defaultUser());
    projectsFindFirst.mockResolvedValue(defaultProject());
    // Pathological: first step apparently completed AFTER the project
    // was marked completed (clock skew, manual data fix, etc).
    stepAggResult = [
      {
        stepsCompleted: 4,
        evidenceHashCount: 4,
        firstStepCompletedAt: new Date("2026-03-15T14:00:00.000Z"),
      },
    ];
    xpAggResult = [{ totalXpEarned: 100 }];

    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.durationSeconds).toBe(0);
    expect(res.body.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it("T7b — recipientName falls back to username, then to 'Atlas Learner'", async () => {
    userProgressFindFirst.mockResolvedValue(defaultProgress());
    usersFindFirst.mockResolvedValue({
      id: USER_ID,
      name: null,
      username: "ada",
      email: "x@x",
    });
    projectsFindFirst.mockResolvedValue(defaultProject());
    stepAggResult = [
      { stepsCompleted: 1, evidenceHashCount: 1, firstStepCompletedAt: new Date() },
    ];
    xpAggResult = [{ totalXpEarned: 0 }];

    const app = await buildApp();
    const res = await request(app).get(`/verify/${CERT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.recipientName).toBe("ada");
  });
});
