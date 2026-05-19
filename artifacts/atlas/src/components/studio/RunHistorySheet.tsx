import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, GitCompare, History } from "lucide-react";
import { diffLines } from "diff";
import type { RunRow } from "./types";

function formatRunAge(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  runs: RunRow[] | null;
  currentCode: string;
  diffRunId: string | null;
  onSelectCode: (code: string) => void;
  onToggleDiff: (id: string) => void;
};

export function RunHistorySheet({
  open,
  onOpenChange,
  runs,
  currentCode,
  diffRunId,
  onSelectCode,
  onToggleDiff,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          title="Recent code runs"
          aria-label="Recent code runs"
        >
          <History className="h-3 w-3 mr-1" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Recent runs</SheetTitle>
          <SheetDescription>
            Your last 20 attempts on this step. Click "Use this code" to restore the
            editor.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {runs === null ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : runs.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No runs yet — hit Run to record your first attempt.
            </div>
          ) : (
            runs.map(r => (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
                data-testid={`run-row-${r.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-medium inline-flex items-center gap-1 ${r.ok ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {r.ok ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {r.ok ? "Passed" : "Errored"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRunAge(r.createdAt)}
                  </span>
                </div>
                <pre className="text-[11px] bg-background border border-border rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">
                  {r.code.slice(0, 600)}
                  {r.code.length > 600 ? "\n…" : ""}
                </pre>
                {(r.stdout || r.stderr) && (
                  <pre
                    className={`text-[11px] rounded p-2 overflow-x-auto max-h-24 whitespace-pre-wrap ${r.stderr ? "bg-red-950/30 text-red-300" : "bg-emerald-950/20 text-emerald-300"}`}
                  >
                    {(r.stderr || r.stdout).slice(0, 400)}
                  </pre>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs flex-1"
                    onClick={() => onSelectCode(r.code)}
                  >
                    Use this code
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => onToggleDiff(r.id)}
                    title="Compare with current editor"
                    aria-label={`Compare run ${r.id} with current editor`}
                    data-testid={`diff-toggle-${r.id}`}
                  >
                    <GitCompare className="h-3 w-3 mr-1" />
                    {diffRunId === r.id ? "Hide diff" : "Diff"}
                  </Button>
                </div>
                {diffRunId === r.id && (
                  <pre className="mt-2 text-[11px] bg-background border border-border rounded p-2 overflow-x-auto max-h-64 whitespace-pre-wrap font-mono">
                    {diffLines(r.code, currentCode).map((part, i) => (
                      <span
                        key={i}
                        className={
                          part.added
                            ? "bg-emerald-900/40 text-emerald-300"
                            : part.removed
                              ? "bg-red-900/40 text-red-300"
                              : "text-muted-foreground"
                        }
                      >
                        {part.added ? "+ " : part.removed ? "- " : "  "}
                        {part.value.replace(
                          /\n(?!$)/g,
                          m =>
                            m +
                            (part.added ? "+ " : part.removed ? "- " : "  "),
                        )}
                      </span>
                    ))}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
