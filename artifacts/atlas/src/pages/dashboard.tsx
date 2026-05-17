import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useListUserProjects, useGetUserStats, useGetLeaderboard } from "@workspace/api-client-react";
import { Flame, Trophy, BookOpen, Code2, Star, Clock, ChevronRight, TrendingUp, Award, Briefcase, PlayCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { JobOutcomesPanel } from "@/components/JobOutcomesPanel";
import { StreakHeatmap } from "@/components/StreakHeatmap";

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

interface ResumePayload {
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  shortDescription: string;
  currentStep: number;
  totalSteps: number;
  completionPercent: number;
  lastUpdatedAt: string;
}

// Fetches the user's most recently-touched in-progress project. 204 = nothing
// in progress (no banner). Re-fetched whenever the user lands on the dashboard
// so the banner stays fresh after they navigate away and back.
function useResumeProject(enabled: boolean) {
  const [data, setData] = useState<ResumePayload | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/projects/resume`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (res.status === 204 || !res.ok) {
          setData(null);
          return;
        }
        setData((await res.json()) as ResumePayload);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);
  return data;
}

export default function Dashboard() {
  const { isLoaded, userId } = useAuth();
  const { data: userProjects, isLoading: projectsLoading } = useListUserProjects();
  const { data: stats, isLoading: statsLoading } = useGetUserStats();
  const { data: leaderboard } = useGetLeaderboard({ limit: 5 });
  const resume = useResumeProject(Boolean(isLoaded && userId));

  if (!isLoaded || !userId) return null;

  const inProgress = (userProjects ?? []).filter((p: any) => p.status === "in_progress");
  const completed = (userProjects ?? []).filter((p: any) => p.status === "completed");

  return (
    <div className="container max-w-6xl mx-auto py-10 px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Track your progress, keep your streak, climb the leaderboard.</p>
      </div>

      {/* Resume banner — only renders when the API reports an in-progress
          project. Click anywhere on the card to jump straight back in. */}
      {resume && (
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
                  Resume where you left off
                </p>
                <p className="font-medium truncate">{resume.projectTitle}</p>
                <div className="mt-2 flex items-center gap-3">
                  <Progress
                    value={Math.max(
                      0,
                      Math.min(100, Math.round((resume.currentStep / Math.max(resume.totalSteps, 1)) * 100)),
                    )}
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
      )}

      {/* Stats Row */}
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

      {/* Streak heatmap + daily goal */}
      {stats && (
        <StreakHeatmap
          currentStreak={stats.streak ?? 0}
          longestStreak={(stats as any).longestStreak ?? 0}
        />
      )}

      {/* XP Level Progress */}
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
                  <Tooltip formatter={(v: any) => [v, "XP"]} />
                  <Area type="monotone" dataKey="xp" stroke="#3B82F6" fill="url(#xpGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* In Progress */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Code2 className="h-4 w-4 text-blue-400" />
              In Progress
            </h2>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground"><Link href="/domains/data-engineering">View all</Link></Button>
          </div>
          {projectsLoading ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : inProgress.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-3">No projects in progress yet.</p>
              <Button asChild size="sm"><Link href="/domains/data-engineering">Start a Project</Link></Button>
            </div>
          ) : (
            <div className="space-y-3">
              {inProgress.slice(0, 3).map((up: any) => {
                const topRole = up.project.jobOutcomes?.roles?.[0];
                return (
                  <div
                    key={up.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                  >
                    <Link href={`/projects/${up.project.slug}`} className="flex-1 min-w-0">
                      <div className="cursor-pointer">
                        <p className="font-medium text-sm line-clamp-1">{up.project.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Step {up.currentStepPosition} of {up.project.stepCount}
                          {topRole && (
                            <span className="ml-2 inline-flex items-center gap-1 text-blue-300/80">
                              <Briefcase className="h-3 w-3" />
                              {topRole}
                            </span>
                          )}
                        </p>
                        {/* Per-project progress bar — % derived client-side from
                            currentStepPosition / stepCount so no extra fetch. */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress
                            value={Math.max(
                              0,
                              Math.min(
                                100,
                                Math.round(((up.currentStepPosition ?? 0) / Math.max(up.project.stepCount ?? 1, 1)) * 100),
                              ),
                            )}
                            className="h-1 flex-1"
                          />
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {Math.min(
                              100,
                              Math.round(((up.currentStepPosition ?? 0) / Math.max(up.project.stepCount ?? 1, 1)) * 100),
                            )}%
                          </span>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {up.project.jobOutcomes && (
                        <JobOutcomesPanel
                          title={up.project.title}
                          jobOutcomes={up.project.jobOutcomes}
                          trigger={
                            <button
                              type="button"
                              className="p-1.5 rounded-md text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
                              title="Career impact"
                              data-testid={`dashboard-career-${up.project.slug}`}
                            >
                              <Award className="h-3.5 w-3.5" />
                            </button>
                          }
                        />
                      )}
                      <Link href={`/projects/${up.project.slug}`} aria-label={`Open ${up.project.title}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leaderboard Preview */}
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
              {(leaderboard as any[]).slice(0, 5).map((entry: any) => (
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
            <p className="text-muted-foreground text-sm text-center py-4">No rankings yet. Start learning to get on the board!</p>
          )}
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-primary/10 to-blue-500/5 border border-primary/20 rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="font-semibold mb-1">Ready to build something?</h3>
          <p className="text-sm text-muted-foreground">Start with the Data Engineering track — 40 real-world projects await.</p>
        </div>
        <Button asChild><Link href="/domains/data-engineering">
            Browse Projects
            <ChevronRight className="ml-2 h-4 w-4" />
          </Link></Button>
      </div>
    </div>
  );
}
