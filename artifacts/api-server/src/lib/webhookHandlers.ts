import { db } from "@workspace/db";
import { users, subscriptions, processedWebhookEvents } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { logger } from "./logger";

type SubPlan = "free" | "pro_monthly" | "pro_annual";
type SubStatus = "active" | "canceled" | "past_due" | "trialing" | "incomplete";

function planFromInterval(interval: string | null | undefined): SubPlan {
  if (interval === "year") return "pro_annual";
  if (interval === "month") return "pro_monthly";
  return "pro_monthly";
}

function normalizeStatus(status: string | null | undefined): SubStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
      return status;
    case "incomplete_expired":
    case "unpaid":
      return "canceled";
    default:
      return "incomplete";
  }
}

/**
 * After stripe-replit-sync writes to stripe.* tables, mirror the relevant state
 * into our own users.subscriptionTier and subscriptions row for the affected customer.
 */
async function reconcileCustomer(stripeCustomerId: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.stripeCustomerId, stripeCustomerId),
  });
  if (!user) {
    logger.warn({ stripeCustomerId }, "Webhook event for unknown customer; skipping reconcile");
    return;
  }

  // Pull the latest subscription for this customer from the synced stripe schema.
  // We pick the most relevant: prefer active/trialing, fall back to most recent.
  const subRows = await db.execute(sql`
    SELECT s.id, s.status, s.cancel_at_period_end, s.current_period_end, s.items
    FROM stripe.subscriptions s
    WHERE s.customer = ${stripeCustomerId}
    ORDER BY
      CASE WHEN s.status IN ('active','trialing') THEN 0 ELSE 1 END,
      s.created DESC
    LIMIT 1
  `);

  const row = subRows.rows[0] as
    | {
        id: string;
        status: string;
        cancel_at_period_end: boolean | null;
        current_period_end: number | string | Date | null;
        items: unknown;
      }
    | undefined;

  if (!row) {
    // No subscription known yet — treat as free, leave subscriptions table alone.
    await db.update(users).set({ subscriptionTier: "free" }).where(eq(users.id, user.id));
    return;
  }

  // Extract the recurring interval from the first subscription item's price.
  let interval: string | null = null;
  let priceId: string | null = null;
  try {
    const items = row.items as { data?: Array<{ price?: { id?: string; recurring?: { interval?: string } } }> } | null;
    const first = items?.data?.[0];
    interval = first?.price?.recurring?.interval ?? null;
    priceId = first?.price?.id ?? null;
  } catch {
    interval = null;
  }

  // If items wasn't populated on the row, fall back to a fresh API lookup.
  if (!interval && row.id) {
    try {
      const stripe = await getUncachableStripeClient();
      const fresh = await stripe.subscriptions.retrieve(row.id, { expand: ["items.data.price"] });
      const item = fresh.items?.data?.[0];
      interval = item?.price?.recurring?.interval ?? null;
      priceId = item?.price?.id ?? priceId;
    } catch (err) {
      logger.warn({ err, subId: row.id }, "Failed to fetch subscription detail for plan lookup");
    }
  }

  const status = normalizeStatus(row.status);
  const plan: SubPlan = planFromInterval(interval);
  const tier = status === "active" || status === "trialing" ? "pro" : "free";

  const periodEnd = row.current_period_end
    ? typeof row.current_period_end === "number"
      ? new Date(row.current_period_end * 1000)
      : row.current_period_end instanceof Date
        ? row.current_period_end
        : new Date(row.current_period_end)
    : null;

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ subscriptionTier: tier })
      .where(eq(users.id, user.id));

    const existing = await tx.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, row.id),
    });

    if (existing) {
      await tx
        .update(subscriptions)
        .set({
          plan,
          status,
          stripeCustomerId,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: row.cancel_at_period_end ? "true" : "false",
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, row.id));
    } else {
      await tx.insert(subscriptions).values({
        userId: user.id,
        stripeCustomerId,
        stripeSubscriptionId: row.id,
        plan,
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: row.cancel_at_period_end ? "true" : "false",
      });
    }
  });

  logger.info({ userId: user.id, tier, plan, status, priceId }, "Reconciled subscription state");
}

/**
 * Extract the customer id from a Stripe event payload (best effort).
 */
function customerIdFromEvent(payload: Buffer): string | null {
  try {
    const evt = JSON.parse(payload.toString("utf8"));
    const obj = evt?.data?.object;
    if (!obj) return null;
    if (typeof obj.customer === "string") return obj.customer;
    if (typeof obj.id === "string" && obj.object === "customer") return obj.id;
    return null;
  } catch {
    return null;
  }
}

function eventIdFromPayload(payload: Buffer): string | null {
  try {
    const evt = JSON.parse(payload.toString("utf8"));
    return typeof evt?.id === "string" ? evt.id : null;
  } catch {
    return null;
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    const eventId = eventIdFromPayload(payload);
    if (eventId) {
      const seen = await db.query.processedWebhookEvents.findFirst({
        where: eq(processedWebhookEvents.eventId, eventId),
      });
      if (seen) {
        logger.info({ eventId }, "Stripe event already processed; skipping");
        return;
      }
    }

    // Verify signature + sync stripe.* tables. Throws on bad signature or sync failure;
    // letting it throw causes Stripe to retry the delivery.
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Mirror the freshly-synced state into our own tables. If reconcile throws,
    // we deliberately propagate so Stripe retries and we don't mark the event
    // processed below — preventing a permanent drop of the app-side state update.
    const customerId = customerIdFromEvent(payload);
    if (customerId) {
      await reconcileCustomer(customerId);
    }

    // Only mark the event processed AFTER both sync and reconcile have succeeded.
    if (eventId) {
      await db
        .insert(processedWebhookEvents)
        .values({ eventId, source: "stripe" })
        .onConflictDoNothing();
    }
  }
}

export { reconcileCustomer };
