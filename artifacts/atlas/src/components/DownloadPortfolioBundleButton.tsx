/**
 * Phase 60C — manual portfolio-bundle download for a completed project.
 *
 * Boring + narrow by design: a single button that, ON CLICK (never on mount),
 * fetches the authenticated Phase-60B artifact route via the generated client
 * and saves the response as a JSON file. We render NOTHING from the bundle —
 * the file written to disk is exactly and only the route's output, so the
 * frontend cannot introduce a leak the backend already guarantees against
 * (no validationConfig / expectedRows / answer keys / over-claiming copy).
 *
 * One artifact build per click keeps the certificates page cheap — we do NOT
 * use the auto-firing `useGetPortfolioArtifact` query (that would build an
 * artifact for every completed project on render).
 */
import { useState } from "react";
import { getPortfolioArtifact } from "@workspace/api-client-react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DownloadStatus = "idle" | "loading" | "error";

interface DownloadPortfolioBundleButtonProps {
  projectSlug: string;
}

/**
 * Trigger a browser download of `contents` as `filename`. Kept tiny and
 * dependency-free so it is trivial to reason about and to mock in tests.
 */
function saveJsonFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function DownloadPortfolioBundleButton({
  projectSlug,
}: DownloadPortfolioBundleButtonProps) {
  const [status, setStatus] = useState<DownloadStatus>("idle");

  async function handleDownload() {
    setStatus("loading");
    try {
      // The response IS the download payload — we serialise it verbatim and
      // never read individual fields, so no spec/answer-key channel can exist
      // on the client that the route does not already expose.
      const bundle = await getPortfolioArtifact(projectSlug);
      saveJsonFile(
        `${projectSlug}-portfolio.json`,
        JSON.stringify(bundle, null, 2),
      );
      setStatus("idle");
    } catch {
      // Any failure (expired session 401, hidden/unknown project 404, network
      // or server error) collapses to one safe, non-leaky message. We do not
      // surface the server error body.
      setStatus("error");
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-xs"
        disabled={status === "loading"}
        onClick={handleDownload}
        data-testid={`download-portfolio-bundle-${projectSlug}`}
      >
        {status === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <FileDown className="h-3.5 w-3.5 mr-1.5" />
        )}
        {status === "loading" ? "Preparing bundle…" : "Download Portfolio Bundle"}
      </Button>
      {status === "error" && (
        <p
          role="alert"
          className="text-[11px] text-red-400"
          data-testid={`download-portfolio-bundle-error-${projectSlug}`}
        >
          Couldn’t prepare the bundle. Please try again.
        </p>
      )}
    </div>
  );
}

export default DownloadPortfolioBundleButton;
