import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Lock, Clock, CheckCircle2, Sparkles, Award, Briefcase } from "lucide-react";
import { JobOutcomesPanel, type JobOutcomes } from "@/components/JobOutcomesPanel";

type Project = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  tier: string;
  xpReward: number;
  estimatedHours: number;
  stepCount: number;
  tags: string[];
  position: number;
  jobOutcomes?: JobOutcomes;
};

type RoadmapViewProps = {
  projects: Project[];
};

type PhaseMeta = {
  phaseNumber: number;
  title: string;
  subtitle: string;
  color: string;
  ring: string;
  bg: string;
  nodeBg: string;
};

const PHASE_META: Record<string, PhaseMeta> = {
  beginner: {
    phaseNumber: 1,
    title: "Foundations",
    subtitle: "Master the core building blocks of data pipelines",
    color: "text-emerald-300",
    ring: "ring-emerald-500/40",
    bg: "from-emerald-500/[0.04] to-transparent",
    nodeBg: "bg-emerald-500 shadow-emerald-500/40",
  },
  intermediate: {
    phaseNumber: 2,
    title: "Pipelines",
    subtitle: "Build production-grade orchestration & warehousing systems",
    color: "text-blue-300",
    ring: "ring-blue-500/40",
    bg: "from-blue-500/[0.04] to-transparent",
    nodeBg: "bg-blue-500 shadow-blue-500/40",
  },
  advanced: {
    phaseNumber: 3,
    title: "Production",
    subtitle: "Architect distributed, real-time, fault-tolerant data platforms",
    color: "text-orange-300",
    ring: "ring-orange-500/40",
    bg: "from-orange-500/[0.04] to-transparent",
    nodeBg: "bg-orange-500 shadow-orange-500/40",
  },
};

// Responsive column counts: 2 on mobile, 3 on tablet, 5 on desktop
const COLS_DESKTOP = 5;
const COLS_TABLET = 3;
const COLS_MOBILE = 2;

function useResponsiveCols(): number {
  const [cols, setCols] = useState<number>(() => {
    if (typeof window === "undefined") return COLS_DESKTOP;
    if (window.innerWidth < 640) return COLS_MOBILE;
    if (window.innerWidth < 1024) return COLS_TABLET;
    return COLS_DESKTOP;
  });

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setCols(COLS_MOBILE);
      else if (window.innerWidth < 1024) setCols(COLS_TABLET);
      else setCols(COLS_DESKTOP);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return cols;
}

function PhaseSection({
  phaseKey,
  projects,
}: {
  phaseKey: string;
  projects: Project[];
}) {
  const meta = PHASE_META[phaseKey] ?? PHASE_META.beginner;
  const cols = useResponsiveCols();
  if (projects.length === 0) return null;

  const totalXp = projects.reduce((sum, p) => sum + p.xpReward, 0);
  const totalHours = projects.reduce((sum, p) => sum + p.estimatedHours, 0);

  // Arrange projects in serpentine rows (snake pattern)
  const rows: Project[][] = [];
  for (let i = 0; i < projects.length; i += cols) {
    const slice = projects.slice(i, i + cols);
    const rowIndex = i / cols;
    rows.push(rowIndex % 2 === 0 ? slice : [...slice].reverse());
  }

  return (
    <section className={`relative rounded-2xl border border-border bg-gradient-to-b ${meta.bg} p-6 md:p-8 mb-8`}>
      <header className="mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className={`text-xs uppercase tracking-widest font-semibold ${meta.color} mb-1`}>
            Phase {meta.phaseNumber}
          </p>
          <h3 className="text-2xl font-bold text-foreground">{meta.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{meta.subtitle}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-amber-400">{totalXp.toLocaleString()}</span> XP
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono">~{totalHours}h</span>
          </span>
          <span className="font-mono">{projects.length} projects</span>
        </div>
      </header>

      <div className="space-y-1">
        {rows.map((row, rowIdx) => {
          const goingRight = rowIdx % 2 === 0;
          // For reversed (right-to-left) partial rows, right-align items so the
          // snake path stays connected to the J-curve coming down on the right.
          const offset = goingRight ? 0 : cols - row.length;
          return (
            <div key={rowIdx} className="relative">
              <div
                className="grid gap-3 md:gap-4"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: cols }).map((_, colIdx) => {
                  const idx = colIdx - offset;
                  const project = idx >= 0 && idx < row.length ? row[idx] : null;
                  if (!project) return <div key={colIdx} />;

                  // Show arrow to next sibling only if both cells have an item
                  const nextIdx = idx + 1;
                  const showRightArrow = nextIdx < row.length;

                  return (
                    <div key={project.id} className="relative">
                      <ProjectNode project={project} meta={meta} />
                      {/* Horizontal connector to next node in row */}
                      {showRightArrow && (
                        <div className="hidden md:block absolute top-7 left-full w-3 md:w-4 h-px bg-border z-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Vertical connector to next row (J-curve) */}
              {rowIdx < rows.length - 1 && (
                <div className="relative h-10 md:h-12 my-2">
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                  >
                    {goingRight ? (
                      // Curve from bottom-right corner down to next row's right side
                      <path
                        d="M 90 0 Q 98 0 98 8 L 98 32 Q 98 40 90 40"
                        fill="none"
                        stroke="hsl(var(--border))"
                        strokeWidth="0.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : (
                      // Curve from bottom-left corner down to next row's left side
                      <path
                        d="M 10 0 Q 2 0 2 8 L 2 32 Q 2 40 10 40"
                        fill="none"
                        stroke="hsl(var(--border))"
                        strokeWidth="0.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProjectNode({
  project,
  meta,
}: {
  project: Project;
  meta: (typeof PHASE_META)[string];
}) {
  const isPro = project.tier === "pro";
  const roles = project.jobOutcomes?.roles ?? [];
  const topRole = roles[0];

  return (
    <div className="group relative bg-card hover:bg-card/80 border border-border hover:border-primary/40 rounded-xl p-3 md:p-4 transition-all h-full flex flex-col">
      <Link to={`/projects/${project.slug}`}>
        <div className="cursor-pointer">
          {/* Number badge */}
          <div className="flex items-center justify-between mb-2">
            <div
              className={`relative h-8 w-8 md:h-10 md:w-10 rounded-full ${meta.nodeBg} flex items-center justify-center text-white text-xs md:text-sm font-bold shadow-lg ring-2 ring-offset-2 ring-offset-background ${meta.ring} z-10`}
            >
              {project.position}
            </div>
            {isPro ? (
              <div className="text-amber-400/80" title="Pro">
                <Lock className="w-3 h-3" />
              </div>
            ) : (
              <div className="text-emerald-400/60" title="Free">
                <CheckCircle2 className="w-3 h-3" />
              </div>
            )}
          </div>

          <h4 className="text-xs md:text-sm font-semibold text-foreground line-clamp-2 leading-tight mb-1.5 group-hover:text-primary transition-colors min-h-[2.5em]">
            {project.title}
          </h4>

          {topRole && (
            <p
              className="flex items-center gap-1 text-[10px] md:text-[11px] text-blue-300/80 line-clamp-1 mb-2"
              title={`Career roles: ${roles.join(", ")}`}
            >
              <Briefcase className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{topRole}</span>
            </p>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground mt-auto">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {project.estimatedHours}h
        </span>
        <div className="flex items-center gap-2">
          {project.jobOutcomes && (
            <JobOutcomesPanel
              title={project.title}
              jobOutcomes={project.jobOutcomes}
              trigger={
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 text-amber-300/90 hover:text-amber-200 transition-colors"
                  title="Career impact"
                  data-testid={`roadmap-career-${project.slug}`}
                >
                  <Award className="w-3 h-3" />
                </button>
              }
            />
          )}
          <span className="text-amber-400 font-mono">+{project.xpReward}</span>
        </div>
      </div>
    </div>
  );
}

export function RoadmapView({ projects }: RoadmapViewProps) {
  // Order by position, then split by difficulty preserving order
  const sorted = [...projects].sort((a, b) => a.position - b.position);

  const phases: Record<string, Project[]> = {
    beginner: [],
    intermediate: [],
    advanced: [],
  };
  for (const p of sorted) {
    const key = phases[p.difficulty] ? p.difficulty : "intermediate";
    phases[key].push(p);
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">
          No projects available yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div>
      <PhaseSection phaseKey="beginner" projects={phases.beginner} />
      <PhaseSection phaseKey="intermediate" projects={phases.intermediate} />
      <PhaseSection phaseKey="advanced" projects={phases.advanced} />
    </div>
  );
}
