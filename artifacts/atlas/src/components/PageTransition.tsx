import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";

/**
 * Lightweight page transition: re-triggers a CSS fade-in on every
 * route change. Avoids AnimatePresence to stay compatible with the
 * Clerk <Show> + <Redirect> nesting in App.tsx (which would not
 * cooperate with framer-motion's exit phase).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("page-fade-in");
    // force reflow so the animation restarts
    void el.offsetWidth;
    el.classList.add("page-fade-in");
  }, [location]);

  return (
    <div ref={ref} className="page-fade-in flex flex-col flex-1">
      {children}
    </div>
  );
}
