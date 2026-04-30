import { getUncachableStripeClient } from "./stripeClient";

/**
 * Idempotently create the "Pro Plan" product and its monthly + annual prices in Stripe.
 * Safe to run multiple times. Run with: pnpm --filter @workspace/scripts run seed:stripe
 */
async function seedStripeProducts(): Promise<void> {
  const stripe = await getUncachableStripeClient();
  console.log("Seeding Stripe products...");

  const existing = await stripe.products.search({
    query: "name:'Pro Plan' AND active:'true'",
  });

  let product = existing.data[0];
  if (product) {
    console.log(`Pro Plan product exists: ${product.id}`);
  } else {
    product = await stripe.products.create({
      name: "Pro Plan",
      description: "Atlas Projects Pro — full access to all Data Engineering content, unlimited AI tutor, and certificates.",
    });
    console.log(`Created Pro Plan product: ${product.id}`);
  }

  // List existing prices for this product so we don't create duplicates.
  const existingPrices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });

  const hasMonthly = existingPrices.data.find(
    (p) => p.recurring?.interval === "month" && p.unit_amount === 2900,
  );
  if (hasMonthly) {
    console.log(`Monthly price exists: ${hasMonthly.id}`);
  } else {
    const monthly = await stripe.prices.create({
      product: product.id,
      unit_amount: 2900,
      currency: "usd",
      recurring: { interval: "month" },
      nickname: "Pro Monthly",
    });
    console.log(`Created monthly price: ${monthly.id}`);
  }

  const hasAnnual = existingPrices.data.find(
    (p) => p.recurring?.interval === "year" && p.unit_amount === 19900,
  );
  if (hasAnnual) {
    console.log(`Annual price exists: ${hasAnnual.id}`);
  } else {
    const annual = await stripe.prices.create({
      product: product.id,
      unit_amount: 19900,
      currency: "usd",
      recurring: { interval: "year" },
      nickname: "Pro Annual",
    });
    console.log(`Created annual price: ${annual.id}`);
  }

  console.log("Done. Webhooks will sync prices into stripe.* tables on next event.");
}

seedStripeProducts().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
