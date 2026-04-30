import { Router } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { waitlist } from "@workspace/db";
import { eq } from "drizzle-orm";
import { JoinWaitlistBody } from "@workspace/api-zod";

const router = Router();

router.post("/waitlist", async (req, res) => {
  const parsed = JoinWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid waitlist signup", details: parsed.error.flatten() });
    return;
  }
  const { email, domainInterest } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await db.query.waitlist.findFirst({
      where: eq(waitlist.email, normalizedEmail),
    });
    if (existing) {
      res.json({
        success: true,
        alreadyOnWaitlist: true,
        message: "You're already on the waitlist — we'll be in touch.",
      });
      return;
    }

    await db.insert(waitlist).values({
      email: normalizedEmail,
      domainInterest: domainInterest ?? null,
      confirmationToken: randomBytes(24).toString("hex"),
    }).onConflictDoNothing();

    res.json({
      success: true,
      alreadyOnWaitlist: false,
      message: "You're on the list! We'll email you when this curriculum opens.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to process waitlist signup");
    res.status(500).json({ error: "Failed to join waitlist" });
  }
});

export default router;
