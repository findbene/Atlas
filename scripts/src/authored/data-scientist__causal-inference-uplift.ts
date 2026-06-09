/**
 * Phase 10 batch-2 / data-scientist (advanced).
 * Candidate 94b29e9d-48e5-4125-8486-478cd7361914 — Causal Inference + Uplift Modeling
 * (propensity scores, IPW ATE, T-learner uplift, Qini curve).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataScientistCausalInferenceUplift: AuthoredProject = {
  slug: "data-scientist-causal-inference-uplift",
  candidateId: "94b29e9d-48e5-4125-8486-478cd7361914",
  title: "Causal Inference + Uplift Modeling — From Confounding to Qini",
  shortDescription:
    "Move beyond correlations: identify confounders, fit a propensity model, estimate the Average Treatment Effect with IPW, build a T-learner for heterogeneous uplift, and evaluate with a Qini curve. End-to-end on a marketing-promotion dataset.",
  fullDescription:
    "Most data-scientist roles in 2026 hit causal questions: 'Did the promotion CAUSE the lift, or did we just target users who'd have bought anyway?'. You'll work the full stack: DAG-based confounder identification, propensity-score modeling (logistic + calibration), inverse-probability weighting for the ATE, a T-learner for per-user uplift, and Qini-curve evaluation. The fixture is a real-shaped marketing dataset with selection bias designed in.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "scikit-learn", "polars", "mlflow", "pandas", "matplotlib"],
  tags: ["causal-inference", "uplift", "propensity-score", "ipw", "t-learner", "qini", "ate", "mlflow", "observability"],
  learningObjectives: [
    "Identify confounders from a domain DAG and avoid colliders.",
    "Fit + calibrate a propensity-score model.",
    "Estimate the ATE via inverse-probability weighting + a doubly-robust estimator.",
    "Build a T-learner for per-user uplift estimates.",
    "Evaluate uplift with the Qini curve + interpret the AUUC.",
  ],
  estimatedMinutes: 200,
  xpReward: 675,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Senior DS at a retailer. Marketing wants to know if the 20%-off email is incremental ('would these users have bought anyway?') and which segments respond best. You have observational data (no clean A/B) — must do causal.",
    hiringRelevance2026:
      "Causal + uplift is the 2026 senior DS differentiator. Roles at Booking, Wayfair, Wish, Lyft explicitly ask for IPW + uplift in screens.",
    readmeOutline: [
      "Overview & Scenario", "Causal DAG + identification", "Step 1 confounders",
      "Step 2 propensity model", "Step 3 IPW ATE", "Step 4 T-learner uplift",
      "Step 5 Qini evaluation", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "notebook",
    deliverable:
      "GitHub repo with the analysis notebook (DAG → propensity → IPW ATE → T-learner uplift → Qini), a short write-up of the identification assumptions, and a Streamlit demo where reviewers can perturb the data + watch the estimates respond.",
    portfolioRelevance:
      "Uplift modeling is the 2026 way senior DS roles screen for causal sophistication. A working notebook beats a Kaggle classification project at every senior interview.",
    repoUrl: "https://github.com/<your-handle>/causal-uplift-lab",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Identify confounders from the DAG",
      instructionMd:
        "Given the domain DAG `(age, prior_orders) → both T and Y`, `gender → T only`, `seasonality → Y only`, `loyalty_segment → T → Y`, return `confounders(dag)` = the set of variables that influence BOTH treatment T and outcome Y (these need adjustment) but excludes mediators on the T→Y path (which would block the effect we want to estimate). Validator passes the fixture DAG and expects {'age', 'prior_orders'} (NOT 'gender' — only affects T; NOT 'seasonality' — only affects Y; NOT 'loyalty_segment' — it's a mediator).",
      learningObjective: "Distinguish confounders (adjust for) from mediators (don't), from colliders (never), from instruments.",
      requiredSkill: "Causal DAGs + back-door criterion + mediator identification",
      starterCode: SRC(`# confounders.py
from dataclasses import dataclass

@dataclass(frozen=True)
class Edge:
    src: str
    dst: str

def confounders(edges: list[Edge], treatment: str = 'T', outcome: str = 'Y') -> set[str]:
    # Confounder = variable with edges to BOTH T and Y (not via T).
    # Mediator = variable on T → ... → Y; must NOT be in the adjustment set.
    parents_of_t = {e.src for e in edges if e.dst == treatment}
    parents_of_y = {e.src for e in edges if e.dst == outcome}
    # TODO: descendants_of_t excludes Y itself.
    # TODO: return parents_of_t ∩ parents_of_y, minus any descendants of T.
    return set()
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "confounders(fixture_dag) returns {'age', 'prior_orders'} (or a list/set equivalent). Must exclude 'gender' (influences T only), 'seasonality' (influences Y only), and 'loyalty_segment' (mediator on the T→Y path).",
      }),
      expectedOutputs: { confounders: ["age", "prior_orders"] },
      datasetRefs: ["fixtures/causal_dag.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Confounder = common cause of T and Y. Adjustment removes its bias.",
          "Mediator = on the causal path T→M→Y. Adjusting for it blocks the effect you want to measure.",
          "Collider = caused by both T and Y. Adjusting for a collider OPENS a spurious path (worst-case error).",
          "The back-door criterion: an adjustment set is sufficient if it blocks every non-causal path from T to Y.",
          "descendants_of_t = set(); stack = [treatment]\\nwhile stack:\\n    node = stack.pop()\\n    for e in edges:\\n        if e.src == node and e.dst not in descendants_of_t and e.dst != outcome:\\n            descendants_of_t.add(e.dst); stack.append(e.dst)\\nreturn (parents_of_t & parents_of_y) - descendants_of_t",
        ],
        successFeedback: "You can now read a DAG and pick the right adjustment set. Every causal estimate downstream depends on this.",
        failureFeedback: "Common slips: adjusted for mediators (blocked the effect → bias toward 0); adjusted for colliders (introduced new bias); included future variables (post-treatment bleed).",
        portfolioRelevance: "Reading DAGs fluently is the gating skill for senior causal DS work. Interviews probe it directly.",
        finalExplanation: "Identification (which variables to adjust for) is causal inference. Estimation (HOW to adjust) is the easy part.",
        misconceptionToWatchFor: "Throwing every variable into a regression. You'll bias the estimate via colliders and block the effect via mediators.",
      }),
    },
    {
      stepNumber: 2,
      title: "Propensity-score model + calibration",
      instructionMd:
        "Fit a calibrated propensity model `e(x) = P(T=1 | confounders)` using `sklearn.LogisticRegression` + `CalibratedClassifierCV`. Validator: trains on fixture (8000 rows, ~30% treated), evaluates on held-out 2000; expects ROC-AUC ≥0.74 AND Brier score ≤0.18 AND calibration slope ∈ [0.85, 1.15] (well-calibrated).",
      learningObjective: "Estimate the probability of treatment, calibrated for use as a weight.",
      requiredSkill: "Logistic regression + isotonic/Platt calibration + Brier score + calibration slope",
      starterCode: SRC(`# propensity.py
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, brier_score_loss
import numpy as np

CONFOUNDERS = ['age', 'prior_orders']

def fit_propensity(df_train, df_test):
    X_tr, t_tr = df_train[CONFOUNDERS].values, df_train['T'].values
    X_te, t_te = df_test[CONFOUNDERS].values, df_test['T'].values
    base = LogisticRegression(max_iter=1000)
    # TODO: wrap in CalibratedClassifierCV(base, method='isotonic', cv=5).fit(X_tr, t_tr)
    model = base.fit(X_tr, t_tr)
    p_te = model.predict_proba(X_te)[:, 1]
    auc = roc_auc_score(t_te, p_te)
    brier = brier_score_loss(t_te, p_te)
    # TODO: calibration slope: fit logreg of t_te ~ logit(p_te); slope ≈ 1 means well-calibrated.
    slope = 1.0
    return {'auc': float(auc), 'brier': float(brier), 'slope': float(slope), 'model': model}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "On the held-out test set (2000 rows): ROC-AUC ≥ 0.74, Brier score ≤ 0.18, calibration slope ∈ [0.85, 1.15] (computed by logit-regressing t_te on logit(p_te)).",
      }),
      expectedOutputs: { auc: 0.77, brier: 0.16, slope: 1.02 },
      datasetRefs: ["fixtures/causal_marketing.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Calibration matters for IPW more than discrimination — a high-AUC but mis-calibrated propensity will yield exploding weights.",
          "Use CalibratedClassifierCV(method='isotonic', cv=5) for >1k samples; 'sigmoid' (Platt) for smaller datasets.",
          "Brier score ≤ 0.25 = barely-better-than-random; ≤0.18 is typical for well-fit propensity models.",
          "Calibration slope from logit-regress: slope=1 perfectly calibrated; <1 = under-confident, >1 = over-confident.",
          "from sklearn.linear_model import LogisticRegression as LR\\nlogit_p = np.log(p_te/(1-p_te))\\nslope = LR().fit(logit_p.reshape(-1,1), t_te).coef_[0][0]",
        ],
        successFeedback: "Propensity model is calibrated + discriminating. IPW weights will be well-behaved.",
        failureFeedback: "Common slips: skipped calibration (weights blow up); used XGBoost without calibrating (highly mis-calibrated by default); included post-treatment variables (post-treatment bleed).",
        portfolioRelevance: "Calibration is the senior signal that separates ML engineers from causal practitioners. Most ML folks skip it.",
        finalExplanation: "The propensity score is a weight, not a prediction. Calibration is non-negotiable.",
        misconceptionToWatchFor: "Optimizing propensity for AUC. AUC + miscalibration = useless for IPW.",
      }),
    },
    {
      stepNumber: 3,
      title: "ATE via inverse-probability weighting",
      instructionMd:
        "Compute the IPW estimator `ATE_hat = mean( Y * T/e(x) ) - mean( Y * (1-T)/(1-e(x)) )`. Trim propensities to [0.05, 0.95] to bound weights. Validator runs on fixture (true ATE = 0.080 by construction) and expects estimated ATE in [0.070, 0.090] (within 1 percentage point).",
      learningObjective: "Use propensity weights to recover an unbiased ATE from observational data.",
      requiredSkill: "Inverse-probability weighting + weight trimming + ATE point estimate",
      starterCode: SRC(`# ate.py
import numpy as np

def ate_ipw(y: np.ndarray, t: np.ndarray, e: np.ndarray, trim: tuple = (0.05, 0.95)) -> float:
    e = np.clip(e, trim[0], trim[1])
    # TODO: weights for treated = T/e, untreated = (1-T)/(1-e).
    # TODO: ATE = mean(Y * T/e) - mean(Y * (1-T)/(1-e)).
    return 0.0
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "ate_ipw(y, t, e) on the fixture returns a value ∈ [0.070, 0.090] (ground-truth ATE = 0.080 by construction). The naive diff-in-means (without IPW) should bias to ~0.13, demonstrating the confounding correction.",
      }),
      expectedOutputs: { ate_ipw: 0.082, ate_naive: 0.131 },
      datasetRefs: ["fixtures/causal_marketing.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Always trim propensities to [0.05, 0.95] — values near 0 or 1 produce huge weights (variance disaster).",
          "Naive diff-in-means is biased by confounding — compute it first to SHOW the bias before correcting.",
          "If trimming removes >5% of rows, your overlap is weak; report it and prefer matching-based estimators.",
          "Doubly-robust extensions (AIPW) are more robust to mis-specification — implement once you have IPW working.",
          "return (y * t / e).mean() - (y * (1 - t) / (1 - e)).mean()",
        ],
        successFeedback: "ATE is now unbiased + within 1pt of ground truth. Confounding bias is removed.",
        failureFeedback: "Common slips: forgot trimming (NaN or astronomical ATE); divided by (1-T) literally instead of treating 1-T as a mask; reported ATE without standard errors.",
        portfolioRelevance: "IPW is the foundational causal-estimation technique. Reciting it + the trimming rationale = senior signal.",
        finalExplanation: "IPW reweights observational data to look like a randomized trial would have. The propensity score is the bridge.",
        misconceptionToWatchFor: "Reporting an ATE without bootstrap or sandwich-variance CIs. Senior reviewers will ask immediately.",
      }),
    },
    {
      stepNumber: 4,
      title: "T-learner for heterogeneous uplift",
      instructionMd:
        "Fit two separate models: `mu1(x) = E[Y|T=1, X]` on treated, `mu0(x) = E[Y|T=0, X]` on control. Per-user uplift = `mu1(x) - mu0(x)`. Use `GradientBoostingRegressor` for each. Validator: trains on 8k, scores on 2k held-out; expects mean predicted uplift in [0.06, 0.10] (close to true ATE 0.080) AND a clear monotone uplift gradient across the top-vs-bottom decile (top-decile uplift ≥0.18, bottom-decile uplift ≤0.02).",
      learningObjective: "Estimate per-user (heterogeneous) treatment effects via two-model decomposition.",
      requiredSkill: "T-learner architecture + gradient boosting + decile-based heterogeneity inspection",
      starterCode: SRC(`# uplift.py
from sklearn.ensemble import GradientBoostingRegressor
import numpy as np

FEATURES = ['age', 'prior_orders', 'gender_enc', 'loyalty_seg_enc']

def fit_t_learner(df_train):
    treated = df_train[df_train['T'] == 1]
    control = df_train[df_train['T'] == 0]
    mu1 = GradientBoostingRegressor(n_estimators=200, max_depth=3, random_state=0).fit(treated[FEATURES], treated['Y'])
    mu0 = GradientBoostingRegressor(n_estimators=200, max_depth=3, random_state=0).fit(control[FEATURES], control['Y'])
    return mu1, mu0

def predict_uplift(mu1, mu0, df) -> np.ndarray:
    # TODO: return mu1.predict(df[FEATURES]) - mu0.predict(df[FEATURES])
    return np.zeros(len(df))
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "predict_uplift on the held-out 2000 rows: mean predicted uplift ∈ [0.06, 0.10] (near the true ATE of 0.08). Top-decile mean uplift ≥ 0.18; bottom-decile mean uplift ≤ 0.02 (demonstrates heterogeneity in treatment response).",
      }),
      expectedOutputs: { mean_uplift: 0.083, top_decile: 0.21, bottom_decile: 0.01 },
      datasetRefs: ["fixtures/causal_marketing.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "T-learner is the simplest uplift architecture: 2 models, one per arm, then subtract.",
          "Gradient boosting handles small-sample treated arms better than neural nets — use 100–300 trees, depth 3–4.",
          "Always check the decile distribution — if uplift is flat, there's no heterogeneity to exploit.",
          "S-learner (single model with T as feature) is simpler but biased when T's effect is small relative to noise.",
          "return mu1.predict(df[FEATURES]) - mu0.predict(df[FEATURES])",
        ],
        successFeedback: "Per-user uplift estimates are now in hand. Targeting policy follows mechanically.",
        failureFeedback: "Common slips: trained one model on all data with T as feature (biases when treated arm is small); used different feature sets in mu1/mu0 (incomparable predictions).",
        portfolioRelevance: "Uplift estimation is the 2026 personalization stack. Senior DS roles at retail/SaaS specifically screen for it.",
        finalExplanation: "ATE answers 'should we treat?'. Uplift answers 'whom should we treat?'. Both are needed for policy.",
        misconceptionToWatchFor: "Targeting on predicted Y (not uplift). You'll target users who'd buy anyway and waste the promotion.",
      }),
    },
    {
      stepNumber: 5,
      title: "Qini curve + AUUC evaluation",
      instructionMd:
        "Implement `qini_curve(uplift_scores, y, t) -> (x, y_curve, auuc)`. Sort users by predicted uplift desc, then at each prefix compute `cumulative(treated Y) - cumulative(control Y) * (n_treated_in_prefix / n_control_in_prefix)`. AUUC = trapezoidal area under the curve normalized by random-targeting line. Validator runs against T-learner predictions on held-out 2k; expects AUUC ≥0.04 (uplift model meaningfully beats random) AND the random-targeting baseline = 0.0.",
      learningObjective: "Evaluate uplift models with the Qini curve, the canonical heterogeneous-effect metric.",
      requiredSkill: "Qini curve construction + AUUC normalization + uplift evaluation",
      starterCode: SRC(`# qini.py
import numpy as np

def qini_curve(uplift_scores: np.ndarray, y: np.ndarray, t: np.ndarray):
    order = np.argsort(-uplift_scores)  # descending uplift
    y_s, t_s = y[order], t[order]
    n = len(y_s)
    cum_treated_y = np.cumsum(y_s * t_s)
    cum_control_y = np.cumsum(y_s * (1 - t_s))
    cum_n_treated = np.cumsum(t_s)
    cum_n_control = np.cumsum(1 - t_s)
    eps = 1e-9
    # TODO: qini(k) = cum_treated_y(k) - cum_control_y(k) * (cum_n_treated(k) / max(cum_n_control(k), eps))
    qini = np.zeros(n)
    x = np.arange(1, n + 1) / n
    # AUUC normalized: area above the random line (which connects (0,0) to (1, qini[-1])).
    random_line = np.linspace(0, qini[-1], n)
    auuc = float(np.trapz(qini - random_line, x))
    return x, qini, auuc
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "qini_curve on the held-out set with T-learner uplift scores: AUUC ≥ 0.04 (model meaningfully beats random targeting). When called with shuffled uplift_scores, AUUC ≤ 0.005 (random baseline ≈ 0).",
      }),
      expectedOutputs: { auuc: 0.052, random_auuc: 0.002 },
      datasetRefs: ["fixtures/causal_marketing.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Qini curve adjusts the treated-cumulative by the treated/control ratio in the prefix — that's what makes it valid.",
          "Always compare your AUUC against a shuffled-uplift baseline — if shuffled scores tie your model, your model isn't learning uplift.",
          "Top-decile uplift is a simpler summary; AUUC integrates across all targeting thresholds — both are useful.",
          "If AUUC < 0, your model is anti-uplift (probably trained on Y not uplift) — debug immediately.",
          "qini = cum_treated_y - cum_control_y * (cum_n_treated / np.maximum(cum_n_control, eps))",
        ],
        successFeedback: "Uplift model evaluation is complete + comparable across iterations. Production targeting can proceed.",
        failureFeedback: "Common slips: didn't adjust by treated/control ratio (biased curve); reported raw cumulative-Y diff (confounded by class imbalance); skipped the random baseline.",
        portfolioRelevance: "Qini + AUUC is the canonical uplift metric. Reciting + computing it is the senior signal.",
        finalExplanation: "AUUC is to uplift what ROC-AUC is to classification — a threshold-agnostic, normalized metric for ranking.",
        misconceptionToWatchFor: "Evaluating uplift with classification accuracy. Uplift isn't a classification task and accuracy is meaningless.",
      }),
    },
  ],
};
