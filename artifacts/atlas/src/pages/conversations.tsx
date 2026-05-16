import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Bot, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ConversationSummary {
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  messageCount: number;
  lastMessageAt: string;
  lastRole: string;
  lastSnippet: string;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function Conversations() {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/ai/chat/conversations`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setError(`Failed to load (HTTP ${res.status})`);
          return;
        }
        const data = (await res.json()) as ConversationSummary[];
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) setError("Failed to load conversations");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="container max-w-4xl mx-auto py-10 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Bot className="h-7 w-7 text-blue-400" />
          Tutor Conversations
        </h1>
        <p className="text-muted-foreground mt-2">
          Pick up where you left off with the Atlas AI tutor on any project.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!items && !error && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Loading conversations…
        </div>
      )}

      {items && (
        <div className="space-y-3">
          <Link
            href="/tutor"
            className="block rounded-lg border border-blue-400/30 bg-blue-400/5 hover:bg-blue-400/10 hover:border-blue-400/50 transition p-4 group"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="h-4 w-4 text-blue-400" />
                  <h3 className="font-medium">General Tutor Chat</h3>
                  <Badge variant="secondary" className="text-xs shrink-0">No project</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Career advice, concept reviews, or anything that doesn't fit a project.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
            </div>
          </Link>

          {items.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No project conversations yet — open any project and ask the tutor a question, or start a general chat above.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/domains">Browse projects</Link>
              </Button>
            </div>
          ) : items.map(c => (
            <Link
              key={c.projectId}
              href={`/projects/${c.projectSlug}`}
              className="block rounded-lg border border-border bg-card hover:bg-card/80 hover:border-blue-400/50 transition p-4 group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{c.projectTitle}</h3>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {c.messageCount} {c.messageCount === 1 ? "message" : "messages"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    <span className="font-medium text-foreground/70">
                      {c.lastRole === "user" ? "You: " : "Atlas: "}
                    </span>
                    {c.lastSnippet}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelative(c.lastMessageAt)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

