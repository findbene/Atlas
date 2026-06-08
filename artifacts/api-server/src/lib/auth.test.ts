/**
 * Phase 60E — tests for the env-gated, production-inert test-auth adapter.
 *
 * The adapter lets a local full-stack E2E authenticate as a seeded test user
 * through the real requireAuth path WITHOUT Clerk. These tests pin its three
 * fail-closed gates and prove it is dead in production.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getAuthMock = vi.fn();
const findFirstMock = vi.fn();

vi.mock("@clerk/express", () => ({
  getAuth: (...a: unknown[]) => getAuthMock(...a),
  clerkClient: { users: { getUser: vi.fn() } },
}));

vi.mock("@workspace/db", () => ({
  db: { query: { users: { findFirst: (...a: unknown[]) => findFirstMock(...a) } } },
  users: { clerkId: "clerk_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
}));

const TEST_USER = { id: "u-e2e", clerkId: "e2e_test_user", email: "e@x.dev", role: "learner" };

function mockReqResNext(headers: Record<string, string> = {}) {
  const req = {
    header: (n: string) => headers[n.toLowerCase()],
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as any;
  const res = {
    statusCode: 0,
    status(code: number) { this.statusCode = code; return this; },
    json: vi.fn(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

let savedEnv: NodeJS.ProcessEnv;
beforeEach(() => {
  savedEnv = { ...process.env };
  getAuthMock.mockReset();
  findFirstMock.mockReset().mockResolvedValue(TEST_USER);
  delete process.env.ATLAS_E2E_AUTH;
  delete process.env.ATLAS_E2E_AUTH_TOKEN;
  delete process.env.ATLAS_E2E_AUTH_CLERK_ID;
});
afterEach(() => {
  process.env = savedEnv;
  vi.resetModules();
});

async function load() {
  return await import("./auth");
}

describe("isE2EAuthMode gating", () => {
  it("true only when ATLAS_E2E_AUTH=1 AND NODE_ENV!=production", async () => {
    const { isE2EAuthMode } = await load();
    process.env.ATLAS_E2E_AUTH = "1";
    process.env.NODE_ENV = "development";
    expect(isE2EAuthMode()).toBe(true);
  });
  it("false in production even with ATLAS_E2E_AUTH=1 (defense in depth)", async () => {
    const { isE2EAuthMode } = await load();
    process.env.ATLAS_E2E_AUTH = "1";
    process.env.NODE_ENV = "production";
    expect(isE2EAuthMode()).toBe(false);
  });
  it("false when ATLAS_E2E_AUTH is unset", async () => {
    const { isE2EAuthMode } = await load();
    process.env.NODE_ENV = "development";
    expect(isE2EAuthMode()).toBe(false);
  });
});

describe("requireAuth E2E adapter", () => {
  it("resolves the seeded test user on a matching token header (never calls Clerk)", async () => {
    process.env.ATLAS_E2E_AUTH = "1";
    process.env.NODE_ENV = "development";
    process.env.ATLAS_E2E_AUTH_TOKEN = "tok";
    const { requireAuth } = await load();
    const { req, res, next } = mockReqResNext({ "x-atlas-e2e-auth": "tok" });
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.localUser).toEqual(TEST_USER);
    expect(getAuthMock).not.toHaveBeenCalled();
  });

  it("401s when the token header is missing (and never calls Clerk)", async () => {
    process.env.ATLAS_E2E_AUTH = "1";
    process.env.NODE_ENV = "development";
    process.env.ATLAS_E2E_AUTH_TOKEN = "tok";
    const { requireAuth } = await load();
    const { req, res, next } = mockReqResNext({});
    await requireAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(getAuthMock).not.toHaveBeenCalled();
  });

  it("401s on a wrong token (no impersonation)", async () => {
    process.env.ATLAS_E2E_AUTH = "1";
    process.env.NODE_ENV = "development";
    process.env.ATLAS_E2E_AUTH_TOKEN = "tok";
    const { requireAuth } = await load();
    const { req, res, next } = mockReqResNext({ "x-atlas-e2e-auth": "WRONG" });
    await requireAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("is fail-closed when ATLAS_E2E_AUTH_TOKEN is unset", async () => {
    process.env.ATLAS_E2E_AUTH = "1";
    process.env.NODE_ENV = "development";
    const { requireAuth } = await load();
    const { req, res, next } = mockReqResNext({ "x-atlas-e2e-auth": "anything" });
    await requireAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("in production, ignores the E2E header and uses the real Clerk path", async () => {
    process.env.ATLAS_E2E_AUTH = "1";
    process.env.NODE_ENV = "production";
    process.env.ATLAS_E2E_AUTH_TOKEN = "tok";
    getAuthMock.mockReturnValue({ userId: null });
    const { requireAuth } = await load();
    const { req, res, next } = mockReqResNext({ "x-atlas-e2e-auth": "tok" });
    await requireAuth(req, res, next);
    // Production took the Clerk path (which we mocked to anonymous) → 401.
    expect(getAuthMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("getCurrentUser E2E adapter", () => {
  it("resolves the seeded user from a matching token header (never calls Clerk)", async () => {
    process.env.ATLAS_E2E_AUTH = "1";
    process.env.NODE_ENV = "development";
    process.env.ATLAS_E2E_AUTH_TOKEN = "tok";
    const { getCurrentUser } = await load();
    const { req } = mockReqResNext({ "x-atlas-e2e-auth": "tok" });
    const user = await getCurrentUser(req);
    expect(user).toEqual(TEST_USER);
    expect(getAuthMock).not.toHaveBeenCalled();
  });

  it("returns null on a missing token (never calls Clerk)", async () => {
    process.env.ATLAS_E2E_AUTH = "1";
    process.env.NODE_ENV = "development";
    process.env.ATLAS_E2E_AUTH_TOKEN = "tok";
    const { getCurrentUser } = await load();
    const { req } = mockReqResNext({});
    const user = await getCurrentUser(req);
    expect(user).toBeNull();
    expect(getAuthMock).not.toHaveBeenCalled();
  });
});
