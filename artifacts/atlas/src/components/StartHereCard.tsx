import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { Sparkles, Compass, Loader2 } from "lucide-react";
import { useCreateEnrollment, type StartHereRecommendation } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";

/**
 * Phase 18 — Start Here card.
 *
 * Renders the rule-based first-project recommendation at the top of a
 * course detail page. Two visual states driven by the server's
 * `reasonKey`:
 *
 *   - `beginner_available` → "Start Here" + "Best first project for this course."
 *   - `no_beginner_available` → "Most approachable project available" +
 *     honest fallback copy. Renders the project's real difficulty badge
 *     (typically Advanced) — never re-labels it as beginner-friendly.
 *
 * Never displays internal metadata (anchor flags, scores, etc.).
 */
export interface StartHereCardProps {
  recommendation: StartHereRecommendation;
}

export function StartHereCard({ recommendation }: StartHereCardProps) {
  const { project, reasonKey } = recommendation;
  const isStartHere = reasonKey === "beginner_available";
  const [, navigate] = useLocation();
  const { isSignedIn } = useAuth();
  const enroll = useCreateEnrollment();

  const heading = isStartHere ? "Start Here" : "Most approachable project available";
  const body = isStartHere
    ? "Best first project for this course."
    : "Beginner projects for this course are coming soon. This is the gentlest available starting point for now.";
  const cta = isStartHere ? "Start this project" : "View project";
  const Icon = isStartHere ? Sparkles : Compass;

  // Phase 21: CTA enrolls (slug-based, idempotent) then deep-links to the
  // workspace. Anonymous users skip enrollment and go to the public
  // project route, which gates them into sign-in itself.
  const onClick = () => {
    if (!isSignedIn) {
      navigate(`/projects/${project.slug}`);
      return;
    }
    enroll.mutate(
      { data: { projectSlug: project.slug } },
      {
        onSettled: () => {
          // Idempotent — regardless of created vs existing, the right
          // landing place is the project workspace.
          navigate(`/projects/${project.slug}`);
        },
      },
    );
  };

  return (
    <Card
      data-testid="start-here-card"
      data-kind={recommendation.kind}
      className="mb-6 border-primary/30 bg-primary/5"
    >
      <CardContent className="py-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wide font-semibold text-primary">
                {heading}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h3
                className="text-lg font-semibold leading-tight"
                data-testid="start-here-project-title"
              >
                {project.title}
              </h3>
              <DifficultyBadge difficulty={project.difficulty} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">{body}</p>
            <Button
              size="sm"
              onClick={onClick}
              disabled={enroll.isPending}
              data-testid="start-here-cta"
            >
              {enroll.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enrolling…
                </>
              ) : (
                cta
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
