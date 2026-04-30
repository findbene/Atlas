import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useListUserProjects, useGetUserStats, useGetLeaderboard } from "@workspace/api-client-react";
import { Flame, Trophy, BookOpen, Code2, Star, Clock, ChevronRight, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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

export default function Dashboard() {
  const { isLoaded, userId } = useAuth();
  const { data: userProjects, isLoading: projectsLoading } = useListUserProjects();
  const { data: stats, isLoading: statsLoading } = useGetUserStats();
  const { data: leaderboard } = useGetLeaderboard({ limit: 5 });

  if (!isLoaded || !userId) return null;

  const inProgress = (userProjects ?? []).filter((p: any) => p.status === "in_progress");
  const completed = (userProjects ?? []).filter((p: any) => p.status === "completed");

  return (
    <div className="container max-w-6xl mx-auto py-10 px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Track your progress, keep your streak, climb the leaderboard.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Star className="h-4 w-4 text-amber-400" />
            Total XP
          </div>
          <p className="text-2xl font-bold">{statsLoading ? "—" : (stats?.totalXp ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Flame className="h-4 w-4 text-orange-400" />
            Day Streak
          </div>
          <p className="text-2xl font-bold">{statsLoading ? "—" : stats?.streak ?? 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <BookOpen className="h-4 w-4 text-blue-400" />
            Completed
          </div>
          <p className="text-2xl font-bold">{statsLoading ? "—" : stats?.projectsCompleted ?? 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Trophy className="h-4 w-4 text-purple-400" />
            Rank
          </div>
          <p className="text-2xl font-bold">#{statsLoading ? "—" : stats?.rank ?? "—"}</p>
        </div>
      </div>

      {/* XP Level Progress */}
      {stats && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Level Progress</h2>
            <span className="text-sm text-muted-foreground">Level {stats.level}</span>
          </div>
          <XpBar current={stats.totalXp % (stats.xpToNextLevel + stats.totalXp % 100 || 100)} next={stats.xpToNextLevel} level={stats.level} />
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
            <Link href="/domains/data-engineering">
              <Button variant="ghost" size="sm" className="text-muted-foreground">View all</Button>
            </Link>
          </div>
          {projectsLoading ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : inProgress.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-3">No projects in progress yet.</p>
              <Link href="/domains/data-engineering">
                <Button size="sm">Start a Project</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {inProgress.slice(0, 3).map((up: any) => (
                <Link key={up.id} href={`/projects/${up.project.slug}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border">
                    <div>
                      <p className="font-medium text-sm line-clamp-1">{up.project.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Step {up.currentStepPosition} of {up.project.stepCount}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
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
            <Link href="/leaderboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground">Full board</Button>
            </Link>
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
        <Link href="/domains/data-engineering">
          <Button>
            Browse Projects
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
