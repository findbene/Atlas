/**
 * Phase 60G/60H — manual GitHub-ready repository download for a completed
 * project. Phase 60H switches the default download to a one-click ZIP archive.
 *
 * On click (never on mount) it fetches the authenticated Phase-60H ZIP route as
 * a Blob via the shared `customFetch` (which applies the same base URL + bearer
 * auth + error semantics as the generated client) and saves it as a `.zip`. We
 * never read the archive contents on the client — the file written to disk is
 * exactly the route output, so the frontend cannot introduce a leak the backend
 * already guarantees against. MANUAL upload only: no GitHub OAuth, no token
 * input, no direct push, no public sharing.
 *
 * The binary `application/zip` response does not fit the JSON-oriented generated
 * react-query client cleanly, so we call `customFetch` directly with
 * `responseType: "blob"` (a narrow, documented helper) rather than adding a
 * binary path to the OpenAPI codegen.
 */
import { useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DownloadStatus = "idle" | "loading" | "error";

interface DownloadGithubRepoButtonProps {
  projectSlug: string;
}

/** Trigger a browser download of `blob` as `filename`. Tiny + dependency-free. */
function saveBlobFile(filename: string, blob: Blob): void {
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
      // The blob IS the download payload — saved verbatim, never inspected, so
      // no spec/answer-key channel can exist on the client that the route does
      // not already expose.
      const zip = await customFetch<Blob>(
        `/api/user/projects/${encodeURIComponent(projectSlug)}/portfolio-repository.zip`,
        { responseType: "blob" },
      );
      // Mirror the server's safe-filename charset (lib/portfolioZip safeRootFolder)
      // so the saved name is filesystem-safe and matches the route's
      // Content-Disposition. For normal kebab-case slugs this is identity.
      const safeName = projectSlug.replace(/[^A-Za-z0-9._-]/g, "-");
      saveBlobFile(`${safeName}-github-ready-repo.zip`, zip);
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
