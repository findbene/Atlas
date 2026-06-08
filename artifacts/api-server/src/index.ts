import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync } from "./lib/stripeClient";
import { startBackgroundJobs } from "./lib/backgroundJobs";
import { resolvePort } from "./lib/resolvePort";

// Phase 0.2 — local-boot decouple. PORT is required in production but defaults to
// 3000 in local dev so `pnpm dev` boots with no env. Logic + tests in resolvePort.ts.
const port = resolvePort();

if (!process.env["PORT"]) {
  logger.warn("PORT unset — defaulting to 3000 (local dev only).");
}

async function initStripe(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    logger.warn("DATABASE_URL missing; skipping Stripe initialization");
    return;
  }
  if (!process.env["REPLIT_CONNECTORS_HOSTNAME"]) {
    logger.warn("Stripe connector not configured; skipping Stripe initialization");
    return;
  }

  try {
    // Phase 0.2 — defer `runMigrations` (the Replit-connector-dependent migration)
    // behind the guards above, so it never runs on the local-boot path. (The
    // package's types are still imported elsewhere; this only moves the call.)
    const { runMigrations } = await import("stripe-replit-sync");
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const replitDomains = process.env["REPLIT_DOMAINS"];
    if (replitDomains) {
      const webhookBaseUrl = `https://${replitDomains.split(",")[0]}`;
      const webhook = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/webhooks/stripe`,
      );
      logger.info(
        { webhookUrl: webhook?.url ?? "configured" },
        "Stripe managed webhook ready",
      );
    }

    logger.info("Starting Stripe data backfill...");
    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe data backfill complete"))
      .catch((err) => logger.error({ err }, "Stripe backfill failed"));
  } catch (err) {
    logger.error({ err }, "Failed to initialize Stripe — billing routes will fail until connector is configured");
  }
}

// Phase 46 — signed-run-envelope secret. Hard-fail at boot when deployed so
// missing-secret deploys never serve a 503-only /api/runs/sign. In dev the
// route degrades to 503 until the operator sets the secret.
function assertRunEnvelopeSigningSecret(): void {
  if (process.env["RUN_ENVELOPE_SIGNING_SECRET"]) return;
  if (process.env["REPLIT_DEPLOYMENT"] === "1") {
    throw new Error(
      "RUN_ENVELOPE_SIGNING_SECRET is required in production deployments (Phase 46).",
    );
  }
  logger.warn(
    "RUN_ENVELOPE_SIGNING_SECRET unset — POST /api/runs/sign will return 503 until set (Phase 46).",
  );
}
assertRunEnvelopeSigningSecret();

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Periodic AI tutor history retention sweep — kept out of the hot path
  // so /api/ai/chat completion isn't gated on a write-path COUNT.
  startBackgroundJobs();
});
