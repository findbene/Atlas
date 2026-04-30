import { useListModules } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Clock, ChevronRight, Lock, Code2 } from "lucide-react";

export default function PythonMastery() {
  const { data: modules, isLoading } = useListModules({ type: "python_mastery" });

  const pythonModules = (modules as any[]) ?? [];

  return (
    <div className="container max-w-4xl mx-auto py-10 px-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Code2 className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Python Mastery</h1>
            <p className="text-muted-foreground">Python fundamentals to advanced patterns for data engineers.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4">
          <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {pythonModules.length} modules</span>
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> ~{pythonModules.reduce((s: number, m: any) => s + (m.estimatedHours ?? 2), 0)}h total</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pythonModules.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Code2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-30" />
          <h3 className="font-semibold mb-2">Curriculum Coming Soon</h3>
          <p className="text-sm text-muted-foreground">Python Mastery modules are being finalized. Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pythonModules.map((module: any, idx: number) => (
            <Link key={module.id} href={`/modules/${module.slug}`}>
              <div className="group bg-card border border-border hover:border-blue-500/40 rounded-xl p-5 transition-all cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold group-hover:text-blue-400 transition-colors">{module.title}</h3>
                      {module.tier === "pro" && (
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                          <Lock className="h-3 w-3 mr-1" />Pro
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{module.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{module.lessonCount} lessons</span>
                      <span>{module.estimatedHours}h</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-400 transition-colors shrink-0 mt-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Built-in modules preview if DB empty */}
      {pythonModules.length === 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Planned Modules</h2>
          {[
            { title: "Python Fundamentals for Data Engineers", desc: "Data types, control flow, functions, file I/O", lessons: 12, hours: 4, tier: "free" },
            { title: "Advanced Python Patterns", desc: "Generators, decorators, context managers, async/await", lessons: 10, hours: 3, tier: "pro" },
            { title: "Data Structures & Algorithms", desc: "Lists, dicts, sets, complexity analysis", lessons: 8, hours: 3, tier: "pro" },
            { title: "Working with APIs & Files", desc: "REST APIs, JSON, CSV, Parquet with Python", lessons: 8, hours: 2, tier: "pro" },
          ].map((m, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 opacity-60">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">{i + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{m.title}</h3>
                    {m.tier === "pro" && <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs"><Lock className="h-3 w-3 mr-1" />Pro</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{m.desc}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{m.lessons} lessons</span><span>{m.hours}h</span>
                  </div>
                </div>
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
