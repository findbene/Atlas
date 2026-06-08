/**
 * Phase 60D — frontend boot-decouple regression guard (run with tsx).
 *
 * Before 60D, `vite.config.ts` hard-`throw`ew at config load when the
 * Replit-injected `PORT` / `BASE_PATH` env vars were absent, blocking every
 * local `vite dev` / `build` / `preview` off-Replit. This guard fails (exit 1)
 * if that blocker returns: the config must load with safe defaults OUTSIDE
 * production, while STILL failing fast in production.
 *
 * It runs under tsx (pure Node) rather than vitest because importing the real
 * config pulls in `@vitejs/plugin-react` → esbuild, whose TextEncoder invariant
 * breaks under vitest's jsdom environment.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

type ConfigFactory = (env: {
  command: "build" | "serve";
  mode: string;
}) => Promise<{ base: string; server: { port: number } }>;

function clearBootEnv(): void {
  delete process.env.PORT;
  delete process.env.BASE_PATH;
}

async function loadFactory(): Promise<ConfigFactory> {
  const configPath = path.resolve(import.meta.dirname, "..", "vite.config.ts");
  const mod = await import(pathToFileURL(configPath).href);
  return mod.default as ConfigFactory;
}

async function main(): Promise<void> {
  const factory = await loadFactory();
  const failures: string[] = [];

  // 1. development with no PORT/BASE_PATH → safe defaults, no throw.
  clearBootEnv();
  try {
    const cfg = await factory({ command: "serve", mode: "development" });
    if (cfg.base !== "/") failures.push(`dev base expected "/" got "${cfg.base}"`);
    if (cfg.server.port !== 5173)
      failures.push(`dev port expected 5173 got ${cfg.server.port}`);
  } catch (err) {
    failures.push(`dev boot threw (blocker is back): ${(err as Error).message}`);
  }

  // 2. production with no PORT → must still fail fast.
  clearBootEnv();
  let threw = false;
  try {
    await factory({ command: "build", mode: "production" });
  } catch {
    threw = true;
  }
  if (!threw) failures.push("production with no PORT did NOT fail fast");

  // 3. explicit PORT/BASE_PATH honored in production.
  clearBootEnv();
  process.env.PORT = "8080";
  process.env.BASE_PATH = "/atlas";
  try {
    const cfg = await factory({ command: "build", mode: "production" });
    if (cfg.base !== "/atlas")
      failures.push(`prod base expected "/atlas" got "${cfg.base}"`);
    if (cfg.server.port !== 8080)
      failures.push(`prod port expected 8080 got ${cfg.server.port}`);
  } catch (err) {
    failures.push(`prod with env threw: ${(err as Error).message}`);
  }
  clearBootEnv();

  if (failures.length > 0) {
    console.error("[check:boot] FAIL — frontend boot decouple regressed:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(
    "[check:boot] OK — frontend config boots with safe dev defaults and stays fail-fast in production.",
  );
}

main().catch((err) => {
  console.error("[check:boot] ERROR", err);
  process.exit(1);
});
