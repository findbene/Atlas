/**
 * Phase 25 — Structured remediation surface rendered below the
 * ValidationFeedbackPanel on failed checks / submits. Consumes the
 * pure `parseRemediation` helper; renders nothing for `generic` so
 * the parent panel's raw `feedback` text remains the sole source for
 * those cases.
 *
 * Rendered ONLY when:
 *   - grading exists AND grading.status === 'failed'
 *   - the step is not a no-check / self-attest type (the caller passes
 *     `hidden` for that)
 *
 * No state, no network, no reducer coupling. Display only.
 */
import { AlertTriangle, Code } from "lucide-react";
import { parseRemediation } from "@/lib/remediationParser";

type Props = {
  feedback: string | null | undefined;
  submission: string | null | undefined;
  hidden?: boolean;
};

export function RemediationPanel({ feedback, submission, hidden }: Props) {
  if (hidden) return null;
  const r = parseRemediation(feedback, submission);
  if (r.kind === "generic") return null;

  return (
    <div
      className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
      data-testid="remediation-panel"
    >
      <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-amber-300 font-semibold">
        {r.kind === "exact-diff" && <AlertTriangle className="h-3.5 w-3.5" />}
        {r.kind === "contains-miss" && <AlertTriangle className="h-3.5 w-3.5" />}
        {r.kind === "regex-miss" && <Code className="h-3.5 w-3.5" />}
        <span>How to fix this</span>
      </div>

      {r.kind === "exact-diff" && (
        <div className="space-y-2" data-testid="remediation-exact-diff">
          <RemediationRow label="Expected" value={r.expected} tone="expected" />
          <RemediationRow label="Got" value={r.actual} tone="actual" />
          <p className="text-xs text-foreground/60 mt-1">
            The output must match the expected value exactly (after trimming).
          </p>
        </div>
      )}

      {r.kind === "contains-miss" && (
        <div className="space-y-2" data-testid="remediation-contains-miss">
          <div className="text-xs text-foreground/70">
            Your output should contain this:
          </div>
          <code
            className="inline-block px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-100 text-xs font-mono whitespace-pre-wrap break-words"
            data-testid="remediation-needle"
          >
            {r.needle}
          </code>
          <RemediationRow label="Your output" value={r.actual} tone="actual" />
        </div>
      )}

      {r.kind === "regex-miss" && (
        <div className="space-y-2" data-testid="remediation-regex-miss">
          <p className="text-xs text-foreground/70">
            Your submission didn't match the required pattern for this step.
            Re-read the step instructions for the exact format expected.
          </p>
          <RemediationRow label="Your output" value={r.actual} tone="actual" />
        </div>
      )}
    </div>
  );
}

function RemediationRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "expected" | "actual";
}) {
  const toneCls =
    tone === "expected"
      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-100"
      : "bg-red-500/10 border-red-500/20 text-red-100";
  return (
    <div className="text-xs">
      <div className="text-foreground/60 mb-0.5 uppercase tracking-wider">
        {label}
      </div>
      <pre
        className={`rounded border ${toneCls} px-2 py-1 font-mono whitespace-pre-wrap break-words max-h-32 overflow-auto text-xs`}
        data-testid={`remediation-${tone}`}
      >
        {value === "" ? <span className="opacity-50">(empty)</span> : value}
      </pre>
    </div>
  );
}
