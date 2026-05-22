import { describe, expect, it } from "vitest";
import { pickStartHere, type StartHereCandidate } from "./startHere";

const p = (over: Partial<StartHereCandidate>): StartHereCandidate => ({
  slug: "x",
  title: "X",
  difficulty: "advanced",
  estimatedHours: 5,
  stepCount: 5,
  ...over,
});

describe("pickStartHere — Phase 18", () => {
  it("returns null on empty input", () => {
    expect(pickStartHere([])).toBeNull();
  });

  it("picks a beginner when one exists (kind=start_here)", () => {
    const result = pickStartHere([
      p({ slug: "adv-1", difficulty: "advanced" }),
      p({ slug: "int-1", difficulty: "intermediate" }),
      p({ slug: "beg-1", difficulty: "beginner" }),
    ]);
    expect(result?.project.slug).toBe("beg-1");
    expect(result?.kind).toBe("start_here");
    expect(result?.reasonKey).toBe("beginner_available");
    expect(result?.hasBeginner).toBe(true);
  });

  it("prefers approachability-signaled beginner over plain beginner", () => {
    const result = pickStartHere([
      p({ slug: "beg-zeta", title: "Zeta", difficulty: "beginner", estimatedHours: 1 }),
      p({ slug: "sql-beginner-select-where-join-essentials", title: "SQL Essentials", difficulty: "beginner", estimatedHours: 4 }),
    ]);
    expect(result?.project.slug).toBe("sql-beginner-select-where-join-essentials");
  });

  it("tie-breaks within beginner by estimatedHours, then stepCount, then slug", () => {
    const result = pickStartHere([
      p({ slug: "beg-a", difficulty: "beginner", estimatedHours: 5, stepCount: 5 }),
      p({ slug: "beg-b", difficulty: "beginner", estimatedHours: 3, stepCount: 5 }),
      p({ slug: "beg-c", difficulty: "beginner", estimatedHours: 3, stepCount: 4 }),
      p({ slug: "beg-d", difficulty: "beginner", estimatedHours: 3, stepCount: 4 }),
    ]);
    // beg-c and beg-d tie on hours+steps → slug ASC → beg-c
    expect(result?.project.slug).toBe("beg-c");
  });

  it("for zero-beginner course, falls back to lowest available difficulty and marks kind=most_approachable_available", () => {
    const result = pickStartHere([
      p({ slug: "adv-2", difficulty: "advanced", estimatedHours: 8 }),
      p({ slug: "int-2", difficulty: "intermediate", estimatedHours: 6 }),
      p({ slug: "adv-1", difficulty: "advanced", estimatedHours: 4 }),
    ]);
    expect(result?.project.slug).toBe("int-2");
    expect(result?.project.difficulty).toBe("intermediate");
    expect(result?.kind).toBe("most_approachable_available");
    expect(result?.reasonKey).toBe("no_beginner_available");
    expect(result?.hasBeginner).toBe(false);
  });

  it("all-advanced course falls back to the gentlest advanced (lowest hours)", () => {
    const result = pickStartHere([
      p({ slug: "adv-hard", difficulty: "advanced", estimatedHours: 10 }),
      p({ slug: "adv-mid", difficulty: "advanced", estimatedHours: 6 }),
      p({ slug: "adv-soft", difficulty: "advanced", estimatedHours: 3 }),
    ]);
    expect(result?.project.slug).toBe("adv-soft");
    expect(result?.kind).toBe("most_approachable_available");
    expect(result?.hasBeginner).toBe(false);
  });

  it("returns stable results across re-runs (deterministic)", () => {
    const input: StartHereCandidate[] = [
      p({ slug: "beg-c", difficulty: "beginner", estimatedHours: 3, stepCount: 4 }),
      p({ slug: "beg-d", difficulty: "beginner", estimatedHours: 3, stepCount: 4 }),
      p({ slug: "beg-a", difficulty: "beginner", estimatedHours: 5 }),
    ];
    const r1 = pickStartHere(input);
    const r2 = pickStartHere([...input].reverse());
    expect(r1?.project.slug).toBe(r2?.project.slug);
  });

  it("ignores unknown difficulty values (defensive, e.g. legacy 'expert')", () => {
    const result = pickStartHere([
      p({ slug: "exp-1", difficulty: "expert" }),
      p({ slug: "beg-1", difficulty: "beginner" }),
    ]);
    expect(result?.project.slug).toBe("beg-1");
  });

  it("returns null if every project has an unknown difficulty", () => {
    const result = pickStartHere([
      p({ slug: "exp-1", difficulty: "expert" }),
    ]);
    expect(result).toBeNull();
  });

  it("helper signature requires no anchor metadata — works on the minimal public-facing shape", () => {
    // Pins the contract: the helper only needs the public ProjectSummary
    // fields (slug, title, difficulty, estimatedHours, stepCount). It must
    // NOT depend on is_anchor or any internal flag, so the route layer can
    // confidently call it with only learner-facing data. (Runtime field
    // stripping is the route layer's job — tested separately in
    // courses.test.ts under "startHere never exposes anchor / internal flags".)
    const minimalOnly: StartHereCandidate = {
      slug: "beg-1", title: "Beg", difficulty: "beginner",
      estimatedHours: 1, stepCount: 2,
    };
    const result = pickStartHere([minimalOnly]);
    expect(result?.project.slug).toBe("beg-1");
    expect(result?.kind).toBe("start_here");
  });
});
