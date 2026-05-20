import type { DimensionScore, NeighborRef } from "../types";
import { DUPLICATE_WARNING_THRESHOLD } from "../rubric";

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function scoreUniqueness(neighbors: NeighborRef[]): {
  dimension: DimensionScore;
  duplicateWarning: boolean;
} {
  const signals: string[] = [];
  const gaps: string[] = [];

  const top = neighbors[0]?.similarity ?? 0;
  // Linear map: 0 sim → 100, 1.0 sim → 0.
  let score = Math.round(100 * (1 - top));
  let duplicateWarning = false;

  if (top >= DUPLICATE_WARNING_THRESHOLD) {
    duplicateWarning = true;
    // Hard penalty beyond just the linear scaling.
    score = Math.round(score * 0.5);
    gaps.push(
      `HARD DUPLICATE WARNING: ${Math.round(top * 100)}% similar to ${neighbors[0].slug}.`,
    );
  } else if (top >= 0.4) {
    gaps.push(
      `Moderate overlap (${Math.round(top * 100)}%) with ${neighbors[0].slug}.`,
    );
  } else if (top > 0) {
    signals.push(
      `Nearest neighbor only ${Math.round(top * 100)}% similar — sufficiently unique.`,
    );
  } else {
    signals.push("No detectable overlap with the existing catalog.");
  }

  return {
    dimension: { score: clamp(score), signals, gaps },
    duplicateWarning,
  };
}
