/**
 * Phase 6 — candidate batch loader (filesystem adapter).
 *
 * The Zod schema lives in `@workspace/curriculum-quality` (`parseBatchFile`)
 * because the lib already owns the proposal schema. This module is a thin
 * filesystem adapter that reads a `.json` file from
 * `.local/candidate-batches/`, calls into `parseBatchFile`, and surfaces a
 * path-precise error on failure. No silent skips.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  parseBatchFile, type BatchFile, type ProposalStrictSchema, type AtlasCourseSlug,
} from "@workspace/curriculum-quality";

export type ValidatedBatch = BatchFile & { filePath: string };

// Resolve the batch dir from the pnpm workspace root so that running this
// script via `pnpm --filter @workspace/scripts run ...` (which changes cwd
// to scripts/) still writes/reads from the canonical
// `<workspace-root>/.local/candidate-batches/` directory.
// pnpm `--filter` runs the script from the package dir (scripts/) but sets
// INIT_CWD to the user's original cwd (workspace root for our use). Resolve
// relative paths against INIT_CWD when set, otherwise process.cwd().
const USER_CWD = process.env.INIT_CWD || process.cwd();
export const BATCH_DIR = path.resolve(USER_CWD, ".local", "candidate-batches");

function resolveUserPath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(USER_CWD, p);
}

export async function loadBatch(filePath: string): Promise<ValidatedBatch> {
  const raw = await fs.readFile(filePath, "utf8");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Batch ${filePath}: invalid JSON — ${(e as Error).message}`);
  }
  try {
    const data = parseBatchFile(json);
    return { ...data, filePath };
  } catch (e) {
    throw new Error(`Batch ${filePath}: ${(e as Error).message}`);
  }
}

export async function listBatchFiles(dir = BATCH_DIR): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter(f => f.endsWith(".json")).map(f => path.join(dir, f)).sort();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function findBatchByIdOrPath(idOrPath: string, dir = BATCH_DIR): Promise<string> {
  const resolved = resolveUserPath(idOrPath);
  try {
    await fs.stat(resolved);
    return resolved;
  } catch { /* fall through */ }
  const candidates = await listBatchFiles(dir);
  const exact = candidates.find(p => path.basename(p, ".json") === idOrPath);
  if (exact) return exact;
  for (const p of candidates) {
    try {
      const json = JSON.parse(await fs.readFile(p, "utf8")) as { batchId?: string };
      if (json.batchId === idOrPath) return p;
    } catch { /* skip unreadable */ }
  }
  throw new Error(`Batch not found: ${idOrPath} (looked in ${dir})`);
}

export function batchToJsonString(batch: {
  batchId: string;
  course: AtlasCourseSlug;
  rubricVersion: string;
  taxonomyVersion: string;
  generatedAt: string;
  generatedBy: string;
  difficultyMix?: Record<string, number>;
  candidates: Array<{
    archId?: string;
    proposedTitle: string;
    proposedCourse: AtlasCourseSlug;
    difficulty: "beginner" | "intermediate" | "advanced";
    targetRoles: string[];
    proposedStack: string[];
    proposal: ProposalStrictSchema;
  }>;
}): string {
  return JSON.stringify(batch, null, 2) + "\n";
}
