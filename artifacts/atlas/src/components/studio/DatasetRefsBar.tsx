import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Database, Info } from "lucide-react";

type Props = { refs: string[] };

type Preview = {
  columns: string[];
  rows: string[][];
  rowCount: number;
};

function parseCsv(text: string, maxRows: number): Preview {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return { columns: [], rows: [], rowCount: 0 };
  // Simple split — datasets we ship are well-formed CSV without embedded commas
  // or quotes. The DuckDB adapter is the actual source of truth; this is only
  // a tiny visual preview so a slightly wrong cell is acceptable, not silent.
  const columns = lines[0].split(",");
  const rows = lines.slice(1, 1 + maxRows).map(l => l.split(","));
  return { columns, rows, rowCount: lines.length - 1 };
}

function DatasetChip({ name }: { name: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (preview || loading) return;
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.BASE_URL ?? "/";
      const res = await fetch(`${base}datasets/${name}.csv`);
      if (!res.ok) {
        setError("Preview unavailable");
        return;
      }
      const text = await res.text();
      setPreview(parseCsv(text, 5));
    } catch {
      setError("Preview unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover
      onOpenChange={open => {
        if (open) void load();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs hover:bg-muted/60 transition-colors"
          data-testid={`dataset-chip-${name}`}
        >
          <Database className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono">{name}</span>
          <Info className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto max-w-md p-3">
        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Database className="h-3 w-3" /> {name}
          {preview && <span className="ml-1">· {preview.rowCount} row(s)</span>}
        </div>
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading preview…</div>
        ) : error ? (
          <div className="text-xs text-muted-foreground italic">{error}</div>
        ) : preview ? (
          <div className="overflow-auto max-h-64 rounded border border-border/60">
            <table className="text-[11px] font-mono">
              <thead className="bg-muted/40">
                <tr>
                  {preview.columns.map(c => (
                    <th
                      key={c}
                      className="text-left px-2 py-1 border-b border-border/60 font-medium"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i} className="even:bg-muted/10">
                    {r.map((cell, j) => (
                      <td key={j} className="px-2 py-1 border-b border-border/30">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function DatasetRefsBar({ refs }: Props) {
  if (!refs || refs.length === 0) return null;
  return (
    <div
      className="border-t border-border bg-muted/10 px-3 py-2 flex items-center gap-2 shrink-0 flex-wrap"
      data-testid="studio-datasets"
    >
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        Tables:
      </span>
      {refs.map(r => (
        <DatasetChip key={r} name={r} />
      ))}
    </div>
  );
}
