import { Router } from "express";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { db } from "@workspace/db";
import { users, subscriptions, processedWebhookEvents } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/billing/plans", async (req, res) => {
  res.json([
    {
      id: "free",
      name: "Free",
      description: "Start your Data Engineering journey",
      monthlyPrice: 0,
      annualPrice: 0,
      features: [
        "Access to first 3 projects per track",
        "Python & SQL editors",
        "Basic AI tutor (10 messages/day)",
        "Community access",
        "Progress tracking",
      ],
      tier: "free",
      stripePriceIdMonthly: null,
      stripePriceIdAnnual: null,
    },
    {
      id: "pro",
      name: "Pro",
      description: "Full access to master Data Engineering",
      monthlyPrice: 29,
      annualPrice: 199,
      features: [
        "All 40+ Data Engineering projects",
        "Python & SQL editors with full execution",
        "Unlimited AI tutor (Claude Sonnet)",
        "Python Mastery curriculum",
        "SQL Mastery curriculum",
        "Certificate of completion",
        "Priority support",
        "Early access to new domains",
      ],
      tier: "pro",
      stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "price_placeholder_monthly",
      stripePriceIdAnnual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? "price_placeholder_annual",
    },
  ]);
});

router.get("/billing/subscription", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, user.id) });
    res.json({
      tier: user.subscriptionTier,
      status: sub?.status ?? "none",
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd === "true",
      stripeCustomerId: sub?.stripeCustomerId ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get subscription");
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

router.post("/billing/checkout", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { priceId, billingInterval, successUrl, cancelUrl } = req.body;
    
    // For now return a placeholder — Stripe integration requires STRIPE_SECRET_KEY
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:3000";
    
    res.json({
      url: successUrl ?? `${baseUrl}/upgrade?status=pending`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkout");
    res.status(500).json({ error: "Failed to create checkout" });
  }
});

router.post("/billing/portal", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:3000";
    res.json({ url: `${baseUrl}/profile` });
  } catch (err) {
    req.log.error({ err }, "Failed to create billing portal");
    res.status(500).json({ error: "Failed to create billing portal" });
  }
});

router.post("/webhooks/stripe", async (req, res) => {
  // Placeholder for Stripe webhook handling
  req.log.info({ body: req.body }, "Stripe webhook received");
  res.json({ received: true });
});

export default router;
