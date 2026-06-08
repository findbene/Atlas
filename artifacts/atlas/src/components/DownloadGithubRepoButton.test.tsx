/**
 * Phase 60H — manual GitHub-ready repository ZIP download button.
 *
 * Verifies the narrow client-side contract:
 *  - clicking calls `customFetch` with the ZIP route URL + responseType "blob"
 *    (on-demand, never on mount);
 *  - the downloaded file is the blob returned by the route, saved as a `.zip`;
 *  - the component renders none of the bundle contents into the DOM;
 *  - every failure collapses to one safe, non-leaky message;
 *  - no forbidden authorship/job/certification claim is ever rendered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DownloadGithubRepoButton } from "./DownloadGithubRepoButton";

const customFetchMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  customFetch: (url: string, opts: unknown) => customFetchMock(url, opts),
}));

let savedFilename: string | null = null;
let capturedBlob: Blob | null = null;
const createObjectURLMock = vi.fn((blob: Blob) => {
  capturedBlob = blob;
  return "blob:mock-url";
});
const revokeObjectURLMock = vi.fn();
const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
  savedFilename = this.download;
});

const origCreateObjectURL = globalThis.URL.createObjectURL;
const origRevokeObjectURL = globalThis.URL.revokeObjectURL;

const SLUG = "analytics-engineer-semantic-layer-with-dbt-and-duckdb";
const ZIP_BLOB = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])], {
  type: "application/zip",
});

beforeEach(() => {
  customFetchMock.mockReset();
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
  anchorClickSpy.mockClear();
  capturedBlob = null;
  savedFilename = null;
  globalThis.URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
  globalThis.URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = origCreateObjectURL;
  globalThis.URL.revokeObjectURL = origRevokeObjectURL;
});

describe("DownloadGithubRepoButton (ZIP)", () => {
  it("calls customFetch with the ZIP route URL + responseType blob on click", async () => {
    customFetchMock.mockResolvedValue(ZIP_BLOB);
    render(<DownloadGithubRepoButton projectSlug={SLUG} />);

    fireEvent.click(screen.getByTestId(`download-github-repo-${SLUG}`));

    await waitFor(() => expect(customFetchMock).toHaveBeenCalledTimes(1));
    const [url, opts] = customFetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/user/projects/${SLUG}/portfolio-repository.zip`);
    expect(opts).toEqual({ responseType: "blob" });
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
  });

  it("downloads the route blob as a .zip file", async () => {
    customFetchMock.mockResolvedValue(ZIP_BLOB);
    render(<DownloadGithubRepoButton projectSlug={SLUG} />);

    fireEvent.click(screen.getByTestId(`download-github-repo-${SLUG}`));

    await waitFor(() => expect(capturedBlob).not.toBeNull());
    expect(capturedBlob).toBe(ZIP_BLOB);
    expect(savedFilename).toBe(`${SLUG}-github-ready-repo.zip`);
  });

  it("renders nothing from the archive into the DOM (download only)", async () => {
    customFetchMock.mockResolvedValue(ZIP_BLOB);
    const { container } = render(<DownloadGithubRepoButton projectSlug={SLUG} />);

    fireEvent.click(screen.getByTestId(`download-github-repo-${SLUG}`));
    await waitFor(() => expect(customFetchMock).toHaveBeenCalled());

    // Only the button label is present; no bundle/file content is painted.
    expect(container.textContent).toContain("Download GitHub-Ready Repo");
    expect(container.textContent).not.toContain("README");
  });

  it("renders no forbidden authorship / job / certification claim", () => {
    render(<DownloadGithubRepoButton projectSlug={SLUG} />);
    const text = (document.body.textContent ?? "").toLowerCase();
    for (const banned of [
      "tamper-proof",
      "cheat-proof",
      "job guaranteed",
      "guarantees a job",
      "verified authorship",
      "certified competence",
    ]) {
      expect(text).not.toContain(banned);
    }
  });

  it("shows one safe error message and does not download on failure", async () => {
    customFetchMock.mockRejectedValue(new Error("Project not found"));
    render(<DownloadGithubRepoButton projectSlug="hidden-or-unknown" />);

    fireEvent.click(screen.getByTestId("download-github-repo-hidden-or-unknown"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t prepare the repository/i);
    expect(alert.textContent).not.toContain("Project not found");
    expect(createObjectURLMock).not.toHaveBeenCalled();
    expect(anchorClickSpy).not.toHaveBeenCalled();
  });
});
