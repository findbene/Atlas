/**
 * Phase 60C — manual portfolio-bundle download button.
 *
 * Verifies the narrow client-side contract:
 *  - clicking calls the GENERATED artifact client with the project slug
 *    (on-demand, never on mount);
 *  - the downloaded file is EXACTLY the route output, serialised verbatim —
 *    the component adds nothing and reads no individual field, so no
 *    spec/answer-key channel can be introduced on the client;
 *  - the component renders none of the bundle contents into the DOM;
 *  - every failure (401 / 404 / network) collapses to one safe, non-leaky
 *    message;
 *  - no forbidden authorship/job/certification claim is ever rendered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { PortfolioArtifactResponse } from "@workspace/api-client-react";
import { DownloadPortfolioBundleButton } from "./DownloadPortfolioBundleButton";

const getPortfolioArtifactMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  getPortfolioArtifact: (slug: string) => getPortfolioArtifactMock(slug),
}));

// Capture the Blob handed to the download path so we can assert its contents.
let capturedBlob: Blob | null = null;
const createObjectURLMock = vi.fn((blob: Blob) => {
  capturedBlob = blob;
  return "blob:mock-url";
});
const revokeObjectURLMock = vi.fn();
const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

// Capture the originals so the mutated globals don't leak past this suite.
const origCreateObjectURL = globalThis.URL.createObjectURL;
const origRevokeObjectURL = globalThis.URL.revokeObjectURL;

const SAFE_BUNDLE: PortfolioArtifactResponse = {
  projectSlug: "analytics-engineer-semantic-layer-with-dbt-and-duckdb",
  generatedAt: "2026-06-07T00:00:00.000Z",
  files: {
    "README.md": "# Semantic Layer with dbt and DuckDB\n\nProject portfolio artifact.",
    "VALIDATION_EVIDENCE.md":
      "Atlas verified that submitted runtime output or artifacts matched the enabled validation checks.",
    "LIMITATIONS.md": "Atlas did not verify independent authorship of this work.",
    "LEARNER_REFLECTION_TEMPLATE.md": "## What I learned\n\n- …",
  },
};

beforeEach(() => {
  getPortfolioArtifactMock.mockReset();
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
  anchorClickSpy.mockClear();
  capturedBlob = null;
  globalThis.URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
  globalThis.URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  vi.clearAllMocks();
  // Restore the URL globals we reassigned so nothing leaks past this file.
  globalThis.URL.createObjectURL = origCreateObjectURL;
  globalThis.URL.revokeObjectURL = origRevokeObjectURL;
});

describe("DownloadPortfolioBundleButton", () => {
  it("calls the generated artifact client with the project slug on click", async () => {
    getPortfolioArtifactMock.mockResolvedValue(SAFE_BUNDLE);
    render(<DownloadPortfolioBundleButton projectSlug={SAFE_BUNDLE.projectSlug} />);

    fireEvent.click(
      screen.getByTestId(`download-portfolio-bundle-${SAFE_BUNDLE.projectSlug}`),
    );

    await waitFor(() => expect(getPortfolioArtifactMock).toHaveBeenCalledTimes(1));
    expect(getPortfolioArtifactMock).toHaveBeenCalledWith(SAFE_BUNDLE.projectSlug);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
  });

  it("downloads EXACTLY the route output, serialised verbatim (no added/leaked fields)", async () => {
    getPortfolioArtifactMock.mockResolvedValue(SAFE_BUNDLE);
    render(<DownloadPortfolioBundleButton projectSlug={SAFE_BUNDLE.projectSlug} />);

    fireEvent.click(
      screen.getByTestId(`download-portfolio-bundle-${SAFE_BUNDLE.projectSlug}`),
    );

    await waitFor(() => expect(capturedBlob).not.toBeNull());
    const text = await capturedBlob!.text();
    // Round-trips to precisely the route output — nothing more, nothing less.
    expect(JSON.parse(text)).toEqual(SAFE_BUNDLE);
    expect(text).toBe(JSON.stringify(SAFE_BUNDLE, null, 2));
    expect(capturedBlob!.type).toBe("application/json");
  });

  it("never leaks spec / answer-key tokens into the download payload", async () => {
    // Even if a (hypothetical, contract-violating) field appeared, the client
    // only ever serialises what the route returns; assert the safe payload
    // carries no spec/answer-key markers.
    getPortfolioArtifactMock.mockResolvedValue(SAFE_BUNDLE);
    render(<DownloadPortfolioBundleButton projectSlug={SAFE_BUNDLE.projectSlug} />);

    fireEvent.click(
      screen.getByTestId(`download-portfolio-bundle-${SAFE_BUNDLE.projectSlug}`),
    );

    await waitFor(() => expect(capturedBlob).not.toBeNull());
    const text = (await capturedBlob!.text()).toLowerCase();
    for (const banned of [
      "validationconfig",
      "expectedrows",
      "expectedrowshash",
      "servergrade",
      "answer key",
      "select ",
      '"spec"',
    ]) {
      expect(text).not.toContain(banned);
    }
  });

  it("renders none of the bundle contents into the DOM (download only)", async () => {
    getPortfolioArtifactMock.mockResolvedValue(SAFE_BUNDLE);
    const { container } = render(
      <DownloadPortfolioBundleButton projectSlug={SAFE_BUNDLE.projectSlug} />,
    );

    fireEvent.click(
      screen.getByTestId(`download-portfolio-bundle-${SAFE_BUNDLE.projectSlug}`),
    );
    await waitFor(() => expect(getPortfolioArtifactMock).toHaveBeenCalled());

    // The bundle file contents must not be painted into the page.
    expect(container.textContent).not.toContain("Semantic Layer with dbt");
    expect(container.textContent).not.toContain("Atlas verified that submitted");
  });

  it("renders no forbidden authorship / job / certification claim", () => {
    render(<DownloadPortfolioBundleButton projectSlug={SAFE_BUNDLE.projectSlug} />);
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

  it("shows one safe error message and does not download on failure (404/401/network)", async () => {
    getPortfolioArtifactMock.mockRejectedValue(new Error("Project not found"));
    render(<DownloadPortfolioBundleButton projectSlug="hidden-or-unknown" />);

    fireEvent.click(screen.getByTestId("download-portfolio-bundle-hidden-or-unknown"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t prepare the bundle/i);
    // No raw server detail surfaced, no file written.
    expect(alert.textContent).not.toContain("Project not found");
    expect(createObjectURLMock).not.toHaveBeenCalled();
    expect(anchorClickSpy).not.toHaveBeenCalled();
  });
});
