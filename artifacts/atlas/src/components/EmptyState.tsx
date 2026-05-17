/**
 * Friendly empty-state card. One icon + headline + body + optional CTA.
 * Keeps the visual language consistent across dashboard, leaderboard, and
 * catalog so empty screens don't feel like a dead end.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaSlot,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaSlot?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-6" : "py-10"
      }`}
      data-testid="empty-state"
    >
      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500/15 to-purple-500/10 border border-border flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-blue-300" />
      </div>
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      {ctaSlot ? (
        <div className="mt-4">{ctaSlot}</div>
      ) : ctaLabel && ctaHref ? (
        <Button asChild size="sm" className="mt-4">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
