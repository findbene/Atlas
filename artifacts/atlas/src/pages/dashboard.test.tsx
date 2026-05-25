/**
 * Phase 22 — Dashboard render-path tests.
 *
 * Covers the four data shapes the migrated `/dashboard` page must handle
 * correctly, plus the hidden-only-enrollment edge case and the dashboard-
 * cache invalidation on the new RecommendedStartHereCard.
 *
 * The @workspace/api-client-react module is mocked wholesale so we don't
 * have to spin up a real React Query client or mock fetch — every hook the
 * dashboard touches is stubbed with deterministic data per test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type {
  DashboardResponse,
  DashboardEnrollment,
  DashboardResume,
  DashboardRecommendation,
} from "@workspace/api-client-react";
import Dashboard from "./dashboard";

// ---- Hook mocks ------------------------------------------------------------

const useGetDashboardMock = vi.fn();
const useGetUserStatsMock = vi.fn();
const useGetLeaderboardMock = vi.fn();
const useCreateEnrollmentMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useGetDashboard: () => useGetDashboardMock(),
  useGetUserStats: () => useGetUserStatsMock(),
  useGetLeaderboard: () => useGetLeaderboardMock(),
  useCreateEnrollment: () => useCreateEnrollmentMock(),
  getGetDashboardQueryKey: () => ["/api/dashboard"],
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ isLoaded: true, userId: "user_test" }),
}));

// StreakHeatmap pulls date-fns and conditional rendering we don't care about
// in these unit tests; stub it to a marker div.
vi.mock("@/components/StreakHeatmap", () => ({
  StreakHeatmap: () => <div data-testid="streak-heatmap-stub" />,
}));

// ---- Fixtures --------------------------------------------------------------

function makeEnrollment(overrides: Partial<DashboardEnrollment> = {}): DashboardEnrollment {
  return {
    projectId: "p1",
    projectSlug: "csv-to-postgres-pipeline",
    projectTitle: "CSV to Postgres Pipeline",
    shortDescription: "Build an idempotent ELT pipeline.",
    course: "data-engineering",
    difficulty: "intermediate",
    status: "in_progress",
    currentStep: 2,
    totalSteps: 4,
    completionPercent: 50,
    startedAt: "2026-05-20T00:00:00Z",
    lastUpdatedAt: "2026-05-24T00:00:00Z",
    completedAt: null,
    ...overrides,
  };
}

const sampleResume: DashboardResume = {
  projectId: "p1",
  projectSlug: "csv-to-postgres-pipeline",
  projectTitle: "CSV to Postgres Pipeline",
  course: "data-engineering",
  currentStep: 2,
  totalSteps: 4,
  completionPercent: 50,
  lastUpdatedAt: "2026-05-24T00:00:00Z",
};

const sampleRecommendation: DashboardRecommendation = {
  courseSlug: "data-engineering",
  startHere: {
    kind: "start_here",
    reasonKey: "beginner_available",
    project: {
      slug: "sql-select-where-join-essentials",
      title: "SQL SELECT/WHERE/JOIN Essentials",
      difficulty: "beginner",
    },
    hasBeginner: true,
  } as DashboardRecommendation["startHere"],
};

const baseStats = {
  totalXp: 1200,
  level: 3,
  xpToNextLevel: 500,
  streak: 4,
  longestStreak: 9,
  projectsCompleted: 1,
  rank: 42,
  weeklyXp: [],
};

// ---- Test harness ----------------------------------------------------------

function renderDashboard(path = "/dashboard") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { hook } = memoryLocation({ path });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <Router hook={hook}>
        <Dashboard />
      </Router>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

beforeEach(() => {
  useGetUserStatsMock.mockReturnValue({ data: baseStats, isLoading: false });
  useGetLeaderboardMock.mockReturnValue({ data: [] });
  useCreateEnrollmentMock.mockReturnValue({
    mutate: vi.fn((_vars, opts) => opts?.onSettled?.()),
    isPending: false,
  });
});

// ---- Cases -----------------------------------------------------------------

describe("Dashboard — Phase 22 render paths", () => {
  it("fresh learner: shows recommendation card, no resume banner, empty lists", () => {
    const data: DashboardResponse = {
      resume: null,
      inProgress: [],
      completed: [],
      recommendedStartHere: sampleRecommendation,
    };
    useGetDashboardMock.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });

    renderDashboard();

    expect(screen.queryByTestId("resume-banner")).not.toBeInTheDocument();
    expect(screen.getByTestId("recommended-start-here-card")).toBeInTheDocument();
    expect(screen.getByTestId("recommended-start-here-title")).toHaveTextContent(
      "SQL SELECT/WHERE/JOIN Essentials",
    );
    // Both empty-state copies render in their respective sections.
    expect(screen.getByText(/No projects in progress yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No completed projects yet/i)).toBeInTheDocument();
    // Defensive fully-empty fallback is NOT shown when a recommendation exists.
    expect(screen.queryByTestId("dashboard-empty-fallback")).not.toBeInTheDocument();
  });

  it("has resume: shows banner with project title + correct /projects/:slug link", () => {
    const data: DashboardResponse = {
      resume: sampleResume,
      inProgress: [makeEnrollment()],
      completed: [],
      recommendedStartHere: null,
    };
    useGetDashboardMock.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });

    renderDashboard();

    const banner = screen.getByTestId("resume-banner");
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId("resume-title")).toHaveTextContent("CSV to Postgres Pipeline");
    // Step counter visible inside the banner — but no copy promises landing
    // on that exact step. (The same text also appears in the In Progress
    // row, so scope to the banner.)
    expect(within(banner).getByText(/Step 2 of 4/i)).toBeInTheDocument();
    // Banner href resolves to /projects/:slug only — no ?step= query.
    const link = banner.closest("a");
    expect(link?.getAttribute("href")).toBe("/projects/csv-to-postgres-pipeline");
    expect(link?.getAttribute("href")).not.toContain("step=");
  });

  it("in-progress only: list populated, completed empty, no recommendation, no banner", () => {
    const data: DashboardResponse = {
      resume: null,
      inProgress: [
        makeEnrollment({ projectId: "a", projectSlug: "a", projectTitle: "Project A" }),
        makeEnrollment({ projectId: "b", projectSlug: "b", projectTitle: "Project B" }),
      ],
      completed: [],
      recommendedStartHere: null,
    };
    useGetDashboardMock.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });

    renderDashboard();

    expect(screen.queryByTestId("resume-banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("recommended-start-here-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("in_progress-row-a")).toBeInTheDocument();
    expect(screen.getByTestId("in_progress-row-b")).toBeInTheDocument();
    expect(screen.getByText(/No completed projects yet/i)).toBeInTheDocument();
  });

  it("completed only: list populated, no banner, no recommendation, in-progress empty-state", () => {
    const data: DashboardResponse = {
      resume: null,
      inProgress: [],
      completed: [
        makeEnrollment({
          projectId: "c",
          projectSlug: "c",
          projectTitle: "Completed Project",
          status: "completed",
          currentStep: 4,
          completionPercent: 100,
          completedAt: "2026-05-24T00:00:00Z",
        }),
      ],
      recommendedStartHere: null,
    };
    useGetDashboardMock.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });

    renderDashboard();

    expect(screen.queryByTestId("resume-banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("recommended-start-here-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("completed-row-c")).toBeInTheDocument();
    expect(screen.getByText(/No projects in progress yet/i)).toBeInTheDocument();
  });

  it("hidden-only enrollment edge case: empty lists + null recommendation renders defensive fallback (NOT fresh-learner recommendation)", () => {
    // Server returns all-empty when the learner has only hidden-project
    // enrollments (raw progressRows.length > 0 → no recommendation, but
    // visible lists are empty).
    const data: DashboardResponse = {
      resume: null,
      inProgress: [],
      completed: [],
      recommendedStartHere: null,
    };
    useGetDashboardMock.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });

    renderDashboard();

    expect(screen.queryByTestId("recommended-start-here-card")).not.toBeInTheDocument();
    // The defensive fallback (Start onboarding) is the only CTA in this case;
    // critically, we do NOT show the fresh-learner recommendation flow.
    expect(screen.getByTestId("dashboard-empty-fallback")).toBeInTheDocument();
  });

  it("error: renders inline retry banner, suppresses false-empty section states, does not crash stats/leaderboard", () => {
    const refetch = vi.fn();
    useGetDashboardMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });

    renderDashboard();

    expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
    // Stats row still rendered.
    expect(screen.getByText(/Total XP/i)).toBeInTheDocument();
    // Per-section error placeholders rendered INSTEAD of the misleading
    // "No projects in progress yet" / "No completed projects yet"
    // empty-state copy — otherwise we'd be lying to the user about state.
    expect(screen.getByTestId("in-progress-error-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("completed-error-placeholder")).toBeInTheDocument();
    expect(screen.queryByText(/No projects in progress yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No completed projects yet/i)).not.toBeInTheDocument();
  });
});

describe("RecommendedStartHereCard — enrollment invalidates dashboard cache", () => {
  it("invalidates /api/dashboard query on CTA click", async () => {
    const data: DashboardResponse = {
      resume: null,
      inProgress: [],
      completed: [],
      recommendedStartHere: sampleRecommendation,
    };
    useGetDashboardMock.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });

    const mutate = vi.fn((_vars, opts) => opts?.onSettled?.());
    useCreateEnrollmentMock.mockReturnValue({ mutate, isPending: false });

    const { queryClient } = renderDashboard();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(screen.getByTestId("recommended-start-here-cta"));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        { data: { projectSlug: "sql-select-where-join-essentials" } },
        expect.any(Object),
      );
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["/api/dashboard"] });
  });
});
