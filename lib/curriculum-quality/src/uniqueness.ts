/**
 * Lightweight uniqueness detection. Jaccard on tokenized
 * (title + tags + step titles). No embeddings yet — Phase 6.
 *
 * Returns nearest-neighbor list so reviewers can see WHY a candidate
 * is flagged as duplicative.
 */

import type { NeighborRef, ProjectInput, StepInput } from "./types";
import { normalizeStackToken } from "./jobDemand";

const STOPWORDS = new Set([
  "a", "an", "and", "or", "the", "to", "of", "in", "on", "for", "with",
  "your", "you", "build", "first", "from", "into", "by", "at", "as",
  "this", "that", "is", "are", "be", "data", "project", "step",
]);

export function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeStackToken)
    .filter(t => t.length >= 2 && !STOPWORDS.has(t));
  return new Set(tokens);
}

export function projectFingerprint(project: ProjectInput, steps: StepInput[]): Set<string> {
  const parts = [
    project.title,
    (project.tags ?? []).join(" "),
    (project.techStack ?? []).join(" "),
    steps.map(s => s.title).join(" "),
  ];
  return tokenize(parts.join(" "));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const unionSize = a.size + b.size - intersect;
  return unionSize === 0 ? 0 : intersect / unionSize;
}

export type Corpus = Array<{
  slug: string;
  title: string;
  fingerprint: Set<string>;
}>;

export function buildCorpus(
  items: Array<{ project: ProjectInput; steps: StepInput[] }>,
): Corpus {
  return items.map(({ project, steps }) => ({
    slug: project.slug,
    title: project.title,
    fingerprint: projectFingerprint(project, steps),
  }));
}

export function nearestNeighbors(
  target: { slug: string; fingerprint: Set<string> },
  corpus: Corpus,
  k = 3,
): NeighborRef[] {
  const ranked: NeighborRef[] = [];
  for (const c of corpus) {
    if (c.slug === target.slug) continue;
    const sim = jaccard(target.fingerprint, c.fingerprint);
    if (sim > 0) ranked.push({ slug: c.slug, title: c.title, similarity: sim });
  }
  ranked.sort((a, b) => b.similarity - a.similarity);
  return ranked.slice(0, k);
}
