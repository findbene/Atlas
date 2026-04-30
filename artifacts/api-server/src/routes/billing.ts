import { Router } from "express";
import { sql, eq, desc, and, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { users, subscriptions } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { getUncachableStripeClient } from "../lib/stripeClient";

const router = Router();

const FREE_PLAN = {
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
  tier: "free" as const,
  stripePriceIdMonthly: null,
  stripePriceIdAnnual: null,
};

const PRO_FEATURES = [
  "All 40+ Data Engineering projects",
  "Python & SQL editors with full execution",
  "Unlimited AI tutor (Claude Sonnet)",
  "Python Mastery curriculum",
  "SQL Mastery curriculum",
  "Certificate of completion",
  "Priority support",
  "Early access to new domains",
];

/**
 * Pull active "Pro Plan" prices from the synced stripe.* schema.
 * Falls back to env-var price IDs if Stripe data hasn't synced yet.
 */
async function getProPricing(): Promise<{
  monthlyPrice: number;
  annualPrice: number;
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
}> {
  let stripePriceIdMonthly: string | null = null;
  let stripePriceIdAnnual: string | null = null;
  let monthlyPrice = 29;
  let annualPrice = 199;

  try {
    const result = await db.execute(sql`
      SELECT pr.id, pr.unit_amount, pr.recurring
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE pr.active = true
        AND p.active = true
        AND p.name = 'Pro Plan'
    `);

    for (const row of result.rows as Array<{
      id: string;
      unit_amount: number | null;
      recurring: { interval?: string } | null;
    }>) {
      const interval = row.recurring?.interval;
      const amount = row.unit_amount ?? 0;
      if (interval === "month") {
        stripePriceIdMonthly = row.id;
        monthlyPrice = Math.round(amount / 100);
      } else if (interval === "year") {
        stripePriceIdAnnual = row.id;
        annualPrice = Math.round(amount / 100);
      }
    }
  } catch {
    // stripe schema not yet migrated — fall through to env-var fallback
  }

  stripePriceIdMonthly = stripePriceIdMonthly ?? process.env["STRIPE_PRO_MONTHLY_PRICE_ID"] ?? null;
  stripePriceIdAnnual = stripePriceIdAnnual ?? process.env["STRIPE_PRO_ANNUAL_PRICE_ID"] ?? null;

  return { monthlyPrice, annualPrice, stripePriceIdMonthly, stripePriceIdAnnual };
}

router.get("/billing/plans", async (_req, res) => {
  const pro = await getProPricing();
  res.json([
    FREE_PLAN,
    {
      id: "pro",
      name: "Pro",
      description: "Full access to master Data Engineering",
      monthlyPrice: pro.monthlyPrice,
      annualPrice: pro.annualPrice,
      features: PRO_FEATURES,
      tier: "pro",
      stripePriceIdMonthly: pro.stripePriceIdMonthly,
      stripePriceIdAnnual: pro.stripePriceIdAnnual,
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
    // Pick the most recent subscription for this user — guards against showing a
    // stale row when a user has multiple historical subscriptions.
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
      orderBy: [desc(subscriptions.createdAt)],
    });
    res.json({
      tier: user.subscriptionTier,
      status: sub?.status ?? "none",
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd === "true",
      stripeCustomerId: user.stripeCustomerId ?? sub?.stripeCustomerId ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get subscription");
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

function appBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]}`;
  if (process.env["REPLIT_DEV_DOMAIN"]) return `https://${process.env["REPLIT_DEV_DOMAIN"]}`;
  return "http://localhost:3000";
}

/**
 * Get the set of price IDs for the active Pro Plan, so we can validate any
 * price the client submits actually belongs to a plan we offer.
 */
async function getAllowedProPriceIds(): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT pr.id
    FROM stripe.prices pr
    JOIN stripe.products p ON p.id = pr.product
    WHERE pr.active = true
      AND p.active = true
      AND p.name = 'Pro Plan'
  `);
  return new Set((result.rows as Array<{ id: string }>).map((r) => r.id));
}

/**
 * Find or create the Stripe customer for this user, idempotently and safely
 * under concurrent calls. Uses a Stripe idempotency key keyed by user.id so
 * parallel requests collapse to a single customer, then writes back to the DB
 * only when the column is still NULL — re-reading the persisted value if a
 * concurrent request won the race.
 */
async function ensureStripeCustomer(
  user: { id: string; email: string; name: string | null; clerkId: string; stripeCustomerId: string | null },
): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create(
    {
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id, clerkId: user.clerkId },
    },
    { idempotencyKey: `atlas-customer-${user.id}` },
  );

  // Atomic conditional update: only write the new customer id if the column is
  // still NULL. If a concurrent request beat us, re-read and use the persisted id.
  const updated = await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(and(eq(users.id, user.id), isNull(users.stripeCustomerId)))
    .returning({ stripeCustomerId: users.stripeCustomerId });

  if (updated[0]?.stripeCustomerId) return updated[0].stripeCustomerId;

  const fresh = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  return fresh?.stripeCustomerId ?? customer.id;
}

router.post("/billing/checkout", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { priceId, billingInterval, successUrl, cancelUrl } = req.body ?? {};

    // Resolve a candidate price ID, then validate it against our allowlist of
    // active Pro Plan prices. This prevents an authenticated user from passing
    // an arbitrary price from the connected Stripe account (e.g., an internal
    // discount price) to game the checkout.
    let candidate: string | null =
      typeof priceId === "string" && priceId.startsWith("price_") ? priceId : null;
    if (!candidate) {
      const pro = await getProPricing();
      candidate = billingInterval === "annual" ? pro.stripePriceIdAnnual : pro.stripePriceIdMonthly;
    }

    if (!candidate) {
      res.status(400).json({
        error:
          "No active Pro price found. Run the Stripe seed script (pnpm --filter @workspace/scripts run seed:stripe) to create products.",
      });
      return;
    }

    const allowed = await getAllowedProPriceIds();
    if (!allowed.has(candidate)) {
      req.log.warn({ priceId: candidate, userId: user.id }, "Rejected checkout for non-Pro price id");
      res.status(400).json({ error: "Invalid price for the Pro plan" });
      return;
    }

    const customerId = await ensureStripeCustomer(user);

    const stripe = await getUncachableStripeClient();
    const base = appBaseUrl();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: candidate, quantity: 1 }],
      success_url: successUrl ?? `${base}/dashboard?upgraded=true`,
      cancel_url: cancelUrl ?? `${base}/pricing?canceled=true`,
      allow_promotion_codes: true,
      client_reference_id: user.id,
    });

    if (!session.url) {
      res.status(502).json({ error: "Stripe did not return a checkout URL" });
      return;
    }

    res.json({ url: session.url });
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
    if (!user.stripeCustomerId) {
      res.status(400).json({ error: "No Stripe customer on file. Subscribe first." });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const base = appBaseUrl();
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${base}/profile`,
    });

    res.json({ url: portal.url });
  } catch (err) {
    req.log.error({ err }, "Failed to create billing portal");
    res.status(500).json({ error: "Failed to create billing portal" });
  }
});

export default router;
