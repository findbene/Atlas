import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SolutionPayload } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  error: { status: number; message: string } | null;
  data: SolutionPayload | null;
};

export function SolutionDialog({ open, onOpenChange, loading, error, data }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Reference Solution
          </DialogTitle>
          <DialogDescription>
            This is one valid implementation — your own approach may differ and still
            be correct.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Loading…
            </div>
          ) : error ? (
            <div className="space-y-3">
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                {error.status === 402 ? (
                  <>
                    <p className="font-medium text-amber-200 mb-1">Pro feature</p>
                    <p className="text-amber-100/80">{error.message}</p>
                    <Button
                      asChild
                      size="sm"
                      className="mt-3 bg-amber-500 hover:bg-amber-600 text-amber-950"
                    >
                      <Link href="/upgrade">Upgrade to Pro</Link>
                    </Button>
                  </>
                ) : error.status === 403 ? (
                  <>
                    <p className="font-medium text-amber-200 mb-1">
                      Try the project first
                    </p>
                    <p className="text-amber-100/80">{error.message}</p>
                  </>
                ) : (
                  <p className="text-amber-100/80">{error.message}</p>
                )}
              </div>
            </div>
          ) : data ? (
            <div className="space-y-3">
              {data.solutionCode && (
                <pre className="text-xs bg-[#0D1117] border border-border rounded p-3 overflow-x-auto whitespace-pre-wrap">
                  {data.solutionCode}
                </pre>
              )}
              {data.explanationMd && (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {data.explanationMd}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
