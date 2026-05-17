import { useGetLeaderboard, useGetUserStats } from "@workspace/api-client-react";
import { Trophy, Star } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard({ period: "all_time", limit: 50 });

  const rankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  return (
    <div className="container max-w-3xl mx-auto py-10 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Trophy className="h-7 w-7 text-amber-400" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground mt-2">Top learners ranked by total XP earned.</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="border-b border-border px-4 py-3 grid grid-cols-12 text-xs text-muted-foreground font-medium">
          <span className="col-span-1 text-center">Rank</span>
          <span className="col-span-6 pl-3">Learner</span>
          <span className="col-span-2 text-center">Level</span>
          <span className="col-span-3 text-right pr-2">XP</span>
        </div>
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="px-4 py-4 grid grid-cols-12 animate-pulse">
                <div className="col-span-1 flex justify-center"><div className="h-5 w-5 rounded bg-muted" /></div>
                <div className="col-span-6 pl-3 flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-muted" />
                  <div className="h-4 w-24 bg-muted rounded" />
                </div>
                <div className="col-span-2 flex justify-center"><div className="h-5 w-12 bg-muted rounded" /></div>
                <div className="col-span-3 flex justify-end pr-2"><div className="h-5 w-16 bg-muted rounded" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {(leaderboard as any[])?.map((entry: any) => (
              <div key={entry.userId} className={`px-4 py-3.5 grid grid-cols-12 items-center transition-colors hover:bg-muted/30 ${entry.rank <= 3 ? "bg-amber-500/3" : ""}`}>
                <div className="col-span-1 text-center">
                  {rankIcon(entry.rank) ? (
                    <span className="text-lg">{rankIcon(entry.rank)}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground font-mono">{entry.rank}</span>
                  )}
                </div>
                <div className="col-span-6 pl-3 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={entry.avatarUrl ?? ""} />
                    <AvatarFallback className="bg-muted text-sm font-semibold">
                      {entry.displayName?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{entry.displayName}</p>
                    <p className="text-xs text-muted-foreground">{entry.projectsCompleted} projects</p>
                  </div>
                </div>
                <div className="col-span-2 text-center">
                  <Badge variant="outline" className="text-xs font-mono">Lv {entry.level}</Badge>
                </div>
                <div className="col-span-3 text-right pr-2">
                  <span className="text-amber-400 font-semibold text-sm">{entry.totalXp.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground ml-1">XP</span>
                </div>
              </div>
            ))}
            {(!leaderboard || (leaderboard as any[]).length === 0) && (
              <EmptyState
                icon={Trophy}
                title="No rankings yet"
                description="Complete project steps to earn XP and become the first on the leaderboard."
                ctaLabel="Browse Projects"
                ctaHref="/domains/data-engineering"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
