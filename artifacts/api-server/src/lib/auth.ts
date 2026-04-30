import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export async function getOrCreateUser(clerkId: string, email: string, name?: string, avatarUrl?: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });
  if (existing) {
    return existing;
  }
  const [created] = await db.insert(users).values({
    clerkId,
    email,
    name: name ?? null,
    avatarUrl: avatarUrl ?? null,
  }).returning();
  return created!;
}

export async function getCurrentUser(req: Request) {
  const auth = getAuth(req);
  if (!auth.userId) return null;
  
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, auth.userId),
  });
  return user ?? null;
}
