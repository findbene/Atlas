import { Link } from "wouter";
import { useListCourses } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database, Sparkles, Brain, LineChart, Layers, Bot, Cloud, Code2, Table,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Database, Sparkles, Brain, LineChart, Layers, Bot, Cloud, Code2, Table,
};

export default function Courses() {
  const { data: courses, isLoading, error } = useListCourses();

  if (error) {
    return <div className="p-8 text-center text-destructive">Failed to load courses</div>;
  }

  return (
    <div className="container max-w-6xl mx-auto py-12 px-6" data-testid="courses-page">
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-4">Courses</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Atlas is organized into 9 courses. Each one is a curated stack of project-based, production-grade work that ladders into a real engineering role.
        </p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="flex flex-col">
              <CardHeader>
                <Skeleton className="h-10 w-10 mb-4 rounded-lg" />
                <Skeleton className="h-6 w-2/3" />
              </CardHeader>
              <CardContent className="flex-1">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="courses-grid">
          {courses?.map(course => {
            const Icon = iconMap[course.icon] ?? Code2;
            const isActive = course.status === "active";
            return (
              <Card
                key={course.slug}
                data-testid={`course-card-${course.slug}`}
                className={`flex flex-col transition-all duration-300 ${isActive ? 'hover:border-primary/50 hover:bg-muted/30' : 'opacity-70'}`}
              >
                <CardHeader>
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: course.color }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    {isActive ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Coming Soon</Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl">{course.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="text-sm">{course.description}</CardDescription>
                  {isActive && (
                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Database className="h-4 w-4" />
                        <span>{course.projectCount} project{course.projectCount === 1 ? '' : 's'}</span>
                      </div>
                      {course.authoredCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {course.authoredCount} authored
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  {isActive ? (
                    <Button asChild className="w-full">
                      <Link href={`/courses/${course.slug}`} className="w-full">Explore course</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Coming soon
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
