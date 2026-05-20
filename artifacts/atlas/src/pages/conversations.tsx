import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Bot, MessageSquare, ArrowRight, Trash2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConversationSummary {
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  messageCount: number;
  lastMessageAt: string;
  lastRole: string;
  lastSnippet: string;
}

interface SearchResult {
  id: string;
  role: string;
  snippet: string;
  createdAt: string;
  projectId: string | null;
  projectSlug: string | null;
  projectTitle: string | null;
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

type DeleteTarget =
  | { kind: "general" }
  | { kind: "project"; projectId: string; projectTitle: string };

export default function Conversations() {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search state. `query` is the live input value; `committed` is the
  // debounced value actually sent to the server. `results` is null until the
  // user has typed something searchable.
  const [query, setQuery] = useState("");
  const [committed, setCommitted] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function loadConversations() {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ai/chat/conversations`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError(`Failed to load (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as ConversationSummary[];
      setItems(data);
      setError(null);
    } catch {
      setError("Failed to load conversations");
    }
  }

  useEffect(() => {
    void loadConversations();
    // Visiting the conversations index counts as "seeing" any new tutor
    // activity — clear the navbar unread badge.
    void fetch(`${import.meta.env.BASE_URL}api/ai/chat/mark-read`, {
      method: "POST",
      credentials: "include",
    }).catch(() => { /* best-effort */ });
  }, []);

  // Debounced search. Skip queries shorter than 2 chars (matches server
  // contract — server short-circuits + returns []).
  const searchAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setCommitted("");
      setResults(null);
      return;
    }
    const t = setTimeout(() => setCommitted(trimmed), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!committed) return;
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    setSearching(true);
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/ai/chat/search?q=${encodeURIComponent(committed)}`,
          { credentials: "include", signal: ctrl.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { results: SearchResult[] };
        if (!ctrl.signal.aborted) setResults(data.results);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          // swallow — search is best-effort UX
        }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    })();
  }, [committed]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const url =
        pendingDelete.kind === "general"
          ? `${import.meta.env.BASE_URL}api/ai/chat/history?general=true`
          : `${import.meta.env.BASE_URL}api/ai/chat/history?projectId=${encodeURIComponent(pendingDelete.projectId)}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        setError(`Failed to delete (HTTP ${res.status})`);
        return;
      }
      // Optimistic-ish: drop the row locally, then refetch in background to
      // catch any drift (e.g. race with another tab).
      if (pendingDelete.kind === "project") {
        setItems(curr => curr ? curr.filter(c => c.projectId !== pendingDelete.projectId) : curr);
      }
      void loadConversations();
    } catch {
      setError("Failed to delete conversation");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const isSearching = committed.length >= 2;

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

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search across all your tutor conversations…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9 pr-9"
          maxLength={200}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive mb-4">
          {error}
        </div>
      )}

      {isSearching ? (
        <div className="space-y-3">
          {searching && results === null && (
            <div className="text-center py-8 text-muted-foreground text-sm">Searching…</div>
          )}
          {results !== null && results.length === 0 && !searching && (
            <div className="text-center py-12 space-y-2">
              <Search className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No matches for "{committed}"</p>
            </div>
          )}
          {results !== null && results.map(r => {
            const href = r.projectSlug ? `/projects/${r.projectSlug}` : "/tutor";
            const label = r.projectTitle ?? "General Tutor Chat";
            return (
              <Link
                key={r.id}
                href={href}
                className="block rounded-lg border border-border bg-card hover:bg-card/80 hover:border-blue-400/50 transition p-4 group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70 truncate">{label}</span>
                      <span>·</span>
                      <span>{r.role === "user" ? "You" : "Atlas"}</span>
                      <span>·</span>
                      <span>{formatRelative(r.createdAt)}</span>
                    </div>
                    {/* server returns sanitized text with <mark> tags only — safe to render */}
                    <p
                      className="text-sm text-foreground/90 [&_mark]:bg-yellow-400/30 [&_mark]:text-foreground [&_mark]:rounded [&_mark]:px-0.5 line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: r.snippet }}
                    />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : !items && !error ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Loading conversations…
        </div>
      ) : items && (
        <div className="space-y-3">
          <div className="relative group">
            <Link
              href="/tutor"
              className="block rounded-lg border border-blue-400/30 bg-blue-400/5 hover:bg-blue-400/10 hover:border-blue-400/50 transition p-4"
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
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDelete({ kind: "general" }); }}
              className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
              aria-label="Delete general chat history"
              title="Delete general chat history"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No project conversations yet — open any project and ask the tutor a question, or start a general chat above.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/courses">Browse projects</Link>
              </Button>
            </div>
          ) : items.map(c => (
            <div key={c.projectId} className="relative group">
              <Link
                href={`/projects/${c.projectSlug}`}
                className="block rounded-lg border border-border bg-card hover:bg-card/80 hover:border-blue-400/50 transition p-4 pr-12"
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
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPendingDelete({ kind: "project", projectId: c.projectId, projectTitle: c.projectTitle });
                }}
                className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
                aria-label={`Delete conversation for ${c.projectTitle}`}
                title="Delete conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={open => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "general"
                ? "This will permanently remove all messages from your general tutor chat. This cannot be undone."
                : `This will permanently remove every tutor message tied to "${pendingDelete?.kind === "project" ? pendingDelete.projectTitle : ""}". This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
