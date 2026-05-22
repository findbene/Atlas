import { useEffect, useMemo, useState } from "react";
import { useRoute, Link, useSearch } from "wouter";
import { useGetCourse } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database, Sparkles, Brain, LineChart, Layers, Bot, Cloud, Code2, Table,
  ArrowLeft, Clock, Trophy,
} from "lucide-react";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import {
  DifficultyFilter,
  parseDifficultyParam,
  type DifficultyFilterValue,
} from "@/components/DifficultyFilter";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Database, Sparkles, Brain, LineChart, Layers, Bot, Cloud, Code2, Table,
};

// Phase 16 — Courses that currently have zero beginner projects. Surfaces a
// helpful empty-state message when a learner filters Beginner. Sourced from
// the Phase 15 difficulty distribution; static list, no runtime heuristic
// inference — `projects.course` is read directly server-side.
const ZERO_BEGINNER_COURSES: ReadonlySet<string> = new Set([
  "ai-engineer",
  "cloud-data-engineer",
  "applied-llm-engineer",
  "mlops-engineer",
]);

function updateUrlDifficulty(next: DifficultyFilterValue) {
  const url = new URL(window.location.href);
  if (next === "all") {
    url.searchParams.delete("difficulty");
  } else {
    url.searchParams.set("difficulty", next);
  }
  window.history.pushState({}, "", url.toString());
}

export default function CourseDetail() {
  const [, params] = useRoute("/courses/:slug");
  const slug = (params?.slug ?? "") as Parameters<typeof useGetCourse>[0];
  const searchString = useSearch();

  const initial = useMemo<DifficultyFilterValue>(() => {
    const sp = new URLSearchParams(searchString);
    return parseDifficultyParam(sp.get("difficulty"));
  }, [searchString]);
  const [difficulty, setDifficulty] = useState<DifficultyFilterValue>(initial);

  // Sync state when user hits back/forward (URL changes outside our control).
  useEffect(() => {
    setDifficulty(initial);
  }, [initial]);

  // Browser popstate (back/forward) doesn't always re-render wouter's
  // `useSearch` if pushState was used — listen explicitly to be safe.
  useEffect(() => {
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search);
      setDifficulty(parseDifficultyParam(sp.get("difficulty")));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const apiParams = difficulty === "all" ? undefined : { difficulty };
  const { data: course, isLoading, error } = useGetCourse(slug, apiParams);

  const onFilterChange = (next: DifficultyFilterValue) => {
    setDifficulty(next);
    updateUrlDifficulty(next);
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-12 px-6">
        <Skeleton className="h-10 w-1/3 mb-6" />
        <Skeleton className="h-4 w-2/3 mb-12" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="container max-w-6xl mx-auto py-12 px-6 text-center">
        <p className="text-muted-foreground">Course not found.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/courses">Back to Courses</Link>
        </Button>
      </div>
    );
  }

  const Icon = iconMap[course.icon] ?? Code2;
  const projectList = course.projects ?? [];
  const isFiltered = difficulty !== "all";
  const isBeginnerFilterOnZeroBeginnerCourse =
    difficulty === "beginner" && ZERO_BEGINNER_COURSES.has(slug);

  return (
    <div className="container max-w-6xl mx-auto py-12 px-6" data-testid="course-detail">
      <div className="mb-8">
        <Button asChild variant="ghost" size="sm">
          <Link href="/courses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Courses
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-5 mb-10">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center text-white shrink-0"
          style={{ background: `${course.color}33`, border: `1px solid ${course.color}40`, color: course.color }}
        >
          <Icon className="h-8 w-8" />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{course.name}</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Course</Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">{course.description}</p>
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <span>{course.projectCount} project{course.projectCount === 1 ? '' : 's'}</span>
            {course.authoredCount > 0 && (
              <span>· {course.authoredCount} authored ≥70</span>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <DifficultyFilter value={difficulty} onChange={onFilterChange} />
      </div>

      {projectList.length === 0 ? (
        <Card>
          <CardContent
            className="py-10 text-center text-muted-foreground"
            data-testid="course-empty-state"
          >
            {isBeginnerFilterOnZeroBeginnerCourse ? (
              <>Beginner projects for this course are coming soon. Try Intermediate or Advanced for now.</>
            ) : isFiltered ? (
              <>No {difficulty} projects in this course yet.</>
            ) : (
              <>No projects available for this course yet. Check back soon.</>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4" data-testid="course-projects">
          {projectList.map(p => (
            <Card key={p.id} data-testid={`project-${p.slug}`} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg leading-tight">{p.title}</CardTitle>
                  <Badge variant={p.tier === "pro" ? "default" : "secondary"} className="shrink-0">
                    {p.tier === "pro" ? "Pro" : "Free"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{p.description}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                  <DifficultyBadge difficulty={p.difficulty} />
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.estimatedHours}h</span>
                  <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{p.xpReward} XP</span>
                </div>
                <Button asChild className="w-full" size="sm">
                  <Link href={`/projects/${p.slug}`}>Start project</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
