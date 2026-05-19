import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircleQuestion } from "lucide-react";
import type { OutputVM } from "./types";

type Props = {
  output: OutputVM | null;
  isRunning: boolean;
  pyLoading: boolean;
  onAskTutor?: (stderr: string) => void;
};

export function OutputPanel({ output, isRunning, pyLoading, onAskTutor }: Props) {
  return (
    <div className="h-full bg-[#0D1117]" data-testid="studio-output">
      <ScrollArea className="h-full p-3">
        {isRunning ? (
          <div className="text-muted-foreground text-sm">
            {pyLoading
              ? "Loading Python runtime (first run only, ~10MB)…"
              : "Running…"}
          </div>
        ) : output ? (
          <div className="font-mono text-sm space-y-2">
            {output.stdout && (
              <pre className="text-green-400 whitespace-pre-wrap">{output.stdout}</pre>
            )}
            {output.stderr && (
              <pre className="text-red-400 whitespace-pre-wrap">{output.stderr}</pre>
            )}
            {output.columns && output.rows && (
              <div
                className="rounded-md border border-border/60 overflow-auto max-h-[40vh]"
                data-testid="sql-result-table"
              >
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      {output.columns.map(c => (
                        <th
                          key={c}
                          className="text-left px-2 py-1 font-medium text-foreground/80 border-b border-border/60"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {output.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={output.columns.length}
                          className="px-2 py-2 text-muted-foreground italic"
                        >
                          No rows returned
                        </td>
                      </tr>
                    ) : (
                      output.rows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="even:bg-muted/10">
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className="px-2 py-1 text-foreground/90 border-b border-border/30 font-mono"
                            >
                              {cell === null ? (
                                <span className="text-muted-foreground italic">null</span>
                              ) : (
                                String(cell)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {output.rows.length > 100 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground bg-muted/20 border-t border-border/40">
                    Showing first 100 of {output.rows.length} rows
                  </div>
                )}
              </div>
            )}
            {!output.stdout && !output.stderr && !output.columns && (
              <span className="text-muted-foreground">No output</span>
            )}
            <div
              className={`text-xs mt-2 ${output.exitCode === 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              Exit code: {output.exitCode}
            </div>
            {output.stderr && onAskTutor && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
                data-testid="ask-tutor-about-error"
                onClick={() => onAskTutor(output.stderr)}
              >
                <MessageCircleQuestion className="h-3 w-3 mr-1" />
                Ask tutor about this error
              </Button>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            Run your code to see output here.
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
