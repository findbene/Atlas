import { useListUserProjects } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import {
  Award,
  Lock,
  Download,
  Linkedin,
  Briefcase,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function buildLinkedInShareUrl(opts: {
  projectTitle: string;
  completedAt?: string;
  certUrl: string;
}) {
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: `${opts.projectTitle} — Atlas`,
    organizationName: "Atlas Projects",
    issueYear: opts.completedAt ? String(new Date(opts.completedAt).getFullYear()) : String(new Date().getFullYear()),
    issueMonth: opts.completedAt ? String(new Date(opts.completedAt).getMonth() + 1) : String(new Date().getMonth() + 1),
    certUrl: opts.certUrl,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export default function Certificates() {
  const { user } = useUser();
  const { data: projects } = useListUserProjects();
  const completed = (projects as any[])?.filter((p: any) => p.status === "completed") ?? [];

  // Tracks (locked / earned aggregate certs)
  const trackCerts = [
    { id: "de-foundations", title: "Data Engineering Foundations", requirement: "Complete 10 DE projects", threshold: 10 },
    { id: "de-pro", title: "Data Engineering Professional", requirement: "Complete all 40 DE projects", threshold: 40 },
  ];

  return (
    <div className="container max-w-6xl mx-auto py-10 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Award className="h-7 w-7 text-amber-400" />
          Certificates
        </h1>
        <p className="text-muted-foreground mt-2">
          Every completed project is a portfolio-ready certificate. Share them on LinkedIn or your résumé.
        </p>
      </div>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Project Certificates
          </h2>
          <span className="text-xs text-muted-foreground">
            {completed.length} earned
          </span>
        </div>

        {completed.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Award className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No certificates yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Finish your first project to earn a shareable certificate showing the roles you're now ready for.
            </p>
            <Button asChild>
              <Link href="/courses/data-engineering">Start your first project</Link>
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map((up: any) => {
              const project = up.project ?? {};
              const roles: string[] = Array.from(
                new Set<string>(project?.jobOutcomes?.roles ?? []),
              );
              const slug: string = project?.slug ?? "";
              const printUrl = `/certificates/${encodeURIComponent(slug)}/print`;
              const shareUrl = buildLinkedInShareUrl({
                projectTitle: project?.title ?? "Atlas Project",
                completedAt: up.completedAt,
                certUrl:
                  typeof window !== "undefined"
                    ? `${window.location.origin}${printUrl}`
                    : printUrl,
              });

              return (
                <div
                  key={up.id ?? slug}
                  className="group relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] via-card to-card p-5 hover:border-amber-500/40 transition-colors"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="relative space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                        <Award className="h-5 w-5 text-amber-400" />
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                        Earned
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-bold text-base leading-tight line-clamp-2">
                        {project?.title ?? "Atlas Project"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        Issued {formatDate(up.completedAt)}
                        {user?.fullName ? <> · {user.fullName}</> : null}
                      </p>
                    </div>

                    {roles.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          Roles unlocked
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {roles.slice(0, 3).map((r) => (
                            <span
                              key={r}
                              className="text-[11px] rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200 px-2 py-0.5"
                            >
                              {r}
                            </span>
                          ))}
                          {roles.length > 3 && (
                            <span className="text-[11px] text-muted-foreground px-1 py-0.5">
                              +{roles.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
                        <Link href={printUrl}>
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          View / Print
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="text-xs">
                        <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Track Certificates
        </h2>
        <div className="space-y-3">
          {trackCerts.map((cert) => {
            const earned = completed.length >= cert.threshold;
            const progress = Math.min(completed.length / cert.threshold, 1);
            return (
              <div
                key={cert.id}
                className={`bg-card border rounded-xl p-4 flex items-center justify-between ${earned ? "border-amber-500/30" : "border-border opacity-80"}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {earned ? (
                    <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{cert.title}</p>
                    <p className="text-xs text-muted-foreground">{cert.requirement}</p>
                    <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden max-w-xs">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground ml-4 shrink-0">
                  {completed.length} / {cert.threshold}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
