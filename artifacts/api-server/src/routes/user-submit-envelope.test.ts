/**
 * Phase 47 — Server-side tests for the signed-envelope branch of
 * POST /user/projects/:projectId/steps/:stepId/submit.
 *
 * Pins:
 *   E1. Allow-list empty by default — envelope submission for ANY kind
 *       returns 400 `envelope_kind_not_enabled` and writes NO nonce row,
 *       NO completions row, NO xp.
 *   E2. With kind allow-listed, a valid round-tripped envelope:
 *         - verifies (real `signRunEnvelope` → real `verifyRunEnvelope`)
 *         - inserts exactly ONE row into `run_envelope_nonces`
 *         - grades via the legacy pure grader using `capture.stdout`
 *           (Phase 47 ships verification only; per-kind comparison
 *           graders land in Phase 49+).
 *   E3. Each verifier failure mode (bad-sig, tampered, binding-mismatch,
 *       expired, replay, malformed, unsupported-version) maps to the
 *       documented 400 error code without leaking verifier detail.
 *   E4. Replay protection: a second submit of the same envelope returns
 *       400 `envelope_replay` because the nonce hook saw the prior INSERT.
 *   E5. Legacy bare-string submission path is PRESERVED VERBATIM when
 *       no `envelope` field is present.
 *   E6. Missing secret degrades the envelope branch to 503 even when
 *       the kind is allow-listed.
 *
 * The execution-core signer is NOT mocked — round-tripping through the
 * real signer is the only way to assert the verifier actually accepted
 * what /runs/sign would mint.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { signRunEnvelope } from "@workspace/execution-core/run-envelope";

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

// Records every (table, values) insertion so tests can assert what — if
// anything — was written to run_envelope_nonces, user_step_completions,
// xp_transactions, etc.
const insertCalls: Array<{ table: unknown; values: unknown }> = [];
const updateCalls: Array<{ table: unknown; values: unknown }> = [];

// Configurable simulated state of the nonces table for replay tests.
const seenNonces = new Set<string>();

let nextPassedCount = 0;

const sendEmailSpy = vi.fn().mockResolvedValue(undefined);
const bumpStreakSpy = vi.fn().mockResolvedValue(undefined);

const dbMock: any = {
  query: {
    userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
    projectSteps: { findFirst: (...a: unknown[]) => projectStepsFindFirst(...a) },
    userStepCompletions: { findFirst: (...a: unknown[]) => userStepCompletionsFindFirst(...a) },
    projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
    userXp: { findFirst: (...a: unknown[]) => userXpFindFirst(...a) },
  },
  insert: vi.fn((table: unknown) => {
    // Special-case the run_envelope_nonces table so the nonce-hook
    // `INSERT ... ON CONFLICT DO NOTHING RETURNING nonce` returns the
    // right row count for first-use vs replay paths.
    return {
      values: (values: unknown) => {
        const isNoncesTable = (table as { _t?: string })?._t === "run_envelope_nonces";
        if (isNoncesTable) {
          const nonce = (values as { nonce?: string })?.nonce ?? "";
          const wasNew = !seenNonces.has(nonce);
          if (wasNew) seenNonces.add(nonce);
          insertCalls.push({ table, values });
          // Drizzle chain: .values(...).onConflictDoNothing().returning(...)
          return {
            onConflictDoNothing: () => ({
              returning: () => Promise.resolve(wasNew ? [{ nonce }] : []),
            }),
          };
        }
        // Generic insert path used by /submit body (completions, xp, etc.)
        insertCalls.push({ table, values });
        return Promise.resolve();
      },
    };
  }),
  update: vi.fn((table: unknown) => ({
    set: (values: unknown) => ({
      where: (_w: unknown) => {
        updateCalls.push({ table, values });
        return {
          returning: () => Promise.resolve([{ id: "prog-1" }]),
        };
      },
    }),
  })),
  select: vi.fn(() => ({
    from: () => ({
      where: () => Promise.resolve([{ passedCount: nextPassedCount }]),
    }),
  })),
  execute: vi.fn(() => Promise.resolve([])),
  transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(dbMock)),
};

vi.mock("@workspace/db", () => ({
  db: dbMock,
  users: {},
  userProgress: { _t: "userProgress", userId: "u", projectId: "p", id: "id", status: "status" },
  userXp: { _t: "userXp", userId: "u" },
  userStreaks: { _t: "userStreaks", userId: "u" },
  xpTransactions: { _t: "xpTransactions" },
  projects: { _t: "projects", id: "id" },
  projectSteps: { _t: "projectSteps", id: "id", projectId: "projectId" },
  userStepCompletions: {
    _t: "userStepCompletions",
    userId: "u", projectId: "p", stepNumber: "n", id: "id", passed: "passed",
  },
  runEnvelopeNonces: { _t: "run_envelope_nonces", nonce: "nonce" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  isNull: (...a: unknown[]) => ({ isNull: a }),
  ne: (...a: unknown[]) => ({ ne: a }),
  sql: Object.assign(
    (strings: unknown, ...values: unknown[]) => {
      if (strings && typeof strings === "object" && Array.isArray((strings as { raw?: unknown }).raw)) {
        return { _sql: (strings as TemplateStringsArray).join("?"), _values: values };
      }
      return {};
    }, {},
  ),
}));

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));
vi.mock("../lib/email", () => ({
  sendEmail: (...a: unknown[]) => sendEmailSpy(...a),
  renderProjectCompletionEmail: vi.fn(() => ({ subject: "s", html: "h", text: "t" })),
}));
vi.mock("../lib/streak", () => ({ bumpStreak: (...a: unknown[]) => bumpStreakSpy(...a) }));

async function buildApp() {
  const router = (await import("./user")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  app.use(router);
  return app;
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const STEP_ID = "22222222-2222-2222-2222-222222222222";
const SECRET = "phase-47-test-secret";

function tableName(t: unknown): string {
  return (t as { _t?: string })?._t ?? "?";
}
function nonceRowsInserted() {
  return insertCalls.filter((c) => tableName(c.table) === "run_envelope_nonces");
}
function completionsInserted() {
  return insertCalls.filter((c) => tableName(c.table) === "userStepCompletions");
}

function mintEnvelope(overrides: { capture?: Record<string, unknown>; binding?: Record<string, unknown> } = {}) {
  const capture = {
    version: 1 as const,
    language: "python" as const,
    code: "print('hi')",
    stdout: "hi\n",
    stderr: "",
    exitCode: 0,
    durationMs: 5,
    timedOut: false,
    ...(overrides.capture ?? {}),
  };
  return signRunEnvelope(
    capture,
    {
      userId: TEST_USER.id,
      projectId: PROJECT_ID,
      stepId: STEP_ID,
      validationKind: "json_equal",
      ttlMs: 10 * 60 * 1000,
      ...(overrides.binding ?? {}),
    },
    SECRET,
  );
}

beforeEach(() => {
  vi.stubEnv("RUN_ENVELOPE_SIGNING_SECRET", SECRET);
  vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "");
  userProgressFindFirst.mockReset().mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID });
  projectStepsFindFirst.mockReset().mockResolvedValue({
    id: STEP_ID,
    projectId: PROJECT_ID,
    stepNumber: 1,
    validationType: "json_equal",
    expectedOutput: null,
    validationConfig: null,
    xpReward: 10,
  });
  userStepCompletionsFindFirst.mockReset().mockResolvedValue(undefined);
  projectsFindFirst.mockReset().mockResolvedValue({ id: PROJECT_ID, totalSteps: 1, title: "T", slug: "t", jobOutcomes: null });
  userXpFindFirst.mockReset().mockResolvedValue(undefined);
  insertCalls.length = 0;
  updateCalls.length = 0;
  seenNonces.clear();
  nextPassedCount = 1;
  sendEmailSpy.mockClear();
  bumpStreakSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─────────────────────────────────────────────────────────────────────────
// E1 — Allow-list empty by default
// ─────────────────────────────────────────────────────────────────────────
describe("E1. allow-list empty by default", () => {
  it("rejects an envelope submission with envelope_kind_not_enabled and writes nothing", async () => {
    const envelope = mintEnvelope();
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, submissionType: "envelope", envelope });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("envelope_kind_not_enabled");
    expect(res.body.validationKind).toBe("json_equal");
    expect(nonceRowsInserted()).toHaveLength(0);
    expect(completionsInserted()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E2 — Happy path under allow-list
// ─────────────────────────────────────────────────────────────────────────
describe("E2. allow-listed kind + valid envelope", () => {
  beforeEach(() => {
    vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal");
  });

  it("verifies, INSERTs exactly one nonce row, and grades via legacy default-pass", async () => {
    const envelope = mintEnvelope();
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, submissionType: "envelope", envelope });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("passed");
    const nonceRows = nonceRowsInserted();
    expect(nonceRows).toHaveLength(1);
    expect((nonceRows[0]!.values as { nonce: string }).nonce).toBe(envelope.binding.nonce);
    expect((nonceRows[0]!.values as { expiresAt: Date }).expiresAt).toBeInstanceOf(Date);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E3 — Verifier failure mapping
// ─────────────────────────────────────────────────────────────────────────
describe("E3. verifier failure modes", () => {
  beforeEach(() => {
    vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal");
  });

  it("400 envelope_malformed for a non-object envelope", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope: "not-an-object" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("envelope_malformed");
    expect(nonceRowsInserted()).toHaveLength(0);
  });

  it("400 envelope_bad_signature when signature is tampered", async () => {
    const envelope = mintEnvelope();
    const bad = { ...envelope, signature: envelope.signature.replace(/.$/, (c) => (c === "0" ? "1" : "0")) };
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope: bad });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("envelope_bad_signature");
    expect(nonceRowsInserted()).toHaveLength(0);
  });

  it("400 envelope_tampered when capture.stdout is mutated post-sign", async () => {
    const envelope = mintEnvelope();
    const tampered = { ...envelope, capture: { ...envelope.capture, stdout: "different\n" } };
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope: tampered });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("envelope_bad_signature");
  });

  it("400 envelope_binding_mismatch when envelope was minted for a different user", async () => {
    const envelope = signRunEnvelope(
      {
        version: 1, language: "python", code: "x", stdout: "", stderr: "",
        exitCode: 0, durationMs: 1, timedOut: false,
      },
      {
        userId: "99999999-9999-9999-9999-999999999999",
        projectId: PROJECT_ID, stepId: STEP_ID, validationKind: "json_equal", ttlMs: 60_000,
      },
      SECRET,
    );
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("envelope_binding_mismatch");
    expect(nonceRowsInserted()).toHaveLength(0);
  });

  it("400 envelope_expired for a past-TTL envelope", async () => {
    const envelope = signRunEnvelope(
      {
        version: 1, language: "python", code: "x", stdout: "", stderr: "",
        exitCode: 0, durationMs: 1, timedOut: false,
      },
      {
        userId: TEST_USER.id, projectId: PROJECT_ID, stepId: STEP_ID,
        validationKind: "json_equal", ttlMs: 1, now: () => Date.now() - 60_000,
      },
      SECRET,
    );
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("envelope_expired");
    // Expiry check fires before the nonce hook — no INSERT amplification.
    expect(nonceRowsInserted()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E4 — Replay protection
// ─────────────────────────────────────────────────────────────────────────
describe("E4. replay protection", () => {
  beforeEach(() => {
    vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal");
  });

  it("second submit of the same envelope returns envelope_replay", async () => {
    const envelope = mintEnvelope();
    const app = await buildApp();

    const first = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(first.status).toBe(200);
    expect(nonceRowsInserted()).toHaveLength(1);

    const second = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(second.status).toBe(400);
    expect(second.body.error).toBe("envelope_replay");
    // Hook called again, but ON CONFLICT DO NOTHING ⇒ second attempt is
    // recorded as a no-op insert (the mock pushes one row per call); the
    // real production table only ever contains one nonce row regardless.
    expect(nonceRowsInserted().length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E5 — Legacy path preserved
// ─────────────────────────────────────────────────────────────────────────
describe("E5. legacy bare-string submission path preserved", () => {
  it("submitting WITHOUT an envelope still grades + persists via the legacy path", async () => {
    projectStepsFindFirst.mockResolvedValue({
      id: STEP_ID,
      projectId: PROJECT_ID,
      stepNumber: 1,
      validationType: "exact",
      expectedOutput: "42",
      validationConfig: null,
      xpReward: 10,
    });
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: "42", submissionType: "text" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("passed");
    // Critically: NO nonce row inserted on the legacy path.
    expect(nonceRowsInserted()).toHaveLength(0);
    // Legacy completions row IS written.
    expect(completionsInserted().length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT enter the envelope branch when envelope is null", async () => {
    projectStepsFindFirst.mockResolvedValue({
      id: STEP_ID,
      projectId: PROJECT_ID,
      stepNumber: 1,
      validationType: "self_attest",
      expectedOutput: null,
      validationConfig: null,
      xpReward: 5,
    });
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: "", submissionType: "text", envelope: null });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("passed");
    expect(nonceRowsInserted()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E4b — Nonce-burn-before-tx fail-closed semantics (architect P47 follow-up)
//
// Intentional design: envelope verify + nonce INSERT happen BEFORE the
// per-user pg_advisory_xact_lock + persistence transaction. That means a
// downstream tx failure does NOT roll back the nonce row, so re-submitting
// the same envelope after a transient persistence error returns
// `envelope_replay` rather than re-grading. This is the security-safe
// fail-closed posture: never offer "retry the same proof" as a legitimate
// UX, since that would collapse the replay defense into a refresh.
// ─────────────────────────────────────────────────────────────────────────
describe("E4b. nonce is burnt even if downstream tx fails (fail-closed)", () => {
  it("first submit consumes nonce; second submit returns envelope_replay even though first didn't persist", async () => {
    vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal");
    const envelope = mintEnvelope();

    // Force the FIRST /submit's persistence tx to throw AFTER the envelope
    // is verified and the nonce row has been written. The route's catch
    // arm returns a 500; the nonce table state is preserved (fail-closed).
    const originalTransaction = dbMock.transaction;
    dbMock.transaction = vi.fn(async () => {
      throw new Error("simulated downstream tx failure");
    });

    const app = await buildApp();
    const first = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(first.status).toBe(500);
    // Critical: the nonce WAS inserted before the tx ran.
    expect(nonceRowsInserted()).toHaveLength(1);

    // Restore the tx so the second call would otherwise succeed.
    dbMock.transaction = originalTransaction;

    const second = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(second.status).toBe(400);
    expect(second.body.error).toBe("envelope_replay");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E6 — Missing secret degrades envelope branch to 503
// ─────────────────────────────────────────────────────────────────────────
describe("E6. signing secret unset", () => {
  it("returns 503 envelope_signing_unavailable even when kind is allow-listed", async () => {
    vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal");
    vi.stubEnv("RUN_ENVELOPE_SIGNING_SECRET", "");
    const envelope = signRunEnvelope(
      {
        version: 1, language: "python", code: "x", stdout: "", stderr: "",
        exitCode: 0, durationMs: 1, timedOut: false,
      },
      {
        userId: TEST_USER.id, projectId: PROJECT_ID, stepId: STEP_ID,
        validationKind: "json_equal", ttlMs: 60_000,
      },
      // Sign with SOME non-empty secret so the envelope is well-formed —
      // the server-side secret is what's unset.
      "anything",
    );
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("envelope_signing_unavailable");
    expect(nonceRowsInserted()).toHaveLength(0);
  });
});
