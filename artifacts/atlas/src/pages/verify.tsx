import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Award, CheckCircle2, XCircle, Loader2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VerifiedCert {
  certId: string;
  recipientName: string;
  recipientUsername: string | null;
  projectTitle: string;
  projectSlug: string;
  completedAt: string;
  issuer: string;
}

type State =
  | { kind: "loading" }
  | { kind: "valid"; cert: VerifiedCert }
  | { kind: "invalid"; message: string };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function Verify() {
  const params = useParams<{ certId: string }>();
  const certId = params?.certId ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/verify/${encodeURIComponent(certId)}`,
        );
        if (!res.ok) {
          if (!cancelled)
            setState({ kind: "invalid", message: "This certificate could not be verified." });
          return;
        }
        const cert = (await res.json()) as VerifiedCert;
        if (!cancelled) setState({ kind: "valid", cert });
      } catch {
        if (!cancelled)
          setState({ kind: "invalid", message: "Network error while verifying." });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [certId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {state.kind === "loading" && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Verifying certificate…</p>
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="h-14 w-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-7 w-7 text-red-400" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Certificate not found</h1>
            <p className="text-sm text-muted-foreground mb-6" data-testid="verify-invalid">
              {state.message}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to Atlas</Link>
            </Button>
          </div>
        )}

        {state.kind === "valid" && (
          <div
            className="bg-card border-2 border-amber-500/30 rounded-2xl p-10 text-center"
            data-testid="verify-valid"
          >
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-400 font-semibold">
              Verified certificate
            </p>

            <div className="flex items-center justify-center gap-3 mt-6">
              <Award className="h-6 w-6 text-amber-400" />
              <h1 className="text-2xl font-serif">Certificate of Completion</h1>
            </div>

            <p className="text-sm text-muted-foreground mt-8">This certifies that</p>
            <p className="text-3xl font-serif italic mt-2">{state.cert.recipientName}</p>
            <p className="text-sm text-muted-foreground mt-4">completed</p>
            <p className="text-xl font-semibold mt-1">{state.cert.projectTitle}</p>

            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-border text-left">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Issued
                </p>
                <p className="text-sm mt-1">{formatDate(state.cert.completedAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Certificate ID
                </p>
                <p className="text-xs font-mono mt-1 break-all">{state.cert.certId.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center mt-8">
              {state.cert.recipientUsername && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/u/${state.cert.recipientUsername}`}>
                    <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                    View profile
                  </Link>
                </Button>
              )}
              <Button asChild size="sm">
                <Link href="/">Explore Atlas</Link>
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground mt-6">
              Issued by {state.cert.issuer} · atlasprojects.dev
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
