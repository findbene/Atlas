import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { isE2EAuthMode } from "./lib/auth";
import { buildCorsOptions, resolveAllowedOrigins } from "./lib/cors";
import { WebhookHandlers } from "./lib/webhookHandlers";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Stripe webhook MUST be registered BEFORE express.json() so the raw body
// (Buffer) is available for signature verification.
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0]! : signature;
      if (!Buffer.isBuffer(req.body)) {
        req.log.error(
          "STRIPE WEBHOOK ERROR: req.body is not a Buffer. " +
            "Ensure this route is registered BEFORE app.use(express.json()).",
        );
        res.status(500).json({ error: "Webhook processing error" });
        return;
      }
      await WebhookHandlers.processWebhook(req.body, sig);
      res.status(200).json({ received: true });
    } catch (err) {
      req.log.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Phase 60F — CORS allowlist (replaces the reflective `origin:true` posture).
// Production-inert: if ATLAS_ALLOWED_ORIGINS is unset in production, the legacy
// reflective behaviour is preserved and we warn the operator to set it.
if (resolveAllowedOrigins() === null) {
  logger.warn(
    "CORS: ATLAS_ALLOWED_ORIGINS is not set in production — using the legacy " +
      "reflective origin policy. Set ATLAS_ALLOWED_ORIGINS to a comma-separated " +
      "allowlist (e.g. https://app.example.com) to harden cross-origin access.",
  );
}
app.use(cors(buildCorsOptions()));

// Phase 60E — in local full-stack E2E mode (gated, non-production) Clerk's
// middleware is intentionally NOT registered: it hard-fails ("Missing Clerk
// Secret Key") without real Clerk credentials, which blocked every request in
// a local stack. In that mode requireAuth uses the gated test-auth adapter
// instead. Production (ATLAS_E2E_AUTH unset) is unaffected — real Clerk runs.
if (!isE2EAuthMode()) {
  app.use(clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
