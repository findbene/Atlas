import { useListUserProjects } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Award, Lock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function Certificates() {
  const { user } = useUser();
  const { data: projects } = useListUserProjects();
  const completed = (projects as any[])?.filter((p: any) => p.status === "completed") ?? [];

  // For now, generate placeholder certificates based on domain completion
  const certs = completed.length >= 10 ? [
    { id: "de-cert", title: "Data Engineering Foundations", issueDate: new Date().toLocaleDateString(), description: "Completed 10+ Data Engineering projects" },
  ] : [];

  return (
    <div className="container max-w-4xl mx-auto py-10 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Award className="h-7 w-7 text-amber-400" />
          Certificates
        </h1>
        <p className="text-muted-foreground mt-2">Earn certificates by completing tracks and milestones.</p>
      </div>

      {certs.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {certs.map(cert => (
            <div key={cert.id} className="bg-card border border-border rounded-xl p-6 space-y-3">
              <div className="flex items-start justify-between">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Award className="h-6 w-6 text-amber-400" />
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Earned</Badge>
              </div>
              <div>
                <h3 className="font-bold">{cert.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{cert.description}</p>
                <p className="text-xs text-muted-foreground mt-2">Issued {cert.issueDate} · {user?.fullName}</p>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Certificate
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Award className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Certificates Yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            Complete at least 10 projects in a track to earn your first certificate. Keep going!
          </p>
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" style={{ width: `${Math.min((completed.length / 10) * 100, 100)}%`, height: "8px", maxWidth: "120px", background: "linear-gradient(to right, #3B82F6, #8B5CF6)", borderRadius: "4px" }} />
            </div>
            <span>{completed.length} / 10 projects completed</span>
          </div>
          <Link href="/domains/data-engineering">
            <Button>Continue Learning</Button>
          </Link>
        </div>
      )}

      {/* Locked certificates */}
      <div className="mt-8 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Upcoming Certificates</h2>
        {[
          { title: "Data Engineering Foundations", requirement: "Complete 10 DE projects" },
          { title: "Data Engineering Professional", requirement: "Complete all 40 DE projects" },
          { title: "Python for Data Engineering", requirement: "Complete Python Mastery" },
          { title: "SQL for Data Engineering", requirement: "Complete SQL Mastery" },
        ].map(cert => (
          <div key={cert.title} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between opacity-60">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{cert.title}</p>
                <p className="text-xs text-muted-foreground">{cert.requirement}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
