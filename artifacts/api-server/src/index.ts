import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync } from "./lib/stripeClient";
import { startBackgroundJobs } from "./lib/backgroundJobs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
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
