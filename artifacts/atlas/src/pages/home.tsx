import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Code2,
  Database,
  Terminal,
  Zap,
  Sparkles,
  Bot,
  Trophy,
  Users,
  CheckCircle2,
  Rocket,
  Briefcase,
  TrendingUp,
  Award,
  PlayCircle,
  GitBranch,
  BarChart3,
  Star,
  Brain,
  Cpu,
  Wrench,
  LineChart,
  Cloud,
  type LucideIcon,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { useListCourses } from "@workspace/api-client-react";
import { Reveal, Stagger, AuroraBg, GlowButton } from "@/components/cinematic";
import { CountUp } from "@/components/CountUp";

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  Database,
  Brain,
  BarChart: LineChart,
  BarChart3: LineChart,
  Cpu,
  Cloud,
  Code2,
  Terminal,
};

export default function Home() {
  const { isSignedIn } = useUser();
  const { data: courses } = useListCourses();
  const primaryHref = isSignedIn ? "/dashboard" : "/sign-up";
  const primaryLabel = isSignedIn ? "Go to Dashboard" : "Start Building Free";
  const footerLabel = isSignedIn ? "Open Your Dashboard" : "Create Your Free Account";

  return (
    <div className="flex flex-col min-h-[100dvh] overflow-hidden">
      {/* 1. Hero --------------------------------------------------------- */}
      <section className="relative px-6 pt-24 pb-28 md:pt-32 md:pb-36 overflow-hidden">
        <AuroraBg />
        <div
          className="absolute inset-0 -z-10 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            color: "var(--color-foreground)",
          }}
        />
        <div className="container max-w-5xl mx-auto text-center space-y-8 relative">
          <Reveal>
            <Badge
              variant="outline"
              className="mx-auto inline-flex items-center gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-300 backdrop-blur"
            >
              <Sparkles className="h-3 w-3" />
              Built for the 2026+ AI-native job market
            </Badge>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance leading-[1.05]">
              Stop watching tutorials.
              <br />
              <span className="hero-shimmer inline-block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 animate-gradient">
                Start shipping systems.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Atlas is the project-first technical learning platform for ambitious engineers.
              Master Data Engineering, AI, MLOps, and Data Science by building real systems in a
              professional browser-based IDE — with an AI tutor in your corner.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link href={primaryHref} data-testid="hero-primary-cta">
                <GlowButton>
                  {primaryLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </GlowButton>
              </Link>
              <Link href="/courses">
                <GlowButton variant="ghost">
                  <PlayCircle className="mr-2 h-4 w-4" /> Explore Projects
                </GlowButton>
              </Link>
            </div>
          </Reveal>

          {!isSignedIn && (
            <Reveal delay={0.26}>
              <p className="text-xs text-muted-foreground pt-1">
                Free forever for the first 5 projects · No credit card
              </p>
            </Reveal>
          )}

          {/* Social proof bar */}
          <Stagger className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { kind: "num" as const, to: 40, suffix: "+", label: "Hands-on projects" },
              { kind: "num" as const, to: 9, suffix: "", label: "Atlas courses" },
              { kind: "text" as const, value: "AI", label: "Tutor on every step" },
              { kind: "num" as const, to: 0, suffix: "", label: "Local setup needed" },
            ].map((s) => (
              <Reveal key={s.label}>
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {s.kind === "num" ? (
                      <CountUp to={s.to} suffix={s.suffix} />
                    ) : (
                      s.value
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 2. Why Atlas ---------------------------------------------------- */}
      <section className="py-20 border-t border-border/50 bg-gradient-to-b from-background to-muted/20">
        <div className="container max-w-6xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-12 max-w-2xl mx-auto">
              <Badge variant="outline" className="mb-4 border-purple-500/30 bg-purple-500/10 text-purple-300">
                <TrendingUp className="h-3 w-3 mr-1" /> Why Atlas
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                The skills tutorials never teach you.
              </h2>
              <p className="text-muted-foreground">
                Recruiters don't hire people who watched a course. They hire people who can ship.
                Atlas projects map 1:1 to the work you'll do on day one of a real engineering team.
              </p>
            </div>
          </Reveal>

          <Stagger className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Briefcase className="h-5 w-5" />,
                title: "Resume bullets that pass screens",
                body: "Every project ships with the exact bullets, skills, and metrics to put on your resume.",
                accent: "from-blue-500/25 to-blue-500/0",
                color: "text-blue-400 bg-blue-500/10",
              },
              {
                icon: <Bot className="h-5 w-5" />,
                title: "AI tutor that knows your code",
                body: "Stuck? An always-on AI tutor sees your codebase, your error, and your goal — and explains.",
                accent: "from-purple-500/25 to-purple-500/0",
                color: "text-purple-400 bg-purple-500/10",
              },
              {
                icon: <Trophy className="h-5 w-5" />,
                title: "XP, streaks, and certificates",
                body: "Stay accountable with a streak system. Earn shareable certificates as you finish projects.",
                accent: "from-emerald-500/25 to-emerald-500/0",
                color: "text-emerald-400 bg-emerald-500/10",
              },
            ].map((c) => (
              <Reveal key={c.title}>
                <div className="glass-card hover-lift group relative overflow-hidden rounded-2xl p-6 h-full">
                  <div
                    className={`pointer-events-none absolute -top-20 -right-20 h-44 w-44 rounded-full bg-gradient-to-br ${c.accent} blur-3xl`}
                  />
                  <div
                    className={`relative h-11 w-11 rounded-xl flex items-center justify-center mb-4 ${c.color}`}
                  >
                    {c.icon}
                  </div>
                  <h3 className="relative text-lg font-semibold mb-1.5">{c.title}</h3>
                  <p className="relative text-sm text-muted-foreground leading-relaxed">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 3. Domain showcase --------------------------------------------- */}
      <section className="py-20 border-t border-border/50">
        <div className="container max-w-6xl mx-auto px-6">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
              <div>
                <Badge variant="outline" className="mb-3 border-blue-500/30 bg-blue-500/10 text-blue-300">
                  <GitBranch className="h-3 w-3 mr-1" /> Learning paths
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Pick a course. Build the portfolio.
                </h2>
                <p className="text-muted-foreground mt-2 max-w-xl">
                  Atlas is 9 courses of progressively harder, production-grade projects.
                </p>
              </div>
              <Button asChild variant="ghost" className="self-start md:self-auto">
                <Link href="/courses">
                  See all courses <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>

          <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(courses ?? []).slice(0, 6).map((d) => {
              const isComingSoon = d.status === "coming_soon" || (d.projectCount ?? 0) === 0;
              const Icon = DOMAIN_ICONS[d.icon] ?? Wrench;
              return (
                <Reveal key={d.slug}>
                  <Link href={`/courses/${d.slug}`}>
                    <div className="glass-card hover-lift group relative overflow-hidden rounded-xl p-5 cursor-pointer h-full">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex items-start justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${d.color ?? "#3B82F6"}33, ${d.color ?? "#3B82F6"}10)`,
                              color: d.color ?? "#3B82F6",
                            }}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-base truncate">{d.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isComingSoon ? "Coming soon" : `${d.projectCount} projects`}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                      </div>
                      <p className="relative text-sm text-muted-foreground mt-3 line-clamp-2">
                        {d.description}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
            {(courses ?? []).length === 0 &&
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-5 h-32 animate-pulse"
                />
              ))}
          </Stagger>
        </div>
      </section>

      {/* 4. How it works ------------------------------------------------- */}
      <section className="py-20 border-t border-border/50 bg-muted/20 relative overflow-hidden">
        <AuroraBg className="opacity-50" />
        <div className="container max-w-5xl mx-auto px-6 relative">
          <Reveal>
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-3 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <Rocket className="h-3 w-3 mr-1" /> How Atlas works
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                From zero to portfolio in three moves
              </h2>
            </div>
          </Reveal>
          <Stagger className="grid md:grid-cols-3 gap-6 relative">
            {[
              {
                step: "01",
                title: "Pick a real project",
                body: "Choose from 40+ industry projects: streaming pipelines, ML platforms, data warehouses.",
                icon: <Database className="h-5 w-5" />,
              },
              {
                step: "02",
                title: "Build step-by-step",
                body: "Write Python and SQL in a real IDE. Get instant feedback. Lean on the AI tutor when you're stuck.",
                icon: <Terminal className="h-5 w-5" />,
              },
              {
                step: "03",
                title: "Earn the record",
                body: "Finish the project, earn XP and an evidence-backed completion certificate, and walk away with resume bullets recruiters care about.",
                icon: <Award className="h-5 w-5" />,
              },
            ].map((s) => (
              <Reveal key={s.step}>
                <div className="glass-card hover-lift relative rounded-xl p-6 h-full">
                  <div className="text-xs font-bold tracking-widest text-muted-foreground/70">
                    STEP {s.step}
                  </div>
                  <div className="mt-3 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    {s.icon}
                  </div>
                  <h3 className="mt-4 font-semibold text-lg">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 5. Role outcomes ----------------------------------------------- */}
      <section className="py-20 border-t border-border/50">
        <div className="container max-w-6xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-12 max-w-2xl mx-auto">
              <Badge variant="outline" className="mb-3 border-amber-500/30 bg-amber-500/10 text-amber-300">
                <BarChart3 className="h-3 w-3 mr-1" /> Career outcomes
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Roles you'll be ready for
              </h2>
              <p className="text-muted-foreground mt-3">
                Every project tells you exactly which roles it qualifies you for, with the resume bullets to back it up.
              </p>
            </div>
          </Reveal>
          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: "Data Engineer", salary: "$120k–$180k", match: "Streaming + warehouse projects" },
              { role: "Analytics Engineer", salary: "$110k–$160k", match: "dbt + modeling projects" },
              { role: "ML Platform Engineer", salary: "$140k–$220k", match: "MLOps + feature store projects" },
              { role: "AI Engineer", salary: "$150k–$240k", match: "RAG + agent projects" },
            ].map((r) => (
              <Reveal key={r.role}>
                <div className="glass-card hover-lift rounded-xl p-5 h-full">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> READY FOR
                  </div>
                  <h3 className="font-semibold text-base">{r.role}</h3>
                  <p className="text-sm text-amber-300 mt-1 tabular-nums">{r.salary}</p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{r.match}</p>
                </div>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 6. Testimonials ------------------------------------------------- */}
      <section className="py-20 border-t border-border/50 bg-muted/20">
        <div className="container max-w-6xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-3 border-purple-500/30 bg-purple-500/10 text-purple-300">
                <Users className="h-3 w-3 mr-1" /> Loved by builders
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Engineers using Atlas to break in
              </h2>
            </div>
          </Reveal>
          <Stagger className="grid md:grid-cols-3 gap-5">
            {[
              {
                quote:
                  "I spent 6 months on YouTube and learned nothing usable. Two Atlas projects later I had bullets I could actually defend in interviews.",
                name: "Priya N.",
                role: "Data Engineer @ fintech",
              },
              {
                quote:
                  "The AI tutor is the unfair advantage. It's like having a senior on call who actually knows your codebase.",
                name: "Marcus J.",
                role: "MLOps Engineer",
              },
              {
                quote:
                  "Finally a platform that treats me like an engineer, not a student. The IDE is buttery smooth.",
                name: "Sofia R.",
                role: "Analytics Engineer @ SaaS",
              },
            ].map((t) => (
              <Reveal key={t.name}>
                <div className="glass-card hover-lift rounded-xl p-6 flex flex-col h-full">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed flex-1">
                    "{t.quote}"
                  </p>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 7. Pricing teaser ---------------------------------------------- */}
      <section className="py-20 border-t border-border/50">
        <div className="container max-w-4xl mx-auto px-6">
          <Reveal>
            <div className="glass-card rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
              <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />
              <div className="relative">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 mb-4">
                  Most popular
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Start free. Go Pro when you're hooked.
                </h2>
                <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
                  Free forever for your first 5 projects. Pro unlocks all 40+ projects, unlimited
                  AI tutor messages, and certificates.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7">
                  <Link href={primaryHref}>
                    <GlowButton>{primaryLabel}</GlowButton>
                  </Link>
                  <Link href="/upgrade">
                    <GlowButton variant="ghost">See Pro pricing</GlowButton>
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 8. Final CTA --------------------------------------------------- */}
      <section className="py-24 border-t border-border bg-gradient-to-b from-muted/20 to-background relative overflow-hidden">
        <AuroraBg className="opacity-60" />
        <div className="container max-w-4xl mx-auto text-center space-y-6 px-6 relative">
          <Reveal>
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/30">
              <Zap className="h-7 w-7 text-white" />
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Your portfolio doesn't build itself.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Join thousands of engineers shipping real systems on Atlas. Your next role starts
              with your next commit.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="pt-4">
              <Link href={primaryHref}>
                <GlowButton>
                  {footerLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </GlowButton>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 bg-muted/10">
        <div className="container max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Code2 className="h-4 w-4" />
            <span className="font-semibold text-foreground">Atlas</span>
            <span>· Build the systems. Earn the role.</span>
          </div>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <Link href="/courses" className="hover:text-foreground">Courses</Link>
            <Link href="/upgrade" className="hover:text-foreground">Pricing</Link>
            <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
            <Link href="/how-atlas-grades" className="hover:text-foreground">How grading works</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
