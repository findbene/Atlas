import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DifficultyLevel } from "./DifficultyBadge";

export type DifficultyFilterValue = DifficultyLevel | "all";

const OPTIONS: ReadonlyArray<{ value: DifficultyFilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export interface DifficultyFilterProps {
  value: DifficultyFilterValue;
  onChange: (next: DifficultyFilterValue) => void;
  className?: string;
}

/**
 * Phase 16 — Difficulty filter pill row. Pure presentational —
 * URL-state syncing lives in the consumer page so the same component can be
 * reused outside route contexts.
 */
export function DifficultyFilter({ value, onChange, className }: DifficultyFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filter by difficulty"
      data-testid="difficulty-filter"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {OPTIONS.map(opt => {
        const selected = opt.value === value;
        return (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            data-testid={`difficulty-filter-${opt.value}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Parses a query-string value to a known DifficultyFilterValue. Anything else
 * (including missing) collapses to "all" — keeps invalid URLs from crashing.
 */
export function parseDifficultyParam(raw: string | null | undefined): DifficultyFilterValue {
  if (raw === "beginner" || raw === "intermediate" || raw === "advanced") return raw;
  return "all";
}
