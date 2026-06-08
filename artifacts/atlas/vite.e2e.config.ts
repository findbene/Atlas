/**
 * Phase 60D — isolated E2E build config for real-browser verification of the
 * portfolio download flow. This config is SEPARATE from the production
 * `vite.config.ts` (production is untouched). It:
 *   - has NO PORT/BASE_PATH/Replit coupling (so it builds anywhere),
 *   - aliases `@clerk/react` to a local mock so the REAL Certificates page can
 *     render a signed-in test learner WITHOUT real Clerk keys/network (a
 *     test-only auth shim — never shipped to production),
 *   - builds the real Certificates page + real DownloadPortfolioBundleButton +
 *     real generated client so a real browser exercises the actual flow.
 * Output goes to dist/e2e (gitignored). Drive it with playwright-cli.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "e2e"),
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@clerk/react": path.resolve(import.meta.dirname, "e2e/clerk-mock.tsx"),
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist", "e2e"),
    emptyOutDir: true,
  },
});
