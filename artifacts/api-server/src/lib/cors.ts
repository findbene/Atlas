/**
 * Phase 60F — CORS allowlist resolution.
 *
 * Replaces the previous reflective posture `cors({ origin: true, credentials:
 * true })`, which echoed *any* request Origin back AND allowed credentials —
 * meaning any website could make credentialed (cookie-bearing) cross-origin
 * requests to the API and read the responses.
 *
 * Resolution order (see `buildCorsOptions`):
 *   1. `ATLAS_ALLOWED_ORIGINS` (comma-separated) → an explicit allowlist, in
 *      ANY environment. This is the operator lever to harden production.
 *   2. Otherwise, in NON-production, default to the local dev/test origins so
 *      `pnpm dev` / Vite / the E2E harness keep working with no config.
 *   3. Otherwise (production AND the env var unset) → return `null`, and the
 *      caller falls back to the LEGACY reflective behaviour. This keeps the
 *      change PRODUCTION-INERT: production behaviour is byte-identical until an
 *      operator sets `ATLAS_ALLOWED_ORIGINS`. (The boot code emits a warning
 *      recommending they do so.)
 *
 * `credentials: true` is preserved in every branch — the hardening is the
 * origin allowlist, not the credentials flag. With the allowlist active, an
 * unknown origin gets NO `Access-Control-Allow-Origin` header (the callback
 * returns `false`, never an Error), so the browser blocks the cross-origin read
 * without the server ever throwing or 500ing.
 */
import type { CorsOptions } from "cors";

/** Local origins that must keep working in dev/test without any config. */
const DEV_DEFAULT_ORIGINS: readonly string[] = [
  "http://localhost:5173", // Vite dev server (atlas frontend)
  "http://127.0.0.1:5173",
  "http://localhost:5199", // alt dev / WASM verify harness port
  "http://localhost:4173", // Vite preview
  "http://127.0.0.1:4178", // full-stack portfolio E2E frontend (e2e runner)
];

/**
 * Resolve the allowed-origin allowlist for the current environment, or `null`
 * when production has no explicit allowlist configured (caller preserves the
 * legacy reflective behaviour in that single case). Pure — `env` is injectable
 * for tests.
 */
export function resolveAllowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] | null {
  const raw = env.ATLAS_ALLOWED_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (env.NODE_ENV !== "production") {
    return [...DEV_DEFAULT_ORIGINS];
  }
  return null;
}

/**
 * Build the `cors` middleware options for the current environment. Pure — `env`
 * is injectable for tests.
 */
export function buildCorsOptions(
  env: NodeJS.ProcessEnv = process.env,
): CorsOptions {
  const allow = resolveAllowedOrigins(env);

  // Production with no allowlist configured → production-inert legacy posture.
  if (allow === null) {
    return { origin: true, credentials: true };
  }

  const allowSet = new Set(allow);
  return {
    credentials: true,
    origin(origin, callback) {
      // No Origin header = a same-origin or non-browser request (curl,
      // server-to-server, health checks). These are not a cross-origin
      // credential-theft vector, so allow them — matching the previous
      // reflective behaviour for that case.
      if (!origin) {
        callback(null, true);
        return;
      }
      // Allowed origin → reflect it; unknown origin → no CORS headers (browser
      // blocks the read). `false`, NOT an Error, so the request still completes
      // without a 500.
      callback(null, allowSet.has(origin));
    },
  };
}
