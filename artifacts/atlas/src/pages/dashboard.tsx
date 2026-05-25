/**
 * Phase 22 — Dashboard migration.
 *
 * The resume / in-progress / completed / recommendation surfaces are sourced
 * from the single `GET /api/dashboard` endpoint (introduced in Phase 21).
 * This replaces the legacy combo of `GET /api/projects/resume` and
 * `useListUserProjects` that the pre-P21 dashboard relied on.
 *
 * What's deliberately preserved (NOT touched by P22):
 *   - XP / streak / level / weekly-XP chart (useGetUserStats)
 *   - Streak heatmap component
 *   - Leaderboard preview (useGetLeaderboard)
 *
 * What's deliberately dropped:
 *   - Static "Ready to build something?" CTA — superseded by the
 *     RecommendedStartHereCard for fresh learners, and irrelevant for users
 *     who already have an in-progress project.
 *   - JobOutcomes button on each in-progress card — the new
 *     `DashboardEnrollment` payload doesn't carry `jobOutcomes`. The data is
 *     still available on the project detail page itself, so the surface
 *     simply moves rather than disappears. Adding a parallel `/api/projects`
 *     fetch on the dashboard purely to re-attach this would defeat the
 *     point of consolidating into a single endpoint.
 *
 * Resume CTAs link to `/projects/:slug` only — the workspace currently does
 * NOT auto-resume to `currentStep` (Phase 23 candidate). Copy is honest
 * about returning to the project, not the exact step.
 */
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  useGetUserStats,
  useGetLeaderboard,
  useGetDashboard,
  type DashboardEnrollment,
  type DashboardResume,
} from "@workspace/api-client-react";
import { Flame, Trophy, BookOpen, Code2, Star, ChevronRight, Award, PlayCircle } from "lucide-react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { StreakHeatmap } from "@/components/StreakHeatmap";
import { EmptyState } from "@/components/EmptyState";
import { RecommendedStartHereCard } from "@/components/RecommendedStartHereCard";
import { Rocket, Trophy as TrophyIcon } from "lucide-react";

function XpBar({ current, next, level }: { current: number; next: number; level: number }) {
  const pct = Math.min((current / next) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Level {level}</span>
        <span>{current} / {next} XP</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function progressPct(current: number, total: number): number {
  return Math.max(0, Math.min(100, Math.round((current / Math.max(total, 1)) * 100)));
}

function ResumeBanner({ resume }: { resume: DashboardResume }) {
  return (
    <Link href={`/projects/${resume.projectSlug}`}>
      <div
        className="group bg-gradient-to-r from-blue-600/15 via-blue-600/10 to-purple-600/10 border border-blue-500/30 hover:border-blue-400/60 rounded-xl p-5 transition-colors cursor-pointer"
        data-testid="resume-banner"
      >
        <div className="flex items-center gap-4">
          <div className="shrink-0 h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <PlayCircle className="h-5 w-5 text-blue-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-blue-300/80 mb-0.5">
              Pick up where you left off
            </p>
            <p className="font-medium truncate" data-testid="resume-title">{resume.projectTitle}</p>
            <div className="mt-2 flex items-center gap-3">
              <Progress
                value={progressPct(resume.currentStep, resume.totalSteps)}
                className="h-1.5 flex-1 max-w-xs"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Step {resume.currentStep} of {resume.totalSteps}
              </span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-blue-300 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

function EnrollmentRow({ row, kind }: { row: DashboardEnrollment; kind: "in_progress" | "completed" }) {
  const pct = progressPct(row.currentStep, row.totalSteps);
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
      data-testid={`${kind}-row-${row.projectSlug}`}
    >
      <Link href={`/projects/${row.projectSlug}`} className="flex-1 min-w-0">
        <div className="cursor-pointer">
          <p className="font-medium text-sm line-clamp-1">{row.projectTitle}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {kind === "completed"
              ? "Completed"
              : `Step ${row.currentStep} of ${row.totalSteps}`}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={pct} className="h-1 flex-1" />
            <span className="text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {kind === "completed" && (
          <Award className="h-3.5 w-3.5 text-amber-300/80" aria-hidden />
        )}
        <Link href={`/projects/${row.projectSlug}`} aria-label={`Open ${row.projectTitle}`}>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isLoaded, userId } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetUserStats();
  const { data: leaderboard } = useGetLeaderboard({ limit: 5 });
  const {
    data: dashboard,
    isLoading: dashboardLoading,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = useGetDashboard();

  if (!isLoaded || !userId) return null;

  const resume = dashboard?.resume ?? null;
  const inProgress = dashboard?.inProgress ?? [];
  const completed = dashboard?.completed ?? [];
  const recommendation = dashboard?.recommendedStartHere ?? null;
  // Defensive fully-empty state: only used if the API succeeded but returned
  // nothing AND no recommendation (e.g. a returning user with only hidden
  // enrollments). Fresh learners always get a recommendation from the server,
  // so this should be rare.
  const isFullyEmpty =
    !dashboardLoading && !dashboardError && !resume && inProgress.length === 0 && completed.length === 0 && !recommendation;

  return (
    <div className="container max-w-6xl mx-auto py-10 px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Track your progress, keep your streak, climb the leaderboard.</p>
      </div>

      {dashboardLoading && (
        <div className="h-24 rounded-xl bg-muted animate-pulse" data-testid="dashboard-loading" />
      )}

      {dashboardError && !dashboardLoading && (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between gap-3"
          data-testid="dashboard-error"
        >
          <p className="text-sm text-muted-foreground">
            Couldn't load your dashboard. Stats and leaderboard below are unaffected.
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetchDashboard()}>
            Retry
          </Button>
        </div>
      )}

      {!dashboardLoading && !dashboardError && resume && <ResumeBanner resume={resume} />}

      {!dashboardLoading && !dashboardError && recommendation && (
        <RecommendedStartHereCard recommendation={recommendation} />
      )}

      {/* Stats Row — unchanged from pre-P22. Independent query, doesn't depend on /api/dashboard. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Star className="h-4 w-4 text-amber-400" />
            Total XP
          </div>
          {statsLoading ? <div className="h-8 w-20 bg-muted rounded animate-pulse" /> : <p className="text-2xl font-bold">{(stats?.totalXp ?? 0).toLocaleString()}</p>}
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Flame className="h-4 w-4 text-orange-400" />
            Day Streak
          </div>
          {statsLoading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : <p className="text-2xl font-bold">{stats?.streak ?? 0}</p>}
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <BookOpen className="h-4 w-4 text-blue-400" />
            Completed
          </div>
          {statsLoading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : <p className="text-2xl font-bold">{stats?.projectsCompleted ?? 0}</p>}
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Trophy className="h-4 w-4 text-purple-400" />
            Rank
          </div>
          {statsLoading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : <p className="text-2xl font-bold">#{stats?.rank ?? "—"}</p>}
        </div>
      </div>

      {stats && (
        <StreakHeatmap
          currentStreak={stats.streak ?? 0}
          longestStreak={(stats as { longestStreak?: number }).longestStreak ?? 0}
        />
      )}

      {stats && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Level Progress</h2>
            <span className="text-sm text-muted-foreground">Level {stats.level}</span>
          </div>
          <XpBar
            current={stats.totalXp % Math.max(stats.xpToNextLevel ?? 100, 1)}
            next={stats.xpToNextLevel ?? 100}
            level={stats.level}
          />
          {stats.weeklyXp && stats.weeklyXp.length > 0 && (
            <div className="mt-4 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.weeklyXp}>
                  <defs>
                    <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
                  <Tooltip formatter={(v: number | string) => [v, "XP"]} />
                  <Area type="monotone" dataKey="xp" stroke="#3B82F6" fill="url(#xpGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* In Progress — sourced from /api/dashboard.inProgress (P22). */}
        <div className="bg-card border border-border rounded-xl p-6" data-testid="in-progress-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Code2 className="h-4 w-4 text-blue-400" />
              In Progress
            </h2>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground"><Link href="/courses">Browse projects</Link></Button>
          </div>
          {dashboardLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : dashboardError ? (
            // Avoid showing a "No projects in progress yet" empty-state when
            // the API actually failed — that would lie to users about their
            // state. The top-level error banner already gives them a retry.
            <p className="text-sm text-muted-foreground" data-testid="in-progress-error-placeholder">
              Couldn't load your projects.
            </p>
          ) : inProgress.length === 0 ? (
            <EmptyState
              compact
              icon={Rocket}
              title="No projects in progress yet"
              description="Pick a real-world project and ship your first commit."
              ctaLabel="Browse courses"
              ctaHref="/courses"
            />
          ) : (
            <div className="space-y-3">
              {inProgress.slice(0, 5).map(row => (
                <EnrollmentRow key={row.projectId} row={row} kind="in_progress" />
              ))}
            </div>
          )}
        </div>

        {/* Completed — new in P22, sourced from /api/dashboard.completed. */}
        <div className="bg-card border border-border rounded-xl p-6" data-testid="completed-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              Completed
            </h2>
            {completed.length > 0 && (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground"><Link href="/certificates">Certificates</Link></Button>
            )}
          </div>
          {dashboardLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : dashboardError ? (
            <p className="text-sm text-muted-foreground" data-testid="completed-error-placeholder">
              Couldn't load your projects.
            </p>
          ) : completed.length === 0 ? (
            <EmptyState
              compact
              icon={TrophyIcon}
              title="No completed projects yet"
              description="Finish your first project to start your portfolio."
            />
          ) : (
            <div className="space-y-3">
              {completed.slice(0, 5).map(row => (
                <EnrollmentRow key={row.projectId} row={row} kind="completed" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard Preview — unchanged from pre-P22. */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            Leaderboard
          </h2>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground"><Link href="/leaderboard">Full board</Link></Button>
        </div>
        {leaderboard && leaderboard.length > 0 ? (
          <div className="space-y-2">
            {(leaderboard as Array<{ userId: string; rank: number; displayName: string; totalXp: number }>).slice(0, 5).map((entry) => (
              <div key={entry.userId} className="flex items-center gap-3 p-2 rounded-lg">
                <span className={`text-xs font-bold w-5 text-center ${entry.rank === 1 ? "text-amber-400" : entry.rank === 2 ? "text-gray-300" : entry.rank === 3 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {entry.rank}
                </span>
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                  {entry.displayName?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm flex-1 truncate">{entry.displayName}</span>
                <span className="text-xs text-amber-400 font-medium">{entry.totalXp.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            icon={TrophyIcon}
            title="No rankings yet"
            description="Earn XP by completing project steps to land on the leaderboard."
          />
        )}
      </div>

      {/* Fully-empty fallback for the rare case the API returns no resume,
          no enrollments, AND no recommendation. Normally a fresh learner
          gets a recommendation; this catches the edge case where the
          recommendation course is empty too. */}
      {isFullyEmpty && (
        <div
          className="bg-gradient-to-r from-primary/10 to-blue-500/5 border border-primary/20 rounded-xl p-6 flex items-center justify-between flex-wrap gap-4"
          data-testid="dashboard-empty-fallback"
        >
          <div>
            <h3 className="font-semibold mb-1">Ready to begin?</h3>
            <p className="text-sm text-muted-foreground">Walk through our 3-step onboarding to pick your first project.</p>
          </div>
          <Button asChild>
            <Link href="/onboarding">
              Start onboarding
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
