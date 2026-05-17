import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "atlas.installPrompt.dismissedAt.v1";
const SUPPRESS_DAYS = 14;

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed — don't pester.
    const mq = window.matchMedia?.("(display-mode: standalone)");
    if (mq?.matches) return;

    // Recently dismissed?
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (raw) {
        const ts = Number(raw);
        if (!Number.isNaN(ts) && Date.now() - ts < SUPPRESS_DAYS * 86400_000) {
          return;
        }
      }
    } catch {/* ignore */}

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {/* ignore */}
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
      dismiss();
    }
  }

  if (!visible || !evt) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Atlas"
      data-testid="install-prompt"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-border bg-card/95 backdrop-blur p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Atlas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add Atlas to your home screen for a faster, offline-ready experience.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={install} data-testid="install-prompt-install">
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
