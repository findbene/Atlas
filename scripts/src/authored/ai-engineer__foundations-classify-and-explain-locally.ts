/**
 * Phase 20 — ai-engineer beginner/foundations seed (net-new). Closes the
 * Start Here gap for one of the last two zero-beginner courses surfaced by
 * Phase 18. "Foundations" framing (difficulty=beginner for invariants)
 * because ai-engineer learners typically arrive with basic Python but no
 * supervised-ML fluency.
 *
 * Candidate b20f6a9c-3d4e-4f50-9b7c-8d9e0f123456 — Build a deterministic,
 * fully-local text-classification pipeline with scikit-learn
 * LogisticRegression: load → vectorize → train → evaluate → locally
 * explain. No cloud, no API keys, no GPU; fixed random_state everywhere so
 * the metrics are byte-reproducible. The local explainability step
 * (top-k coefficients per class → report.md) is the move that turns "I
 * trained a model" into "I shipped a model a reviewer can audit".
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const aiEngineerFoundationsClassifyAndExplainLocally: AuthoredProject = {
  slug: "ai-engineer-foundations-classify-and-explain-locally",
  candidateId: "b20f6a9c-3d4e-4f50-9b7c-8d9e0f123456",
  title: "AI-Engineer Foundations — Classify-and-Explain Locally with scikit-learn LogisticRegression",
  shortDescription:
    "Build the foundational supervised-ML loop on your laptop with scikit-learn: load a labelled CSV, split with a fixed random_state, vectorize text with TfidfVectorizer, train a LogisticRegression, evaluate with accuracy + confusion matrix + per-class report, and locally explain the model by reading the top-k positive/negative coefficients per class into a report.md. Zero cloud, zero API keys, zero GPU. Deterministic by design — every run reproduces the same metrics to the digit.",
  fullDescription:
    "The 2026 ai-engineer interview is no longer 'do you know what a transformer is' — it's 'can you ship a SUPERVISED model that a reviewer can audit'. This project teaches the foundational loop end-to-end on your laptop: load a labelled text dataset (a 200-row tagged messages CSV ships in the repo — `spam` vs `ham`), split with a fixed `random_state` + stratification, fit a `TfidfVectorizer` on TRAIN ONLY (never on test — the single most-frequent leak in beginner ML repos), train a `LogisticRegression(class_weight='balanced')`, evaluate with `accuracy_score` + `confusion_matrix` + `classification_report`, and then — the hiring-relevant move — locally explain the model by sorting `model.coef_` per class to surface the top-10 most-positive and most-negative tokens, written to a `report.md`. The whole project is byte-reproducible: same seed, same metrics every run; the repo `make all` produces an identical `metrics.json` + `report.md` on every reviewer's machine.",
  language: "python",
  difficulty: "beginner",
  techStack: ["Python", "scikit-learn", "pandas", "numpy"],
  tags: ["ai-engineer", "beginner", "foundations", "scikit-learn", "classification", "explainability", "deterministic"],
  learningObjectives: [
    "Load a labelled CSV with pandas and split with `train_test_split(random_state=42, stratify=y)` so class balance is preserved and the split is byte-reproducible.",
    "Fit `TfidfVectorizer` on TRAIN ONLY then `.transform()` test — the canonical anti-leakage discipline of supervised ML.",
    "Train `LogisticRegression(class_weight='balanced', random_state=42)` and inspect `predict_proba` not just `predict`.",
    "Evaluate with `accuracy_score`, `confusion_matrix`, `classification_report` — and explain why the confusion matrix is the truth and accuracy is the headline.",
    "Locally explain a linear model by sorting `model.coef_` per class to surface the top-k tokens — a model audit a reviewer can read in 30 seconds.",
  ],
  estimatedMinutes: 165,
  xpReward: 495,
  isMultiFile: false,
  meta: projectMeta({
    scenario:
      "Junior ai-engineer candidate at a 2026 messaging platform. The platform team is evaluating spam-detection options. You build the canonical baseline — a deterministic local scikit-learn LogisticRegression with a locally-readable feature-importance report — entirely on your laptop with no API keys. The baseline pins reproducible metrics that any future LLM-based approach has to beat to be worth the latency + cost.",
    hiringRelevance2026:
      "A deterministic local scikit-learn baseline + a feature-importance report is *the* foundational ai-engineer screen in 2026. Reviewers want to see the supervised-ML loop (split → vectorize → train → evaluate → explain) in a small, runnable repo with NO API key in the README — that proves you understand the discipline before reaching for an LLM.",
    readmeOutline: [
      "Overview — supervised baseline + local audit",
      "Setup (uv or pip install scikit-learn pandas)",
      "Step 1: load + stratified split with fixed seed",
      "Step 2: TfidfVectorizer (fit on train only)",
      "Step 3: train LogisticRegression + predict_proba",
      "Step 4: evaluate (accuracy + confusion matrix + report)",
      "Step 5: local explainability — top-k coefficients → report.md",
      "Portfolio Hand-off (Makefile + byte-reproducible metrics)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: `src/load.py` (CSV → stratified split), `src/vectorize.py` (fit-on-train TfidfVectorizer), `src/train.py` (LogisticRegression with fixed seeds), `src/evaluate.py` (accuracy + confusion + classification_report → `metrics.json`), `src/explain.py` (top-k coef per class → `report.md`), `fixtures/messages.csv` (200 labelled rows), `tests/test_pipeline.py`, `Makefile` (`make all` reproduces metrics.json + report.md byte-for-byte). README must call out the fixed-seed determinism + the fit-on-train-only discipline.",
    portfolioRelevance:
      "A reviewer who clones, runs `make all`, gets an identical `metrics.json` to the README, and reads a `report.md` showing the top-10 spam-indicator tokens in 30 seconds — that's the highest-signal junior ai-engineer artefact. The byte-reproducibility is the trust signal; the local explainability is the senior signal.",
    repoUrl: "https://github.com/<your-handle>/ai-engineer-foundations-classify-and-explain",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Load + stratified split with fixed seed",
      instructionMd:
        "Write `src/load.py` exposing `load_split(csv_path: str, test_size: float = 0.25) -> tuple[list[str], list[str], list[str], list[str]]` returning `(X_train, X_test, y_train, y_test)`. Read the CSV with `pandas.read_csv` (columns: `text`, `label` where label ∈ {'spam', 'ham'}), then `from sklearn.model_selection import train_test_split` and split with `random_state=42, stratify=y`. Why stratify: with a class-imbalanced corpus, a random split can leave you with 90% ham in train and 60% ham in test — stratification preserves the class ratio in BOTH splits. Why a fixed `random_state`: a reviewer running `make all` must get the same metrics. Reproducibility is the trust contract. This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.",
      learningObjective:
        "Stratified + seeded split is the single boundary between 'I trained a model' and 'I trained a model whose metrics any reviewer can reproduce on the first try'.",
      requiredSkill: "pandas.read_csv + sklearn.model_selection.train_test_split with stratify + random_state",
      starterCode: SRC(`# src/load.py
import pandas as pd
from sklearn.model_selection import train_test_split

def load_split(csv_path: str, test_size: float = 0.25):
    df = pd.read_csv(csv_path)
    X = df["text"].tolist()
    y = df["label"].tolist()
    # TODO: train_test_split(X, y, test_size=test_size, stratify=y, random_state=42)
    return [], [], [], []
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "Learner attests the split is correct.", {
        attestationCriteria: [
          "load_split returns exactly 4 lists: (X_train, X_test, y_train, y_test).",
          "The split uses stratify=y and random_state=42.",
          "Running load_split twice with the same csv_path produces identical splits (byte-reproducible).",
          "X_train and X_test are disjoint (no overlap between train and test examples).",
          "The class ratio of 'spam'/'ham' is approximately preserved in both train and test sets.",
        ],
      }),
      expectedOutputs: { splitReproducible: true, stratified: true },
      datasetRefs: ["fixtures/messages.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`from sklearn.model_selection import train_test_split` — the canonical split helper. Returns `(X_train, X_test, y_train, y_test)` IN THAT ORDER.",
          "`stratify=y` preserves the class-ratio in both splits — essential when classes are imbalanced (e.g. 80% ham / 20% spam).",
          "`random_state=42` is convention; any integer works as long as it's PINNED. Without it the split is random per run and your metrics drift.",
          "`test_size=0.25` is the convention for small datasets. With 200 rows that's 150 train / 50 test — small but enough to spot a regression.",
          "X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, stratify=y, random_state=42)",
        ],
        successFeedback:
          "Stratified seeded split — your model has a fair shot AND your metrics will be reproducible across machines.",
        failureFeedback:
          "Most common slips: omitting `stratify=y` (class imbalance corrupts the test set); omitting `random_state` (every run produces different metrics, reviewer can't verify); swapping the return order (the helper returns X first then y — easy to mis-unpack).",
        portfolioRelevance:
          "A `load_split` with `stratify=y` + `random_state=42` is the first thing a senior reviewer opens — it tells them you've internalised the two split disciplines before they read a single line of model code.",
        finalExplanation:
          "Reproducibility starts at the split. Same data + same seed + same stratification = same numbers every time. That's the contract that lets a reviewer trust everything downstream.",
        misconceptionToWatchFor:
          "Believing 'a random split is fine, the model will generalise'. No — with class imbalance you can get a test set that's 100% one class, making accuracy meaningless.",
      }),
    },
    {
      stepNumber: 2,
      title: "Vectorize text — TfidfVectorizer, fit on TRAIN ONLY",
      instructionMd:
        "Write `src/vectorize.py` exposing `vectorize(X_train: list[str], X_test: list[str]) -> tuple[Any, Any, TfidfVectorizer]` returning `(X_train_vec, X_test_vec, vectorizer)`. Use `from sklearn.feature_extraction.text import TfidfVectorizer` with `min_df=2, max_df=0.95, ngram_range=(1, 2), lowercase=True`. CRITICAL: `vectorizer.fit_transform(X_train)` then `vectorizer.transform(X_test)` — NEVER `fit_transform(X_test)`. Fitting the vectorizer on test data is the single most-common leak in beginner ML repos; it secretly tells your model what vocabulary exists in the held-out set. This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.",
      learningObjective:
        "Fit-on-train-only is the canonical anti-leakage discipline. The vectorizer (and any future preprocessing) sees TRAIN, then APPLIES to test.",
      requiredSkill: "sklearn TfidfVectorizer with min_df/max_df/ngram_range + fit_transform/transform split",
      starterCode: SRC(`# src/vectorize.py
from sklearn.feature_extraction.text import TfidfVectorizer

def vectorize(X_train, X_test):
    vec = TfidfVectorizer(
        min_df=2, max_df=0.95, ngram_range=(1, 2), lowercase=True,
    )
    # TODO: X_train_vec = vec.fit_transform(X_train)
    # TODO: X_test_vec  = vec.transform(X_test)   # NOT fit_transform!
    return None, None, vec
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "Learner attests the vectorizer is correct.", {
        attestationCriteria: [
          "vectorize calls vec.fit_transform(X_train) and vec.transform(X_test) — never fit_transform on test data.",
          "The vectorizer is constructed with min_df=2, max_df=0.95, ngram_range=(1, 2), lowercase=True.",
          "X_train_vec.shape[0] equals len(X_train) and X_test_vec.shape[0] equals len(X_test).",
          "X_test_vec uses exactly the same vocabulary as X_train_vec (same column count).",
        ],
      }),
      expectedOutputs: { vectorizerFittedTrainOnly: true, leakFree: true },
      datasetRefs: [],
      pedagogy: pedagogyConfig({
        hints: [
          "`TfidfVectorizer` turns each document into a sparse vector of TF-IDF weights — high for words frequent in this doc but rare across the corpus.",
          "`min_df=2` drops words that appear in only 1 document (almost always noise). `max_df=0.95` drops words in 95%+ of docs (stopwords).",
          "`ngram_range=(1, 2)` captures both single words AND adjacent pairs — 'free money' as a phrase is a much stronger spam signal than 'free' or 'money' alone.",
          "Fit happens ONCE on training data: `vec.fit_transform(X_train)`. Then `vec.transform(X_test)` applies the SAME vocabulary to test.",
          "X_train_vec = vec.fit_transform(X_train); X_test_vec = vec.transform(X_test)",
        ],
        successFeedback:
          "TfidfVectorizer fitted on train and applied to test — no leakage, your test metrics are honest.",
        failureFeedback:
          "Most common slips: calling `vec.fit_transform(X_test)` (catastrophic leak — your test 'accuracy' becomes meaningless); skipping `min_df`/`max_df` (vocabulary blows up to 10k+ tokens for 200 rows, model overfits); forgetting `ngram_range=(1, 2)` (you lose phrase-level signal which is the highest-value spam feature).",
        portfolioRelevance:
          "A senior reviewer searches your repo for `fit_transform(X_test)` — if they find it, the review is over. The clean `fit_transform(X_train)` then `transform(X_test)` split is the single line that proves you understand leakage.",
        finalExplanation:
          "The fit/transform split is sklearn's pedagogical gift to ML engineering: any preprocessing that LEARNS from data (vocabulary, scaling parameters, encoders) must fit on train ONLY and transform test. Anything else is leakage.",
        misconceptionToWatchFor:
          "Believing 'fit_transform is faster so I'll use it on both'. The whole point of separating fit and transform is so test data never influences the model. Speed is not the metric here; integrity is.",
      }),
    },
    {
      stepNumber: 3,
      title: "Train LogisticRegression + predict_proba",
      instructionMd:
        "Write `src/train.py` exposing `train(X_train_vec, y_train) -> LogisticRegression` and `predict(model, X_test_vec) -> tuple[list[str], list[float]]` returning `(y_pred, y_prob_spam)` where `y_prob_spam` is the probability of the positive class for each test row. Train with `LogisticRegression(class_weight='balanced', random_state=42, max_iter=1000)`. Why `class_weight='balanced'`: with an imbalanced corpus, the default loss is dominated by the majority class — balanced weighting upweights the minority class proportional to inverse frequency. Why `predict_proba` not just `predict`: a probability lets you tune the decision threshold downstream; a hard label discards that information. This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.",
      learningObjective:
        "LogisticRegression with balanced class weights + predict_proba is the boring-correct supervised baseline. Probabilities > labels.",
      requiredSkill: "sklearn LogisticRegression + class_weight='balanced' + predict + predict_proba",
      starterCode: SRC(`# src/train.py
from sklearn.linear_model import LogisticRegression

def train(X_train_vec, y_train):
    model = LogisticRegression(
        class_weight="balanced", random_state=42, max_iter=1000,
    )
    # TODO: model.fit(X_train_vec, y_train)
    return model

def predict(model, X_test_vec):
    # TODO: y_pred = model.predict(X_test_vec)
    # TODO: spam_col = list(model.classes_).index("spam")
    # TODO: y_prob_spam = model.predict_proba(X_test_vec)[:, spam_col].tolist()
    return [], []
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "Learner attests the model is trained correctly.", {
        attestationCriteria: [
          "train returns a fitted LogisticRegression with class_weight='balanced', random_state=42, max_iter=1000.",
          "predict returns (y_pred, y_prob_spam) where y_prob_spam is the probability of the 'spam' class for each test row.",
          "All values in y_prob_spam are in [0, 1].",
          "y_prob_spam is indexed using model.classes_ to locate the 'spam' column (not hardcoded [:, 1]).",
        ],
      }),
      expectedOutputs: { modelTrained: true, probsAvailable: true },
      datasetRefs: [],
      pedagogy: pedagogyConfig({
        hints: [
          "`LogisticRegression` is the boring-correct text-classification baseline; non-linear models rarely beat it on TF-IDF features.",
          "`class_weight='balanced'` auto-weights samples inversely proportional to class frequency — essential with imbalanced data.",
          "`max_iter=1000` prevents the solver from stopping early on harder corpora; `random_state=42` pins the (small) randomness in the solver.",
          "`predict_proba(X)` returns an `(n_samples, n_classes)` array. Use `model.classes_` to find which COLUMN corresponds to 'spam'.",
          "spam_col = list(model.classes_).index('spam'); y_prob_spam = model.predict_proba(X_test_vec)[:, spam_col].tolist()",
        ],
        successFeedback:
          "Model trained with balanced weighting + you have BOTH hard labels and class probabilities — the foundation for the next two steps.",
        failureFeedback:
          "Most common slips: omitting `class_weight='balanced'` (model predicts majority class for everything, accuracy looks high but the confusion matrix exposes it); hardcoding `[:, 1]` for the spam column (breaks if sklearn orders classes alphabetically as ['ham', 'spam']); forgetting `max_iter=1000` (solver warning floods the log).",
        portfolioRelevance:
          "A reviewer who sees `class_weight='balanced'` + `model.classes_.index('spam')` knows you've trained on real imbalanced data before — those are senior-tier defensive habits.",
        finalExplanation:
          "Logistic regression remains the best beginner ai-eng model because every part of it is inspectable: weights are interpretable, probabilities are calibrated, and the training loop is one fit() call. No magic.",
        misconceptionToWatchFor:
          "Believing 'I should use a neural net for everything'. For a 200-row binary text task, LogisticRegression + TF-IDF gives you a baseline that's hard to beat AND fully auditable. Reach for complexity only when it pays.",
      }),
    },
    {
      stepNumber: 4,
      title: "Evaluate — accuracy + confusion matrix + per-class report → metrics.json",
      instructionMd:
        "Write `src/evaluate.py` exposing `evaluate(y_true: list[str], y_pred: list[str]) -> dict` that computes `accuracy_score`, `confusion_matrix` (as a 2x2 list-of-lists with row=true, col=pred), and `classification_report(..., output_dict=True)` and returns a single dict with `{accuracy, confusion_matrix, per_class}`. Then write a thin CLI that loads the CSV, splits, vectorizes, trains, predicts, evaluates, and writes the dict to `metrics.json` (sorted keys, `indent=2`). Why three metrics: accuracy is the headline but it lies on imbalanced data; the confusion matrix shows you WHERE the errors are (false positives vs false negatives); the per-class precision/recall is what you actually report when a stakeholder asks 'how good is it'. This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.",
      learningObjective:
        "Three evaluation views (headline number, confusion structure, per-class breakdown) are how a senior engineer talks about model performance — never the headline alone.",
      requiredSkill: "sklearn.metrics: accuracy_score + confusion_matrix + classification_report + JSON serialization",
      starterCode: SRC(`# src/evaluate.py
import json
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report

LABELS = ["ham", "spam"]

def evaluate(y_true, y_pred) -> dict:
    acc = float(accuracy_score(y_true, y_pred))
    # TODO: cm = confusion_matrix(y_true, y_pred, labels=LABELS).tolist()
    # TODO: report = classification_report(y_true, y_pred, labels=LABELS, output_dict=True, zero_division=0)
    return {"accuracy": acc, "confusion_matrix": [], "per_class": {}}

def write_metrics(metrics: dict, out_path: str = "metrics.json") -> None:
    # TODO: write json.dumps(metrics, sort_keys=True, indent=2) to out_path
    pass
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "Learner attests the evaluator is correct.", {
        attestationCriteria: [
          "evaluate returns a dict with keys: accuracy (float), confusion_matrix (2x2 list-of-lists, rows=true label, cols=predicted label, labels=['ham','spam']), per_class (dict with per-class precision/recall/f1).",
          "confusion_matrix is computed with labels=['ham','spam'] explicitly so row/column order is deterministic.",
          "write_metrics writes JSON with sort_keys=True and indent=2, producing byte-identical output on every run.",
          "Running make all twice produces identical metrics.json files.",
        ],
      }),
      expectedOutputs: { metricsJsonWritten: true, reproducible: true },
      datasetRefs: [],
      pedagogy: pedagogyConfig({
        hints: [
          "`accuracy_score(y_true, y_pred)` → float in [0, 1]. Headline number, lies on imbalanced data.",
          "`confusion_matrix(y_true, y_pred, labels=LABELS)` → numpy 2x2 with rows=true, cols=pred. ALWAYS pass `labels=` explicitly; otherwise sklearn picks alphabetical order and you'll mis-read the matrix.",
          "`classification_report(..., output_dict=True, zero_division=0)` → dict with per-class precision/recall/f1 + macro/weighted averages. The `zero_division=0` flag prevents warnings when a class has 0 predictions.",
          "`json.dumps(d, sort_keys=True, indent=2)` produces deterministic JSON output — same dict produces the same bytes every time, which is what makes `make all` reproducible.",
          "cm = confusion_matrix(y_true, y_pred, labels=LABELS).tolist()",
        ],
        successFeedback:
          "Three-view evaluation written to a deterministic metrics.json — a reviewer can re-run and diff against the README.",
        failureFeedback:
          "Most common slips: omitting `labels=LABELS` from confusion_matrix (matrix rows/cols silently reorder); skipping `sort_keys=True` (JSON byte-diffs across runs); reporting only accuracy on imbalanced data (a model that predicts 'ham' for everything gets 80% accuracy — the per-class recall for spam is what you should actually report).",
        portfolioRelevance:
          "A `metrics.json` committed alongside `report.md` — both byte-reproducible — is the highest-trust artefact a junior can ship. Reviewers verify by running `make all` and diffing.",
        finalExplanation:
          "Evaluation is a three-view discipline: headline (accuracy), structure (confusion matrix), breakdown (per-class). One view always lies; three views together tell the truth.",
        misconceptionToWatchFor:
          "Believing 'high accuracy = good model'. On imbalanced data, a constant-predictor can hit 80%+ accuracy. Always look at the confusion matrix.",
      }),
    },
    {
      stepNumber: 5,
      title: "Local explainability — top-k coefficients per class → report.md",
      instructionMd:
        "Write `src/explain.py` exposing `explain(model: LogisticRegression, vectorizer: TfidfVectorizer, k: int = 10) -> dict` that returns `{class_name: {top_positive: [(token, weight), ...], top_negative: [(token, weight), ...]}}`. For a binary `LogisticRegression`, `model.coef_` is shape `(1, n_features)` and `vectorizer.get_feature_names_out()` is the vocabulary in the same column order. The most-POSITIVE coefficients are the strongest signals for `model.classes_[1]`; the most-NEGATIVE are the strongest for `model.classes_[0]`. Sort `coef_[0]` ascending, take the first k (most-negative) and last k (most-positive), pair with token names, write to `report.md` as two markdown tables. Why this matters: a linear model is auditable BY DEFINITION. Anyone can read the report and see 'top spam signal: \"free money\" (+2.3); top ham signal: \"meeting at\" (-1.8)'. This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.",
      learningObjective:
        "Local explainability for linear models = `coef_` + `get_feature_names_out()` + sort. The most-readable model audit in supervised ML, free and built-in.",
      requiredSkill: "sklearn coef_ inspection + get_feature_names_out + numpy argsort + markdown table writer",
      starterCode: SRC(`# src/explain.py
from pathlib import Path
import numpy as np

def explain(model, vectorizer, k: int = 10) -> dict:
    feature_names = vectorizer.get_feature_names_out()
    coef = model.coef_[0]
    order = np.argsort(coef)
    # TODO: most_negative_idx = order[:k]; most_positive_idx = order[-k:][::-1]
    # TODO: return {"top_positive": [(feature_names[i], float(coef[i])) for i in most_positive_idx], ...}
    return {}

def write_report(explanation: dict, model, out_path: str = "report.md") -> None:
    # TODO: write a markdown report with two tables (top positive / top negative)
    #       and a header line naming the positive class (model.classes_[1]).
    pass
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "Learner attests the explainability report is correct.", {
        attestationCriteria: [
          "explain returns exactly k top_positive pairs sorted by coefficient descending and k top_negative pairs sorted by coefficient ascending.",
          "Token-weight pairs are derived from vectorizer.get_feature_names_out() indexed by np.argsort(model.coef_[0]).",
          "write_report produces a report.md with two markdown tables (top positive / top negative) labelled with the positive class name from model.classes_[1].",
          "The report is human-readable in 30 seconds — a reviewer can scan the top spam-indicator tokens and their weights.",
        ],
      }),
      expectedOutputs: { reportWritten: true, modelAudited: true },
      datasetRefs: [],
      pedagogy: pedagogyConfig({
        hints: [
          "Binary LogisticRegression: `model.coef_` is shape `(1, n_features)` — index `[0]` to get the 1-D weight vector.",
          "`np.argsort(coef)` returns indices that would sort ASC. First k = most-negative; last k = most-positive (reverse with `[::-1]` for descending presentation).",
          "`vectorizer.get_feature_names_out()` returns the vocabulary in the SAME COLUMN ORDER as `coef_` — index `[i]` gives the token at coefficient position i.",
          "Markdown table: `| Token | Weight |\\n|---|---|\\n| free | +2.31 |` — keep it simple, reviewers scan it instantly.",
          "most_negative_idx = order[:k]; most_positive_idx = order[-k:][::-1]",
        ],
        successFeedback:
          "Model audit written — anyone can read report.md and see exactly which tokens drive each class prediction. Senior-tier deliverable.",
        failureFeedback:
          "Most common slips: indexing `model.coef_` without `[0]` (you get a 2D array of shape (1, n) and the sort breaks); reading `vectorizer.vocabulary_` instead of `get_feature_names_out()` (vocabulary_ is a dict, not aligned by index); presenting top-positive in ascending order (cosmetic but reads backwards to humans).",
        portfolioRelevance:
          "A `report.md` showing the top-10 spam-signal tokens (with weights) is the single most-scrutinised artefact in a junior ai-eng repo. A reviewer reads it in 30 seconds and either trusts you or doesn't.",
        finalExplanation:
          "Linear models are explainable by construction — the coefficients ARE the explanation. Tree models need SHAP, neural nets need attention probes; LogisticRegression needs a sort. That's why it belongs in every ai-engineer's foundational toolkit.",
        misconceptionToWatchFor:
          "Believing 'explainability requires SHAP or LIME'. Those are great for non-linear models. For a linear model, the coefficients themselves are the truth — anything else is overkill.",
      }),
    },
  ],
};
