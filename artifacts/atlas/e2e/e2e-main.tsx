/**
 * Phase 60D — real-browser E2E harness for the Phase-60C portfolio download.
 *
 * Renders the REAL Certificates page + REAL DownloadPortfolioBundleButton +
 * REAL generated client. The backend is faked at the `window.fetch` boundary
 * (frontend network interception — an explicitly allowed strategy) so we never
 * boot the Replit-coupled API. Auth is faked via the clerk-mock alias.
 *
 * Downloads are captured into `window.__E2E_DOWNLOAD__` so the browser driver
 * (playwright-cli) can read and assert the exact payload the button produced.
 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

// --- Fixtures: one completed C2 project + a safe (leak-free) artifact bundle.
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

  // Order matters: the artifact path also contains "portfolio".
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Certificates />
  </QueryClientProvider>,
);
