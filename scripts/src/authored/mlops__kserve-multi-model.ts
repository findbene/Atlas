/**
 * Phase 7 — Wave 1a / mlops-engineer (advanced).
 * Candidate 0acbb8e4-0910-403f-b714-4ec2b78420ca — KServe Multi-Model Deployment (72.3).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const mlopsKserveMultiModel: AuthoredProject = {
  slug: "mlops-kserve-multi-model",
  title: "KServe Multi-Model Deployment on Kubernetes — Cohosted Inference",
  shortDescription:
    "Deploy 8 small ML models behind a single KServe InferenceService using the ModelMesh runtime, autoscale per-model traffic with KEDA, and add Prometheus latency + per-model RPS dashboards. Stops paying for one pod per model.",
  fullDescription:
    "Your company trains a model per customer (8 today, 80 next quarter). Today each model has its own Kubernetes Deployment — that's 8 idle pods burning compute 24/7. The 2026 production answer is ModelMesh: one runtime pod hosts many models, swapping them in/out of memory as traffic shifts. You'll deploy the ModelMesh runtime, register 8 sklearn models, set up KEDA autoscaling per-model RPS, and wire a Prometheus + Grafana dashboard with per-model latency P50/P99 and an SLO-burn-rate alert.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "Kubernetes", "Docker", "MLflow", "Terraform", "observability", "Prometheus"],
  tags: ["mlops", "kubernetes", "kserve", "modelmesh", "autoscaling", "observability", "ml-serving"],
  learningObjectives: [
    "Reason about per-model-pod vs co-hosted ModelMesh trade-offs (cost, cold-start, isolation).",
    "Register multiple models in a single KServe ServingRuntime via InferenceService CRs.",
    "Configure KEDA to autoscale on per-model RPS pulled from Prometheus.",
    "Instrument Python predictor handlers with prom_client and structured per-model labels.",
    "Define an SLO + multi-window burn-rate alert in Prometheus rules.",
  ],
  estimatedMinutes: 210,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "B2B SaaS trains a small XGBoost per customer. Each model has its own Deployment today. Cost is exploding as the customer count grows.",
    hiringRelevance2026:
      "Every 2026 MLOps JD that mentions Kubernetes also mentions cost-aware inference. ModelMesh + KEDA + SLO burn-rate alerts are the 2026 production stack — junior MLOps roles ask about Docker, senior roles ask about exactly this.",
    readmeOutline: [
      "Overview", "Architecture (per-pod vs ModelMesh)", "Step 1 ServingRuntime",
      "Step 2 InferenceServices", "Step 3 KEDA autoscaler", "Step 4 prom_client predictor",
      "Step 5 SLO + burn-rate alert", "Cost comparison",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "GitHub repo + a public Grafana snapshot URL. Repo includes: kubectl manifests for the ServingRuntime + 8 InferenceServices, the predictor image (Python), the KEDA ScaledObject, Prometheus rules YAML, and a cost-comparison table (per-pod vs ModelMesh) computed from a 7-day load test.",
    portfolioRelevance:
      "Most MLOps portfolios stop at 'I containerized a model'. A full ModelMesh + KEDA + SLO-alert stack with a cost-saved number signals you've done production cost engineering, not just demos.",
    repoUrl: "https://github.com/<your-handle>/kserve-multi-model",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Author the ModelMesh ServingRuntime",
      instructionMd:
        "Write a `ServingRuntime` CR for the `mlserver-mlflow` runtime: supported formats `[mlflow, sklearn]`, container image `seldonio/mlserver:1.5.0`, replicas 2, resource requests CPU=500m / mem=2Gi. ModelMesh will route prediction requests to whichever runtime pod has the requested model loaded; idle models are evicted from memory. Validator parses the YAML and asserts (a) kind=ServingRuntime, (b) supportedModelFormats includes both names, (c) replicas==2.",
      learningObjective: "Define a multi-format ServingRuntime so many models can co-tenant the same pods.",
      requiredSkill: "Kubernetes CRDs + KServe ServingRuntime spec",
      starterCode: SRC(`# k8s/serving-runtime.yaml
apiVersion: serving.kserve.io/v1alpha1
kind: ServingRuntime
metadata:
  name: mlserver-mlflow
  namespace: modelmesh-serving
spec:
  supportedModelFormats:
    # TODO: list mlflow and sklearn (autoSelect: true)
  replicas: 2
  containers:
    - name: mlserver
      image: seldonio/mlserver:1.5.0
      env:
        - name: MLSERVER_MODELS_DIR
          value: /models
      resources:
        # TODO: requests cpu=500m mem=2Gi
        limits:
          cpu: "2"
          memory: 4Gi
`),
      validationType: "exact",
      stepType: "multi_file",
      validation: validationConfig("exact", "kubectl apply --dry-run=client succeeds; ServingRuntime has the two model formats + replicas=2.", {
        expectedKind: "ServingRuntime",
        expectedFormats: ["mlflow", "sklearn"],
        expectedReplicas: 2,
      }),
      expectedOutputs: { kind: "ServingRuntime", formats: ["mlflow", "sklearn"], replicas: 2 },
      datasetRefs: ["fixtures/runtime_expected.yaml"],
      pedagogy: pedagogyConfig({
        hints: [
          "Each supportedModelFormats entry is {name, version, autoSelect}. autoSelect:true lets ModelMesh assign matching models.",
          "Requests are what the scheduler reserves; limits are the hard cap. Set requests at 500m/2Gi.",
          "supportedModelFormats:\n  - name: mlflow\n    autoSelect: true\n  - name: sklearn\n    autoSelect: true",
          "resources:\n  requests:\n    cpu: 500m\n    memory: 2Gi",
          "(see reference above)",
        ],
        successFeedback: "Runtime ready. 2 pods will now host whichever models traffic asks for, evicting cold ones to free memory.",
        failureFeedback: "Common slips: forgot autoSelect (models in those formats won't bind to this runtime); set requests == limits (no burst headroom for warm-up spikes).",
        portfolioRelevance: "Senior MLOps interviewers ask 'how do you serve N models without N pods?'. ModelMesh + the runtime spec is the textbook answer.",
        finalExplanation: "ServingRuntime is the pool. InferenceServices in the next step are the things that bind to a pool. ModelMesh is the indirection layer that lets one pool host many bindings without one pod per binding.",
        misconceptionToWatchFor: "Treating ServingRuntime like a single-tenant Deployment. The point is multi-tenancy; if you set replicas==N for N models you've defeated the architecture.",
      }),
    },
    {
      stepNumber: 2,
      title: "Register 8 InferenceServices",
      instructionMd:
        "Generate 8 `InferenceService` CRs, one per customer (acct-001..acct-008). Each references `storageUri: s3://models/acct-XXX/v1/` and `modelFormat.name: mlflow`. Use a small Jinja2 template + Python loop to generate them — manual copy-paste is the antipattern. ModelMesh sees these and starts pulling/loading them across the runtime pool. Validator runs the generator and asserts 8 files written + each binds to the runtime via `runtime: mlserver-mlflow`.",
      learningObjective: "Generate many InferenceService CRs from a template instead of hand-maintaining each one.",
      requiredSkill: "Jinja2 + Python loop + Kubernetes manifest generation",
      starterCode: SRC(`# scripts/gen_inferenceservices.py
from pathlib import Path
from jinja2 import Template

TPL = Template("""apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: {{ name }}
  namespace: modelmesh-serving
  annotations:
    serving.kserve.io/deploymentMode: ModelMesh
spec:
  predictor:
    model:
      modelFormat:
        name: mlflow
      runtime: mlserver-mlflow
      storageUri: s3://models/{{ name }}/v1/
""")

ACCOUNTS = [f"acct-{i:03d}" for i in range(1, 9)]
OUT = Path("k8s/inferenceservices")

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # TODO: for name in ACCOUNTS, render TPL and write to OUT/<name>.yaml.
    raise NotImplementedError

if __name__ == "__main__":
    main()
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "After main() runs, 8 yaml files exist; each has runtime=mlserver-mlflow + modelFormat.name=mlflow.", {
        expectedFileCount: 8,
        eachAsserts: { runtime: "mlserver-mlflow", "modelFormat.name": "mlflow" },
      }),
      expectedOutputs: { fileCount: 8 },
      datasetRefs: ["fixtures/expected_inferenceservices.tar"],
      pedagogy: pedagogyConfig({
        hints: [
          "Loop over ACCOUNTS, render the Jinja template with {'name': name}, write to OUT / f'{name}.yaml'.",
          "for name in ACCOUNTS: (OUT / f'{name}.yaml').write_text(TPL.render(name=name))",
          "Idempotency tip: write to a temp dir first, then atomically rename. Otherwise a partial run leaves a mix of old + new.",
          "for name in ACCOUNTS:\n  (OUT / f'{name}.yaml').write_text(TPL.render(name=name))",
          "(see reference above)",
        ],
        successFeedback: "8 InferenceServices generated. Add an account = add an entry to ACCOUNTS + rerun. ModelMesh handles the rest.",
        failureFeedback: "Common slips: hand-wrote the 8 YAMLs (drift guaranteed within a sprint); forgot the ModelMesh deploymentMode annotation (KServe routes to a per-pod Deployment instead — defeats the architecture).",
        portfolioRelevance: "'Manifests are generated, not hand-written' is a senior signal. It's how you scale Kubernetes from 8 services to 800 without N hours of YAML maintenance.",
        finalExplanation: "Generated manifests + git-committed template = repeatable, reviewable, diffable. Manual YAML editing across 800 files is how organizations end up with 800 subtly-different services.",
        misconceptionToWatchFor: "Using Helm templating ONLY. Helm is great, but for a small set of similar manifests, a Jinja template + Python loop is more transparent and easier to debug.",
      }),
    },
    {
      stepNumber: 3,
      title: "KEDA ScaledObject for per-model RPS autoscale",
      instructionMd:
        "Define a `ScaledObject` that scales the ServingRuntime Deployment based on Prometheus query `sum(rate(model_request_seconds_count[1m])) by (model_name)`. minReplicas=2, maxReplicas=20, scale trigger threshold=10 RPS per pod. KEDA watches Prometheus, computes desired replicas, and updates the runtime's Deployment. Validator parses the YAML and asserts (a) kind=ScaledObject, (b) trigger type=prometheus, (c) threshold='10'.",
      learningObjective: "Wire KEDA to autoscale inference workloads on a Prometheus signal instead of CPU.",
      requiredSkill: "KEDA ScaledObject + Prometheus query + per-trigger threshold reasoning",
      starterCode: SRC(`# k8s/keda-scaledobject.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: mlserver-mlflow-rps
  namespace: modelmesh-serving
spec:
  scaleTargetRef:
    name: mlserver-mlflow
  minReplicaCount: 2
  maxReplicaCount: 20
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus.observability:9090
        # TODO: query: sum(rate(model_request_seconds_count[1m]))
        # threshold: "10"
`),
      validationType: "exact",
      stepType: "multi_file",
      validation: validationConfig("exact", "ScaledObject parses; trigger type=prometheus; threshold='10'; min=2 max=20.", {
        expectedTriggerType: "prometheus",
        expectedThreshold: "10",
        expectedMin: 2, expectedMax: 20,
      }),
      expectedOutputs: { triggerType: "prometheus", threshold: "10" },
      datasetRefs: ["fixtures/keda_expected.yaml"],
      pedagogy: pedagogyConfig({
        hints: [
          "Threshold is RPS PER POD. If you want to keep each pod under 10 RPS, set threshold='10' — KEDA divides the metric by current replicas.",
          "The query targets the SUM across all models because the pool scales as a whole. If you wanted per-model autoscaling you'd need separate Deployments — which defeats ModelMesh.",
          "query: sum(rate(model_request_seconds_count[1m]))\nthreshold: \"10\"",
          "Note threshold is a STRING in the YAML — KEDA parses it. Numbers will be rejected.",
          "(see reference above)",
        ],
        successFeedback: "Autoscaling wired. Traffic up = pods up; traffic down = pods down (eventually to minReplicas=2).",
        failureFeedback: "Common slips: set threshold as a number (KEDA needs string); used a per-model query (wrong layer — pool-level metric is what matters); set minReplicas=0 (cold-start latency from in-memory cache loss is painful).",
        portfolioRelevance: "Knowing KEDA + Prometheus-driven autoscale is a hire signal for any 'scale ML inference' JD bullet.",
        finalExplanation: "KEDA generalizes HPA beyond CPU/memory to ANY metric. Combined with Prometheus you can scale on the SIGNAL that matters (RPS, queue depth, P99 latency) rather than a proxy.",
        misconceptionToWatchFor: "Using HPA on CPU for inference. CPU is a lagging indicator that misses bursts; RPS is the actual demand signal.",
      }),
    },
    {
      stepNumber: 4,
      title: "Predictor with prom_client per-model labels",
      instructionMd:
        "Subclass `mlserver.MLModel`. In `predict()`, time the inference and observe a Prometheus `Histogram('model_request_seconds', labelnames=['model_name'])`. The histogram is what KEDA scrapes for autoscaling AND what powers the latency dashboard. The model_name label lets you split per-model in Grafana without recompiling. Validator runs the predictor against a smoke input + asserts the histogram has a sample with the right label.",
      learningObjective: "Instrument the predictor with prom_client and a per-model label dimension.",
      requiredSkill: "prom_client Histogram + mlserver.MLModel async predict + label dimensioning",
      starterCode: SRC(`# predictor.py
import time
from prometheus_client import Histogram
from mlserver import MLModel
from mlserver.types import InferenceRequest, InferenceResponse, ResponseOutput

REQ_HIST = Histogram(
    "model_request_seconds",
    "Per-model inference latency in seconds",
    labelnames=["model_name"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5),
)

class CustomerModel(MLModel):
    async def load(self) -> bool:
        # the actual model file is loaded by mlserver-mlflow already.
        self.ready = True
        return True

    async def predict(self, req: InferenceRequest) -> InferenceResponse:
        t0 = time.perf_counter()
        # TODO: run inference (delegate to self._predict_impl or super().predict)
        # then observe REQ_HIST.labels(model_name=self.name) with elapsed seconds.
        raise NotImplementedError
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "predict() emits one sample on REQ_HIST with label model_name=self.name.", {
        assertHistogramLabel: "model_name",
        assertSampleCount: 1,
      }),
      expectedOutputs: { histogramLabel: "model_name", samples: 1 },
      datasetRefs: ["fixtures/predictor_smoke.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Two things: call super().predict OR a small inline scorer, then observe REQ_HIST.labels(model_name=self.name).observe(elapsed).",
          "Use time.perf_counter() and (now - t0) — observe expects seconds.",
          "buckets matter: tune them around your SLO (e.g. for a 50ms SLO have 25/50/100ms buckets).",
          "resp = await super().predict(req)\nREQ_HIST.labels(model_name=self.name).observe(time.perf_counter() - t0)\nreturn resp",
          "(see reference above)",
        ],
        successFeedback: "Per-model latency is now scrapable. KEDA autoscales on it; Grafana visualizes it.",
        failureFeedback: "Common slips: observed in seconds × 1000 (data ends up in 'thousands of seconds' bucket — useless); forgot the label (can't split per-model); used Counter instead of Histogram (no quantiles).",
        portfolioRelevance: "Recruiters scanning for MLOps hires look for 'instrumented per-model latency' as a hire signal. It's the difference between 'I deployed a model' and 'I deployed AND observed it'.",
        finalExplanation: "Labels are the dimensionality of your metric. Add too many = explode cardinality and kill Prometheus. Add the right ones (model_name, customer_tier) = production-grade observability.",
        misconceptionToWatchFor: "Adding customer_id as a label with thousands of customers. Each unique label combination is a new time series; high-cardinality labels DOS your monitoring stack.",
      }),
    },
    {
      stepNumber: 5,
      title: "SLO + multi-window burn-rate alert",
      instructionMd:
        "Define a Prometheus PrometheusRule with a 99% latency-under-200ms SLO and the standard 2-window burn-rate alerts (fast: 1h+5m windows > 14.4× budget burn → critical; slow: 6h+30m > 6× → warning). Use the standard formula: burn_rate = (1 - successful_fraction) / (1 - slo) where successful_fraction = histogram_quantile(0.99, ...) <= 0.2. Validator parses the YAML and asserts 2 alert rules with the right burn-rate thresholds.",
      learningObjective: "Define a 2-window burn-rate SLO alert for inference latency.",
      requiredSkill: "Prometheus recording rules + SLO burn-rate alerting (Google SRE pattern)",
      starterCode: SRC(`# k8s/prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: mlserver-slo
  namespace: observability
spec:
  groups:
    - name: mlserver-slo.rules
      rules:
        - alert: MLServerLatencyBurnRateFast
          # TODO: expr that fires when 5m burn rate AND 1h burn rate both > 14.4
          # severity: critical
        - alert: MLServerLatencyBurnRateSlow
          # TODO: expr for 30m AND 6h windows > 6
          # severity: warning
`),
      validationType: "exact",
      stepType: "multi_file",
      validation: validationConfig("exact", "Two alert rules present with the right names + severities.", {
        expectedAlerts: ["MLServerLatencyBurnRateFast", "MLServerLatencyBurnRateSlow"],
        expectedSeverities: ["critical", "warning"],
      }),
      expectedOutputs: { alerts: 2, severities: ["critical", "warning"] },
      datasetRefs: ["fixtures/slo_rules_expected.yaml"],
      pedagogy: pedagogyConfig({
        hints: [
          "Burn rate = (1 - good_fraction) / (1 - slo). For 99% SLO, 14.4× burn means the 5m + 1h windows have BOTH consumed 14.4× the steady-state error budget — page the on-call.",
          "good_fraction over a window = (sum requests with latency <= 200ms) / (total requests). In Prometheus: rate(model_request_seconds_bucket{le='0.2'}[5m]) / rate(model_request_seconds_count[5m]).",
          "The 'multi-window' part is the AND: short window catches fast burn, long window prevents flapping on a 5-minute blip.",
          "expr: (1 - (sum(rate(model_request_seconds_bucket{le=\"0.2\"}[5m])) / sum(rate(model_request_seconds_count[5m])))) > (14.4 * (1 - 0.99))\n      AND\n      (1 - (sum(rate(model_request_seconds_bucket{le=\"0.2\"}[1h])) / sum(rate(model_request_seconds_count[1h])))) > (14.4 * (1 - 0.99))",
          "(see reference above)",
        ],
        successFeedback: "SLO burn-rate alerts live. On-call pages when latency genuinely violates the SLO, not on a 30-second blip.",
        failureFeedback: "Common slips: single-window alert (flaps); used absolute latency thresholds (won't trip when SLO is technically OK but degrading); forgot the AND in multi-window (defeats the pattern).",
        portfolioRelevance: "Knowing the 2-window burn-rate pattern (from Google SRE book) is the senior signal for any 'SLO ownership' JD bullet. Most candidates have only heard 'set up alerts'.",
        finalExplanation: "Multi-window burn rate is the Google SRE answer to 'how do I alert on SLO violations without flapping'. The short window catches real fires; the long window stops drift-by-blip pages.",
        misconceptionToWatchFor: "Alerting on a single absolute threshold like 'P99 > 200ms'. That fires on every minor blip and on-call learns to ignore alerts. Burn-rate fires only when the BUDGET is being burned.",
      }),
    },
  ],
};
