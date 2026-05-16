import { useEffect, useRef, useState } from "react";
import { Bot, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AiMessage { role: "user" | "assistant"; content: string; }

export interface AiTutorPanelProps {
  /** When null/undefined, the panel runs as a general (non-project) chat. */
  projectId?: string | null;
  stepId?: string | null;
  currentCode?: string;
  /** UI tweaks for embedding contexts. */
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
  className?: string;
}

export function AiTutorPanel({
  projectId,
  stepId,
  currentCode,
  emptyStateTitle = "Ask me anything about this project.",
  emptyStateSubtitle = "I'll guide you without giving away the answer.",
  className = "bg-card/50 border-l border-border",
}: AiTutorPanelProps) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const isGeneral = !projectId;

  // Opening the tutor panel counts as "seeing" any pending tutor activity —
  // clear the navbar's unread badge. Best-effort, fire once per mount.
  useEffect(() => {
    void fetch(`${import.meta.env.BASE_URL}api/ai/chat/mark-read`, {
      method: "POST",
      credentials: "include",
    }).catch(() => { /* best-effort */ });
  }, []);

  // Build the history-fetch URL — projectId-scoped, or ?general=true for the
  // standalone (non-project) thread, so general chat doesn't mix with project chats.
  const historyQuery = isGeneral
    ? `general=true`
    : `projectId=${encodeURIComponent(projectId!)}`;

  useEffect(() => {
    let cancelled = false;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsStreaming(false);
    setHistoryLoaded(false);
    setMessages([]);
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/ai/chat/history?${historyQuery}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{ role: string; content: string }>;
        if (cancelled) return;
        setMessages(
          rows
            .filter(r => r.role === "user" || r.role === "assistant")
            .map(r => ({ role: r.role as "user" | "assistant", content: r.content })),
        );
      } catch {
        /* best-effort */
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [historyQuery]);

  async function clearHistory() {
    if (isStreaming) return;
    if (!window.confirm("Clear this tutor conversation? This cannot be undone.")) return;
    try {
      await fetch(
        `${import.meta.env.BASE_URL}api/ai/chat/history?${historyQuery}`,
        { method: "DELETE", credentials: "include" },
      );
      setMessages([]);
    } catch {
      /* no-op */
    }
  }

  async function sendMessage() {
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);
    let assistantContent = "";
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    streamAbortRef.current = controller;
    const body = isGeneral
      ? { message: userMsg, contextType: "general" }
      : { message: userMsg, contextType: "project", contextId: projectId, stepId, currentCode };

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        assistantContent = `Sorry — the AI tutor is unavailable right now (HTTP ${res.status}).`;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantContent };
          return updated;
        });
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              assistantContent += parsed.content ?? "";
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            } catch {}
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        setMessages(prev => prev.slice(0, -1));
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "Sorry — couldn't reach the AI tutor. Check your connection and try again." };
          return updated;
        });
      }
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      setIsStreaming(false);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Bot className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-medium">Atlas AI</span>
        <span className="text-xs text-muted-foreground ml-auto">Claude-powered</span>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={clearHistory}
            disabled={isStreaming}
            title="Clear conversation"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        {!historyLoaded ? (
          <div className="text-center py-8 text-muted-foreground text-xs">Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
            <Bot className="h-8 w-8 mx-auto opacity-50" />
            <p>{emptyStateTitle}</p>
            <p className="text-xs">{emptyStateSubtitle}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`${msg.role === "user" ? "ml-4" : "mr-4"}`}>
                <div className={`rounded-lg p-3 text-sm ${msg.role === "user" ? "bg-primary/10 text-foreground ml-auto" : "bg-muted text-foreground"}`}>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content || "..."}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="p-3 border-t border-border flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask a question..."
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          disabled={isStreaming}
        />
        <Button size="sm" onClick={sendMessage} disabled={isStreaming || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
