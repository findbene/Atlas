/**
 * Phase 20 — mlops-engineer beginner/foundations seed (net-new). Closes the
 * Start Here gap for the last of the four zero-beginner courses surfaced by
 * Phase 18. "Foundations" framing (difficulty=beginner for invariants)
 * because mlops-engineer learners typically arrive with basic Python +
 * sklearn but no operational discipline.
 *
 * Candidate c20a7b0d-4e5f-4a61-8c8d-9e0f12345678 — Build a foundational
 * REPRODUCIBLE local training pipeline: pin data version → set seeds →
 * save versioned artifacts → verify replay → publish a runs catalog.
 * No Docker, no Kubernetes, no cloud, no MLflow service. Every artefact
 * lives in `runs/<timestamp>__<short_hash>/` on the local filesystem.
 * The transferable mental model (data version + run config + serialized
 * model + metrics + replay test) maps 1:1 onto MLflow / W&B / Vertex /
 * SageMaker on day one of the next module.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const mlopsEngineerFoundationsReproducibleLocalTrainingPipeline: AuthoredProject = {
  slug: "mlops-engineer-foundations-reproducible-local-training-pipeline",
  candidateId: "c20a7b0d-4e5f-4a61-8c8d-9e0f12345678",
  title: "MLOps Foundations — Reproducible Local Training Pipeline (Data Hash → Seeded Train → Versioned Artifacts → Replay → Runs Catalog)",
  shortDescription:
    "Build the five canonical reproducibility moves of a training pipeline on your laptop — no Docker, no K8s, no cloud, no MLflow service. Hash-pin the input data, seed every source of randomness, save versioned artifacts under runs/<timestamp>__<hash>/, write a replay verifier that re-loads a run and asserts identical metrics, and publish a `runs/index.md` catalog. Same disciplines that MLflow / W&B / Vertex enforce, learned locally first.",
  fullDescription:
    "Most mlops tutorials throw you at MLflow + Kubernetes + a cloud bucket and you spend three days on YAML before training a single model. This project teaches the *transferable* mlops mental model — data versioning, seed pinning, versioned artifacts, replay verification, run cataloguing — entirely locally with the Python standard library + joblib. The five moves (SHA256 the input CSV into `data_manifest.json`, set `numpy`/`random`/`sklearn`/`PYTHONHASHSEED` seeds in `run_config.json`, save model + metrics + features schema under `runs/<utc_iso>__<hash[:8]>/`, write a `replay(run_dir) -> bool` that re-trains from the pinned config and data and asserts metric equality within `1e-9`, and generate a `runs/index.md` catalog table) are the same disciplines every production mlops platform enforces. The repo is byte-reproducible: `make train` from a clean checkout produces a run whose metrics match the README's reference metrics exactly.",
  language: "python",
  difficulty: "beginner",
  techStack: ["Python", "scikit-learn", "joblib", "numpy", "hashlib"],
  tags: ["mlops-engineer", "beginner", "foundations", "reproducibility", "versioning", "local-only"],
  learningObjectives: [
    "Hash-pin a training dataset with `hashlib.sha256` over a deterministic-ordered CSV and write `data_manifest.json` so any future re-train is checked against the same bytes.",
    "Set every source of randomness explicitly (`numpy.random.seed`, `random.seed`, `PYTHONHASHSEED`, sklearn `random_state`) and serialize the seed bundle into `run_config.json`.",
    "Save versioned training artifacts under `runs/<utc_iso>__<short_hash>/` (model.joblib, features.json, metrics.json, run_config.json, data_manifest.json) — never overwrite a run.",
    "Write a `replay(run_dir) -> bool` that re-loads a run's config + data + retrains and asserts metric equality within `1e-9` — the reproducibility contract is checkable.",
    "Publish `runs/index.md` — a markdown table of every historical run with timestamp, data hash, seed, headline metric, and a link to the run dir.",
  ],
  estimatedMinutes: 180,
  xpReward: 540,
  isMultiFile: false,
  meta: projectMeta({
    scenario:
      "Junior mlops candidate at a 2026 fintech. The data-science team retrains a churn model weekly but no one can reproduce last quarter's numbers — random seeds drift, the training CSV gets silently overwritten, and there's no manifest of what ran when. You build the foundational local pipeline that pins all five — data hash, seed bundle, versioned artifacts, replay verifier, runs catalog — proving the discipline end-to-end on your laptop before the team adopts MLflow on Vertex.",
    hiringRelevance2026:
      "Reproducibility-by-construction is the 2026 mlops interview signal. Candidates who can articulate why `data_manifest.json` + `run_config.json` + a `replay()` function matter — and have a runnable local repo proving they understand it — are the ones platform teams hire. MLflow / W&B / Vertex are just hosted versions of these five moves; learning them locally first is the cheap, transferable path.",
    readmeOutline: [
      "Overview — local-first reproducibility, transferable model",
      "Setup (uv or pip install scikit-learn joblib)",
      "Step 1: hash-pin the input data → data_manifest.json",
      "Step 2: pin every seed → run_config.json",
      "Step 3: save versioned artifacts → runs/<iso>__<hash>/",
      "Step 4: replay verifier (re-train, assert metric eq)",
      "Step 5: publish runs/index.md catalog",
      "Portfolio Hand-off (Makefile + reference metrics + replay test)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: `src/data_manifest.py` (sha256 the training CSV), `src/seeds.py` (pin numpy/random/sklearn/PYTHONHASHSEED), `src/train.py` (LogisticRegression train + versioned save under `runs/`), `src/replay.py` (re-train from a run dir, assert metric equality), `src/catalog.py` (walk runs/ → `runs/index.md`), `fixtures/training.csv`, `tests/test_replay.py` (CI proves replay holds), `Makefile` (`make train` → new run; `make replay RUN=<dir>` → verify; `make catalog` → regenerate index). README must pin reference metrics and the reference data hash.",
    portfolioRelevance:
      "An mlops-foundations repo where `make train` then `make replay` produces an identical metric within `1e-9` — with the data hash, seed bundle, and runs catalog all visible — is the highest-signal junior mlops artefact. The five locally-enforced disciplines map 1:1 to every hosted platform.",
    repoUrl: "https://github.com/<your-handle>/mlops-foundations-reproducible-local-training",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Hash-pin the input data → data_manifest.json",
      instructionMd:
        "Write `src/data_manifest.py` exposing `manifest(csv_path: str) -> dict` that reads the CSV bytes, computes `hashlib.sha256(bytes).hexdigest()`, and returns `{path, sha256, n_rows, n_bytes, captured_at_utc}`. CRITICAL: hash the RAW BYTES of the file, NOT the parsed pandas DataFrame — DataFrame ordering can vary across pandas versions for the same source bytes. Then `write_manifest(manifest_dict, out_path: str)` writes deterministic JSON (`sort_keys=True, indent=2`). Why: if the CSV silently changes (a row gets appended, a column gets a new whitespace) the hash mismatches and the replay verifier in step 4 will fail loudly. Without this, 'reproducible' is wishful thinking.",
      learningObjective:
        "Reproducibility starts at the data boundary. Hash the raw bytes — not the parsed structure — so any change is detected at load time, not at training time.",
      requiredSkill: "hashlib.sha256 over file bytes + JSON manifest with deterministic ordering",
      starterCode: SRC(`# src/data_manifest.py
import hashlib, json
from pathlib import Path
from datetime import datetime, timezone

def manifest(csv_path: str) -> dict:
    p = Path(csv_path)
    data = p.read_bytes()
    # TODO: sha256 over the raw bytes
    digest = hashlib.sha256(data).hexdigest()
    # TODO: n_rows = data.count(b"\\n")
    return {
        "path": str(p),
        "sha256": digest,
        "n_rows": 0,
        "n_bytes": len(data),
        "captured_at_utc": datetime.now(timezone.utc).isoformat(),
    }

def write_manifest(m: dict, out_path: str) -> None:
    Path(out_path).write_text(json.dumps(m, sort_keys=True, indent=2))
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "manifest returns {path, sha256 (64-char hex), n_rows, n_bytes, captured_at_utc (ISO-8601 UTC)}; the same input file produces the same sha256 across runs; write_manifest output is sort_keys-stable.", {
        expected: {
          sha256SixtyFourHex: true,
          sameInputSameHash: true,
          manifestHasFiveFields: true,
          jsonSortKeysStable: true,
        },
      }),
      expectedOutputs: { manifestWritten: true, hashStable: true },
      datasetRefs: ["fixtures/training.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`Path(csv_path).read_bytes()` gives you the raw file bytes — no parsing, no normalization.",
          "`hashlib.sha256(bytes).hexdigest()` returns a 64-char hex string. Stable across machines, OS, and Python versions.",
          "Count rows from the raw bytes for the manifest (`data.count(b'\\n')`) so you don't pull pandas just for the count.",
          "`datetime.now(timezone.utc).isoformat()` produces a parseable, timezone-aware string. Always tag artifacts with UTC.",
          "json.dumps(m, sort_keys=True, indent=2)",
        ],
        successFeedback:
          "Data manifest pinned — any future re-load checks bytes against this hash and fails loudly on drift.",
        failureFeedback:
          "Most common slips: hashing the parsed DataFrame (`hashlib.sha256(df.to_csv().encode())` — pandas-version-dependent); skipping the timestamp (you lose the capture-time provenance); using `json.dumps(m)` without `sort_keys=True` (byte-diffs across runs invalidate replay).",
        portfolioRelevance:
          "A `data_manifest.json` next to your training CSV is the first artefact a senior mlops reviewer opens — it tells them immediately whether reproducibility is taken seriously here.",
        finalExplanation:
          "The data manifest IS the contract between the training run and the world. If the bytes change, the manifest changes, and the replay fails. That's reproducibility-by-construction at its simplest.",
        misconceptionToWatchFor:
          "Believing 'the filename is enough; I named it training_v1.csv'. Filenames lie. Hashes don't.",
      }),
    },
    {
      stepNumber: 2,
      title: "Pin every seed → run_config.json",
      instructionMd:
        "Write `src/seeds.py` exposing `pin_seeds(seed: int = 42) -> dict` that sets ALL of: `random.seed(seed)`, `numpy.random.seed(seed)`, `os.environ['PYTHONHASHSEED'] = str(seed)`, and returns `{python_hash_seed, random_seed, numpy_seed, sklearn_random_state}` so the seed bundle is recorded for the run config. Then `write_run_config(seed_bundle, model_params, data_manifest_sha256, out_path)` writes deterministic JSON. Why pin all four: each source of randomness lives in a different library; missing even one makes the run irreproducible. sklearn's `random_state` is passed PER-MODEL — the bundle records the value the trainer will pass in step 3.",
      learningObjective:
        "Pinning seeds is a 4-source discipline (Python random, NumPy, PYTHONHASHSEED, sklearn random_state) — miss one and reproducibility collapses silently.",
      requiredSkill: "random.seed + numpy.random.seed + os.environ['PYTHONHASHSEED'] + sklearn random_state",
      starterCode: SRC(`# src/seeds.py
import os, random, json
from pathlib import Path
import numpy as np

def pin_seeds(seed: int = 42) -> dict:
    # TODO: random.seed(seed)
    # TODO: np.random.seed(seed)
    # TODO: os.environ["PYTHONHASHSEED"] = str(seed)
    return {
        "python_hash_seed": str(seed),
        "random_seed": seed,
        "numpy_seed": seed,
        "sklearn_random_state": seed,
    }

def write_run_config(
    seed_bundle: dict, model_params: dict, data_sha256: str, out_path: str,
) -> None:
    cfg = {
        "seeds": seed_bundle,
        "model_params": model_params,
        "data_sha256": data_sha256,
    }
    Path(out_path).write_text(json.dumps(cfg, sort_keys=True, indent=2))
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "pin_seeds sets all 4 randomness sources (random, numpy, PYTHONHASHSEED, sklearn record); same seed→same numpy.random.rand() output; run_config.json has seeds, model_params, data_sha256 with sort_keys-stable JSON.", {
        expected: {
          allFourSeedsPinned: true,
          numpyRandomReproducible: true,
          runConfigHasThreeSections: true,
          envHashSeedSet: true,
        },
      }),
      expectedOutputs: { seedsBundled: true, configWritten: true },
      datasetRefs: [],
      pedagogy: pedagogyConfig({
        hints: [
          "`random.seed(seed)` seeds Python's stdlib random. Used for shuffles, sampling, etc.",
          "`np.random.seed(seed)` seeds NumPy's legacy RNG. sklearn often falls back to numpy randomness for non-`random_state`-aware code paths.",
          "`os.environ['PYTHONHASHSEED'] = str(seed)` makes dict/set iteration order stable across runs (Python randomises hash seed by default for security).",
          "sklearn `random_state=seed` is passed PER-MODEL constructor; the run config just records the value so future replays use the same one.",
          "os.environ['PYTHONHASHSEED'] = str(seed); random.seed(seed); np.random.seed(seed)",
        ],
        successFeedback:
          "All four randomness sources pinned + recorded — the run is now reproducible to the digit.",
        failureFeedback:
          "Most common slips: only seeding numpy (Python stdlib random can still flip a coin); forgetting PYTHONHASHSEED (dict/set iteration order drifts, training-data shuffle order changes); pinning seeds at the top of train.py but not recording them in run_config.json (future replays can't recover the seed bundle).",
        portfolioRelevance:
          "A senior reviewer searches your repo for `random_state=` and expects to see it everywhere a randomness-aware sklearn class is constructed. Missing one is a yellow flag.",
        finalExplanation:
          "Determinism is multiplicative: 4 sources of randomness, all must be pinned. The bundle pattern (`pin_seeds()` returns a dict you record) makes it explicit and auditable.",
        misconceptionToWatchFor:
          "Believing 'random_state=42 on the model is enough'. It isn't — anything that calls `random.random()` or `np.random.rand()` without an explicit RNG will drift.",
      }),
    },
    {
      stepNumber: 3,
      title: "Save versioned artifacts → runs/<utc_iso>__<hash>/",
      instructionMd:
        "Write `src/train.py` exposing `train_and_save(csv_path, runs_root='runs') -> str` that: (1) builds the data manifest, (2) pins seeds, (3) loads the CSV, splits (stratified, `random_state=42`), fits a `LogisticRegression(random_state=42)`, evaluates, then (4) writes ALL of `model.joblib`, `metrics.json`, `features.json` (the trained vectorizer's vocabulary), `run_config.json`, `data_manifest.json` into `runs/<utc_iso>__<short_hash>/` where `short_hash = sha256(data_manifest + run_config)[:8]`. Returns the run directory path. CRITICAL: the run dir name combines time + content hash — time gives ordering, hash gives content-addressing. NEVER overwrite a run; each call MUST create a fresh dir.",
      learningObjective:
        "Versioned artifacts = time-ordered + content-addressed + never-overwritten. The same three properties every hosted mlops platform enforces — learned locally.",
      requiredSkill: "joblib.dump + pathlib.Path.mkdir(parents=True) + content-addressed directory naming",
      starterCode: SRC(`# src/train.py
import hashlib, json
from datetime import datetime, timezone
from pathlib import Path
import joblib
from src.data_manifest import manifest, write_manifest
from src.seeds import pin_seeds, write_run_config

def _short_hash(manifest_json: str, run_config_json: str) -> str:
    h = hashlib.sha256((manifest_json + run_config_json).encode()).hexdigest()
    return h[:8]

def train_and_save(csv_path: str, runs_root: str = "runs") -> str:
    seeds = pin_seeds(42)
    m = manifest(csv_path)
    model_params = {"class_weight": "balanced", "max_iter": 1000, "random_state": 42}
    # TODO: build run_config dict, compute short_hash, mkdir runs/<iso>__<hash>/
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    # TODO: train the LogisticRegression, dump model.joblib, write metrics.json + features.json
    # TODO: also write run_config.json + data_manifest.json into the run dir
    return ""
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "train_and_save creates runs/<utc_iso>__<short_hash>/ with all 5 files (model.joblib, metrics.json, features.json, run_config.json, data_manifest.json); never overwrites an existing dir; short_hash derived from manifest+config bytes.", {
        expected: {
          fiveArtifactsWritten: true,
          dirNameHasTimestampAndHash: true,
          neverOverwritesExistingDir: true,
          shortHashDerivedFromContent: true,
          modelLoadableWithJoblib: true,
        },
      }),
      expectedOutputs: { runDirCreated: true, allArtifactsPresent: true },
      datasetRefs: ["fixtures/training.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`joblib.dump(model, path)` is the canonical sklearn-model serializer — handles sparse matrices + estimators correctly.",
          "Run dir name pattern: `runs/20260523T180530Z__a1b2c3d4/` — time-sorted lexicographically AND content-addressed.",
          "`Path(...).mkdir(parents=True, exist_ok=False)` — `exist_ok=False` enforces the never-overwrite rule by raising on a collision.",
          "`features.json` stores `vectorizer.get_feature_names_out().tolist()` — the vocabulary IS part of the model state.",
          "ts = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'); run_dir = Path(runs_root) / f'{ts}__{short_hash}'",
        ],
        successFeedback:
          "Versioned artifacts written — every run is content-addressed, time-ordered, and immutable. The five-file pattern mirrors what MLflow stores per run.",
        failureFeedback:
          "Most common slips: using `pickle.dump` instead of `joblib.dump` (pickle struggles with sparse matrices); allowing overwrite (one re-run silently destroys an earlier audit trail); naming dirs by timestamp ONLY (two runs in the same second collide; the content hash prevents this).",
        portfolioRelevance:
          "A `runs/` directory committed to the repo with 3-5 historical runs visible — each with all 5 files — is the artefact that proves you treat training as an auditable activity, not a one-off.",
        finalExplanation:
          "Time + content addressing + immutability = the three primitives every mlops platform enforces. Implementing them locally in 20 lines of Python proves you understand the contract, not just the tool.",
        misconceptionToWatchFor:
          "Believing 'I'll just commit the model.joblib to git and overwrite the metrics.json each run'. You lose the audit trail the moment something changes. Versioned dirs cost nothing and save you on day 30.",
      }),
    },
    {
      stepNumber: 4,
      title: "Replay verifier — re-load a run and assert metric equality within 1e-9",
      instructionMd:
        "Write `src/replay.py` exposing `replay(run_dir: str) -> dict` that: (1) reads `run_config.json` + `data_manifest.json` from the run dir, (2) re-hashes the source CSV at the path in the manifest and ASSERTS it matches the recorded `sha256` (else raise `ReplayError(\"data_drift: ...\")`), (3) re-pins seeds from the recorded bundle, (4) re-trains using the same code path as `train_and_save`, (5) compares new metrics to the recorded `metrics.json` and asserts equality within `1e-9` per metric. Returns `{passed: bool, original_metrics: dict, replayed_metrics: dict, max_abs_diff: float}`. Why `1e-9` and not `0.0`: floating-point summation in sparse matrix ops has machine-epsilon-level noise even with identical inputs — `1e-9` is generous enough to absorb that without hiding real drift.",
      learningObjective:
        "A replay verifier is the *executable* form of the reproducibility contract — if it fails, your manifest/seeds/code aren't actually deterministic.",
      requiredSkill: "JSON load + sha256 re-verification + dict-of-floats comparison with tolerance + custom exception",
      starterCode: SRC(`# src/replay.py
import hashlib, json
from pathlib import Path
from src.seeds import pin_seeds
from src.train import train_and_save  # or factor out the inner training fn

class ReplayError(RuntimeError):
    pass

def _max_abs_diff(a: dict, b: dict) -> float:
    keys = set(a) & set(b)
    diffs = []
    for k in keys:
        if isinstance(a[k], (int, float)) and isinstance(b[k], (int, float)):
            diffs.append(abs(float(a[k]) - float(b[k])))
    return max(diffs) if diffs else 0.0

def replay(run_dir: str) -> dict:
    rd = Path(run_dir)
    cfg = json.loads((rd / "run_config.json").read_text())
    man = json.loads((rd / "data_manifest.json").read_text())
    orig_metrics = json.loads((rd / "metrics.json").read_text())

    # TODO: re-hash man["path"], raise ReplayError("data_drift: ...") on mismatch
    # TODO: pin_seeds from cfg["seeds"]["random_seed"], retrain, get replayed metrics
    # TODO: compute max_abs_diff(orig, replayed); passed = diff <= 1e-9
    return {"passed": False, "original_metrics": orig_metrics, "replayed_metrics": {}, "max_abs_diff": float("inf")}
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "replay(run_dir) on an unmodified run returns passed=True and max_abs_diff ≤ 1e-9; replay on a run whose source CSV was modified raises ReplayError starting with 'data_drift:'.", {
        expected: { max_abs_diff: 0.0, passed: 1 },
        tolerance: 0.000000001,
      }),
      expectedOutputs: { replayPasses: true, driftDetected: true },
      datasetRefs: ["fixtures/training.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Re-hash the source CSV with `hashlib.sha256(Path(man['path']).read_bytes()).hexdigest()` — same function as the manifest creator.",
          "Raise a CUSTOM exception (`ReplayError`) so callers can distinguish 'replay failed because of drift' from 'replay failed because of a bug'.",
          "`1e-9` tolerance absorbs FP-summation noise without hiding actual non-determinism — 1e-12 is too tight, 1e-6 hides bugs.",
          "Compare metrics dict-wise: iterate the intersection of keys, take `max(abs(a-b))` over numeric values only (skip string keys like 'model_version').",
          "if hashlib.sha256(Path(man['path']).read_bytes()).hexdigest() != man['sha256']: raise ReplayError(f'data_drift: ...')",
        ],
        successFeedback:
          "Replay verifier wired — the reproducibility contract is now CHECKABLE. CI can prove it holds on every commit.",
        failureFeedback:
          "Most common slips: tolerance=0.0 (FP-noise causes spurious failures); silent return False instead of ReplayError on drift (callers can't distinguish failure modes); skipping the re-hash (you 'replay' against drifted data and pass false-positively).",
        portfolioRelevance:
          "A `tests/test_replay.py` that runs in CI and proves the latest run replays within `1e-9` is THE artefact that distinguishes 'mlops-curious' from 'mlops-trustworthy'.",
        finalExplanation:
          "Reproducibility you can't check isn't reproducibility. A replay verifier is the only thing that proves the contract holds; everything else is aspirational documentation.",
        misconceptionToWatchFor:
          "Believing 'if I pinned the seeds, replay is automatic'. Untrue — code paths change, dependency versions drift, FP-summation reorders. Only the verifier proves the contract.",
      }),
    },
    {
      stepNumber: 5,
      title: "Publish runs/index.md — the local runs catalog",
      instructionMd:
        "Write `src/catalog.py` exposing `build_catalog(runs_root: str = 'runs', out_path: str = 'runs/index.md') -> dict`: walks `runs_root`, for each run dir reads `run_config.json` + `metrics.json`, builds a markdown table (`| Run Dir | Timestamp (UTC) | Data SHA256 | Seed | Accuracy | Status |`) sorted by run-dir name DESC (newest first), and writes to `out_path`. Returns `{n_runs, headline_metric, runs: [...]}` summary. Why a catalog: a `runs/` directory with 12 versioned subdirs is unreadable; a 12-row markdown table is the human interface. Same role as MLflow's runs page, locally.",
      learningObjective:
        "A runs catalog is the human interface to versioned training history — the local analog of MLflow's runs UI, in markdown, free.",
      requiredSkill: "pathlib walk + JSON load per dir + markdown table writer + DESC sort",
      starterCode: SRC(`# src/catalog.py
import json
from pathlib import Path

HEADER = "| Run Dir | Timestamp (UTC) | Data SHA256 | Seed | Accuracy | Status |"
SEP    = "|---|---|---|---|---|---|"

def build_catalog(runs_root: str = "runs", out_path: str = "runs/index.md") -> dict:
    root = Path(runs_root)
    rows: list[dict] = []
    for run_dir in sorted([p for p in root.iterdir() if p.is_dir()], reverse=True):
        try:
            cfg = json.loads((run_dir / "run_config.json").read_text())
            metrics = json.loads((run_dir / "metrics.json").read_text())
            rows.append({
                "run_dir": run_dir.name,
                "data_sha256": cfg["data_sha256"][:12],
                "seed": cfg["seeds"]["random_seed"],
                "accuracy": metrics.get("accuracy"),
                "status": "ok",
            })
        except (FileNotFoundError, KeyError, json.JSONDecodeError):
            rows.append({"run_dir": run_dir.name, "status": "incomplete"})
    # TODO: render markdown table, write to out_path, return summary dict
    return {"n_runs": len(rows), "headline_metric": "accuracy", "runs": rows}
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "build_catalog walks runs_root, sorts DESC by dir name, tolerates incomplete runs (status='incomplete'), writes runs/index.md as a markdown table, and returns {n_runs, headline_metric, runs}.", {
        expected: {
          walksRunsRoot: true,
          sortedDescByDirName: true,
          tolerantToIncompleteRuns: true,
          markdownTableWritten: true,
          summaryHasNRuns: true,
        },
      }),
      expectedOutputs: { catalogBuilt: true, indexWritten: true },
      datasetRefs: [],
      pedagogy: pedagogyConfig({
        hints: [
          "`Path('runs').iterdir()` yields all entries; filter `if p.is_dir()` to keep only run dirs.",
          "Sort DESC by directory name — because the name starts with a sortable UTC timestamp, lexicographic DESC = chronological DESC.",
          "Catch `FileNotFoundError | KeyError | json.JSONDecodeError` per run and tag `status='incomplete'` — a partial run shouldn't crash the catalog.",
          "Markdown table: header line, separator line (`|---|`), then one row per run. Pin the headline metric (accuracy) at top-level for quick scanning.",
          "for run_dir in sorted([p for p in root.iterdir() if p.is_dir()], reverse=True):",
        ],
        successFeedback:
          "Catalog published — runs/index.md is the human interface to your training history, regeneratable in 1 second.",
        failureFeedback:
          "Most common slips: crashing on the first incomplete run (a single corrupted run dir takes the whole catalog down); sorting ASC (newest runs buried at the bottom); committing `runs/` to git without a `.gitignore` for `model.joblib` (binary bloat).",
        portfolioRelevance:
          "A `runs/index.md` checked into the repo showing 3-5 historical runs with metrics + data hashes is the README-level artefact a reviewer scans in 5 seconds to gauge your operational discipline.",
        finalExplanation:
          "The catalog is the human-readable shadow of the machine-readable runs/ tree. Both must exist; neither replaces the other.",
        misconceptionToWatchFor:
          "Believing 'I'll just `ls runs/` when I need to see history'. After 20 runs that's unreadable. A catalog table costs nothing and is the difference between an archive and an audit trail.",
      }),
    },
  ],
};
