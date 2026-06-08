import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Phase 60E — env-gated, production-inert test-auth adapter.
 *
 * Lets a local FULL-STACK E2E authenticate as a single SEEDED test user through
 * the REAL `requireAuth` / `getCurrentUser` path, WITHOUT real Clerk. It is
 * fail-closed on three independent gates, so it is dead code in production:
 *   1. `ATLAS_E2E_AUTH` must equal "1" (never set in production),
 *   2. `NODE_ENV` must NOT be "production" (defense in depth),
 *   3. `ATLAS_E2E_AUTH_TOKEN` must be set AND the request must carry a matching
 *      `X-Atlas-E2E-Auth` header (absent / mismatch ⇒ treated as anonymous ⇒
 *      401, exactly like the real Clerk path).
 * It resolves a FIXED clerkId (`ATLAS_E2E_AUTH_CLERK_ID`), NEVER a userId taken
 * from the request, so it cannot be used to impersonate an arbitrary user, and
 * it does not alter the route's 404-not-403 / hidden-project behaviour (the
 * resolved test user simply is not enrolled in hidden projects).
 */
export function isE2EAuthMode(): boolean {
  return (
    process.env.ATLAS_E2E_AUTH === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

function e2eClerkIdFromRequest(req: Request): string | null {
  const expected = process.env.ATLAS_E2E_AUTH_TOKEN;
  if (!expected) return null; // fail-closed when no token is configured
  const provided = req.header("x-atlas-e2e-auth");
  if (!provided || provided !== expected) return null;
  return process.env.ATLAS_E2E_AUTH_CLERK_ID ?? "e2e_test_user";
}

// In-memory cache of clerkId -> local user row, so we don't hit the Clerk API
// or run a SELECT on every request. Per-process; small footprint; cleared on restart.
const userCache = new Map<string, Awaited<ReturnType<typeof loadOrProvisionUser>>>();

async function loadOrProvisionUser(clerkId: string, req: Request) {
  // 1. Try local DB first.
  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
  if (existing) return existing;

  // 2. Not in DB — fetch profile from Clerk and create the local row.
  let email: string | null = null;
  let name: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);
    email =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      null;
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();
    name = fullName || clerkUser.username || null;
    avatarUrl = clerkUser.imageUrl ?? null;
  } catch (err) {
    req.log.error({ err, clerkId }, "Failed to fetch Clerk user during provisioning");
  }

  if (!email) {
    // Fall back to a placeholder email so we can still create the row.
    // The user record won't be deliverable but the app is functional.
    email = `${clerkId}@users.atlasprojects.dev`;
  }

  // Insert; on unique violation re-read by clerkId first, then fall back to a
  // placeholder email if the original collided with an existing row (rare but
  // possible if a previous local account used the same address before Clerk).
  try {
    const [created] = await db
      .insert(users)
      .values({ clerkId, email, name, avatarUrl })
      .returning();
    return created!;
  } catch (err) {
    req.log.warn({ err, clerkId }, "Initial user insert failed, attempting recovery");
    const byClerkId = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
    if (byClerkId) return byClerkId;
    // Likely an email-uniqueness collision. Retry with a clerk-scoped email.
    try {
      const placeholderEmail = `${clerkId}@users.atlasprojects.dev`;
      const [created] = await db
        .insert(users)
        .values({ clerkId, email: placeholderEmail, name, avatarUrl })
        .returning();
      return created!;
    } catch (retryErr) {
      req.log.error({ err: retryErr, clerkId }, "User provisioning failed after retry");
      throw retryErr;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Phase 60E — local full-stack E2E path (gated; dead code in production).
  // Never touches Clerk: in e2e mode clerkMiddleware is not registered, so
  // getAuth(req) would throw. Resolve the seeded test user from the gated
  // header, else 401 — exercising the real requireAuth contract.
  if (isE2EAuthMode()) {
    const e2eClerkId = e2eClerkIdFromRequest(req);
    if (!e2eClerkId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      let user = userCache.get(e2eClerkId);
      if (!user) {
        user = await loadOrProvisionUser(e2eClerkId, req);
        userCache.set(e2eClerkId, user);
      }
      (req as Request & { localUser?: typeof user }).localUser = user;
      next();
    } catch (err) {
      req.log.error({ err, e2e: true }, "Failed to resolve E2E test user");
      res.status(500).json({ error: "Failed to resolve user" });
    }
    return;
  }

  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    let user = userCache.get(userId);
    if (!user) {
      user = await loadOrProvisionUser(userId, req);
      userCache.set(userId, user);
    }
    (req as Request & { localUser?: typeof user }).localUser = user;
    next();
  } catch (err) {
    req.log.error({ err, userId }, "Failed to load or provision local user");
    res.status(500).json({ error: "Failed to resolve user" });
  }
}

export async function getOrCreateUser(clerkId: string, email: string, name?: string, avatarUrl?: string) {
  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
  if (existing) return existing;
  const [created] = await db.insert(users).values({
    clerkId,
    email,
    name: name ?? null,
    avatarUrl: avatarUrl ?? null,
  }).returning();
  return created!;
}

/**
 * Drop the cached row for a Clerk user so the next request reloads it from
 * the DB. Call this after any write that mutates a column other code paths
 * read from the cache (e.g. aiTutorLastReadAt). Without this, in-process
 * reads after a write keep returning the pre-write value until restart.
 */
export function invalidateUserCache(clerkId: string): void {
  userCache.delete(clerkId);
}

/**
 * Phase 8 — gate admin-only routes. Chains off `requireAuth` so callers
 * still get `req.localUser` populated. Rejects authenticated-but-non-admin
 * users with 403. Anonymous requests get 401 from the underlying
 * `requireAuth`. Uses the existing `users.role` enum ('learner' | 'admin').
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    const user = (req as Request & { localUser?: typeof users.$inferSelect }).localUser;
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "admin role required" });
      return;
    }
    next();
  });
}

export async function getCurrentUser(req: Request) {
  // Fast path: requireAuth populated req.localUser already.
  const cached = (req as Request & { localUser?: typeof users.$inferSelect }).localUser;
  if (cached) return cached;

  // Phase 60E — in e2e mode, never call getAuth (clerkMiddleware is absent).
  if (isE2EAuthMode()) {
    const e2eClerkId = e2eClerkIdFromRequest(req);
    if (!e2eClerkId) return null;
    const memo = userCache.get(e2eClerkId);
    if (memo) return memo;
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, e2eClerkId),
    });
    return user ?? null;
  }

  const auth = getAuth(req);
  if (!auth.userId) return null;

  const memo = userCache.get(auth.userId);
  if (memo) return memo;

  const user = await db.query.users.findFirst({ where: eq(users.clerkId, auth.userId) });
  return user ?? null;
}
