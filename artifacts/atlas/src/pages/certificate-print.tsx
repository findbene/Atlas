import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { useUser } from "@clerk/react";
import { useListUserProjects } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Award, Printer, ArrowLeft, Briefcase } from "lucide-react";

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function CertificatePrint() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { user } = useUser();
  const { data: projects, isLoading } = useListUserProjects();

  useEffect(() => {
    document.body.classList.add("cert-print-body");
    return () => document.body.classList.remove("cert-print-body");
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading certificate…
      </div>
    );
  }

  const item = (projects as any[])?.find(
    (p: any) => p.project?.slug === slug && p.status === "completed",
  );

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold mb-2">Certificate not available</h1>
          <p className="text-sm text-muted-foreground mb-4">
            This certificate is unlocked once you complete the project.
          </p>
          <Button asChild>
            <Link href="/certificates">Back to certificates</Link>
          </Button>
        </div>
      </div>
    );
  }

  const project = item.project ?? {};
  const roles: string[] = Array.from(new Set<string>(project?.jobOutcomes?.roles ?? []));
  const skills: string[] = Array.from(
    new Set<string>(project?.jobOutcomes?.skillsForResume ?? []),
  );
  const recipient = user?.fullName ?? user?.username ?? "Atlas Learner";
  const fullCertId = (item.id ?? "").toString();
  const certId = `ATL-${fullCertId.slice(0, 8).toUpperCase()}`;
  const verifyUrl =
    typeof window !== "undefined" && fullCertId
      ? `${window.location.origin}/verify/${fullCertId}`
      : "";

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white py-10 px-4 print:p-0">
      {/* Print-specific styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .cert-page { box-shadow: none !important; border: none !important; }
          @page { size: landscape; margin: 0; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between no-print">
        <Button asChild variant="ghost" size="sm">
          <Link href="/certificates">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to certificates
          </Link>
        </Button>
        <Button onClick={() => window.print()} size="sm">
          <Printer className="h-4 w-4 mr-1.5" />
          Print / Save as PDF
        </Button>
      </div>

      <div
        className="cert-page max-w-4xl mx-auto bg-white text-neutral-900 rounded-lg shadow-2xl p-12 print:shadow-none border-8 border-double border-amber-600/40"
        style={{ aspectRatio: "11 / 8.5" }}
      >
        <div className="h-full flex flex-col">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-amber-100 border-2 border-amber-400 mb-3">
              <Award className="h-7 w-7 text-amber-600" />
            </div>
            <p className="uppercase tracking-[0.3em] text-xs text-amber-700 font-bold">
              Atlas Projects
            </p>
            <h2 className="text-3xl font-serif mt-2 text-neutral-800">
              Certificate of Completion
            </h2>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <p className="text-sm text-neutral-600">This is to certify that</p>
            <p className="text-4xl font-serif italic mt-3 mb-3 text-neutral-900">
              {recipient}
            </p>
            <p className="text-sm text-neutral-600 max-w-2xl">
              has successfully completed the project-based curriculum for
            </p>
            <p className="text-2xl font-bold mt-3 text-neutral-900">
              {project.title}
            </p>

            {roles.length > 0 && (
              <div className="mt-6 max-w-2xl">
                <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2 font-semibold flex items-center justify-center gap-1.5">
                  <Briefcase className="h-3 w-3" />
                  Portfolio-ready for
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {roles.map((r) => (
                    <span
                      key={r}
                      className="text-xs rounded-full border border-amber-400 bg-amber-50 text-amber-800 px-3 py-1 font-medium"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {skills.length > 0 && (
              <p className="mt-4 text-xs text-neutral-600 max-w-2xl leading-relaxed">
                <span className="font-semibold">Skills demonstrated:</span>{" "}
                {skills.slice(0, 10).join(" · ")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 mt-6 pt-6 border-t border-neutral-200 text-xs text-neutral-600">
            <div>
              <p className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500">
                Issued
              </p>
              <p className="mt-1">{formatDate(item.completedAt)}</p>
            </div>
            <div className="text-center">
              <p className="font-serif italic text-neutral-700">— Atlas Projects</p>
              <p className="text-[10px] text-neutral-500 mt-0.5">atlasprojects.dev</p>
            </div>
            <div className="text-right">
              <p className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500">
                Certificate ID
              </p>
              <p className="mt-1 font-mono">{certId}</p>
              {verifyUrl && (
                <p className="mt-1 text-[10px] text-neutral-500 break-all">
                  Verify at {verifyUrl.replace(/^https?:\/\//, "")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
