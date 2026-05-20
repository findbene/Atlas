/**
 * Phase 8 — bootstrap admin CLI.
 *
 *   pnpm --filter @workspace/scripts run grant:admin -- <email>
 *
 * Flips `users.role` to 'admin' for the row matching the given email.
 * Errors loudly if no row matches (we don't want a silent no-op).
 * No UI; admin promotion is intentionally manual-only in Phase 8.
 */
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main(): Promise<void> {
  const email = process.argv.slice(2).filter(a => a !== "--")[0];
  if (!email) {
    console.error("usage: grant-admin <email>");
    process.exit(1);
  }
  const existing = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length === 0) {
    console.error(`No user with email '${email}'. Have they signed in at least once (auto-provisioning)?`);
    process.exit(1);
  }
  if (existing[0].role === "admin") {
    console.log(`[grant-admin] ${email} is already admin — no-op.`);
    process.exit(0);
  }
  await db.update(users).set({ role: "admin" }).where(eq(users.id, existing[0].id));
  console.log(`[grant-admin] ${email} promoted to admin.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
