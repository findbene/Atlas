import type { ExecutionProfile } from "@workspace/execution-core";
import { Cloud, Database, Container, ShieldCheck, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  profile: ExecutionProfile;
  /** Optional className for layout integration in the workspace top bar. */
  className?: string;
}

const STYLE_BY_MODE: Record<ExecutionProfile["mode"], { className: string; Icon: typeof Cloud }> = {
  simulated: {
    className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    Icon: Play,
  },
  replay: {
    className: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    Icon: Database,
  },
  local_container: {
    className: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    Icon: Container,
  },
  byo_cloud: {
    className: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    Icon: Cloud,
  },
  managed_sandbox: {
    className: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
    Icon: ShieldCheck,
  },
};

const TOOLTIP_BY_MODE: Record<ExecutionProfile["mode"], string> = {
  simulated:
    "Your code runs entirely in this browser tab using Pyodide (Python) or DuckDB-WASM (SQL). No real cloud services are touched.",
  replay:
    "This lab compares your code against pre-recorded outputs from a real cloud run. Educational, but no live cloud execution.",
  local_container:
    "Code runs in an ephemeral Atlas-managed container. Closer to production behavior than simulated mode.",
  byo_cloud:
    "Code runs against your own connected cloud account. You are responsible for any usage costs.",
  managed_sandbox:
    "Code runs in a short-lived Atlas-managed cloud sandbox. Real services, costs metered by Atlas.",
};

/**
 * Honesty chip surfaced in the project workspace top bar. Always tells the
 * learner exactly what kind of environment is executing their code — no
 * silent fallbacks, no misleading "cloud" framing for in-browser work.
 */
export function ExecutionModeChip({ profile, className }: Props) {
  const { Icon, className: styleClass } = STYLE_BY_MODE[profile.mode];
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${styleClass} text-xs gap-1 cursor-help ${className ?? ""}`}
            data-testid="execution-mode-chip"
            data-mode={profile.mode}
          >
            <Icon className="h-3 w-3" />
            {profile.honestyLabel}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          {TOOLTIP_BY_MODE[profile.mode]}
          {profile.estimatedCost && (
            <div className="mt-1 text-muted-foreground">Cost: {profile.estimatedCost}</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
