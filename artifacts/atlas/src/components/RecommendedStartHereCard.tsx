import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateEnrollment,
  getGetDashboardQueryKey,
  type DashboardRecommendation,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { Sparkles, Compass, Loader2 } from "lucide-react";

/**
 * Phase 22 — Dashboard Start-Here surface.
 *
 * Mirrors the visual contract of `StartHereCard` (course-detail.tsx) but
 * sourced from `GET /api/dashboard.recommendedStartHere`. The server only
 * returns a recommendation for fresh learners (raw progressRows.length === 0),
 * so a hidden-only-enrolled user does NOT see this card.
 *
 * CTA: idempotent enroll (slug-based) → invalidate dashboard cache →
 * navigate to `/projects/:slug`. We do NOT promise an exact step landing —
 * the workspace currently starts every session at step 0 (Phase 23 candidate).
 */
export interface RecommendedStartHereCardProps {
  recommendation: DashboardRecommendation;
}

export function RecommendedStartHereCard({ recommendation }: RecommendedStartHereCardProps) {
  const { startHere } = recommendation;
  const { project, reasonKey } = startHere;
  const isStartHere = reasonKey === "beginner_available";
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const enroll = useCreateEnrollment();

  const heading = isStartHere ? "Start Here" : "Most approachable project available";
  const body = isStartHere
    ? "Best first project to kick off your Atlas journey."
    : "Beginner projects for this course are coming soon. This is the gentlest available starting point for now.";
  const Icon = isStartHere ? Sparkles : Compass;

  const onClick = () => {
    enroll.mutate(
      { data: { projectSlug: project.slug } },
      {
        onSettled: () => {
          // Refresh dashboard so the next visit reflects the new enrollment
          // without a hard reload. We invalidate even on error since the
          // server is idempotent and may have committed before the response
          // path failed.
          void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          navigate(`/projects/${project.slug}`);
        },
      },
    );
  };

  return (
    <Card
      data-testid="recommended-start-here-card"
      data-kind={startHere.kind}
      className="border-primary/30 bg-primary/5"
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
                data-testid="recommended-start-here-title"
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
              data-testid="recommended-start-here-cta"
            >
              {enroll.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enrolling…
                </>
              ) : (
                "Start this project"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
