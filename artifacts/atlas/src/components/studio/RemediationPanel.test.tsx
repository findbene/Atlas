/**
 * Phase 25 — Component tests for RemediationPanel.
 * Verifies each parser branch renders the right structured UI and the
 * panel correctly hides itself on passed/no-check cases.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RemediationPanel } from "./RemediationPanel";

describe("RemediationPanel", () => {
  it("renders exact-diff with expected + got rows", () => {
    render(
      <RemediationPanel
        feedback="Expected: hello world"
        submission="hello"
      />,
    );
    expect(screen.getByTestId("remediation-panel")).toBeInTheDocument();
    expect(screen.getByTestId("remediation-exact-diff")).toBeInTheDocument();
    expect(screen.getByTestId("remediation-expected").textContent).toBe(
      "hello world",
    );
    expect(screen.getByTestId("remediation-actual").textContent).toBe("hello");
  });

  it("renders contains-miss with needle chip and submission row", () => {
    render(
      <RemediationPanel
        feedback="Your output should contain: SELECT *"
        submission="select 1"
      />,
    );
    expect(screen.getByTestId("remediation-contains-miss")).toBeInTheDocument();
    expect(screen.getByTestId("remediation-needle").textContent).toBe(
      "SELECT *",
    );
    expect(screen.getByTestId("remediation-actual").textContent).toBe(
      "select 1",
    );
  });

  it("renders regex-miss with a generic-format hint and submission row", () => {
    render(
      <RemediationPanel
        feedback="Your output doesn't match the expected pattern."
        submission="abc"
      />,
    );
    expect(screen.getByTestId("remediation-regex-miss")).toBeInTheDocument();
    expect(screen.getByTestId("remediation-actual").textContent).toBe("abc");
  });

  it("renders NOTHING for generic feedback (parent panel shows raw text)", () => {
    const { container } = render(
      <RemediationPanel feedback="Step completed." submission="anything" />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("remediation-panel")).not.toBeInTheDocument();
  });

  it("renders NOTHING when hidden=true (no-check / passed step types)", () => {
    const { container } = render(
      <RemediationPanel
        feedback="Expected: x"
        submission="y"
        hidden={true}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders an (empty) placeholder when submission is empty for exact-diff", () => {
    render(<RemediationPanel feedback="Expected: x" submission="" />);
    const actual = screen.getByTestId("remediation-actual");
    expect(actual.textContent).toContain("(empty)");
  });
});
