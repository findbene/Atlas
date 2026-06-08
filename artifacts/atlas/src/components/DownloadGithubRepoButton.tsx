/**
 * Phase 60G — manual GitHub-ready repository download for a completed project.
 *
 * Sibling of DownloadPortfolioBundleButton: a single button that, ON CLICK
 * (never on mount), fetches the authenticated Phase-60G portfolio-repository
 * route via the generated client and saves the response as a JSON file. We
 * render NOTHING from the bundle — the file written to disk is exactly and only
 * the route's output, so the frontend cannot introduce a leak the backend
 * already guarantees against (no validationConfig / expectedRows / answer keys
 * / over-claiming copy). MANUAL upload only: no GitHub OAuth, no token input,
 * no direct push, no public sharing.
 */
import { useState } from "react";
import { getPortfolioRepository } from "@workspace/api-client-react";
import { Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DownloadStatus = "idle" | "loading" | "error";

interface DownloadGithubRepoButtonProps {
  projectSlug: string;
}

/** Trigger a browser download of `contents` as `filename`. Tiny + dependency-
 *  free so it is trivial to reason about and to mock in tests. */
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

export function DownloadGithubRepoButton({
  projectSlug,
}: DownloadGithubRepoButtonProps) {
  const [status, setStatus] = useState<DownloadStatus>("idle");

  async function handleDownload() {
    setStatus("loading");
    try {
      // The response IS the download payload — serialised verbatim, never read
      // field-by-field, so no spec/answer-key channel can exist on the client
      // that the route does not already expose.
      const repo = await getPortfolioRepository(projectSlug);
      saveJsonFile(
        `${projectSlug}-github-ready-repo.json`,
        JSON.stringify(repo, null, 2),
      );
      setStatus("idle");
    } catch {
      // Any failure (401 / 404 / network / server) collapses to one safe,
      // non-leaky message. We never surface the server error body.
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
        data-testid={`download-github-repo-${projectSlug}`}
      >
        {status === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <Github className="h-3.5 w-3.5 mr-1.5" />
        )}
        {status === "loading" ? "Preparing repo…" : "Download GitHub-Ready Repo"}
      </Button>
      {status === "error" && (
        <p
          role="alert"
          className="text-[11px] text-red-400"
          data-testid={`download-github-repo-error-${projectSlug}`}
        >
          Couldn’t prepare the repository. Please try again.
        </p>
      )}
    </div>
  );
}

export default DownloadGithubRepoButton;
