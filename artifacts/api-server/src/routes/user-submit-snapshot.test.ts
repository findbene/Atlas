/**
 * Phase 60B — portfolio submission-snapshot write behavior.
 *
 * Pins the append-only snapshot contract on /submit (and its absence on
 * /check):
 *   - /check writes NO snapshot (and opens no transaction).
 *   - /submit on a FRESH pass writes exactly one safe snapshot row
 *     (passed=true, correct kind + serverGrade flag, sha256 set, runtime
 *     output null on the legacy path, source="submit_legacy"), and never the
 *     spec/answer key.
 *   - /submit re-submit of an already-passed step writes NO new snapshot.
 *   - /submit on a FAILING attempt writes NO snapshot (no passed evidence).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "u@example.com",
  name: "U",
  timezone: "UTC",
  subscriptionTier: "free",
};

vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCurrentUser: vi.fn().mockResolvedValue(TEST_USER),
  getOrCreateUser: vi.fn(),
  invalidateUserCache: vi.fn(),
}));

const userProgressFindFirst = vi.fn();
const projectStepsFindFirst = vi.fn();
const userStepCompletionsFindFirst = vi.fn();
const projectsFindFirst = vi.fn();
const userXpFindFirst = vi.fn();

const insertCalls: Array<{ table: unknown; values: unknown }> = [];
const transactionCalls: Array<{ ran: true }> = [];
let nextPassedCount = 0;

const dbMock: any = {
  query: {
    userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
    projectSteps: { findFirst: (...a: unknown[]) => projectStepsFindFirst(...a) },
    userStepCompletions: { findFirst: (...a: unknown[]) => userStepCompletionsFindFirst(...a) },
    projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
    userXp: { findFirst: (...a: unknown[]) => userXpFindFirst(...a) },
  },
  insert: vi.fn((table: unknown) => ({
    values: (values: unknown) => {
      insertCalls.push({ table, values });
      const result: Promise<void> & { onConflictDoNothing?: () => Promise<void> } =
        Promise.resolve();
      result.onConflictDoNothing = () => Promise.resolve();
      return result;
    },
  })),
  update: vi.fn(() => ({
    set: () => ({
      where: () => ({ returning: () => Promise.resolve([{ id: "prog-1" }]) }),
    }),
  })),
  select: vi.fn(() => ({ from: () => ({ where: () => Promise.resolve([{ passedCount: nextPassedCount }]) }) })),
  execute: vi.fn(() => Promise.resolve([])),
  transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => { transactionCalls.push({ ran: true }); return cb(dbMock); }),
};

vi.mock("@workspace/db", () => ({
  db: dbMock,
  users: {},
  userProgress: { _t: "userProgress" },
  userXp: { _t: "userXp" },
  userStreaks: { _t: "userStreaks" },
  xpTransactions: { _t: "xpTransactions" },
  projects: { _t: "projects" },
  projectSteps: { _t: "projectSteps" },
  userStepCompletions: { _t: "userStepCompletions" },
  portfolioSubmissionSnapshots: { _t: "portfolioSubmissionSnapshots" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  isNull: (...a: unknown[]) => ({ isNull: a }),
  ne: (...a: unknown[]) => ({ ne: a }),
  sql: Object.assign((s: unknown, ...v: unknown[]) => {
    if (s && typeof s === "object" && Array.isArray((s as { raw?: unknown }).raw)) return { _sql: "x", _values: v };
    return {};
  }, {}),
}));

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));
vi.mock("../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  renderProjectCompletionEmail: vi.fn(() => ({ subject: "s", html: "h", text: "t" })),
}));
vi.mock("../lib/streak", () => ({ bumpStreak: vi.fn().mockResolvedValue(undefined) }));

async function buildApp() {
  const router = (await import("./user")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }; next(); });
  app.use(router);
  return app;
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const STEP_ID = "22222222-2222-2222-2222-222222222222";

const sqlStep = {
  id: STEP_ID, projectId: PROJECT_ID, stepNumber: 2, xpReward: 10,
  validationType: "sql_resultset", expectedOutput: null,
  validationConfig: { kind: "sql_resultset", description: "scd2", spec: {
    serverGrade: true, columns: ["check", "value"], expectedRows: [["one_current", 0], ["overlap", 0]],
  } },
};
const SQL_OK = JSON.stringify({ columns: ["check", "value"], rows: [["one_current", 0], ["overlap", 0]] });
const SQL_WRONG = JSON.stringify({ columns: ["check", "value"], rows: [["one_current", 1], ["overlap", 0]] });

function mockStep(step: Record<string, unknown>) {
  userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID, status: "in_progress", completedAt: null });
  projectStepsFindFirst.mockResolvedValue(step);
  userStepCompletionsFindFirst.mockResolvedValue(undefined);
  projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 8, title: "T", slug: "s", jobOutcomes: [] });
  userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
  nextPassedCount = 1;
}

function snapshotInserts() {
  return insertCalls.filter((c) => (c.table as { _t?: string })?._t === "portfolioSubmissionSnapshots");
}

beforeEach(() => {
  for (const m of [userProgressFindFirst, projectStepsFindFirst, userStepCompletionsFindFirst, projectsFindFirst, userXpFindFirst]) m.mockReset();
  insertCalls.length = 0; transactionCalls.length = 0; nextPassedCount = 0;
});

describe("portfolio snapshot write", () => {
  it("/check writes NO snapshot and opens no transaction", async () => {
    const app = await buildApp();
    mockStep(sqlStep);
    const r = await request(app).post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/check`).send({ submission: SQL_OK });
    expect(r.body.status).toBe("passed");
    expect(transactionCalls).toHaveLength(0);
    expect(snapshotInserts()).toHaveLength(0);
  });

  it("/submit fresh pass writes exactly one safe snapshot (legacy path)", async () => {
    const app = await buildApp();
    mockStep(sqlStep);
    const r = await request(app).post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`).send({ submission: SQL_OK, submissionType: "code" });
    expect(r.body.status).toBe("passed");
    expect(r.body.isFirstPass).toBe(true);

    const snaps = snapshotInserts();
    expect(snaps).toHaveLength(1);
    const v = snaps[0].values as Record<string, unknown>;
    expect(v.passed).toBe(true);
    expect(v.validationKind).toBe("sql_resultset");
    expect(v.isServerGraded).toBe(true);
    expect(v.stepId).toBe(STEP_ID);
    expect(v.source).toBe("submit_legacy");
    expect(typeof v.submissionSha256).toBe("string"); // full-content hash present
    expect((v.submissionSha256 as string).length).toBe(64);
    expect(v.runtimeOutputSha256).toBeNull(); // no envelope capture on legacy path
    // The snapshot stores the learner's SUBMISSION excerpt (their own work) —
    // that is intended. It must NOT store the spec / answer key, i.e. the
    // validationConfig object or its expectedRows. (The excerpt may coincide
    // with expected content when the learner is correct; the no-leak guarantee
    // is about the SPEC object never being persisted, which we assert here.)
    const serialized = JSON.stringify(v);
    expect(serialized).not.toContain("validationConfig");
    expect(serialized).not.toContain("expectedRows");
    expect(serialized).not.toContain("\"spec\"");
    expect(v).not.toHaveProperty("validationConfig");
  });

  it("/submit re-submit of an already-passed step writes NO new snapshot", async () => {
    const app = await buildApp();
    mockStep(sqlStep);
    userStepCompletionsFindFirst.mockResolvedValue({ id: "uc-1", passed: true, attemptCount: 1 });
    const r = await request(app).post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`).send({ submission: SQL_OK, submissionType: "code" });
    expect(r.body.status).toBe("passed");
    expect(r.body.isFirstPass).toBe(false);
    expect(snapshotInserts()).toHaveLength(0);
  });

  it("/submit on a FAILING attempt writes NO snapshot (no passed evidence)", async () => {
    const app = await buildApp();
    mockStep(sqlStep);
    const r = await request(app).post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`).send({ submission: SQL_WRONG, submissionType: "code" });
    expect(r.body.status).toBe("failed");
    expect(snapshotInserts()).toHaveLength(0);
  });
});
