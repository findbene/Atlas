import { useRoute, Link } from "wouter";
import { useGetCourse } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database, Sparkles, Brain, LineChart, Layers, Bot, Cloud, Code2, Table,
  ArrowLeft, Clock, Trophy,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Database, Sparkles, Brain, LineChart, Layers, Bot, Cloud, Code2, Table,
};

export default function CourseDetail() {
  const [, params] = useRoute("/courses/:slug");
  const slug = (params?.slug ?? "") as Parameters<typeof useGetCourse>[0];
  const { data: course, isLoading, error } = useGetCourse(slug);

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

      {projectList.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No projects available for this course yet. Check back soon.
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
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="capitalize">{p.difficulty}</span>
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
