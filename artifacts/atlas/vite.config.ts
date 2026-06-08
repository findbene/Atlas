import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

// Phase 60D — local/test boot decouple. Replit injected PORT + BASE_PATH; off
// Replit they are absent and the previous hard `throw` at config load blocked
// every local `vite build` / `dev` / `preview`. Keep production fail-fast (an
// unconfigured prod deploy must error loudly), but fall back to safe local
// defaults outside production so the learner frontend boots in a controlled
// dev/test environment without Replit coupling. `mode` is Vite's canonical
// signal: `vite dev` → "development", `vite build`/`preview` → "production".
export default defineConfig(async ({ mode }) => {
  const isProduction = mode === "production";

  const rawPort = process.env.PORT ?? (isProduction ? undefined : "5173");
  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required in production but was not provided.",
    );
  }
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = process.env.BASE_PATH ?? (isProduction ? undefined : "/");
  if (!basePath) {
    throw new Error(
      "BASE_PATH environment variable is required in production but was not provided.",
    );
  }

  return {
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      // Disable SW in dev to avoid HMR + cached asset weirdness — dev uses live vite,
      // production gets the offline service worker.
      devOptions: { enabled: false },
      includeAssets: ["favicon.svg", "opengraph.jpg"],
      manifest: {
        name: "Atlas — Project-based Learning",
        short_name: "Atlas",
        description:
          "Project-first technical learning for Data Engineering, AI, MLOps, and Data Science.",
        theme_color: "#0b0b0f",
        background_color: "#0b0b0f",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // SPA navigation fallback, but skip /api and the Pyodide CDN
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/__mockup/],
        // Keep precache lean — only static built assets. Pyodide (10MB) is
        // intentionally excluded; we cache it at runtime via the CDN rule below.
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,ico,webmanifest}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://cdn.jsdelivr.net",
            handler: "CacheFirst",
            options: {
              cacheName: "jsdelivr-pyodide",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache strictly public GET reads so first-load offline browsing works.
            // Explicit allowlist + denylist; anything user-scoped or auth-gated
            // (e.g. /api/projects/resume, /api/projects/<slug>/solution, /api/projects/<slug>/run-history)
            // must fall through to the network to avoid serving cross-user data.
            urlPattern: ({ url, request }) => {
              if (request.method !== "GET") return false;
              const p = url.pathname;
              // Public domain catalog (list + detail are both public reads).
              if (p === "/api/domains" || p.startsWith("/api/domains/")) return true;
              // Public projects list.
              if (p === "/api/projects") return true;
              // Public per-project detail at /api/projects/<slug> ONLY — no nested
              // subpaths and never the per-user "resume" handle.
              const detail = p.match(/^\/api\/projects\/([^/]+)$/);
              if (detail && detail[1] !== "resume") return true;
              return false;
            },
            handler: "NetworkFirst",
            options: {
              cacheName: "atlas-api-content",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  };
});
