/**
 * Phase 60G — manual GitHub-ready repository download button.
 *
 * Same narrow client-side contract as the portfolio-bundle button:
 *  - clicking calls the GENERATED repository client with the project slug
 *    (on-demand, never on mount);
 *  - the downloaded file is EXACTLY the route output, serialised verbatim;
 *  - the component renders none of the bundle contents into the DOM;
 *  - every failure collapses to one safe, non-leaky message;
 *  - no forbidden authorship/job/certification claim is ever rendered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { PortfolioRepositoryResponse } from "@workspace/api-client-react";
import { DownloadGithubRepoButton } from "./DownloadGithubRepoButton";

const getPortfolioRepositoryMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  getPortfolioRepository: (slug: string) => getPortfolioRepositoryMock(slug),
}));

let capturedBlob: Blob | null = null;
const createObjectURLMock = vi.fn((blob: Blob) => {
  capturedBlob = blob;
  return "blob:mock-url";
});
const revokeObjectURLMock = vi.fn();
const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

const origCreateObjectURL = globalThis.URL.createObjectURL;
const origRevokeObjectURL = globalThis.URL.revokeObjectURL;

const SAFE_REPO: PortfolioRepositoryResponse = {
  projectSlug: "analytics-engineer-semantic-layer-with-dbt-and-duckdb",
  generatedAt: "2026-06-08T00:00:00.000Z",
  format: "github-ready-repository",
  files: {
    "README.md": "# Semantic Layer with dbt and DuckDB\n\nProject portfolio artifact.",
    "VALIDATION_EVIDENCE.md":
      "Atlas verified that submitted runtime output or artifacts matched the enabled validation checks.",
    "LIMITATIONS.md": "Atlas did not verify independent authorship of this work.",
    "LEARNER_REFLECTION_TEMPLATE.md": "## What I learned\n\n- …",
    "atlas-portfolio.json": '{\n  "schema": "atlas-portfolio/v1"\n}\n',
  },
};

beforeEach(() => {
  getPortfolioRepositoryMock.mockReset();
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
  anchorClickSpy.mockClear();
  capturedBlob = null;
  globalThis.URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
  globalThis.URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = origCreateObjectURL;
  globalThis.URL.revokeObjectURL = origRevokeObjectURL;
});

describe("DownloadGithubRepoButton", () => {
  it("calls the generated repository client with the project slug on click", async () => {
    getPortfolioRepositoryMock.mockResolvedValue(SAFE_REPO);
    render(<DownloadGithubRepoButton projectSlug={SAFE_REPO.projectSlug} />);

    fireEvent.click(screen.getByTestId(`download-github-repo-${SAFE_REPO.projectSlug}`));

    await waitFor(() => expect(getPortfolioRepositoryMock).toHaveBeenCalledTimes(1));
    expect(getPortfolioRepositoryMock).toHaveBeenCalledWith(SAFE_REPO.projectSlug);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
  });

  it("downloads EXACTLY the route output, serialised verbatim", async () => {
    getPortfolioRepositoryMock.mockResolvedValue(SAFE_REPO);
    render(<DownloadGithubRepoButton projectSlug={SAFE_REPO.projectSlug} />);

    fireEvent.click(screen.getByTestId(`download-github-repo-${SAFE_REPO.projectSlug}`));

    await waitFor(() => expect(capturedBlob).not.toBeNull());
    const text = await capturedBlob!.text();
    expect(JSON.parse(text)).toEqual(SAFE_REPO);
    expect(text).toBe(JSON.stringify(SAFE_REPO, null, 2));
    expect(capturedBlob!.type).toBe("application/json");
  });

  it("renders none of the bundle contents into the DOM (download only)", async () => {
    getPortfolioRepositoryMock.mockResolvedValue(SAFE_REPO);
    const { container } = render(
      <DownloadGithubRepoButton projectSlug={SAFE_REPO.projectSlug} />,
    );

    fireEvent.click(screen.getByTestId(`download-github-repo-${SAFE_REPO.projectSlug}`));
    await waitFor(() => expect(getPortfolioRepositoryMock).toHaveBeenCalled());

    expect(container.textContent).not.toContain("Semantic Layer with dbt");
    expect(container.textContent).not.toContain("Atlas verified that submitted");
  });

  it("renders no forbidden authorship / job / certification claim", () => {
    render(<DownloadGithubRepoButton projectSlug={SAFE_REPO.projectSlug} />);
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
    getPortfolioRepositoryMock.mockRejectedValue(new Error("Project not found"));
    render(<DownloadGithubRepoButton projectSlug="hidden-or-unknown" />);

    fireEvent.click(screen.getByTestId("download-github-repo-hidden-or-unknown"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t prepare the repository/i);
    expect(alert.textContent).not.toContain("Project not found");
    expect(createObjectURLMock).not.toHaveBeenCalled();
    expect(anchorClickSpy).not.toHaveBeenCalled();
  });
});
