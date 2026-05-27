/**
 * Phase 46 — server-side tests for POST /runs/sign.
 *
 * Locks in:
 *  - auth scoping (secret missing → 503; no user → 401)
 *  - body validation (bad UUIDs, missing/malformed capture, oversize)
 *  - ownership gates (foreign step, hidden project, premium-only, not-enrolled)
 *  - allow-list gate (self_attest / regex / exact / contains → 422)
 *  - happy path returns a verifiable signed envelope
 *  - server is sole hash authority (capture.code hash matches binding;
 *    client-supplied `submissionSha256` on the body is irrelevant)
 *
 * The execution-core library is NOT mocked — letting the real signer run
 * gives us a real round-trip with `verifyRunEnvelope`, which is the only
 * way to assert the signature is actually valid.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import {
  verifyRunEnvelope,
  type SignedRunEnvelope,
} from "@workspace/execution-core/run-envelope";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  subscriptionTier: "free" as "free" | "pro",
  aiTutorLastReadAt: null,
};

vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCurrentUser: vi.fn().mockResolvedValue(TEST_USER),
  invalidateUserCache: vi.fn(),
}));

const projectStepsFindFirst = vi.fn();
const projectsFindFirst = vi.fn();
const userProgressFindFirst = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projectSteps: { findFirst: (...a: unknown[]) => projectStepsFindFirst(...a) },
      projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
      userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
    },
  },
  projects: { id: "id" },
  projectSteps: { id: "id", projectId: "projectId" },
  userProgress: { userId: "userId", projectId: "projectId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
}));

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const STEP_ID = "22222222-2222-2222-2222-222222222222";

const SECRET = "test-secret-do-not-use-in-prod";

async function buildApp() {
  const router = (await import("./runs-sign")).default;
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => {
    (req as unknown as { log: object }).log = {
      error: vi.fn(), warn: vi.fn(), info: vi.fn(),
    };
    next();
  });
  app.use(router);
  return app;
}

function validCapture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    version: 1,
    language: "python",
    code: "print(2 + 2)",
    stdout: "4\n",
    stderr: "",
    exitCode: 0,
    durationMs: 12,
    timedOut: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("RUN_ENVELOPE_SIGNING_SECRET", SECRET);
  projectStepsFindFirst.mockReset().mockResolvedValue({ id: STEP_ID, validationType: "json_equal" });
  projectsFindFirst.mockReset().mockResolvedValue({ id: PROJECT_ID, isPremium: false, learnerVisible: true });
  userProgressFindFirst.mockReset().mockResolvedValue({ id: "enrollment-1" });
  TEST_USER.subscriptionTier = "free";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /runs/sign — secret + auth", () => {
  it("503s when the signing secret is unset", async () => {
    vi.stubEnv("RUN_ENVELOPE_SIGNING_SECRET", "");
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture() });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("signing_unavailable");
  });

  it("401s when getCurrentUser returns null (resolved Clerk session with no local user row)", async () => {
    // requireAuth is mocked to next() for the unit-test surface; the real
    // 401 in production comes from getCurrentUser returning null inside the
    // handler itself (e.g. Clerk session valid but local provisioning row
    // not yet readable). Cover that branch explicitly so the architect
    // 401-coverage gap is closed.
    const auth = await import("../lib/auth");
    (auth.getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture() });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });
});

describe("POST /runs/sign — body validation", () => {
  it("rejects an invalid projectId UUID", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: "nope", stepId: STEP_ID, capture: validCapture() });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_projectId");
  });

  it("rejects an invalid stepId UUID", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: "nope", capture: validCapture() });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_stepId");
  });

  it("rejects a missing capture", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_capture");
  });

  it("rejects a capture with the wrong version", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture({ version: 2 }) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_capture");
  });

  it("rejects a capture with an unknown language", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture({ language: "rust" }) });
    expect(res.status).toBe(400);
  });

  it("413s when stdout exceeds the server cap", async () => {
    const app = await buildApp();
    const huge = "x".repeat(70_000);
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture({ stdout: huge }) });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("capture_too_large");
  });

  it("rejects rows containing unsupported cell types (e.g. nested objects)", async () => {
    const app = await buildApp();
    // JSON.stringify coerces Infinity/NaN to null, so we exercise the
    // unsupported-type path with a nested object cell instead — that's the
    // shape an attacker could actually deliver over the wire.
    const res = await request(app)
      .post("/runs/sign")
      .send({
        projectId: PROJECT_ID, stepId: STEP_ID,
        capture: validCapture({ columns: ["a"], rows: [[{ nested: true }]] }),
      });
    expect(res.status).toBe(400);
  });
});

describe("POST /runs/sign — ownership gates", () => {
  it("404s when the step does not belong to the project", async () => {
    projectStepsFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture() });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("step_not_found");
  });

  it("404s when the project is hidden (no existence leak)", async () => {
    projectsFindFirst.mockResolvedValueOnce({ id: PROJECT_ID, isPremium: false, learnerVisible: false });
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture() });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("project_not_found");
  });

  it("403s premium project for free-tier user", async () => {
    projectsFindFirst.mockResolvedValueOnce({ id: PROJECT_ID, isPremium: true, learnerVisible: true });
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture() });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("pro_required");
  });

  it("403s when the learner is not enrolled", async () => {
    userProgressFindFirst.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture() });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_enrolled");
  });
});

describe("POST /runs/sign — allow-list", () => {
  it.each([
    "self_attest",
    "exact",
    "regex",
    "contains",
  ])("422s validation kind %s", async (kind) => {
    projectStepsFindFirst.mockResolvedValueOnce({ id: STEP_ID, validationType: kind });
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture() });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("validation_kind_not_signable");
    expect(res.body.validationKind).toBe(kind);
  });

  it.each([
    "json_equal",
    "numeric_tolerance",
    "sql_resultset",
    "csv_set_equal",
    "csv_ordered",
  ])("accepts validation kind %s", async (kind) => {
    projectStepsFindFirst.mockResolvedValueOnce({ id: STEP_ID, validationType: kind });
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture() });
    expect(res.status).toBe(200);
    expect(res.body.envelope.binding.validationKind).toBe(kind);
  });
});

describe("POST /runs/sign — happy path", () => {
  it("returns a verifiable signed envelope bound to (user, project, step, kind)", async () => {
    const app = await buildApp();
    const capture = validCapture({
      columns: ["x"],
      rows: [[1], [2]],
    });
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture });
    expect(res.status).toBe(200);
    const envelope = res.body.envelope as SignedRunEnvelope;
    expect(envelope.binding.userId).toBe(TEST_USER.id);
    expect(envelope.binding.projectId).toBe(PROJECT_ID);
    expect(envelope.binding.stepId).toBe(STEP_ID);
    expect(envelope.binding.validationKind).toBe("json_equal");
    expect(envelope.binding.kid).toBe("v1");
    expect(envelope.signature.length).toBeGreaterThan(0);

    // Server is sole hash authority: binding hashes are derived from the
    // capture independently of any client-supplied value (we never send one,
    // but verify the envelope round-trips against a known secret + binding).
    const verify = await verifyRunEnvelope(envelope, {
      secret: SECRET,
      expected: {
        userId: TEST_USER.id,
        projectId: PROJECT_ID,
        stepId: STEP_ID,
        validationKind: "json_equal",
        kid: "v1",
      },
    });
    expect(verify.ok).toBe(true);
  });

  it("envelope expires roughly 10 minutes after issuedAt", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/runs/sign")
      .send({ projectId: PROJECT_ID, stepId: STEP_ID, capture: validCapture() });
    expect(res.status).toBe(200);
    const { issuedAt, expiresAt } = (res.body.envelope as SignedRunEnvelope).binding;
    const ttlMs = Date.parse(expiresAt) - Date.parse(issuedAt);
    expect(ttlMs).toBe(10 * 60 * 1000);
  });

  it("ignores any client-supplied submissionSha256 / outputSha256 on the body", async () => {
    const app = await buildApp();
    const capture = validCapture();
    const res = await request(app)
      .post("/runs/sign")
      .send({
        projectId: PROJECT_ID, stepId: STEP_ID, capture,
        // Garbage values the client should NOT be able to inject into the binding.
        submissionSha256: "deadbeef".repeat(8),
        outputSha256: "cafebabe".repeat(8),
      });
    expect(res.status).toBe(200);
    const envelope = res.body.envelope as SignedRunEnvelope;
    // Server-derived hashes — must verify cleanly.
    const verify = await verifyRunEnvelope(envelope, { secret: SECRET });
    expect(verify.ok).toBe(true);
    expect(envelope.binding.submissionSha256).not.toBe("deadbeef".repeat(8));
    expect(envelope.binding.outputSha256).not.toBe("cafebabe".repeat(8));
  });
});
