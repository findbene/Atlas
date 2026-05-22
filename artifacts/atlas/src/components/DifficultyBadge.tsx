import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

const LABELS: Record<DifficultyLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const STYLES: Record<DifficultyLevel, string> = {
  beginner:
    "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  intermediate:
    "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  advanced:
    "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
};

function isKnown(value: string | null | undefined): value is DifficultyLevel {
  return value === "beginner" || value === "intermediate" || value === "advanced";
}

export interface DifficultyBadgeProps {
  difficulty: string | null | undefined;
  className?: string;
}

/**
 * Phase 16 — Public-facing difficulty badge. Renders only the three
 * learner-facing difficulty levels. Unknown / null difficulties render
 * nothing (defensive — no visible project currently has an unknown level).
 * NEVER displays `is_anchor` or any other internal metadata.
 */
export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  if (!isKnown(difficulty)) return null;
  return (
    <Badge
      variant="outline"
      data-testid={`difficulty-badge-${difficulty}`}
      className={cn("font-medium", STYLES[difficulty], className)}
    >
      {LABELS[difficulty]}
    </Badge>
  );
}
