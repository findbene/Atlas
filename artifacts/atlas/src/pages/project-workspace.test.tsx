/**
 * Phase 23 — Workspace lifecycle test for auto-resume.
 *
 * This is a focused regression test for the bug the architect caught in the
 * first pass: when a returning learner opens `/projects/:slug` with no
 * `?step=N` and a server-recorded `progress.currentStepPosition`, the
 * workspace must wait for enrollment to resolve AND the progress query to
 * actually fetch before deciding which step to land on. An earlier draft
 * resolved immediately because `enrolled` starts `false` and the gating
 * condition was `!enrolled`, which locked in step 0 before progress
 * arrived.
 *
 * We don't try to render the full StudioShell here — it pulls in heavy
 * editor + recharts dependencies that aren't relevant to the resume
 * decision. Instead we stub StudioShell to a marker that exposes the
 * `currentStepIdx` prop, then assert it lands on the correct index.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import ProjectWorkspace from "./project-workspace";

// ---- Hook + heavy-dependency mocks ----------------------------------------

const useGetProjectMock = vi.fn();
const useGetUserProjectProgressMock = vi.fn();
const useEnrollProjectMock = vi.fn();
const useSubmitStepMock = vi.fn();
const useGetUserProfileMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useGetProject: () => useGetProjectMock(),
  useGetUserProjectProgress: () => useGetUserProjectProgressMock(),
  useEnrollProject: () => useEnrollProjectMock(),
  useSubmitStep: () => useSubmitStepMock(),
  useGetUserProfile: () => useGetUserProfileMock(),
  getGetUserProjectProgressQueryKey: (id: string) => ["/api/user/projects", id, "progress"],
}));

// Pyodide and the execution registry would otherwise try to load real
// Python/SQL runtimes when the workspace mounts — stub them out.
vi.mock("@/lib/pyodideRunner", () => ({
  runPython: vi.fn(),
  loadPyodideOnce: vi.fn(() => Promise.resolve()),
  subscribePyodideStatus: (_cb: (s: string) => void) => () => {},
}));
vi.mock("@/lib/executionRegistry", () => ({
  runViaRegistry: vi.fn(),
}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

// StudioShell is heavy (editor, recharts, etc.). Stub to a marker that
// surfaces the prop we care about for resume.
vi.mock("@/components/studio/StudioShell", () => ({
  StudioShell: (props: { currentStepIdx: number }) => (
    <div data-testid="studio-shell" data-step-idx={String(props.currentStepIdx)} />
  ),
}));
vi.mock("@/components/studio/StudioTopBar", () => ({
  StudioTopBar: () => <div data-testid="studio-topbar" />,
}));
vi.mock("@/components/studio/SolutionDialog", () => ({
  SolutionDialog: () => null,
}));

// wouter's useParams pulls from the Router context; the Router below provides
// the path, but we also need to make sure the params hook reads the slug.
vi.mock("wouter", async () => {
  const actual: any = await vi.importActual("wouter");
  return {
    ...actual,
    useParams: () => ({ slug: "csv-to-postgres-pipeline" }),
  };
});

// ---- Helpers --------------------------------------------------------------

function makeProject(stepCount: number) {
  return {
    id: "p1",
    slug: "csv-to-postgres-pipeline",
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `s${i + 1}`,
      position: i + 1,
      title: `Step ${i + 1}`,
      description: "",
      type: "concept_check",
    })),
  };
}

function renderWorkspace(initialUrl: string = "/projects/csv-to-postgres-pipeline") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { hook } = memoryLocation({ path: initialUrl });
  return render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <ProjectWorkspace />
      </Router>
    </QueryClientProvider>,
  );
}

// ---- Tests ----------------------------------------------------------------

describe("Phase 23 — ProjectWorkspace resume lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default safe stubs every test can override.
    useGetUserProfileMock.mockReturnValue({ data: { tier: "free" } });
    useSubmitStepMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
    // Replace any leftover ?step= from previous tests.
    window.history.replaceState({}, "", "/");
  });

  it("seeds from progress.currentStepPosition when no ?step= URL param and enrollment + progress resolve asynchronously", async () => {
    useGetProjectMock.mockReturnValue({ data: makeProject(5), isLoading: false });
    // Progress query has fetched and returns position 3 (1-indexed → idx 2).
    useGetUserProjectProgressMock.mockReturnValue({
      data: { currentStepPosition: 3, stepCompletions: [] },
      isFetched: true,
    });
    // Enroll mutation fires onSuccess synchronously so React's batched
    // setEnrolled(true) takes effect on the next render — mirroring the
    // real 409-or-201 fast-path.
    const enrollMutate = vi.fn((_vars: unknown, opts: any) => opts?.onSuccess?.());
    useEnrollProjectMock.mockReturnValue({ mutate: enrollMutate, isPending: false });

    renderWorkspace();
    // The auto-enroll useEffect + the resume useEffect both run in the same
    // commit cycle; one flush is enough but we wrap in act() to be safe.
    await act(async () => {});

    const shell = await screen.findByTestId("studio-shell");
    expect(shell.getAttribute("data-step-idx")).toBe("2");
    // URL self-correction: the resume effect should have written ?step=3
    // back so a reload / share lands on the same step.
    expect(window.location.search).toBe("?step=3");
  });

  it("prefers a valid ?step= URL param over progress (clamped to range)", async () => {
    useGetProjectMock.mockReturnValue({ data: makeProject(5), isLoading: false });
    useGetUserProjectProgressMock.mockReturnValue({
      data: { currentStepPosition: 1, stepCompletions: [] },
      isFetched: true,
    });
    useEnrollProjectMock.mockReturnValue({
      mutate: vi.fn((_v: unknown, opts: any) => opts?.onSuccess?.()),
      isPending: false,
    });

    // ?step=999 clamps to last step (idx 4 for a 5-step project).
    window.history.replaceState({}, "", "/projects/csv-to-postgres-pipeline?step=999");
    renderWorkspace();
    await act(async () => {});

    const shell = await screen.findByTestId("studio-shell");
    expect(shell.getAttribute("data-step-idx")).toBe("4");
    // Out-of-range URL gets corrected to the actual landing step.
    expect(window.location.search).toBe("?step=5");
  });

  it("holds the skeleton (does not flash step 0) while enrollment is still pending", async () => {
    useGetProjectMock.mockReturnValue({ data: makeProject(5), isLoading: false });
    useGetUserProjectProgressMock.mockReturnValue({
      data: undefined,
      isFetched: false,
    });
    // Enroll mutation never fires onSuccess — simulates in-flight enroll.
    useEnrollProjectMock.mockReturnValue({ mutate: vi.fn(), isPending: true });

    renderWorkspace();
    await act(async () => {});

    // StudioShell must not have rendered yet — the resume-pending skeleton
    // branch should be active.
    expect(screen.queryByTestId("studio-shell")).not.toBeInTheDocument();
  });
});
