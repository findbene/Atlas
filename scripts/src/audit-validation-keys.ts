/**
 * Phase 61I — authored validation-key audit (catalog-wide, latent + visible).
 *
 * The grading runtime reads only a fixed, kind-specific set of keys from each
 * step's `validation.spec`. Any OTHER key is silently ignored — for the
 * gate-bearing kinds (`contains`, `exact`, `regex`) that means a bespoke key
 * produces a dead gate (auto-pass / fail-closed-on-null), exactly the class of
 * defect Phases 61G/61H fixed at runtime and 61I sweeps out of the authored
 * catalog. This audit loads the FULL authored index (every project, promoted or
 * not — so latent dead gates are caught before they can ship) and asserts:
 *
 *   - kind "contains": spec keys ⊆ { needle, needles, match, caseInsensitive }.
 *   - kind "exact":    spec keys ⊆ { expected }, and `expected` is a NON-EMPTY
 *                      string (the canonical 61I contract — promote maps it to
 *                      the `expected_output` column; a missing/empty expected
 *                      would fail closed at runtime = a dead gate).
 *   - kind "regex":    spec keys ⊆ { pattern, flags }.
 *
 * Kinds out of 61I scope are intentionally NOT policed here: `json_equal` and
 * `numeric_tolerance` are also dead-gate kinds (no runtime branch) but their
 * catalog-wide sweep is deferred to Phase 61J (and `json_equal` overlaps the
 * Phase-52 operator-pending canary); rowset kinds (`csv_set_equal`,
 * `sql_resultset`) and `self_attest` carry their own rich/empty-by-design specs.
 *
 * Read-only, no DB. Exits non-zero on the first violation so the phase ritual
 * and CI gate on it. Mirrors the authoring-time guards in
 * `@workspace/curriculum-quality` (`assertValidContainsSpec` /
 * `assertValidExactSpec`) — anything those reject at construction, this rejects
 * across the whole index.
 */
import { AUTHORED_PROJECTS } from "./authored";
import { selfAttestHonestyViolations } from "@workspace/curriculum-quality";

const ALLOWED: Record<string, Set<string>> = {
  contains: new Set(["needle", "needles", "match", "caseInsensitive"]),
  exact: new Set(["expected"]),
  regex: new Set(["pattern", "flags"]),
  // Phase 61J — json_equal deep-compares the submission against `expected`;
  // numeric_tolerance compares a single number against `expected` ± `tolerance`.
  json_equal: new Set(["expected"]),
  numeric_tolerance: new Set(["expected", "tolerance"]),
};

const failures: string[] = [];
let checked = 0;

for (const p of AUTHORED_PROJECTS) {
  for (const s of p.steps) {
    const kind = s.validation?.kind;

    // Phase 61K — self_attest honesty lint (all kinds): a `self_attest` step
    // performs NO grading, so its learner-facing copy must not imply automated /
    // Atlas validation ("Validator runs/asserts X", "server-enforced", "Atlas
    // verifies", "commit-grader", "graded by Atlas", "auto-graded", …). The shared
    // `selfAttestHonestyViolations` helper (curriculum-quality) encodes the phrase
    // set and suppresses honest negations ("Atlas does NOT run/grade…") and
    // learner-owned validators ("your validator runs…"). Lints BOTH the
    // instructionMd and the validation description so neither can smuggle a claim.
    if (kind === "self_attest") {
      const bad = [
        ...selfAttestHonestyViolations(s.instructionMd ?? ""),
        ...selfAttestHonestyViolations((s.validation?.description as string) ?? ""),
      ];
      if (bad.length > 0) {
        failures.push(
          `${p.slug} step ${s.stepNumber} (self_attest): copy implies automated/Atlas ` +
            `validation, but self_attest performs no grading (false H3 claim): "${bad.join('", "')}". ` +
            `Reword to honest self-verification copy.`,
        );
      }
    }

    if (!kind || !(kind in ALLOWED)) continue; // key-allowlist only for the graded kinds
    checked++;
    const tag = `${p.slug} step ${s.stepNumber} (${kind})`;
    const spec = (s.validation.spec ?? {}) as Record<string, unknown>;
    const allowed = ALLOWED[kind];

    const stray = Object.keys(spec).filter((k) => !allowed.has(k));
    if (stray.length > 0) {
      failures.push(
        `${tag}: bespoke spec key(s) the runtime never reads → silent dead gate: ${stray.join(", ")}. ` +
          `Allowed for '${kind}': ${[...allowed].join(", ")}.`,
      );
    }

    if (kind === "exact") {
      const exp = (spec as { expected?: unknown }).expected;
      if (typeof exp !== "string" || exp.length === 0) {
        failures.push(
          `${tag}: 'exact' requires a non-empty string 'expected' (promote maps it to the ` +
            `expected_output column; missing/empty would fail closed = a dead gate).`,
        );
      }
    }

    if (kind === "regex") {
      const pat = (spec as { pattern?: unknown }).pattern;
      if (typeof pat !== "string" || pat.length === 0) {
        failures.push(
          `${tag}: 'regex' requires a non-empty string 'pattern' (an empty pattern matches ` +
            `everything = a dead gate).`,
        );
      }
    }

    if (kind === "json_equal") {
      if (!("expected" in spec) || (spec as { expected?: unknown }).expected === undefined) {
        failures.push(
          `${tag}: 'json_equal' requires an 'expected' JSON value (the runtime deep-compares ` +
            `the submission against it; a missing expected fails closed = a dead gate).`,
        );
      }
    }

    if (kind === "numeric_tolerance") {
      const e = (spec as { expected?: unknown }).expected;
      const t = (spec as { tolerance?: unknown }).tolerance;
      if (typeof e !== "number" || !Number.isFinite(e)) {
        failures.push(`${tag}: 'numeric_tolerance' requires a finite numeric 'expected'.`);
      }
      if (typeof t !== "number" || !Number.isFinite(t) || t < 0) {
        failures.push(`${tag}: 'numeric_tolerance' requires a finite non-negative numeric 'tolerance'.`);
      }
    }
  }
}

console.log(`\n=== Phase 61I/61J — authored validation-key audit ===`);
console.log(
  `Projects: ${AUTHORED_PROJECTS.length}   graded (contains/exact/regex/json_equal/numeric_tolerance) ` +
    `steps key-checked: ${checked}   (+ self_attest honesty lint over all steps)`,
);
console.log(`Violations: ${failures.length}`);

if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(
    `\nFAIL — ${failures.length} authored validation step(s) carry keys the runtime never reads. ` +
      `Convert to canonical needle(s) / expected / pattern, or to self_attest where Atlas cannot grade.`,
  );
  process.exit(1);
}

console.log(
  `\nPASS — every authored contains/exact/regex/json_equal/numeric_tolerance step uses only ` +
    `canonical, runtime-read keys (no bespoke dead gates remain).`,
);
process.exit(0);
