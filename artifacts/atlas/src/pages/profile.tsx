import { useState } from "react";
import { useUser } from "@clerk/react";
import {
  useGetUserProfile,
  useGetUserStats,
  useListUserProjects,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  Star,
  Flame,
  Trophy,
  BookOpen,
  ChevronRight,
  Award,
  Pencil,
  Sparkles,
  Crown,
  CalendarDays,
  Zap,
  Target,
  Rocket,
} from "lucide-react";
import { EditProfileDialog } from "@/components/EditProfileDialog";

function StatCard({
  label,
  value,
  icon,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card/60 p-5 backdrop-blur transition-all hover:border-border/80 hover:bg-card">
      <div
        className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-20 blur-2xl ${accent}`}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Badges({
  totalXp,
  streak,
  completed,
  level,
}: {
  totalXp: number;
  streak: number;
  completed: number;
  level: number;
}) {
  const items = [
    {
      key: "first-step",
      label: "First Steps",
      desc: "Earned your first XP",
      icon: <Sparkles className="h-5 w-5 text-amber-300" />,
      unlocked: totalXp > 0,
    },
    {
      key: "streak-3",
      label: "On Fire",
      desc: "3-day streak",
      icon: <Flame className="h-5 w-5 text-orange-400" />,
      unlocked: streak >= 3,
    },
    {
      key: "first-project",
      label: "Builder",
      desc: "Completed first project",
      icon: <Rocket className="h-5 w-5 text-emerald-400" />,
      unlocked: completed >= 1,
    },
    {
      key: "five-projects",
      label: "Practitioner",
      desc: "Completed 5 projects",
      icon: <Target className="h-5 w-5 text-blue-400" />,
      unlocked: completed >= 5,
    },
    {
      key: "level-5",
      label: "Rising Star",
      desc: "Reached level 5",
      icon: <Star className="h-5 w-5 text-purple-400" />,
      unlocked: level >= 5,
    },
    {
      key: "level-10",
      label: "Legend",
      desc: "Reached level 10",
      icon: <Crown className="h-5 w-5 text-amber-400" />,
      unlocked: level >= 10,
    },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((b) => (
        <div
          key={b.key}
          className={`relative rounded-xl border p-3.5 transition-all ${
            b.unlocked
              ? "border-border bg-card hover:border-border/80"
              : "border-border/30 bg-muted/20 opacity-50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                b.unlocked ? "bg-muted/60" : "bg-muted/20"
              }`}
            >
              {b.icon}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{b.label}</p>
              <p className="truncate text-xs text-muted-foreground">{b.desc}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Profile() {
  const { user, isLoaded } = useUser();
  const { data: profile } = useGetUserProfile();
  const { data: stats, isLoading: statsLoading } = useGetUserStats();
  const { data: projects } = useListUserProjects();
  const [editOpen, setEditOpen] = useState(false);

  if (!isLoaded) return null;

  const completed =
    (projects as any[])?.filter((p: any) => p.status === "completed") ?? [];
  const inProgress =
    (projects as any[])?.filter((p: any) => p.status === "in_progress") ?? [];
  // API already orders by lastUpdatedAt server-side; show top 5
  const recent = ((projects as any[]) ?? []).slice(0, 5);

  const tier = (profile as any)?.tier ?? "free";
  const isPro = tier === "pro" || tier === "premium";
  const memberSince = (profile as any)?.createdAt
    ? new Date((profile as any).createdAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  const xpToNext = Math.max(stats?.xpToNextLevel ?? 100, 1);
  const xpInLevel = (stats?.totalXp ?? 0) % xpToNext;
  const progressPct = Math.min((xpInLevel / xpToNext) * 100, 100);

  return (
    <div className="min-h-screen pb-16">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-purple-500/10 to-emerald-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.18),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.12),transparent_55%)]" />
        <div className="relative container max-w-5xl mx-auto px-6 py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-emerald-500 opacity-80 blur-sm" />
              <Avatar className="relative h-24 w-24 ring-4 ring-background">
                <AvatarImage src={user?.imageUrl ?? ""} />
                <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                  {user?.firstName?.[0] ??
                    user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ??
                    "?"}
                </AvatarFallback>
              </Avatar>
              {stats && (
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 px-2 py-0.5 text-[11px] font-bold text-white ring-2 ring-background">
                  L{stats.level}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {(profile as any)?.displayName ?? user?.fullName ?? "Anonymous"}
                </h1>
                {isPro ? (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1">
                    <Crown className="h-3 w-3" /> Pro
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground"
                  >
                    Free
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {(profile as any)?.username
                  ? `@${(profile as any).username} · `
                  : ""}
                {user?.emailAddresses?.[0]?.emailAddress}
              </p>
              {(profile as any)?.bio && (
                <p className="mt-2.5 text-sm text-foreground/85 max-w-prose">
                  {(profile as any).bio}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {memberSince && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> Joined {memberSince}
                  </span>
                )}
                {stats && stats.streak > 0 && (
                  <span className="flex items-center gap-1.5 text-orange-300">
                    <Flame className="h-3.5 w-3.5" /> {stats.streak}-day streak
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                data-testid="edit-profile-button"
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit profile
              </Button>
              {!isPro && (
                <Button
                  asChild
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
                >
                  <Link href="/upgrade">
                    <Crown className="h-4 w-4 mr-1.5" /> Upgrade to Pro
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-5xl mx-auto px-6 pt-8 space-y-8">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total XP"
            value={(stats?.totalXp ?? 0).toLocaleString()}
            icon={<Star className="h-4 w-4 text-amber-400" />}
            accent="bg-amber-500"
            sub={statsLoading ? "" : `Level ${stats?.level ?? 1}`}
          />
          <StatCard
            label="Streak"
            value={`${stats?.streak ?? 0}d`}
            icon={<Flame className="h-4 w-4 text-orange-400" />}
            accent="bg-orange-500"
            sub="Keep it going"
          />
          <StatCard
            label="Completed"
            value={stats?.projectsCompleted ?? 0}
            icon={<BookOpen className="h-4 w-4 text-emerald-400" />}
            accent="bg-emerald-500"
            sub={`${inProgress.length} in progress`}
          />
          <StatCard
            label="Global rank"
            value={`#${stats?.rank ?? "—"}`}
            icon={<Trophy className="h-4 w-4 text-purple-400" />}
            accent="bg-purple-500"
            sub="On the leaderboard"
          />
        </div>

        {/* XP Progress */}
        {stats && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-sm mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="font-semibold">Level {stats.level} progress</span>
              </div>
              <span className="text-muted-foreground tabular-nums">
                {xpInLevel.toLocaleString()} / {xpToNext.toLocaleString()} XP
              </span>
            </div>
            <Progress value={progressPct} className="h-2.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {(xpToNext - xpInLevel).toLocaleString()} XP to Level {stats.level + 1}
            </p>
          </div>
        )}

        {/* Achievements */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-400" /> Achievements
            </h2>
            <span className="text-xs text-muted-foreground">
              Earn more by completing projects
            </span>
          </div>
          <Badges
            totalXp={stats?.totalXp ?? 0}
            streak={stats?.streak ?? 0}
            completed={completed.length}
            level={stats?.level ?? 1}
          />
        </section>

        {/* Recent activity + Projects */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" /> Recent activity
            </h3>
            {recent.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-3 py-4">
                <p>You haven't started any projects yet.</p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/domains/data-engineering">Browse projects</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recent.map((up: any) => (
                  <Link key={up.id} href={`/projects/${up.project.slug}`}>
                    <div className="flex items-center gap-3 py-3 cursor-pointer group">
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          up.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {up.status === "completed" ? (
                          <Award className="h-4 w-4" />
                        ) : (
                          <BookOpen className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {up.project.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {up.status === "completed" ? "Completed" : "In progress"}
                          {up.earnedXp ? ` · +${up.earnedXp} XP` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-400" /> Completed
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({completed.length})
              </span>
            </h3>
            {completed.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                <p>Finish your first project to earn a certificate.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {completed.slice(0, 6).map((up: any) => (
                  <Link key={up.id} href={`/projects/${up.project.slug}`}>
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors text-sm cursor-pointer">
                      <span className="text-emerald-400 shrink-0">✓</span>
                      <span className="truncate flex-1">{up.project.title}</span>
                      {up.earnedXp ? (
                        <span className="text-xs text-amber-400 shrink-0">
                          +{up.earnedXp} XP
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{
          username: (profile as any)?.username,
          displayName: (profile as any)?.displayName,
          bio: (profile as any)?.bio,
        }}
      />
    </div>
  );
}
