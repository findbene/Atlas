/**
 * Phase 49 — "How Atlas Grades" learner-facing disclosure page.
 *
 * Honest-claim ceiling H3 (see docs/runtime-validation-threat-model.md):
 *   Atlas may verify, for certain steps, that the runtime output you
 *   submitted matched the expected result. That is the FULL extent of
 *   what the signed-envelope path proves. It does NOT prove independent
 *   authorship, does NOT prove the absence of outside help, and does
 *   NOT certify mastery on its own.
 *
 * Copy-review guard: this page is unit-tested for the absence of
 * H1/H2 overclaim verbs ("tamper-proof", "verified authorship",
 * "guaranteed", "cheat-proof", "proven mastery", etc.). If you edit
 * the copy here, run `pnpm --filter @workspace/atlas run test
 * how-atlas-grades.test.tsx` to confirm the guard still holds.
 */
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileCheck2, AlertCircle, ListChecks, Code2 } from "lucide-react";

export default function HowAtlasGrades() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <Badge variant="secondary" className="mb-4">Grading & verification</Badge>
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight mb-4"
            data-testid="how-atlas-grades-heading"
          >
            How Atlas grades your work
          </h1>
          <p className="text-lg text-muted-foreground">
            We want you to know exactly what our automated checks do and
            do not establish. This page is the single source of truth.
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-8 space-y-6">
            <section data-testid="how-atlas-grades-what-we-check">
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">What our checks look at</h2>
              </div>
              <p className="text-muted-foreground mb-3">
                When you submit a step, Atlas runs one of a few different
                kinds of automated checks depending on the step type:
              </p>
              <ul className="space-y-2 text-muted-foreground list-disc pl-6">
                <li>
                  For code-execution steps with an authored expected output,
                  we may compare your runtime output to that expected output.
                </li>
                <li>
                  For concept-check and short-answer steps, we record your
                  submission and mark it complete so you can continue.
                </li>
                <li>
                  Some steps rely on self-attestation — you mark the work as
                  done after completing it on your own machine or environment.
                </li>
              </ul>
            </section>

            <section data-testid="how-atlas-grades-signed-runs">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">
                  Signed runtime captures (pilot)
                </h2>
              </div>
              <p className="text-muted-foreground mb-3">
                For a small pilot set of code steps, when you click Run in
                the editor we ask our server to sign a short-lived record
                of the output your browser produced. If you then Submit
                within a few minutes, we re-check that record on the server
                before grading.
              </p>
              <p className="text-muted-foreground">
                When this happens, the signed record means one specific
                thing: <span className="font-medium text-foreground">
                Atlas saw your browser report a particular output for the
                code you ran, and that output matched what the step
                expected.</span> The signature is something Atlas issued
                to itself — it confirms the record came from your session
                and was not modified in flight.
              </p>
            </section>

            <section data-testid="how-atlas-grades-what-not-proven">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <h2 className="text-xl font-semibold">What this does not prove</h2>
              </div>
              <p className="text-muted-foreground mb-3">
                We want to be straightforward about the limits of these
                checks. A passing automated check does not establish any
                of the following:
              </p>
              <ul className="space-y-2 text-muted-foreground list-disc pl-6">
                <li>
                  It does not prove that you wrote the code yourself or
                  worked through the step independently.
                </li>
                <li>
                  It does not prove that you did not use outside help — an
                  AI assistant, a peer, a tutor, or copying from a public
                  source.
                </li>
                <li>
                  It does not certify mastery of the underlying concepts.
                  Passing a step means the output matched; it does not
                  mean you have nothing left to learn.
                </li>
                <li>
                  Checks vary by project and step type. The presence or
                  absence of a check on any given step is not a claim
                  about that step's importance.
                </li>
              </ul>
            </section>

            <section data-testid="how-atlas-grades-fallback">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">When the signed path is unavailable</h2>
              </div>
              <p className="text-muted-foreground">
                If signing is unavailable for any reason — a network
                hiccup, a step type that is not part of the pilot, a
                deployment without the signing key configured — your
                submission still goes through using our existing grading
                path. Nothing about your ability to complete the step
                depends on the signed-record feature working.
              </p>
            </section>

            <section data-testid="how-atlas-grades-honest-claim">
              <div className="flex items-center gap-2 mb-3">
                <Code2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Why we are being this specific</h2>
              </div>
              <p className="text-muted-foreground">
                A lot of platforms describe their automated checks in ways
                that sound stronger than the underlying mechanism actually
                supports. We would rather under-promise here and let your
                portfolio, your projects, and the work you can talk
                through in an interview do the harder talking.
              </p>
            </section>
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground text-center">
          Questions or feedback?{" "}
          <Link href="/dashboard" className="text-primary hover:underline">
            Head back to your dashboard
          </Link>{" "}
          and reach out from there.
        </div>
      </main>
    </div>
  );
}
