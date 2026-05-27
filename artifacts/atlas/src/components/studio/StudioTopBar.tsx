import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, Award, Bot } from "lucide-react";
import { ExecutionModeChip } from "@/components/ExecutionModeChip";
import { JobOutcomesPanel } from "@/components/JobOutcomesPanel";
import { ModeSelector } from "@/components/studio/ModeSelector";
import type { ExecutionProfile } from "@workspace/execution-core";

type Props = {
  project: any;
  executionProfile: ExecutionProfile | null;
  enrollPending: boolean;
  enrollError: string | null;
  showAi: boolean;
  onToggleAi: () => void;
};

export function StudioTopBar({
  project,
  executionProfile,
  enrollPending,
  enrollError,
  showAi,
  onToggleAi,
}: Props) {
  return (
    <div
      className="border-b border-border px-4 py-2.5 flex items-center gap-2 sm:gap-3 shrink-0 bg-card/80 flex-wrap"
      data-testid="studio-topbar"
    >
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link href={`/courses/${project.courseSlug ?? project.domainSlug}`}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {project.courseName ?? project.domainName}
        </Link>
      </Button>
      <span className="text-muted-foreground">/</span>
      <span className="font-semibold text-sm truncate">{project.title}</span>
      {enrollPending && (
        <span className="text-xs text-muted-foreground italic">Enrolling…</span>
      )}
      {enrollError && (
        <span className="text-xs text-red-400 italic" title={enrollError}>
          {enrollError}
        </span>
      )}
      <ModeSelector projectSlug={typeof project.slug === "string" ? project.slug : undefined} />
      {executionProfile && (
        <ExecutionModeChip profile={executionProfile} className="ml-auto" />
      )}
      <Badge variant="outline" className="text-xs">
        {project.difficulty}
      </Badge>
      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
        +{project.xpReward} XP
      </Badge>
      <JobOutcomesPanel
        title={project.title}
        jobOutcomes={project.jobOutcomes}
        learningObjectives={project.learningObjectives ?? []}
        prerequisites={project.prerequisites ?? []}
        longDescription={project.longDescription}
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-amber-300 hover:text-amber-200"
            data-testid="open-career-impact"
          >
            <Award className="h-4 w-4 mr-1" />
            Career Impact
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="sm"
        className={`text-xs ${showAi ? "text-blue-400" : "text-muted-foreground"}`}
        onClick={onToggleAi}
      >
        <Bot className="h-4 w-4 mr-1" />
        AI Tutor
      </Button>
    </div>
  );
}
