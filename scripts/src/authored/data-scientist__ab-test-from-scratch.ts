/**
 * Phase 10 batch-2 / data-scientist (intermediate→advanced).
 * Candidate 3338abcb-8b49-4fb3-9eff-203263415369 — A/B Test From Scratch
 * (power, randomization, t-test+CI, sequential testing, CUPED).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataScientistAbTestFromScratch: AuthoredProject = {
  slug: "data-scientist-ab-test-from-scratch",
  candidateId: "3338abcb-8b49-4fb3-9eff-203263415369",
  title: "A/B Test From Scratch — Power, Sequential Testing, CUPED",
  shortDescription:
    "Run a production-grade A/B test end-to-end: sample-size calculation, deterministic randomization, t-test with CIs, sequential testing (avoid peeking), and CUPED variance reduction. Build the toolkit senior DS roles expect.",
  fullDescription:
    "Most 'A/B tests' you see in industry are actually p-hacked or massively under-powered. You'll build the disciplined version: compute the required sample size from a power analysis, randomize deterministically by hashing user_id (replayable + leak-free), run a Welch t-test with bootstrap CIs, gate early stopping via O'Brien-Fleming sequential boundaries, and apply CUPED to cut variance ~30%. Real-shaped fixture data, real edge cases, real interview-ready output.",
  language: "python",
  difficulty: "intermediate",
  techStack: ["Python", "polars", "scipy", "mlflow", "pandas", "matplotlib"],
  tags: ["ab-testing", "experimentation", "power-analysis", "sequential-testing", "cuped", "frequentist", "variance-reduction", "mlflow", "observability"],
  learningObjectives: [
    "Compute required sample size from effect size + power.",
    "Randomize deterministically via hash(user_id) for reproducibility.",
    "Run a Welch t-test + bootstrap CI; reject vs fail-to-reject correctly.",
    "Apply sequential-testing boundaries to allow early stopping without inflating α.",
    "Reduce variance ~30% with CUPED using pre-experiment covariates.",
  ],
  estimatedMinutes: 180,
  xpReward: 650,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Senior DS embedded in a growth team. PM keeps shipping under-powered tests + peeking at p-values daily. You build a self-serve A/B toolkit that makes the right thing the easy thing.",
    hiringRelevance2026:
      "A/B testing rigor is a 2026 DS interview staple at every consumer company. Knowing CUPED + sequential testing cold = senior signal.",
    readmeOutline: [
      "Overview & Scenario", "Statistical primer (power, α, β)",
      "Step 1 sample-size calculator", "Step 2 deterministic randomization",
      "Step 3 t-test + bootstrap CI", "Step 4 sequential testing",
      "Step 5 CUPED variance reduction", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "GitHub repo with the toolkit (power calc, randomizer, analyzer with CUPED, sequential gate), a Jupyter walkthrough on a fixture experiment, and a README explaining each stat decision a stakeholder might question.",
    portfolioRelevance:
      "Senior DS interviews lean heavily on experimentation rigor — a clean toolkit + a written rationale beats any LLM-fine-tuning side project for the role tier.",
    repoUrl: "https://github.com/<your-handle>/ab-from-scratch",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Sample-size calculator (two-proportion z-test)",
      instructionMd:
        "Implement `sample_size(p_baseline, mde_rel, alpha=0.05, power=0.80) -> int` for a two-proportion z-test (one-sided). Use `n = ((z_α + z_β)² * (p1(1-p1) + p2(1-p2))) / (p2-p1)²` where p2 = p1*(1+mde_rel). Self-check: call sample_size(p_baseline=0.10, mde_rel=0.10, alpha=0.05, power=0.80) and confirm n_per_arm ∈ [14500, 16000].",
      learningObjective: "Compute the sample size required to detect a given lift with prescribed power.",
      requiredSkill: "Power analysis + two-proportion z-test sample-size formula + α/β interpretation",
      starterCode: SRC(`# power.py
from scipy.stats import norm
import math

def sample_size(p_baseline: float, mde_rel: float, alpha: float = 0.05, power: float = 0.80) -> int:
    p1 = p_baseline
    p2 = p1 * (1 + mde_rel)
    z_alpha = norm.ppf(1 - alpha)        # one-sided
    z_beta  = norm.ppf(power)
    # TODO: n_per_arm = ceil( (z_alpha + z_beta)^2 * (p1*(1-p1) + p2*(1-p2)) / (p2 - p1)^2 )
    return 0
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "sample_size(p_baseline=0.10, mde_rel=0.10, alpha=0.05, power=0.80) returns an integer in [14500, 16000]. Doubling mde_rel approximately halves required n.",
      }),
      expectedOutputs: { n_per_arm: 15235 },
      datasetRefs: ["fixtures/power_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Two-sided alpha=0.05 → use z_(1-α/2)=1.96; one-sided uses z_(1-α)=1.645 — pick deliberately.",
          "Relative MDE (10% lift) ≠ absolute MDE (10 percentage points). State which in every conversation.",
          "n scales as 1/MDE² — detecting 5% lifts needs 4× the data of detecting 10% lifts.",
          "If the calculator returns >your traffic budget, accept a larger MDE OR a longer test — not lower power.",
          "diff = p2 - p1; n_per_arm = math.ceil(((z_alpha + z_beta) ** 2 * (p1*(1-p1) + p2*(1-p2))) / (diff ** 2))",
        ],
        successFeedback: "Sample-size calculations are now defensible. No more 'we'll just run 2 weeks' guessing.",
        failureFeedback: "Common slips: confused one-sided vs two-sided α (n off by ~10%); used absolute MDE when meaning relative (n wrong by orders of magnitude); skipped pooled variance term.",
        portfolioRelevance: "Reciting the formula + interpreting outputs is the senior-DS table-stakes signal.",
        finalExplanation: "Sample size is a contract: 'I will detect a lift of X with probability P, accepting Y% false-positive risk'. Anything else is a guess.",
        misconceptionToWatchFor: "Increasing test duration after results disappoint. Same as p-hacking via sample-size manipulation.",
      }),
    },
    {
      stepNumber: 2,
      title: "Deterministic randomization via hashing",
      instructionMd:
        "Implement `assign(user_id, experiment_id, split=0.5) -> 'control'|'treatment'` using `hashlib.md5(f'{experiment_id}|{user_id}').hexdigest()[:8]` as a 32-bit int, then thresholded at `split * 2^32`. Self-check: run over 100k user_ids and confirm treatment count ∈ [49500, 50500] for split=0.5 (chi² p>0.05); verify every repeat call with the same user_id returns the same bucket (deterministic); verify different experiment_ids re-randomize (independent salts).",
      learningObjective: "Randomize deterministically so assignments are replayable, leak-free, and independent across experiments.",
      requiredSkill: "Hash-based bucketing + experiment-id salting + chi² balance test",
      starterCode: SRC(`# assign.py
import hashlib

def assign(user_id: str, experiment_id: str, split: float = 0.5) -> str:
    h = hashlib.md5(f'{experiment_id}|{user_id}'.encode()).hexdigest()[:8]
    bucket = int(h, 16) / (2 ** 32)
    # TODO: return 'treatment' if bucket < split else 'control'
    return 'control'
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Over 100k users with split=0.5: treatment count ∈ [49500, 50500]. Same (user_id, experiment_id) inputs always return the same bucket (deterministic). Different experiment_ids re-randomize (assignment correlation < 0.05 between experiments).",
      }),
      expectedOutputs: { treatment_count: 50118, deterministic: true },
      datasetRefs: ["fixtures/users_100k.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Salting with experiment_id is critical — without it, user 'always assigned to treatment' across every experiment = correlated arms.",
          "MD5 is fine for assignment (we're not protecting secrets) and 5x faster than SHA-256.",
          "Always check balance with a chi² test post-hoc — hash collisions or salt typos cause silent imbalance.",
          "Deterministic randomization replays cleanly when reanalyzing — A/B platforms that store assignments often diverge from this re-derived ground truth.",
          "return 'treatment' if bucket < split else 'control'",
        ],
        successFeedback: "Assignments are deterministic, balanced, and salt-independent. The randomization layer is bulletproof.",
        failureFeedback: "Common slips: forgot the salt (correlated assignment across experiments); used time-seeded random (non-replayable); didn't verify balance (silent skew).",
        portfolioRelevance: "Hash-bucket randomization is the canonical pattern at every major experimentation platform. Interview alpha.",
        finalExplanation: "Deterministic random sounds contradictory — it isn't. Cryptographic hashes give us reproducible randomness.",
        misconceptionToWatchFor: "Re-assigning users on each visit. Cross-visit assignment drift destroys experiment validity.",
      }),
    },
    {
      stepNumber: 3,
      title: "Welch t-test + bootstrap CI",
      instructionMd:
        "Implement `analyze(treatment, control) -> AnalysisReport` returning Welch t-statistic, two-sided p-value (`scipy.stats.ttest_ind(equal_var=False)`), point estimate (mean diff), and 95% bootstrap CI (10k resamples). Self-check: run on a fixture with treated mean=10.5, control mean=10.0, σ=2, n=8000 per arm, and confirm p<0.001, point diff ∈ [0.45, 0.55], CI excludes 0, and CI width <0.12.",
      learningObjective: "Run a correct unequal-variance t-test + report uncertainty via a CI.",
      requiredSkill: "Welch's t-test + bootstrap resampling + reporting effect + CI rather than p-value alone",
      starterCode: SRC(`# analyze.py
from dataclasses import dataclass
from scipy.stats import ttest_ind
import numpy as np

@dataclass
class AnalysisReport:
    diff: float
    p_value: float
    t_stat: float
    ci_low: float
    ci_high: float
    n_treatment: int
    n_control: int

def analyze(treatment: np.ndarray, control: np.ndarray, n_boot: int = 10000, alpha: float = 0.05, seed: int = 0) -> AnalysisReport:
    t_stat, p = ttest_ind(treatment, control, equal_var=False)
    diff = float(treatment.mean() - control.mean())
    rng = np.random.default_rng(seed)
    # TODO: bootstrap CI: for each of n_boot resamples, sample treatment + control with replacement (same sizes),
    #       compute diff; take percentiles [100*alpha/2, 100*(1-alpha/2)] for the CI.
    ci_low, ci_high = 0.0, 0.0
    return AnalysisReport(diff, float(p), float(t_stat), ci_low, ci_high, len(treatment), len(control))
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "On fixture (n=8000/arm, treated mean=10.5, control mean=10.0, σ=2): p < 0.001, point diff ∈ [0.45, 0.55], 95% bootstrap CI width < 0.12, and the CI excludes 0.",
      }),
      expectedOutputs: { diff: 0.50, p: 0.0001, ci_width: 0.09 },
      datasetRefs: ["fixtures/ab_experiment_main.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "equal_var=False (Welch) is more conservative + robust to unequal variances — default to it always.",
          "Always report the EFFECT (diff + CI), not just the p-value. p < 0.05 with negligible diff isn't worth shipping.",
          "Bootstrap CIs are robust to non-normality — preferred over analytical CIs when N >1000.",
          "Set seed for reproducibility — bootstrap is stochastic and silent reseeds break audits.",
          "boot_diffs = np.array([rng.choice(treatment, size=len(treatment), replace=True).mean() - rng.choice(control, size=len(control), replace=True).mean() for _ in range(n_boot)])\\nci_low, ci_high = float(np.percentile(boot_diffs, 2.5)), float(np.percentile(boot_diffs, 97.5))",
        ],
        successFeedback: "Analysis returns interpretable, defensible numbers. PMs can read the CI directly.",
        failureFeedback: "Common slips: used equal_var=True (Student's t — wrong when variances differ); reported p without effect (vibes-based decisions); didn't seed bootstrap (irreproducible).",
        portfolioRelevance: "Effect + CI reporting is THE 2026 experimentation standard. p-value-only output gets you flagged.",
        finalExplanation: "p-values answer 'could chance explain this?'. CIs answer 'how big is the effect?' — businesses care about the second.",
        misconceptionToWatchFor: "Equating 'p > 0.05' with 'no effect'. It only means 'failed to reject the null at this sample size'.",
      }),
    },
    {
      stepNumber: 4,
      title: "Sequential testing — O'Brien-Fleming boundaries",
      instructionMd:
        "Implement `obf_boundary(t_fraction, alpha=0.05) -> float` returning the O'Brien-Fleming Z-boundary at interim analysis fraction `t_fraction` ∈ (0, 1]: `boundary = z_(1-α/2) / sqrt(t_fraction)`. Implement `check_early_stop(z_stat, t_fraction)` returning True iff |z_stat| > boundary. Self-check: confirm obf_boundary(0.25) ≈ 3.92 and obf_boundary(1.0) ≈ 1.96; simulate 4-look type-1 error across 10k null experiments and confirm it is ≤ 0.052 (vs ~0.14 with naive z=1.96 at every look).",
      learningObjective: "Gate early stopping with a conservative boundary to preserve overall type-1 error.",
      requiredSkill: "Group-sequential testing + O'Brien-Fleming boundaries + α-spending intuition",
      starterCode: SRC(`# sequential.py
from scipy.stats import norm
import math

def obf_boundary(t_fraction: float, alpha: float = 0.05) -> float:
    if not (0 < t_fraction <= 1):
        raise ValueError(f'invalid t_fraction {t_fraction}')
    z_two = norm.ppf(1 - alpha / 2)
    # TODO: O'Brien-Fleming z-boundary at info fraction t: z_two / sqrt(t).
    return 0.0

def check_early_stop(z_stat: float, t_fraction: float, alpha: float = 0.05) -> bool:
    boundary = obf_boundary(t_fraction, alpha)
    return abs(z_stat) > boundary
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "obf_boundary(t=0.25) ≈ 3.92, obf_boundary(t=0.5) ≈ 2.77, obf_boundary(t=1.0) ≈ 1.96. Simulated 4-look type-1 error across 10k null experiments ≤ 0.052 (vs ~0.14 with naive z=1.96 at every look).",
      }),
      expectedOutputs: { boundary_t025: 3.92, type1: 0.049 },
      datasetRefs: ["fixtures/seq_sim_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "OBF is more conservative than Pocock early-on, less conservative at the end — matches the 'don't peek too eagerly' intuition.",
          "α-spending controls the cumulative type-1 error — without it, 5 peeks at α=0.05 each = ~20% false-positive rate.",
          "The asymptotic OBF formula `z_(1-α/2) / sqrt(t)` is exact for normal test statistics + balanced looks.",
          "Pre-register your look schedule (e.g. t ∈ {0.25, 0.5, 0.75, 1.0}) — switching mid-experiment voids the guarantee.",
          "return z_two / math.sqrt(t_fraction)",
        ],
        successFeedback: "You can now legitimately peek without inflating type-1 error. PM happy + statistician happy.",
        failureFeedback: "Common slips: used z=1.96 at every look (massive type-1 inflation); used Bonferroni naïvely (too conservative, kills power); didn't pre-register the schedule.",
        portfolioRelevance: "Sequential testing is a senior+ DS topic. Most teams don't do it; doing it correctly = signal.",
        finalExplanation: "Sequential testing trades a small amount of power for the freedom to stop early — usually a great deal.",
        misconceptionToWatchFor: "Stopping early on a strong p-value without a boundary. Even one unplanned look inflates type-1 error meaningfully.",
      }),
    },
    {
      stepNumber: 5,
      title: "CUPED — variance reduction via pre-experiment covariate",
      instructionMd:
        "Implement `cuped_adjust(y, x_pre) -> y_adj` where `y_adj = y - θ * (x_pre - x_pre.mean())` and `θ = Cov(y, x_pre) / Var(x_pre)`. Run the analyzer on raw `y` vs adjusted `y_adj`. Self-check: on a fixture experiment with x_pre correlation ρ=0.7 to y, confirm CI width after CUPED is ≤ 0.75 × CI width before CUPED, and that the point estimate stays within ±5% of the unadjusted estimate (CUPED is unbiased).",
      learningObjective: "Reduce experiment variance ~30% by adjusting outcomes by pre-experiment covariates.",
      requiredSkill: "CUPED (Microsoft 2013) + control-variate variance reduction + interpreting the estimate stays unbiased",
      starterCode: SRC(`# cuped.py
import numpy as np

def cuped_adjust(y: np.ndarray, x_pre: np.ndarray) -> np.ndarray:
    if len(y) != len(x_pre):
        raise ValueError('cuped: y and x_pre must align')
    var_x = np.var(x_pre, ddof=1)
    if var_x == 0: return y.copy()
    # TODO: theta = Cov(y, x_pre) / Var(x_pre)
    # TODO: y_adj = y - theta * (x_pre - x_pre.mean())
    return y.copy()
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "On a fixture experiment with x_pre correlation ρ=0.7 to y: CI width after CUPED ≤ 0.75 × CI width before CUPED; point estimate stays within ±5% of the unadjusted estimate (CUPED is unbiased).",
      }),
      expectedOutputs: { ci_shrink: 0.68, estimate_drift: 0.02 },
      datasetRefs: ["fixtures/ab_experiment_main.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "CUPED works because x_pre is uncorrelated with treatment (chosen pre-randomization) but correlated with y.",
          "Variance reduction ≈ ρ² — at ρ=0.5 you cut variance ~25%; at ρ=0.8, ~64%.",
          "Always use a TRULY pre-experiment covariate — post-randomization covariates bias the estimate.",
          "The estimate stays unbiased because we subtract a mean-zero quantity (centered x_pre).",
          "theta = np.cov(y, x_pre, ddof=1)[0, 1] / var_x; return y - theta * (x_pre - x_pre.mean())",
        ],
        successFeedback: "Variance is materially reduced. Effective sample size up ~50% for free.",
        failureFeedback: "Common slips: used post-treatment covariate (bias); forgot to center x_pre (estimate shifts by θ*mean); negative correlation handled wrong (still valid — θ is signed).",
        portfolioRelevance: "CUPED is a 2026 DS-staff-engineer table stake. Microsoft + Booking + Netflix all use variants — naming it cold = signal.",
        finalExplanation: "CUPED is a control-variate variance reduction. The math is 5 lines; the discipline is choosing the right pre-covariate.",
        misconceptionToWatchFor: "Believing CUPED 'finds' more significance. It reduces variance — the underlying effect is unchanged.",
      }),
    },
  ],
};
