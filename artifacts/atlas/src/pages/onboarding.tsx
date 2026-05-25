/**
 * Phase 21 — 3-step onboarding flow.
 *
 *   1. Pick a course (defaults to data-engineering; learner can override).
 *   2. Review the rule-based "Start Here" project for that course.
 *   3. Enroll → mark onboarding complete → land on /projects/:slug.
 *
 * The screen is purely a wrapper around existing endpoints — it does NOT
 * own any onboarding state machine of its own. Server is source of truth
 * via `GET /api/onboarding/state`; if a learner is already completed they
 * bounce to /dashboard immediately so the flow is non-blocking on repeat
 * visits.
 *
 * Honest fallback: if the picked course has no beginner project, we still
 * show the deterministic Most-Approachable pick (kind=most_approachable)
 * with truthful copy rather than re-labelling an advanced project.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetOnboardingState,
  useCompleteOnboarding,
  useCreateEnrollment,
  useGetCourse,
  useListCourses,
  type CourseDetail,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { ArrowLeft, ArrowRight, Check, Compass, Loader2, Sparkles } from "lucide-react";

const DEFAULT_COURSE_SLUG = "data-engineering";

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { data: state, isLoading: stateLoading } = useGetOnboardingState();
  const { data: courses, isLoading: coursesLoading } = useListCourses();
  const [step, setStep] = useState<Step>(1);
  const [courseSlug, setCourseSlug] = useState<string>(DEFAULT_COURSE_SLUG);
  // Phase 21: useGetCourse signature requires the slug typed as the literal
  // course union; the constant is a known course, so the cast is safe.
  const { data: course, isLoading: courseLoading } = useGetCourse(
    courseSlug as Parameters<typeof useGetCourse>[0],
  );
  const enroll = useCreateEnrollment();
  const complete = useCompleteOnboarding();

  // Already-completed users skip the flow entirely. Server is source of
  // truth; no client-side localStorage fallback.
  useEffect(() => {
    if (state?.completed) {
      navigate("/dashboard");
    }
  }, [state?.completed, navigate]);

  if (stateLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-16 px-6">
        <Skeleton className="h-8 w-1/2 mb-4" />
        <Skeleton className="h-4 w-2/3 mb-12" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const onEnrollAndFinish = () => {
    const targetSlug = course?.startHere?.project.slug;
    if (!targetSlug) return;
    enroll.mutate(
      { data: { projectSlug: targetSlug } },
      {
        onSettled: () => {
          // Mark onboarding complete regardless of enroll success — the
          // user has at least picked a course; we don't want them stuck
          // in the flow on a transient failure. If enroll failed they'll
          // land on the project page and can retry the "Start" CTA.
          complete.mutate(undefined, {
            onSettled: () => navigate(`/projects/${targetSlug}`),
          });
        },
      },
    );
  };

  return (
    <div className="container max-w-3xl mx-auto py-12 px-6" data-testid="onboarding-page">
      <StepHeader step={step} />

      {step === 1 && (
        <PickCourseStep
          courses={courses ?? []}
          isLoading={coursesLoading}
          value={courseSlug}
          onChange={setCourseSlug}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <ReviewStartHereStep
          isLoading={courseLoading}
          course={course}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <FinishStep
          course={course}
          onBack={() => setStep(2)}
          onFinish={onEnrollAndFinish}
          isFinishing={enroll.isPending || complete.isPending}
        />
      )}
    </div>
  );
}

function StepHeader({ step }: { step: Step }) {
  const steps = [
    { n: 1 as Step, label: "Pick a course" },
    { n: 2 as Step, label: "Preview Start Here" },
    { n: 3 as Step, label: "Begin learning" },
  ];
  return (
    <div className="mb-10">
      <h1 className="text-3xl font-bold mb-2">Welcome to Atlas</h1>
      <p className="text-muted-foreground mb-6">
        Three quick steps and you're in your first project.
      </p>
      <ol className="flex items-center gap-3 text-sm" data-testid="onboarding-steps">
        {steps.map((s, i) => {
          const isActive = s.n === step;
          const isDone = s.n < step;
          return (
            <li key={s.n} className="flex items-center gap-3">
              <div
                className={
                  "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold " +
                  (isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground")
                }
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span className={isActive ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
              {i < steps.length - 1 && <span className="text-muted-foreground">›</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type CourseListItem = { slug: string; name: string; description: string };

function PickCourseStep({
  courses,
  isLoading,
  value,
  onChange,
  onNext,
}: {
  courses: CourseListItem[];
  isLoading: boolean;
  value: string;
  onChange: (slug: string) => void;
  onNext: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-6">
        <h2 className="text-xl font-semibold mb-2">Which course fits your goal?</h2>
        <p className="text-sm text-muted-foreground mb-5">
          You can switch courses at any time. We'll pre-select Data Engineering — it's the
          most popular starting point.
        </p>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="grid gap-2" data-testid="course-picker">
            {courses.map(c => {
              const selected = c.slug === value;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => onChange(c.slug)}
                  data-testid={`course-option-${c.slug}`}
                  data-selected={selected ? "true" : "false"}
                  className={
                    "text-left rounded-lg border p-3 transition " +
                    (selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50")
                  }
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {c.description}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-6 flex justify-end">
          <Button onClick={onNext} disabled={!value} data-testid="onboarding-next-1">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type CourseWithStartHere = CourseDetail;

function ReviewStartHereStep({
  isLoading,
  course,
  onBack,
  onNext,
}: {
  isLoading: boolean;
  course: CourseWithStartHere | undefined;
  onBack: () => void;
  onNext: () => void;
}) {
  if (isLoading || !course) {
    return (
      <Card>
        <CardContent className="py-6">
          <Skeleton className="h-6 w-2/3 mb-4" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  const sh = course.startHere;
  return (
    <Card>
      <CardContent className="py-6">
        <h2 className="text-xl font-semibold mb-2">Here's your first project</h2>
        <p className="text-sm text-muted-foreground mb-5">
          We picked the most approachable project in {course.name} based on difficulty
          and length.
        </p>
        {sh ? (
          <div
            className="rounded-lg border border-primary/30 bg-primary/5 p-4"
            data-testid="onboarding-start-here"
          >
            <div className="flex items-center gap-2 mb-1 text-xs uppercase tracking-wide text-primary font-semibold">
              {sh.reasonKey === "beginner_available" ? (
                <><Sparkles className="h-3.5 w-3.5" /> Start Here</>
              ) : (
                <><Compass className="h-3.5 w-3.5" /> Most approachable available</>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-semibold">{sh.project.title}</h3>
              <DifficultyBadge difficulty={sh.project.difficulty} />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {sh.reasonKey === "beginner_available"
                ? "Best first project for this course."
                : "Beginner projects for this course are coming soon. This is the gentlest available starting point for now."}
            </p>
          </div>
        ) : (
          <div
            className="rounded-lg border border-border p-4 text-sm text-muted-foreground"
            data-testid="onboarding-no-start-here"
          >
            No projects are available in this course yet — try picking a different course.
          </div>
        )}
        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext} disabled={!sh} data-testid="onboarding-next-2">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FinishStep({
  course,
  onBack,
  onFinish,
  isFinishing,
}: {
  course: CourseWithStartHere | undefined;
  onBack: () => void;
  onFinish: () => void;
  isFinishing: boolean;
}) {
  const sh = course?.startHere;
  return (
    <Card>
      <CardContent className="py-6">
        <h2 className="text-xl font-semibold mb-2">You're set.</h2>
        <p className="text-sm text-muted-foreground mb-5">
          When you click below we'll enroll you in{" "}
          <span className="font-medium text-foreground">{sh?.project.title ?? "your first project"}</span>{" "}
          and take you straight there. You can always pick a different project later from the
          course page.
        </p>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack} disabled={isFinishing}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={onFinish}
            disabled={!sh || isFinishing}
            data-testid="onboarding-finish"
          >
            {isFinishing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting…
              </>
            ) : (
              <>Start project<ArrowRight className="h-4 w-4 ml-2" /></>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
