import { useEffect, useRef, useState } from "react";
import { Bot, Send, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AiMessage { role: "user" | "assistant"; content: string; }

export interface AiTutorPanelProps {
  projectId?: string | null;
  stepId?: string | null;
  currentCode?: string;
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
  className?: string;
  /**
   * When this string changes to a non-empty value, the panel prefills the
   * input box with it (does NOT auto-send — the user must click Send so they
   * can edit the prompt first). The component uses a ref to track the last
   * applied value so re-renders with the same string don't overwrite user
   * edits.
   */
  seedInput?: string;
}

// Small three-dot typing indicator used while the model is "thinking" but
// before any tokens have streamed in. Better than rendering "..." inside the
// markdown view, which looks like the model literally typed an ellipsis.
function TypingDots() {
  return (
    <div className="flex items-center gap-1 h-5" aria-label="Assistant is typing">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-pulse [animation-delay:-0.2s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-pulse [animation-delay:-0.1s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-pulse" />
    </div>
  );
}

export function AiTutorPanel({
  projectId,
  stepId,
  currentCode,
  emptyStateTitle = "Ask me anything about this project.",
  emptyStateSubtitle = "I'll guide you without giving away the answer.",
  className = "bg-card/50 border-l border-border",
  seedInput,
}: AiTutorPanelProps) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const lastSeedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (seedInput && seedInput !== lastSeedRef.current) {
      lastSeedRef.current = seedInput;
      setInput(seedInput);
    }
  }, [seedInput]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // We only auto-scroll the chat to the bottom when the user is *already*
  // near the bottom. This prevents the panel from yanking the user back down
  // while they're scrolled up reading earlier messages.
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const streamAbortRef = useRef<AbortController | null>(null);

  const isGeneral = !projectId;

  useEffect(() => {
    void fetch(`${import.meta.env.BASE_URL}api/ai/chat/mark-read`, {
      method: "POST",
      credentials: "include",
    }).catch(() => { /* best-effort */ });
  }, []);

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
    setConfirmClear(false);
    if (isStreaming) return;
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

  function stopStreaming() {
    streamAbortRef.current?.abort();
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
            } catch { /* ignore malformed SSE chunks */ }
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        // User stopped the stream — drop the trailing assistant placeholder
        // entirely if it's empty, otherwise keep what streamed so far.
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.content === "") return prev.slice(0, -1);
          return prev;
        });
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

  // Track whether the user is "near the bottom" of the scroll viewport. Used
  // by the auto-scroll effect below to avoid yanking the user back down.
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useEffect(() => {
    if (!isNearBottomRef.current) return;
    scrollViewportRef.current?.scrollTo({
      top: scrollViewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
        <Bot className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-medium">Atlas AI</span>
        <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">Claude-powered</span>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setConfirmClear(true)}
            disabled={isStreaming}
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
      <div
        className="flex-1 min-h-0 overflow-y-auto p-3"
        ref={scrollViewportRef}
        onScroll={handleScroll}
      >
        {!historyLoaded ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={`h-16 rounded-lg bg-muted/40 animate-pulse ${i % 2 === 0 ? "mr-6" : "ml-6"}`}
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
            <Bot className="h-8 w-8 mx-auto opacity-50" />
            <p>{emptyStateTitle}</p>
            <p className="text-xs">{emptyStateSubtitle}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => {
              const isStreamingPlaceholder =
                isStreaming
                && i === messages.length - 1
                && msg.role === "assistant"
                && msg.content === "";
              return (
                <div key={i} className={`${msg.role === "user" ? "ml-4" : "mr-4"}`}>
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary/10 text-foreground ml-auto"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {isStreamingPlaceholder ? (
                      <TypingDots />
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content || " "}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <form
        className="p-3 border-t border-border flex gap-2 shrink-0"
        onSubmit={e => { e.preventDefault(); void sendMessage(); }}
      >
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={isStreaming ? "Streaming response…" : "Ask a question…"}
          className="flex-1 h-9 text-sm"
          disabled={isStreaming}
          aria-label="Message"
        />
        {isStreaming ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={stopStreaming}
            aria-label="Stop streaming"
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!input.trim()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              The full chat history for this {isGeneral ? "general chat" : "project"} will be permanently deleted.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void clearHistory()}>Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
