import { useUser } from "@clerk/react";
import { useGetUserStats, useListUserProjects } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { Star, Flame, Trophy, BookOpen, Calendar, ChevronRight, Award } from "lucide-react";

export default function Profile() {
  const { user, isLoaded } = useUser();
  const { data: stats, isLoading: statsLoading } = useGetUserStats();
  const { data: projects } = useListUserProjects();

  if (!isLoaded) return null;

  const completed = (projects as any[])?.filter((p: any) => p.status === "completed") ?? [];
  const inProgress = (projects as any[])?.filter((p: any) => p.status === "in_progress") ?? [];

  return (
    <div className="container max-w-4xl mx-auto py-10 px-6 space-y-6">
      {/* Profile Header */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user?.imageUrl ?? ""} />
            <AvatarFallback className="text-2xl font-bold bg-primary/10">
              {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{user?.fullName ?? "Anonymous"}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{user?.emailAddresses?.[0]?.emailAddress}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {stats?.tier === "pro" ? (
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pro Member</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Free Plan</Badge>
              )}
              {stats && <Badge variant="outline" className="text-blue-400 border-blue-400/30">Level {stats.level}</Badge>}
            </div>
          </div>
          {stats?.tier !== "pro" && (
            <Link href="/upgrade">
              <Button>Upgrade to Pro</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total XP", value: (stats?.totalXp ?? 0).toLocaleString(), icon: <Star className="h-4 w-4 text-amber-400" /> },
          { label: "Streak", value: `${stats?.streak ?? 0} days`, icon: <Flame className="h-4 w-4 text-orange-400" /> },
          { label: "Completed", value: stats?.projectsCompleted ?? 0, icon: <BookOpen className="h-4 w-4 text-emerald-400" /> },
          { label: "Rank", value: `#${stats?.rank ?? "—"}`, icon: <Trophy className="h-4 w-4 text-purple-400" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon}{label}</div>
            <p className="text-xl font-bold">{statsLoading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* XP Progress */}
      {stats && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="font-medium">XP Progress</span>
            <span className="text-muted-foreground">{stats.totalXp.toLocaleString()} XP total</span>
          </div>
          <Progress value={Math.min(((stats.totalXp % Math.max(stats.xpToNextLevel, 1)) / Math.max(stats.xpToNextLevel, 1)) * 100, 100)} className="h-2.5" />
          <p className="text-xs text-muted-foreground mt-2">{stats.xpToNextLevel} XP to Level {stats.level + 1}</p>
        </div>
      )}

      {/* Projects */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-400" /> In Progress ({inProgress.length})
          </h3>
          {inProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects in progress.</p>
          ) : (
            <div className="space-y-2">
              {inProgress.slice(0, 5).map((up: any) => (
                <Link key={up.id} href={`/projects/${up.project.slug}`}>
                  <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors text-sm">
                    <span className="truncate">{up.project.title}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-400" /> Completed ({completed.length})
          </h3>
          {completed.length === 0 ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>No projects completed yet.</p>
              <Link href="/domains/data-engineering">
                <Button size="sm" variant="outline" className="mt-2">Start a Project</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {completed.slice(0, 5).map((up: any) => (
                <div key={up.id} className="flex items-center gap-2 p-2.5 rounded-lg text-sm">
                  <span className="text-emerald-400">✓</span>
                  <span className="truncate">{up.project.title}</span>
                  <span className="ml-auto text-xs text-amber-400">+{up.xpEarned} XP</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
