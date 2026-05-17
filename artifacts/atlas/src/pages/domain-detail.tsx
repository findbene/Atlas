import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useGetDomain } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import {
  ArrowLeft,
  Clock,
  Lock,
  Star,
  Users,
  LayoutGrid,
  GitBranch,
  Database,
  Brain,
  LineChart,
  Cpu,
  Cloud,
  Code2,
  Terminal,
  Wrench,
  Award,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { RoadmapView } from "@/components/RoadmapView";
import { JobOutcomesPanel } from "@/components/JobOutcomesPanel";
import { EmptyState } from "@/components/EmptyState";
import { Inbox, FilterX } from "lucide-react";

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  Database,
  Brain,
  BarChart: LineChart,
  BarChart3: LineChart,
  Cpu,
  Cloud,
  Code2,
  Terminal,
};

type ViewMode = "roadmap" | "list";

export default function DomainDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const { data: domain, isLoading, error } = useGetDomain(slug);
  const [view, setView] = useState<ViewMode>("roadmap");
  // List-view filters. Roadmap intentionally ignores them — that visualisation
  // depends on the full project graph to draw the prerequisite arrows.
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<"all" | "python" | "sql">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "beginner" | "intermediate" | "advanced">("all");

  // Derived list filter. MUST sit above any early returns or React throws
  // "Rendered more hooks than during the previous render" when loading flips.
  const projectsList = (domain?.projects ?? []) as any[];
  const searchLower = search.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    if (!searchLower && language === "all" && difficultyFilter === "all") return projectsList;
    return projectsList.filter((p) => {
      if (difficultyFilter !== "all" && p.difficulty !== difficultyFilter) return false;
      if (language !== "all" && p.language && p.language !== language) return false;
      if (searchLower) {
        const hay = `${p.title ?? ""} ${p.description ?? ""} ${(p.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      return true;
    });
  }, [projectsList, searchLower, language, difficultyFilter]);

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

  const projects = projectsList;
  const visibleProjects = filteredProjects;

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
                {(() => {
                  const Icon = DOMAIN_ICONS[domain.icon as string] ?? Wrench;
                  return (
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: `${domain.color}20`,
                        border: `1px solid ${domain.color}40`,
                        color: domain.color,
                      }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                  );
                })()}
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
              {domain.enrolledCount > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>
                    {domain.enrolledCount.toLocaleString()} learner
                    {domain.enrolledCount === 1 ? "" : "s"}
                  </span>
                </div>
              )}
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

        {projects.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3" data-testid="catalog-filters">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="pl-9 pr-9"
                data-testid="catalog-search"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="inline-flex rounded-lg border border-border p-1 bg-card text-xs">
              {(["all", "python", "sql"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  aria-pressed={language === lang}
                  className={`px-3 py-1.5 font-medium rounded-md transition-all capitalize ${
                    language === lang
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`filter-lang-${lang}`}
                >
                  {lang === "all" ? "All languages" : lang}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-border p-1 bg-card text-xs">
              {(["all", "beginner", "intermediate", "advanced"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficultyFilter(d)}
                  aria-pressed={difficultyFilter === d}
                  className={`px-3 py-1.5 font-medium rounded-md transition-all capitalize ${
                    difficultyFilter === d
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`filter-diff-${d}`}
                >
                  {d === "all" ? "Any level" : d}
                </button>
              ))}
            </div>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6">
            <EmptyState
              icon={Inbox}
              title="No projects available yet"
              description="This domain is being authored. Check back soon, or explore one of our active tracks in the meantime."
              ctaLabel="Browse all Domains"
              ctaHref="/domains"
            />
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6">
            <EmptyState
              icon={FilterX}
              title="No projects match your filters"
              description="Try clearing the search box or broadening the difficulty/language filters."
              ctaSlot={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setLanguage("all");
                    setDifficultyFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : view === "roadmap" ? (
          <RoadmapView projects={visibleProjects as any} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleProjects.map((project: any) => {
              const roles: string[] = project.jobOutcomes?.roles ?? [];
              return (
                <div
                  key={project.id}
                  className="group bg-card border border-border hover:border-primary/40 rounded-xl p-5 transition-all duration-200 h-full flex flex-col"
                >
                  <Link href={`/projects/${project.slug}`}>
                    <div className="cursor-pointer">
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
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    </div>
                  </Link>

                  {roles.length > 0 && (
                    <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {roles.slice(0, 2).map((r) => (
                          <span
                            key={r}
                            className="text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-1.5 py-0.5 rounded"
                          >
                            {r}
                          </span>
                        ))}
                        {roles.length > 2 && (
                          <span className="text-[11px] text-muted-foreground">
                            +{roles.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex-1" />

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

                  <div className="flex items-center justify-between gap-2 mt-3">
                    <div className="flex flex-wrap gap-1.5 min-w-0">
                      {(project.tags ?? []).slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {project.jobOutcomes && (
                      <JobOutcomesPanel
                        title={project.title}
                        jobOutcomes={project.jobOutcomes}
                        trigger={
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 hover:text-amber-200 transition-colors"
                            data-testid={`career-impact-${project.slug}`}
                          >
                            <Award className="h-3.5 w-3.5" />
                            Career impact
                          </button>
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
