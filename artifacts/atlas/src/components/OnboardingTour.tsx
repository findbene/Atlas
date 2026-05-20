/**
 * Lightweight first-run onboarding. Triggered for signed-in users that
 * haven't seen the tour yet (per-user key in localStorage). Built with a
 * single fixed overlay + framer-motion entrance — no external joyride
 * dependency. Skippable, dismissible, and replayable from settings.
 */
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { ChevronRight, X, Rocket, Bot, BarChart3, Trophy } from "lucide-react";
import { Link } from "wouter";

type Step = {
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  cta?: { label: string; href: string };
};

const STEPS: Step[] = [
  {
    icon: Rocket,
    title: "Welcome to Atlas",
    body: "You're about to learn Data, AI, and MLOps by shipping real systems — not by watching another tutorial. The next 60 seconds will show you around.",
  },
  {
    icon: BarChart3,
    title: "Your dashboard is mission control",
    body: "Track XP, streaks, and projects in flight. The streak heatmap rewards daily practice — even one commit counts.",
    cta: { label: "Open Dashboard", href: "/dashboard" },
  },
  {
    icon: Bot,
    title: "An AI tutor on every step",
    body: "Every project step has a tutor that sees your code, your error, and your goal. Send it your run output with one click.",
    cta: { label: "Browse Projects", href: "/courses/data-engineering" },
  },
  {
    icon: Trophy,
    title: "Earn proof, not just progress",
    body: "Finish a project and earn a shareable certificate. Pro unlocks all 40+ projects and unlimited tutor messages.",
    cta: { label: "See Pricing", href: "/pricing" },
  },
];

function storageKey(userId: string | null | undefined) {
  return userId ? `atlas-onboarding-done:${userId}` : "atlas-onboarding-done";
}

export function OnboardingTour() {
  const { isSignedIn, userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;
    // Tiny delay so the first paint feels stable before the modal arrives.
    const t = setTimeout(() => {
      const done = localStorage.getItem(storageKey(userId));
      if (!done) setOpen(true);
    }, 800);
    return () => clearTimeout(t);
  }, [isSignedIn, userId]);

  function finish() {
    try {
      localStorage.setItem(storageKey(userId), "1");
    } catch {
      /* private mode */
    }
    setOpen(false);
    setStep(0);
  }

  if (!open) return null;
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = s.icon;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={finish}
        data-testid="onboarding-overlay"
      >
        <motion.div
          className="glass-card relative w-full max-w-md p-7 rounded-2xl"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={finish}
            className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
            aria-label="Close onboarding"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/20 border border-border flex items-center justify-center mb-4">
            <Icon className="h-6 w-6 text-blue-300" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">{s.title}</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.body}</p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-blue-400" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={finish}
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {s.cta && (
                <Button asChild variant="outline" size="sm" onClick={finish}>
                  <Link href={s.cta.href}>{s.cta.label}</Link>
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => (isLast ? finish() : setStep(step + 1))}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                {isLast ? "Get started" : "Next"}
                {!isLast && <ChevronRight className="ml-1 h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
