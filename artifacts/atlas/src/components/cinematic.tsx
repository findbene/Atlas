/**
 * Shared cinematic primitives:
 *  - <Reveal>      : fade+rise entrance once a section scrolls into view.
 *  - <Stagger>     : a parent that staggers its <Reveal> children.
 *  - <AuroraBg>    : animated soft-blur orbs background for hero / CTA.
 *  - <GlowButton>  : 3D-feel CTA with hover lift + glow.
 *
 * All built on framer-motion + the project's existing tailwind tokens.
 */
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { forwardRef, type ReactNode, type ComponentPropsWithoutRef } from "react";

const baseVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "h1" | "h2" | "p" | "li";
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, margin: "-80px" }}
      variants={baseVariants}
      transition={{ delay }}
    >
      {children}
    </Tag>
  );
}

export function Stagger({
  children,
  className,
  step = 0.08,
}: {
  children: ReactNode;
  className?: string;
  step?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: step } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Slow-floating gradient orbs. Pure CSS — no canvas, cheap on battery. */
export function AuroraBg({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <motion.div
        className="absolute -top-40 left-1/4 h-[34rem] w-[34rem] rounded-full bg-blue-500/25 blur-3xl"
        animate={{ y: [0, 24, 0], x: [0, -18, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-20 right-0 h-[28rem] w-[28rem] rounded-full bg-purple-500/20 blur-3xl"
        animate={{ y: [0, -22, 0], x: [0, 18, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-emerald-500/15 blur-3xl"
        animate={{ y: [0, -16, 0], x: [0, 14, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
    </div>
  );
}

type GlowButtonProps = ComponentPropsWithoutRef<"button"> & {
  children: ReactNode;
  variant?: "primary" | "ghost";
};

/**
 * 3D-feel CTA button. The hover lift + inset highlight gives it weight; the
 * blur halo behind it sells the "techy glow". `forwardRef` so it composes
 * with `asChild` patterns or framer-motion wrappers.
 */
export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  function GlowButton({ children, className = "", variant = "primary", ...props }, ref) {
    const isPrimary = variant === "primary";
    return (
      <button
        ref={ref}
        {...props}
        className={`relative group inline-flex items-center justify-center font-medium px-7 h-12 rounded-xl transition-all duration-300 active:translate-y-0 hover:-translate-y-0.5 ${
          isPrimary
            ? "text-white bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-[0_8px_30px_-8px_rgba(99,102,241,0.65)] hover:shadow-[0_12px_36px_-8px_rgba(99,102,241,0.85)]"
            : "text-foreground bg-card/60 border border-border backdrop-blur"
        } ${className}`}
      >
        {isPrimary && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-70"
          />
        )}
        {isPrimary && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-br from-blue-500/40 to-purple-500/40 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
        <span className="relative inline-flex items-center">{children}</span>
      </button>
    );
  },
);
