/**
 * Phase 7 — Wave 1c / data-scientist (advanced).
 * Candidate a40f5e5d-01b8-4feb-aa01-dbdc7146e9ad — Notebook-to-Production Pipeline.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataScientistNotebookToProduction: AuthoredProject = {
  slug: "data-scientist-notebook-to-production",
  candidateId: "a40f5e5d-01b8-4feb-aa01-dbdc7146e9ad",
  title: "Notebook-to-Production: Polars + scikit-learn + MLflow + FastAPI",
  shortDescription:
    "Take a Jupyter notebook prototype (Polars EDA + scikit-learn model) and ship it: register the model in MLflow, wrap it in a FastAPI prediction service, add a feature-store-style preprocessing module, and integration-test the deployed endpoint.",
  fullDescription:
    "The notebook-to-production gap is THE thing data scientists get hired to close in 2026. You'll start from a Polars notebook that trains a churn model, refactor preprocessing into a reusable module, register the model + signature in MLflow, wrap it in a FastAPI service with Pydantic-typed request/response, and write integration tests that prove the API matches the notebook's predictions on a holdout set.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Polars", "scikit-learn", "MLflow", "Python", "FastAPI"],
  tags: ["polars", "scikit-learn", "mlflow", "fastapi", "data-scientist", "model-serving", "observability"],
  learningObjectives: [
    "Refactor notebook preprocessing into a deterministic Python module.",
    "Train a sklearn pipeline with Polars-to-numpy conversion + register in MLflow with a signature.",
    "Load the registered model into a FastAPI prediction service.",
    "Build a request/response schema with Pydantic that mirrors the model signature.",
    "Integration-test the service against the notebook's holdout predictions.",
  ],
  estimatedMinutes: 200,
  xpReward: 650,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Data-science team has a churn notebook that's been 'almost ready for production' for 4 months. Product needs the predictions as a live API. The notebook works; nobody knows how to ship it.",
    hiringRelevance2026:
      "Notebook-to-prod is THE data-scientist hiring filter in 2026. Recruiters want to see Polars + sklearn + MLflow + FastAPI as one cohesive workflow.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (Polars → sklearn → MLflow → FastAPI)",
      "Step 1 preprocessing module", "Step 2 sklearn pipeline + MLflow",
      "Step 3 FastAPI service", "Step 4 Pydantic schemas",
      "Step 5 integration test", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "service",
    deliverable:
      "Public GitHub repo with the notebook, refactored preprocessing module, MLflow training script, FastAPI service, Pydantic schemas, pytest suite, docker-compose for MLflow + the service, and a README walking through the notebook→service migration.",
    portfolioRelevance:
      "Notebook→production is THE hiring signal for DS in 2026. A repo that demonstrates the full lifecycle stops the interview at 'when can you start?'.",
    repoUrl: "https://github.com/<your-handle>/notebook-to-production",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Preprocessing module — deterministic + testable",
      instructionMd:
        "Refactor the notebook's preprocessing into `features.py`: a single `build_features(df: pl.DataFrame) -> pl.DataFrame` function that computes feature engineering with Polars (e.g. tenure_months, avg_monthly_charges, is_high_value). Make it pure: same input → same output, no notebook globals. Validator runs it against a fixture input + asserts exact output frame.",
      learningObjective: "Convert notebook cell sequences into a deterministic preprocessing function.",
      requiredSkill: "Polars expressions + pure functions + testable feature engineering",
      starterCode: SRC(`# features.py
import polars as pl

FEATURE_COLUMNS = ["tenure_months", "avg_monthly_charges", "is_high_value"]

def build_features(df: pl.DataFrame) -> pl.DataFrame:
    # TODO:
    # return df.with_columns(
    #   ((pl.col("signup_date").max() - pl.col("signup_date")).dt.total_days() / 30).alias("tenure_months"),
    #   (pl.col("total_charges") / pl.col("tenure_months").clip(lower_bound=1)).alias("avg_monthly_charges"),
    #   (pl.col("total_charges") > 1000).alias("is_high_value"),
    # ).select(FEATURE_COLUMNS + ["customer_id", "churned"])
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "build_features(fixture_df) returns a Polars DataFrame with exactly the columns ['tenure_months', 'avg_monthly_charges', 'is_high_value', 'customer_id', 'churned']. Same input always produces the same output (pure function, no globals or I/O). Values match fixtures/features_expected.csv.",
      }),
      expectedOutputs: { columns: 5, deterministic: true },
      datasetRefs: ["fixtures/customers_input.csv", "fixtures/features_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Pure = no I/O, no globals, no time.now(). Pass everything in, return one thing.",
          "Polars expression chaining is more readable than .apply() — prefer with_columns + named aliases.",
          "Test BOTH happy path and edge cases (zero tenure, missing charges).",
          "Add a property test (e.g. hypothesis) that builds random valid frames and asserts no exception.",
          "(see reference above)",
        ],
        successFeedback: "Preprocessing is now a unit-testable function. The notebook just calls it; the API will too.",
        failureFeedback: "Common slips: kept .head() debug prints (changes behavior under different sizes); used pl.col() without clip (divide-by-zero for new customers).",
        portfolioRelevance: "Pure preprocessing is the bridge from 'notebook works' to 'service ships'. Senior DS interviewers ask for this explicitly.",
        finalExplanation: "Pure preprocessing functions are the contract between the model and any caller. The notebook and the service share THE SAME function.",
        misconceptionToWatchFor: "Inlining feature engineering in the FastAPI handler. The notebook and the service drift; predictions diverge.",
      }),
    },
    {
      stepNumber: 2,
      title: "sklearn pipeline + MLflow registration with signature",
      instructionMd:
        "Train a `Pipeline([('clf', LogisticRegression())])` on the Polars-derived features (call `.to_numpy()` after build_features). Log to MLflow with `mlflow.sklearn.log_model(model, 'churn-model', signature=infer_signature(X_train, y_train), input_example=X_train.head(3))`. Register as 'ChurnModel' version. Validator asserts the registered model has signature + input_example + correct stage.",
      learningObjective: "Train + log + register a sklearn model in MLflow with a typed signature.",
      requiredSkill: "sklearn Pipeline + mlflow.sklearn.log_model + infer_signature + Model Registry",
      starterCode: SRC(`# train.py
import mlflow, mlflow.sklearn
from mlflow.models.signature import infer_signature
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from features import build_features, FEATURE_COLUMNS
import polars as pl

df = pl.read_csv("customers.csv")
features = build_features(df)
X = features.select(FEATURE_COLUMNS).to_numpy()
y = features["churned"].to_numpy()
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

mlflow.set_tracking_uri("http://mlflow:5000")
mlflow.set_experiment("churn")

with mlflow.start_run() as run:
    pipe = Pipeline([("clf", LogisticRegression(max_iter=1000))])
    pipe.fit(X_train, y_train)
    sig = infer_signature(X_train, pipe.predict_proba(X_train)[:, 1])
    # TODO: mlflow.sklearn.log_model(pipe, "model", signature=sig, input_example=X_train[:3])
    # TODO: result = mlflow.register_model(model_uri=f"runs:/{run.info.run_id}/model", name="ChurnModel")
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "After running train.py: MLflow Model Registry has a 'ChurnModel' entry at version 1. The registered model has a signature with 3 input columns (matching FEATURE_COLUMNS) and an input_example artifact present.",
      }),
      expectedOutputs: { modelRegistered: true, signatureInputs: 3 },
      datasetRefs: ["fixtures/customers.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "infer_signature inspects (X, y) and stores column types — the serving layer reads it.",
          "input_example=X_train[:3] gives MLflow an example to render in the UI and validate request schemas.",
          "register_model promotes from a run-scoped artifact to a versioned, queryable Model Registry entry.",
          "mlflow.sklearn.log_model(pipe, 'model', signature=sig, input_example=X_train[:3]); mlflow.register_model(f'runs:/{run.info.run_id}/model', 'ChurnModel')",
          "(see reference above)",
        ],
        successFeedback: "Model is now a first-class entity with a contract. Serving knows the schema.",
        failureFeedback: "Common slips: skipped signature (serving accepts anything → silent prediction failures); didn't fix random_state (non-reproducible).",
        portfolioRelevance: "MLflow + signature is the modern model-registry pattern. Recruiters know this is the 'I've shipped' signal.",
        finalExplanation: "Signature + input_example transform 'a pickle on disk' into 'a model with a typed API'. Everything downstream depends on it.",
        misconceptionToWatchFor: "Skipping the registry and loading from runs:/ directly. Works once; breaks the second the run is archived.",
      }),
    },
    {
      stepNumber: 3,
      title: "FastAPI prediction service",
      instructionMd:
        "Write `service.py`: load `models:/ChurnModel/latest` once at startup via lifespan, expose `POST /predict` that takes a list of customer feature dicts and returns probabilities. Use Pydantic models for request + response. Validator boots the app + posts 3 rows + asserts response shape + probabilities in [0,1].",
      learningObjective: "Serve a registered MLflow model via FastAPI with Pydantic-typed I/O.",
      requiredSkill: "FastAPI lifespan + mlflow.pyfunc.load_model + Pydantic request/response",
      starterCode: SRC(`# service.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel
import mlflow.pyfunc, numpy as np

model = {"obj": None}

@asynccontextmanager
async def lifespan(app: FastAPI):
    mlflow.set_tracking_uri("http://mlflow:5000")
    model["obj"] = mlflow.pyfunc.load_model("models:/ChurnModel/latest")
    yield
    model["obj"] = None

app = FastAPI(lifespan=lifespan)

class PredictRequest(BaseModel):
    rows: list[dict]

class PredictResponse(BaseModel):
    probabilities: list[float]

@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest) -> PredictResponse:
    # TODO: build X numpy from req.rows in FEATURE_COLUMNS order
    # TODO: probs = model["obj"].predict(X)[:, 1] if predict_proba shape else model["obj"].predict(X)
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "POST /predict with 3 valid rows returns HTTP 200 with body {probabilities: [p1, p2, p3]}. All three probabilities are floats in [0, 1].",
      }),
      expectedOutputs: { field: "probabilities", len: 3 },
      datasetRefs: ["fixtures/predict_request.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Lifespan = startup/shutdown context — load the model ONCE, not per request.",
          "models:/ChurnModel/latest resolves to the latest registered version automatically.",
          "Order features deterministically (FEATURE_COLUMNS) — dicts have no guaranteed order across clients.",
          "X = np.array([[row[c] for c in FEATURE_COLUMNS] for row in req.rows], dtype=float)\\nreturn PredictResponse(probabilities=list(model['obj'].predict(X)))",
          "(see reference above)",
        ],
        successFeedback: "Service ships. POST a row, get a probability back.",
        failureFeedback: "Common slips: loaded model per-request (latency spike + memory bloat); didn't fix feature order (predictions silently wrong for non-conformant clients).",
        portfolioRelevance: "MLflow + FastAPI lifespan is the canonical 2026 prediction-service pattern.",
        finalExplanation: "Lifespan is FastAPI's startup hook. It's where ALL one-time model/db setup belongs.",
        misconceptionToWatchFor: "Loading the model at module import. Works in dev, breaks under uvicorn with multiple workers + during reloads.",
      }),
    },
    {
      stepNumber: 4,
      title: "Pydantic schemas matching MLflow signature",
      instructionMd:
        "Refine `PredictRequest` to type each row explicitly: `class CustomerFeatures(BaseModel) { tenure_months: float; avg_monthly_charges: float; is_high_value: bool }` and `PredictRequest.rows: list[CustomerFeatures]`. Now invalid types fail at the FastAPI 422 boundary. Validator posts row with `is_high_value: 'yes'` and asserts 422.",
      learningObjective: "Enforce the model's input contract at the API boundary via Pydantic typing.",
      requiredSkill: "Pydantic typed nested models + FastAPI 422 boundary",
      starterCode: SRC(`# schemas.py
from pydantic import BaseModel

class CustomerFeatures(BaseModel):
    tenure_months: float
    avg_monthly_charges: float
    is_high_value: bool

class PredictRequest(BaseModel):
    rows: list[CustomerFeatures]

class PredictResponse(BaseModel):
    probabilities: list[float]
# TODO: import these in service.py and replace the loose list[dict] request shape.
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "POST /predict with {rows: [{tenure_months: 1.0, avg_monthly_charges: 50.0, is_high_value: 'yes'}]} returns HTTP 422. The error response body mentions 'is_high_value' as the invalid field.",
      }),
      expectedOutputs: { status: 422, field: "is_high_value" },
      datasetRefs: ["fixtures/bad_predict_request.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Typed Pydantic models = FastAPI returns clean 422s with field paths.",
          "If you ever change the model's feature set, change the Pydantic class — the API contract follows.",
          "Auto-doc bonus: /docs now shows the exact request shape with example values.",
          "Use Field(..., description='...', ge=0) to add docs + value constraints (e.g. tenure_months ≥ 0).",
          "(see reference above)",
        ],
        successFeedback: "Bad clients now get a clear 422 instead of a confusing 500.",
        failureFeedback: "Common slips: kept list[dict] (any nonsense gets through and crashes the model); used Dict[str, Any] (same problem).",
        portfolioRelevance: "Pydantic-typed APIs are the modern Python signal. Hand-rolled JSON parsing is the bootcamp tell.",
        finalExplanation: "Typed I/O moves error detection from runtime (500) to validation (422). Faster debugging, better client experience.",
        misconceptionToWatchFor: "Trusting the model's training schema as the only contract. The API needs its own typed boundary too.",
      }),
    },
    {
      stepNumber: 5,
      title: "Integration test: notebook ↔ service parity",
      instructionMd:
        "Write `test_parity.py` that loads the same holdout set the notebook used, calls `service.predict()` via httpx AsyncClient, and asserts probabilities match notebook predictions to within 1e-6 elementwise. Validator runs the test + asserts pass.",
      learningObjective: "Prove the service produces the same predictions as the notebook — close the notebook-to-prod gap with evidence.",
      requiredSkill: "pytest + httpx AsyncClient + numerical parity testing",
      starterCode: SRC(`# tests/test_parity.py
import pytest, httpx, numpy as np, polars as pl, mlflow.pyfunc
from app.service import app
from app.features import build_features, FEATURE_COLUMNS

@pytest.mark.asyncio
async def test_service_matches_notebook():
    holdout = pl.read_csv("tests/fixtures/holdout.csv")
    features = build_features(holdout)
    X = features.select(FEATURE_COLUMNS).to_numpy()

    nb_model = mlflow.pyfunc.load_model("models:/ChurnModel/latest")
    nb_preds = nb_model.predict(X)

    rows = [dict(zip(FEATURE_COLUMNS, row)) for row in X.tolist()]
    async with httpx.AsyncClient(app=app, base_url="http://test") as c:
        r = await c.post("/predict", json={"rows": rows})

    api_preds = np.array(r.json()["probabilities"])
    # TODO: np.testing.assert_allclose(nb_preds, api_preds, atol=1e-6)
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "test_service_matches_notebook passes: for all 100 rows in the holdout set, probabilities returned by POST /predict match mlflow.pyfunc predictions on the same features within atol=1e-6 elementwise (np.testing.assert_allclose).",
      }),
      expectedOutputs: { atol: 1e-6, rows: 100 },
      datasetRefs: ["fixtures/holdout.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Parity test = the strongest possible proof that prod ≡ notebook. Run it on every release.",
          "Use the same MLflow model in both branches of the comparison — never re-train ad-hoc in a test.",
          "atol=1e-6 catches floating-point drift; loosen to 1e-4 only if you have evidence of acceptable serialization rounding.",
          "np.testing.assert_allclose(notebook_predictions, api_predictions, atol=1e-6)",
          "(see reference above)",
        ],
        successFeedback: "The team can now confidently say 'the service is the notebook'. That's the whole point.",
        failureFeedback: "Common slips: re-trained inside the test (random init drift); compared against a hand-coded baseline (drifts as the model evolves).",
        portfolioRelevance: "A parity test is the strongest 'shipped a model' signal. Hiring managers see it and know you understand reproducibility.",
        finalExplanation: "Parity tests are the production-DS equivalent of unit tests for engineers. They prove the system behaves as intended.",
        misconceptionToWatchFor: "Skipping parity testing because 'it's the same model'. Serialization + I/O paths add drift you must measure.",
      }),
    },
  ],
};
