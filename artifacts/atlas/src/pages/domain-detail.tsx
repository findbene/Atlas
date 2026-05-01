import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetDomain } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Clock,
  Lock,
  Star,
  Users,
  LayoutGrid,
  GitBranch,
} from "lucide-react";
import { RoadmapView } from "@/components/RoadmapView";

type ViewMode = "roadmap" | "list";

export default function DomainDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const { data: domain, isLoading, error } = useGetDomain(slug);
  const [view, setView] = useState<ViewMode>("roadmap");

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-12 px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !domain) {
    return (
      <div className="container max-w-6xl mx-auto py-12 px-6 text-center">
        <p className="text-muted-foreground">Domain not found.</p>
        <Button asChild className="mt-4" variant="outline"><Link href="/domains">
            Back to Domains
          </Link></Button>
      </div>
    );
  }

  const difficultyColor: Record<string, string> = {
    beginner: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    intermediate: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    advanced: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };

  const projects = domain.projects ?? [];

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-b from-muted/30 to-transparent border-b border-border">
        <div className="container max-w-6xl mx-auto px-6 py-12">
          <Button asChild
              variant="ghost"
              size="sm"
              className="mb-6 text-muted-foreground hover:text-foreground -ml-2"
            ><Link href="/domains">
              <ArrowLeft className="h-4 w-4 mr-2" />
              All Domains
            </Link></Button>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{
                    background: `${domain.color}20`,
                    border: `1px solid ${domain.color}40`,
                  }}
                >
                  {domain.icon === "Database"
                    ? "🗄️"
                    : domain.icon === "Brain"
                      ? "🧠"
                      : domain.icon === "BarChart"
                        ? "📊"
                        : "🔧"}
                </div>
                <h1 className="text-3xl font-bold">{domain.name}</h1>
              </div>
              <p className="text-muted-foreground max-w-2xl">
                {domain.description}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4" />
                <span>{domain.projectCount} projects</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{domain.enrolledCount} learners</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              Curriculum{" "}
              <span className="text-muted-foreground font-normal text-lg">
                ({projects.length} projects)
              </span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              A structured progression from foundations to production-grade
              systems
            </p>
          </div>

          <div role="group" aria-label="View mode" className="inline-flex rounded-lg border border-border p-1 bg-card">
            <button
              onClick={() => setView("roadmap")}
              aria-pressed={view === "roadmap"}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                view === "roadmap"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="view-roadmap"
            >
              <GitBranch className="w-4 h-4" />
              Roadmap
            </button>
            <button
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="view-list"
            >
              <LayoutGrid className="w-4 h-4" />
              List
            </button>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">
              No projects available yet. Check back soon!
            </p>
          </div>
        ) : view === "roadmap" ? (
          <RoadmapView projects={projects as any} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project: any) => (
              <Link key={project.id} href={`/projects/${project.slug}`}>
                <div className="group bg-card border border-border hover:border-primary/40 rounded-xl p-5 transition-all duration-200 cursor-pointer h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <Badge
                      variant="outline"
                      className={`text-xs ${difficultyColor[project.difficulty] ?? ""}`}
                    >
                      {project.difficulty}
                    </Badge>
                    {project.tier === "pro" && (
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Pro
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    #{project.position} {project.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                    {project.description}
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {project.estimatedHours}h
                      </span>
                      <span>{project.stepCount} steps</span>
                    </div>
                    <span className="text-amber-400 font-medium">
                      +{project.xpReward} XP
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(project.tags ?? []).slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
