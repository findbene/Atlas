/**
 * Phase 9 — lint guard. `mapToCourse` is now a one-shot backfill helper
 * (and the defensive fallback inside `author-project.ts`'s audit loop).
 * Any new caller from `artifacts/**` or `lib/**` is a regression — runtime
 * code must read `projects.course` directly.
 *
 * Allowed locations (the only places this string may appear):
 *
 *   - lib/curriculum-quality/src/courses.ts        (the definition itself)
 *   - lib/curriculum-quality/src/courses.test.ts   (unit tests for the function)
 *   - lib/db/src/schema/{domains,enums}.ts         (JSDoc comments — historical)
 *
 * Run from CI (wired into root `pnpm run check:no-heuristic-runtime`).
 */
import { execSync } from "node:child_process";

const ROOT = process.env.INIT_CWD || process.cwd();

const ALLOWLIST: ReadonlySet<string> = new Set([
  "lib/curriculum-quality/src/courses.ts",
  "lib/curriculum-quality/src/courses.test.ts",
  "lib/db/src/schema/domains.ts",
  "lib/db/src/schema/enums.ts",
]);

// `rg --files-with-matches` for the token in lib + artifacts only.
let output = "";
try {
  // Phase 9 — explicit glob list so we catch .ts/.tsx/.js/.jsx/.mjs/.cjs
  // (ripgrep's `--type ts` historically excluded .tsx on older versions and
  // never covers JS callers — a runtime caller compiled from .ts can still
  // sneak in if pre-compiled .js is committed).
  output = execSync(
    `rg --files-with-matches "mapToCourse" artifacts lib ` +
    `-g '*.ts' -g '*.tsx' -g '*.js' -g '*.jsx' -g '*.mjs' -g '*.cjs'`,
    { encoding: "utf8", cwd: ROOT },
  );
} catch (e) {
  const err = e as { status?: number; stdout?: string };
  if (err.status === 1) output = ""; // ripgrep exits 1 when there are no matches
  else throw e;
}

const offenders = output
  .split("\n")
  .map(s => s.trim())
  .filter(Boolean)
  .filter(f => !ALLOWLIST.has(f));

if (offenders.length > 0) {
  console.error("[check] FAIL — runtime callers of mapToCourse outside the allowlist:");
  for (const f of offenders) console.error(`  ${f}`);
  console.error("\nRuntime code must read `projects.course` directly. The");
  console.error("heuristic is for the one-shot backfill only. If you need a");
  console.error("new exemption, add it to ALLOWLIST in scripts/src/check-no-runtime-mapToCourse.ts.");
  process.exit(1);
}

console.log(`[check] OK — no runtime mapToCourse callers outside the ${ALLOWLIST.size}-entry allowlist.`);
