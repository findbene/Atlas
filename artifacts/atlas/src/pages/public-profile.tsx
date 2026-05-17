import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Briefcase, Flame, Star, Trophy } from "lucide-react";

interface PublicBadge {
  projectSlug: string;
  projectTitle: string;
  difficulty: string;
  xpReward: number;
  completedAt: string | null;
  topRole: string | null;
}

interface PublicProfile {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  completedCount: number;
  badges: PublicBadge[];
}

const DIFF_COLOR: Record<string, string> = {
  beginner: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  intermediate: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  advanced: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default function PublicProfile() {
  const params = useParams<{ username: string }>();
  const username = params.username ?? "";
  const [data, setData] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    void fetch(`${import.meta.env.BASE_URL}api/u/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.status === 404 ? "Profile not found" : "Could not load profile");
          return;
        }
        const json = (await res.json()) as PublicProfile;
        if (!cancelled) setData(json);
      })
      .catch(() => { if (!cancelled) setError("Could not load profile"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username]);

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted rounded-2xl" />
          <div className="h-48 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="container max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="text-muted-foreground">{error ?? "Profile not found."}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    );
  }

  const joined = new Date(data.joinedAt).toLocaleDateString(undefined, {
    year: "numeric", month: "long",
  });
  const initials = (data.displayName || data.username)
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-b from-muted/30 to-transparent border-b border-border">
        <div className="container max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-start gap-5 flex-wrap">
            <Avatar className="h-20 w-20 border border-border">
              {data.avatarUrl && <AvatarImage src={data.avatarUrl} alt={data.displayName} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{data.displayName}</h1>
              <p className="text-sm text-muted-foreground">@{data.username} · Joined {joined}</p>
              {data.bio && <p className="mt-3 text-sm max-w-2xl">{data.bio}</p>}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1">
                  <Trophy className="h-3 w-3" /> Level {data.level}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-1">
                  <Star className="h-3 w-3" /> {data.totalXp.toLocaleString()} XP
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/20 px-2.5 py-1">
                  <Flame className="h-3 w-3" /> {data.currentStreak}-day streak
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-1">
                  <Award className="h-3 w-3" /> {data.completedCount} project{data.completedCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-lg font-semibold mb-4">Completed projects</h2>
        {data.badges.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No completed projects yet — check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.badges.map((b) => (
              <Link
                key={b.projectSlug}
                href={`/projects/${b.projectSlug}`}
                data-testid={`public-badge-${b.projectSlug}`}
              >
                <div className="group rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-all cursor-pointer h-full">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                      {b.projectTitle}
                    </h3>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${DIFF_COLOR[b.difficulty] ?? ""}`}>
                      {b.difficulty}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {b.topRole && <><Briefcase className="h-3 w-3" />{b.topRole}</>}
                    </span>
                    <span className="text-amber-400 font-medium">+{b.xpReward} XP</span>
                  </div>
                  {b.completedAt && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Completed {new Date(b.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
