import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Award,
  FileText,
  HelpCircle,
  Sparkles,
  TrendingUp,
  ListChecks,
} from "lucide-react";
import type { ReactNode } from "react";

export type JobOutcomes = {
  roles?: string[];
  skillsForResume?: string[];
  resumeBullets?: string[];
  interviewQuestions?: string[];
  portfolioReadiness?: string;
  marketSignal?: string;
};

type Props = {
  trigger?: ReactNode;
  title: string;
  jobOutcomes?: JobOutcomes | null;
  learningObjectives?: string[];
  prerequisites?: string[];
  longDescription?: string;
};

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function JobOutcomesPanel({
  trigger,
  title,
  jobOutcomes,
  learningObjectives,
  prerequisites,
  longDescription,
}: Props) {
  const hasOutcomes =
    jobOutcomes &&
    ((jobOutcomes.roles?.length ?? 0) > 0 ||
      (jobOutcomes.skillsForResume?.length ?? 0) > 0 ||
      (jobOutcomes.resumeBullets?.length ?? 0) > 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <Award className="h-3.5 w-3.5 text-amber-400" />
            Career Impact
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl border-l border-border/50 bg-card p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <SheetTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            What you walk away with
          </SheetTitle>
          <SheetDescription className="text-sm">
            Research-backed career signals from completing{" "}
            <span className="font-medium text-foreground">{title}</span>.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-9rem)] px-6 py-5">
          <div className="space-y-7 pb-12">
            {longDescription && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {longDescription}
              </p>
            )}

            {!hasOutcomes && (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Career-impact signals are being curated for this project.
              </div>
            )}

            {jobOutcomes?.marketSignal && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
                  <p className="text-sm text-amber-100/90 leading-relaxed">
                    <span className="font-semibold text-amber-300">
                      2026 market signal:{" "}
                    </span>
                    {jobOutcomes.marketSignal}
                  </p>
                </div>
              </div>
            )}

            {jobOutcomes?.roles && jobOutcomes.roles.length > 0 && (
              <Section icon={<Briefcase className="h-4 w-4" />} title="Roles you'll be ready for">
                <div className="flex flex-wrap gap-2">
                  {jobOutcomes.roles.map((r) => (
                    <Badge
                      key={r}
                      variant="secondary"
                      className="bg-blue-500/10 text-blue-300 border border-blue-500/20"
                    >
                      {r}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}

            {jobOutcomes?.skillsForResume && jobOutcomes.skillsForResume.length > 0 && (
              <Section icon={<ListChecks className="h-4 w-4" />} title="Skills for your resume">
                <div className="flex flex-wrap gap-2">
                  {jobOutcomes.skillsForResume.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="border-border bg-muted/40 text-foreground/90"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}

            {jobOutcomes?.resumeBullets && jobOutcomes.resumeBullets.length > 0 && (
              <Section icon={<FileText className="h-4 w-4" />} title="Resume bullets you can write">
                <ul className="space-y-2.5">
                  {jobOutcomes.resumeBullets.map((b) => (
                    <li
                      key={b}
                      className="text-sm leading-relaxed pl-4 border-l-2 border-emerald-500/30 text-foreground/90"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {jobOutcomes?.interviewQuestions && jobOutcomes.interviewQuestions.length > 0 && (
              <Section icon={<HelpCircle className="h-4 w-4" />} title="Interview questions you'll be ready for">
                <ul className="space-y-2">
                  {jobOutcomes.interviewQuestions.map((q) => (
                    <li
                      key={q}
                      className="text-sm leading-relaxed text-foreground/90 flex gap-2"
                    >
                      <span className="text-primary font-bold">›</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {jobOutcomes?.portfolioReadiness && (
              <Section icon={<Award className="h-4 w-4" />} title="Make it portfolio-ready">
                <p className="text-sm leading-relaxed text-foreground/90">
                  {jobOutcomes.portfolioReadiness}
                </p>
              </Section>
            )}

            {learningObjectives && learningObjectives.length > 0 && (
              <Section icon={<Sparkles className="h-4 w-4" />} title="Learning objectives">
                <ul className="space-y-1.5 text-sm text-foreground/90">
                  {learningObjectives.map((o) => (
                    <li key={o} className="flex gap-2">
                      <span className="text-emerald-400">✓</span> {o}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {prerequisites && prerequisites.length > 0 && (
              <Section icon={<ListChecks className="h-4 w-4" />} title="Prerequisites">
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {prerequisites.map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
