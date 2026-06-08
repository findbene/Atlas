// Phase 0.2 — pure PORT resolution, extracted so the boot-config behavior is
// unit-testable (mirrors `resolveAllowedOrigins` in ./cors.ts). PORT is required
// in production (NODE_ENV=production or a Replit deployment); in local dev it
// defaults so `pnpm dev` boots with no env. Keep this side-effect-free — the
// boot-time warning log lives in index.ts.

const DEFAULT_DEV_PORT = 3000;

export function isProductionEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env["NODE_ENV"] === "production" || env["REPLIT_DEPLOYMENT"] === "1";
}

export function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  const rawPort = env["PORT"];

  if (!rawPort && isProductionEnv(env)) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort ?? String(DEFAULT_DEV_PORT));

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return port;
}
