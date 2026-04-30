import { Link } from "wouter";
import { useListDomains } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code2, Database, Brain, Sparkles, LineChart, Lock } from "lucide-react";

const iconMap: Record<string, any> = {
  "data-engineering": Database,
  "python-mastery": Code2,
  "ai-engineering": Sparkles,
  "ai-mlops": Brain,
  "mlops": Brain,
  "data-science": LineChart,
};

export default function Domains() {
  const { data: domains, isLoading, error } = useListDomains();

  if (error) {
    return <div className="p-8 text-center text-destructive">Failed to load domains</div>;
  }

  return (
    <div className="container max-w-6xl mx-auto py-12 px-6">
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-4">Learning Domains</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Choose a path to master. Atlas provides rigorous, project-based curriculums designed to make you a production-ready engineer.
        </p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {domains?.map(domain => {
            const Icon = iconMap[domain.slug] || Code2;
            const isActive = domain.status === "active";

            return (
              <Card key={domain.id} className={`flex flex-col transition-all duration-300 ${isActive ? 'hover:border-primary/50 hover:bg-muted/30' : 'opacity-70'}`}>
                <CardHeader>
                  <div className="flex justify-between items-start mb-4">
                    <div 
                      className="h-12 w-12 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: domain.color || "var(--primary)" }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    {isActive ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Coming Soon</Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl">{domain.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="text-sm">
                    {domain.description}
                  </CardDescription>
                  {isActive && (
                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Database className="h-4 w-4" />
                        <span>{domain.projectCount} Projects</span>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  {isActive ? (
                    <Link href={`/domains/${domain.slug}`} className="w-full">
                      <Button className="w-full">Explore Path</Button>
                    </Link>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      <Lock className="mr-2 h-4 w-4" /> Waitlist
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