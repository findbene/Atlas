/**
 * Phase 60D/60E — real-browser E2E harness for the portfolio download.
 *
 * Renders the REAL Certificates page + REAL DownloadPortfolioBundleButton +
 * REAL generated client. Two modes, selected at build time:
 *
 *  - **Full-stack (Phase 60E):** when `VITE_E2E_API_BASE` is set, the generated
 *    client talks to a REAL running API server (real DB-backed routes). A test
 *    auth header (`X-Atlas-E2E-Auth`) is injected so the API's gated test-auth
 *    adapter resolves the seeded test learner. No backend is faked.
 *  - **Mock (Phase 60D):** otherwise, the backend is faked at the `window.fetch`
 *    boundary (frontend network interception) — used for the boot-decouple
 *    verification that needs no running API.
 *
 * Auth (Clerk) is always faked via the clerk-mock alias (no real Clerk keys).
 * Downloads are captured into `window.__E2E_DOWNLOAD__` for the browser driver.
 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import Certificates from "@/pages/certificates";
import "@/index.css";

declare global {
  interface Window {
    __E2E_DOWNLOAD__?: string;
    __E2E_FAIL__?: boolean;
  }
}

// --- Capture the downloaded payload (the button uses URL.createObjectURL) ---
const realCreateObjectURL = URL.createObjectURL.bind(URL);
URL.createObjectURL = ((obj: Blob | MediaSource) => {
  if (obj instanceof Blob) {
    obj
      .text()
      .then((t) => {
        window.__E2E_DOWNLOAD__ = t;
      })
      .catch(() => {});
  }
  return realCreateObjectURL(obj as Blob);
}) as typeof URL.createObjectURL;

const API_BASE = import.meta.env.VITE_E2E_API_BASE as string | undefined;
const API_TOKEN = import.meta.env.VITE_E2E_API_TOKEN as string | undefined;

if (API_BASE) {
  // ---- Phase 60E full-stack mode: talk to the real API server ----
  setBaseUrl(API_BASE);
  const realFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (API_TOKEN) headers.set("X-Atlas-E2E-Auth", API_TOKEN);
    if (input instanceof Request) {
      return realFetch(new Request(input, { headers }));
    }
    return realFetch(input, { ...init, headers });
  }) as typeof window.fetch;
} else {
  // ---- Phase 60D mock mode: fake the two read routes at window.fetch ----
  const SLUG = "analytics-engineer-semantic-layer-with-dbt-and-duckdb";
  const PORTFOLIO = {
    completedCount: 1,
    totalProjectXp: 250,
    evidenceBackedCount: 1,
    items: [
      {
        certId: "cert-e2e",
        projectSlug: SLUG,
        projectTitle: "Semantic Layer with dbt and DuckDB",
        completedAt: "2026-05-01T13:30:00.000Z",
        printUrl: `/certificates/${SLUG}`,
        verifyUrl: "/verify/cert-e2e",
        stepsCompleted: 8,
        totalSteps: 8,
        totalXpEarned: 250,
        evidenceHashCount: 2,
        topRole: "Analytics Engineer",
        durationSeconds: 5400,
      },
    ],
  };
  const ARTIFACT = {
    projectSlug: SLUG,
    generatedAt: "2026-06-08T00:00:00.000Z",
    files: {
      "README.md":
        "# Semantic Layer with dbt and DuckDB\n\nPortfolio artifact for a completed Atlas project.",
      "VALIDATION_EVIDENCE.md":
        "Atlas verified that submitted runtime output or artifacts matched the enabled validation checks.",
      "LIMITATIONS.md":
        "Atlas did not verify independent authorship of this work and does not guarantee employment.",
      "LEARNER_REFLECTION_TEMPLATE.md": "## What I learned\n\n- ...",
    },
  };
  const realFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url.includes("/portfolio-artifact")) {
      if (window.__E2E_FAIL__ === true) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(ARTIFACT), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/api/user/portfolio")) {
      return new Response(JSON.stringify(PORTFOLIO), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof window.fetch;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Certificates />
  </QueryClientProvider>,
);
