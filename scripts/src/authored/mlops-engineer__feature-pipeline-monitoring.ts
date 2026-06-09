/**
 * Phase 13 — mlops-engineer course-seed (net-new). Lifts the
 * `mlops-engineer` course from 2 → 3 learner-visible projects.
 *
 * Candidate f1475ac2-57de-4388-9bbc-b42536475870 — Feature pipeline
 * monitoring: training-vs-serving skew detection, freshness SLOs,
 * distribution drift via PSI, null-rate alerts, and an end-to-end
 * Prometheus + alert-rule pack ready to wire to PagerDuty.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const mlopsEngineerFeaturePipelineMonitoring: AuthoredProject = {
  slug: "mlops-engineer-feature-pipeline-monitoring",
  candidateId: "f1475ac2-57de-4388-9bbc-b42536475870",
  title: "Feature Pipeline Monitoring — Skew, Drift, Freshness, and Alert Rules",
  shortDescription:
    "Build the monitoring layer most feature stores ship without: training-vs-serving skew detection, freshness SLOs per feature group, distribution drift via PSI, null-rate alerting, and a Prometheus + Alertmanager rule pack ready to page on real degradation.",
  fullDescription:
    "A feature pipeline that's silently broken is worse than a feature pipeline that's loudly broken — silent breakage degrades models for weeks before anyone notices. You'll wire the four monitors every production feature pipeline needs: (1) training-vs-serving skew by comparing the offline materialization to the online lookup, (2) freshness SLO per feature group with a max-lag alert, (3) population stability index (PSI) for distribution drift vs a rolling reference window, (4) null-rate spike detection with EWMA baselining. Final deliverable is a Prometheus metrics endpoint + a hand-tuned Alertmanager rule pack that maps each monitor to an actionable page (or doesn't, when it shouldn't).",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "pandas", "numpy", "prometheus-client", "scipy", "great-expectations"],
  tags: ["mlops", "feature-store", "monitoring", "data-drift", "skew", "psi", "alerting"],
  learningObjectives: [
    "Detect training-vs-serving skew by replaying serving requests through offline materialization.",
    "Define per-feature-group freshness SLOs and emit a `feature_max_lag_seconds` gauge.",
    "Compute population stability index (PSI) against a rolling reference distribution.",
    "Baseline null-rate with EWMA and alert on > 3σ deviation, not absolute thresholds.",
    "Write a Prometheus + Alertmanager rule pack that maps each monitor to actionable pages with severity.",
  ],
  estimatedMinutes: 240,
  xpReward: 800,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "MLOps engineer on a 2026 fraud-detection team. A 1.2pp false-negative regression was eventually root-caused to a feature that started returning null in 4% of serving calls after an upstream schema change — 17 days after the change went live. You're building the monitoring stack so the next one is caught in 17 minutes.",
    hiringRelevance2026:
      "Feature-pipeline monitoring is the difference between 'we have a feature store' and 'we operate one'. PSI + skew detection + freshness SLOs are the senior-MLOps interview signals; most candidates have heard the terms but never wired the metrics.",
    readmeOutline: [
      "Overview & The Silent-Failure Story", "Setup (uv + Prometheus + Alertmanager docker-compose)",
      "Step 1 training-vs-serving skew detection", "Step 2 freshness SLO + max_lag_seconds gauge",
      "Step 3 PSI distribution drift", "Step 4 null-rate EWMA + 3σ alert",
      "Step 5 alert rule pack + severity routing", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: docker-compose Prometheus + Alertmanager + a `feature-monitor` service exposing `/metrics`, a synthetic feature pipeline that lets you inject each failure mode (skew, stale, drift, null spike), `alerts.yml` Alertmanager rule pack with severity (page vs ticket), and a `scenarios/` folder where each failure mode reproduces the corresponding alert firing within 60s.",
    portfolioRelevance:
      "A monitoring repo where each failure mode is reproducible + each alert is hand-tuned (not 'alert on everything') is exactly what hiring managers grade senior MLOps candidates on. Show the alertmanager screenshot in the README.",
    repoUrl: "https://github.com/<your-handle>/feature-pipeline-monitoring",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Training-vs-serving skew — replay serving requests through offline materialization",
      instructionMd:
        "Implement `detect_skew(serving_logs, offline_materializer) -> {skew_rate: float, mismatched_keys: list[str]}`. For each (entity_id, feature_name, served_value, served_at) in serving logs, look up the materialized value at the same point-in-time and assert ==. Validator runs against a fixture with 1000 serving requests including 23 deliberate skew cases; expects `skew_rate ≈ 0.023`, `mismatched_keys` length 23.",
      learningObjective: "Skew detection IS replay. The cheap version (compare distributions) misses the most-dangerous bugs (the same entity getting different values online vs offline).",
      requiredSkill: "Point-in-time correct lookup + tuple-equality skew computation",
      starterCode: SRC(`# monitors/skew.py
from typing import Callable, Any
from datetime import datetime

ServingLog = dict[str, Any]  # {entity_id, feature_name, served_value, served_at}
Materializer = Callable[[str, str, datetime], Any]  # (entity_id, feature, ts) -> value

def detect_skew(
    serving_logs: list[ServingLog], materializer: Materializer
) -> dict[str, Any]:
    n = len(serving_logs)
    if n == 0: return {"skew_rate": 0.0, "mismatched_keys": []}
    mismatched: list[str] = []
    for row in serving_logs:
        offline = materializer(row["entity_id"], row["feature_name"], row["served_at"])
        # TODO: equality with tolerance for floats — pure == is wrong for engineered numeric features.
        if isinstance(offline, float) and isinstance(row["served_value"], float):
            same = abs(offline - row["served_value"]) <= 1e-6
        else:
            same = offline == row["served_value"]
        if not same:
            mismatched.append(f"{row['entity_id']}::{row['feature_name']}")
    return {"skew_rate": len(mismatched) / n, "mismatched_keys": mismatched}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "Against the 1000-row fixture (23 deliberate skew cases: 12 numeric drift, 11 categorical mismatch), detect_skew returns skew_rate ≈ 0.023 and len(mismatched_keys) == 23.",
          "Numeric comparisons use abs(offline - served) ≤ 1e-6 rather than strict equality to absorb floating-point noise.",
          "The materializer is called with the point-in-time timestamp (served_at), not the current time.",
        ],
      }),
      expectedOutputs: { skew_rate: 0.023, mismatched_count: 23 },
      datasetRefs: ["fixtures/serving_logs_1000.jsonl", "fixtures/skew_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "ALWAYS use point-in-time-correct lookup — `materializer(..., served_at)`, not `now()`. Wrong-time lookup makes EVERYTHING look skewed.",
          "Float equality needs a tolerance. `1e-6` is fine for most engineered features; tighter for IDs encoded as floats (don't do that).",
          "Skew rate alone is misleading — also report mismatched_keys so on-call can pull one example into a notebook.",
          "If skew rate suddenly jumps from 0.001 to 0.05, something specific broke — your alert thresholds should detect change, not absolute.",
          "abs(offline - row['served_value']) <= 1e-6",
        ],
        successFeedback: "You can now detect the worst category of feature bug (same entity, different values).",
        failureFeedback: "Most slips: comparing serving aggregates to offline aggregates (misses the per-entity skew); skipping the timestamp (joins to wrong materialization).",
        portfolioRelevance: "Skew detection is the senior-MLOps interview question. Pin the result with a reproducible synthetic skew injector.",
        finalExplanation: "Training-serving skew is the silent killer. Replay is the only reliable detector; everything else is a proxy.",
        misconceptionToWatchFor: "Believing 'we use the same code online and offline' means no skew. Same code, different inputs (latency, missing data, partial state) yields different outputs all the time.",
      }),
    },
    {
      stepNumber: 2,
      title: "Freshness SLO — feature_max_lag_seconds gauge per feature group",
      instructionMd:
        "Expose `feature_max_lag_seconds{group}` Prometheus gauge = max(now - feature_updated_at) within the group. Run a scrape every 30s. Validator: 4 feature groups with materialization lags of 30s, 120s, 600s, 3600s; assert the gauge shows the exact value per group; SLO breaches surface in `breaches` list when lag > group SLO.",
      learningObjective: "Freshness alerts are the easiest monitor to define correctly and the most-skipped. Stale features cause model drift that looks like model drift.",
      requiredSkill: "Prometheus gauge with labels + per-group SLO threshold definition",
      starterCode: SRC(`# monitors/freshness.py
from datetime import datetime, timezone
from prometheus_client import Gauge

feature_max_lag = Gauge(
    "feature_max_lag_seconds",
    "Maximum staleness (seconds) of any feature in a group at scrape time",
    ["group"],
)

# Per-group SLO. Slow-moving features (account_age) have looser SLOs than
# fast-moving features (transactions_in_last_5min).
GROUP_SLOS_SEC: dict[str, int] = {
    "account_features":     86400,  # 24h
    "txn_5min_features":    300,    # 5m
    "session_features":     900,    # 15m
    "device_features":      3600,   # 1h
}

def scrape_freshness(
    feature_updated_at: dict[str, dict[str, datetime]],  # group -> {feature: ts}
    now: datetime | None = None,
) -> dict[str, list[str]]:
    now = now or datetime.now(timezone.utc)
    breaches: list[str] = []
    for group, features in feature_updated_at.items():
        if not features: continue
        max_lag = max((now - ts).total_seconds() for ts in features.values())
        feature_max_lag.labels(group=group).set(max_lag)
        # TODO: emit breach when above per-group SLO.
        slo = GROUP_SLOS_SEC.get(group)
        if slo is not None and max_lag > slo:
            breaches.append(f"{group}: lag {int(max_lag)}s > slo {slo}s")
    return {"breaches": breaches}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "With lags {account_features: 30s, txn_5min_features: 600s, session_features: 800s, device_features: 3500s}, scrape_freshness returns exactly 1 breach for 'txn_5min_features' (600 > SLO of 300s).",
          "feature_max_lag.labels(group=group).set(max_lag) is called for all 4 groups so the Prometheus gauge reflects the current max lag.",
          "Lag is computed with (now - ts).total_seconds(), not .seconds, to avoid wrapping at 24 hours.",
        ],
      }),
      expectedOutputs: { breachCount: 1, gaugesEmitted: 4 },
      datasetRefs: ["fixtures/freshness_scenarios.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "ALWAYS attach the group label — alerting on 'some feature is stale' is useless without knowing which one.",
          "Per-group SLO: an `account_age` feature is correctly 12h stale; a `txn_in_last_5min` feature stale by 12 minutes is a fire.",
          "Use `(now - ts).total_seconds()`, not `(now - ts).seconds` — the latter wraps at 24h.",
          "Compute MAX lag within a group, not mean — one stale feature can poison the whole group's predictions.",
          'feature_max_lag.labels(group=group).set(max_lag)',
        ],
        successFeedback: "Per-group freshness with per-group SLOs — the simple monitor that catches most silent breakage.",
        failureFeedback: "Most slips: same SLO for all groups (alert fatigue or missed breaches); using mean lag (hides one-bad-feature case).",
        portfolioRelevance: "A freshness dashboard with per-group SLOs is what hiring managers ask 'show me how you'd page' about. Pin it.",
        finalExplanation: "Freshness is the cheapest, highest-signal feature monitor. Wire it first, always.",
        misconceptionToWatchFor: "Believing pipeline-run success = features fresh. The job can succeed having processed the wrong upstream window.",
      }),
    },
    {
      stepNumber: 3,
      title: "PSI — population stability index vs rolling reference",
      instructionMd:
        "Implement `psi(reference, current, bins=10) -> float` using deciles of the REFERENCE distribution as bin edges. PSI = Σ (curr_pct - ref_pct) * ln(curr_pct / ref_pct), with a small epsilon to avoid log(0). Validator: identical distributions → PSI ≈ 0.0; small shift → PSI < 0.1; major shift → PSI > 0.25. Test against 3 fixture pairs with known PSI values.",
      learningObjective: "PSI is the standard distribution-drift metric for production ML. The bins-from-reference detail is what most implementations get wrong.",
      requiredSkill: "PSI computation + reference-defined bin edges + epsilon for log stability",
      starterCode: SRC(`# monitors/drift.py
import numpy as np

def psi(reference: np.ndarray, current: np.ndarray, bins: int = 10, eps: float = 1e-4) -> float:
    """Population stability index. <0.1 stable, 0.1-0.25 slight shift, >0.25 major shift."""
    if reference.size == 0 or current.size == 0:
        return 0.0
    # TODO: bin edges from REFERENCE distribution (deciles), not from current.
    # Using current's quantiles biases PSI toward 0 whenever current is monomodal.
    edges = np.quantile(reference, np.linspace(0, 1, bins + 1))
    edges = np.unique(edges)
    if edges.size < 2: return 0.0
    edges[0] = -np.inf; edges[-1] = np.inf

    ref_pct = np.histogram(reference, bins=edges)[0] / reference.size
    cur_pct = np.histogram(current,   bins=edges)[0] / current.size

    # Epsilon prevents log(0) when a bin is empty in current
    ref_pct = np.clip(ref_pct, eps, None)
    cur_pct = np.clip(cur_pct, eps, None)

    return float(np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct)))
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "psi(reference, reference) ≈ 0.0 (identical distributions produce PSI < 0.01).",
          "psi(reference, small_shift) produces a value in the range 0.02–0.10 (slight shift).",
          "psi(reference, major_shift) > 0.25 (major distributional shift triggers the alert threshold).",
          "Bin edges are computed from the REFERENCE distribution (np.quantile on reference), not on the current distribution.",
        ],
      }),
      expectedOutputs: { identicalPsiLt: 0.01, majorPsiGt: 0.25 },
      datasetRefs: ["fixtures/psi_identical.npz", "fixtures/psi_small_shift.npz", "fixtures/psi_major_shift.npz"],
      pedagogy: pedagogyConfig({
        hints: [
          "Bin edges MUST come from the reference distribution, not from current. Otherwise PSI is biased toward 0 whenever current is monomodal.",
          "Use deciles (10 bins) for most production features — finer bins are noisier without adding signal.",
          "Add epsilon to both ref and cur percentages — log(0) explodes; log(eps) just gives a finite penalty.",
          "PSI thresholds: <0.1 stable, 0.1-0.25 watch, >0.25 alert. Tune per feature; tail features need higher thresholds.",
          "edges = np.quantile(reference, np.linspace(0, 1, bins + 1))",
        ],
        successFeedback: "PSI computed correctly — the reference-edge detail is what most teams miss.",
        failureFeedback: "Most slips: bin edges from current (biased low); no epsilon (NaN/Inf on empty bins); equal-width bins (worse signal-to-noise than quantile bins).",
        portfolioRelevance: "Show PSI alongside KS-test in your README — they catch different shifts and the combo is what mature shops use.",
        finalExplanation: "PSI = symmetric KL divergence over a fixed binning. The 'fixed' part is essential; that's what makes it stable across time.",
        misconceptionToWatchFor: "Treating PSI as the only drift metric. PSI catches distribution shape; concept drift (P(y|x) changing) needs a different monitor.",
      }),
    },
    {
      stepNumber: 4,
      title: "Null-rate EWMA — alert on > 3σ deviation, not absolute threshold",
      instructionMd:
        "Implement `null_rate_alert(window) -> {alerts: list[{feature, current, baseline_mean, baseline_std, z}]}`. For each feature, compute its rolling EWMA mean and std (α=0.05); current is the latest 5-minute window's null rate; emit an alert when `|current - mean| > 3*std` AND `current > 0.005`. Validator: 24-hour stream of null rates with a 2-hour deliberate spike (0.001→0.045 on one feature); assert exactly 1 alert is emitted during the spike window for that feature, 0 alerts for the other 9 features.",
      learningObjective: "Absolute null-rate alerts ALWAYS fire false-positive because every feature has a different baseline. EWMA + 3σ adapts to the feature's own normal.",
      requiredSkill: "Exponentially-weighted mean/std + z-score thresholding + minimum-floor guard",
      starterCode: SRC(`# monitors/null_rate.py
from collections import deque
from typing import Iterable
import math

class EwmaTracker:
    def __init__(self, alpha: float = 0.05):
        self.alpha = alpha
        self.mean: float | None = None
        self.var:  float = 0.0

    def update(self, x: float) -> tuple[float, float]:
        if self.mean is None:
            self.mean = x; self.var = 0.0
        else:
            # TODO: classical EWMA mean + variance update.
            delta = x - self.mean
            self.mean = self.mean + self.alpha * delta
            self.var  = (1 - self.alpha) * (self.var + self.alpha * delta * delta)
        return self.mean, math.sqrt(self.var)

def null_rate_alert(
    streams: dict[str, Iterable[float]],  # feature -> per-5min null-rates
    floor: float = 0.005,
) -> dict[str, list[dict]]:
    alerts: list[dict] = []
    for feature, samples in streams.items():
        t = EwmaTracker()
        last_mean = last_std = 0.0
        for x in samples:
            last_mean, last_std = t.update(x)
        current = x  # final sample is "now"
        if last_std > 0 and abs(current - last_mean) > 3 * last_std and current > floor:
            alerts.append({
                "feature": feature,
                "current": current,
                "baseline_mean": last_mean,
                "baseline_std": last_std,
                "z": (current - last_mean) / last_std,
            })
    return {"alerts": alerts}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "With the 24-hour fixture stream (10 features, feature_3 spiking from 0.001 to 0.045 over a 2-hour window), null_rate_alert emits exactly 1 alert for feature_3.",
          "No alerts are emitted for the other 9 features (zero false positives).",
          "The alert fires because |current - ewma_mean| > 3 * ewma_std AND current > floor (0.005) — both conditions must be true simultaneously.",
        ],
      }),
      expectedOutputs: { alertCount: 1, falsePositives: 0 },
      datasetRefs: ["fixtures/null_rate_streams_24h.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "EWMA = weighted moving average where recent observations weigh more. α=0.05 gives ~20-sample memory; α=0.20 gives ~5-sample.",
          "Always combine z-score AND an absolute floor — 0.001 → 0.002 is a 100% jump but operationally meaningless.",
          "Higher α (0.20) reacts fast but flags noise; lower α (0.05) is steadier but slower to alert. Tune per feature.",
          "Track variance, not std — variance is what the recursive update is mathematically defined on.",
          "self.var = (1 - alpha) * (self.var + alpha * delta * delta)",
        ],
        successFeedback: "Null-rate alerts that adapt per-feature — finally no more 'alert on >5% nulls' false positives.",
        failureFeedback: "Most slips: absolute threshold (alerts on slow-and-noisy features, misses fast-and-quiet ones); no floor (alerts on trivial near-zero spikes).",
        portfolioRelevance: "Per-feature adaptive alerting is the difference between 'I added Prometheus' and 'I tuned an alert pack'. Hiring managers care.",
        finalExplanation: "Statistical alerting beats threshold alerting for any quantity with feature-specific baselines. Null rate is the canonical example.",
        misconceptionToWatchFor: "Believing 'just alert on > X%' is fine. Different features have wildly different normal null rates; one threshold fits none.",
      }),
    },
    {
      stepNumber: 5,
      title: "Alert rule pack — severity, runbook link, group_by routing",
      instructionMd:
        "Write `alerts.yml` with 4 PrometheusRule groups (skew / freshness / drift / null_rate). Each rule includes: `severity` label (`page` for skew & freshness breaches, `ticket` for drift watch, `page` for null-rate 3σ), `runbook_url` annotation, and a `for: 10m` clause so transient blips don't page. This is a learner attestation — Atlas does not enforce the group count, rule count, forbidden severities, or routing logic; verify it yourself against the criteria below.",
      learningObjective: "An alert pack without severity, runbook, and dedup routing IS the alert-fatigue problem. The YAML matters as much as the metric.",
      requiredSkill: "Prometheus rule YAML + Alertmanager severity routing + 'for:' debounce",
      starterCode: SRC(`# alerts.yml
groups:
  - name: feature.skew
    rules:
      - alert: FeatureServingSkewHigh
        expr: feature_skew_rate > 0.005
        for: 10m
        labels:
          severity: page
          team: ml-platform
        annotations:
          summary: "Training-vs-serving skew rate > 0.5% sustained 10m"
          runbook_url: "https://runbooks.example.com/feature-skew"

  - name: feature.freshness
    rules:
      - alert: FeatureGroupStale
        expr: feature_max_lag_seconds > on(group) feature_max_lag_slo_seconds
        for: 5m
        labels: { severity: page, team: ml-platform }
        annotations:
          summary: "Feature group {{ $labels.group }} exceeded freshness SLO"
          runbook_url: "https://runbooks.example.com/feature-freshness"

  - name: feature.drift
    rules:
      - alert: FeaturePSIWatch
        expr: feature_psi > 0.1
        for: 1h
        labels: { severity: ticket, team: ml-platform }
        annotations:
          summary: "PSI {{ $labels.feature }} > 0.1 sustained 1h — watch"
          runbook_url: "https://runbooks.example.com/feature-drift"
      - alert: FeaturePSIAlert
        expr: feature_psi > 0.25
        for: 30m
        labels: { severity: page, team: ml-platform }
        annotations:
          summary: "PSI {{ $labels.feature }} > 0.25 sustained 30m — major shift"
          runbook_url: "https://runbooks.example.com/feature-drift"

  - name: feature.null_rate
    rules:
      - alert: FeatureNullRateZHigh
        expr: feature_null_rate_zscore > 3 and feature_null_rate > 0.005
        for: 10m
        labels: { severity: page, team: ml-platform }
        annotations:
          summary: "Null rate {{ $labels.feature }} 3σ above baseline"
          runbook_url: "https://runbooks.example.com/feature-null-rate"

# Note: 'feature.skew' has 1 rule; 'feature.freshness' has 1; 'feature.drift'
# has 2 (watch+alert tiering); 'feature.null_rate' has 1 = 5 rules.
# TODO: add 3 more rules (your choice — synthetic_canary, schema_change,
# materialization_runtime_p95) for the 8-rule total the validator expects.
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "Alert rule pack: 4 groups, 8 total rules, every rule has severity + runbook_url + for: clause, no severity: critical used, page/ticket routing is correct.", {
        attestationCriteria: [
          "alerts.yml contains exactly 4 rule groups (skew, freshness, drift, null_rate)",
          "There are exactly 8 total alert rules across all groups",
          "Every rule has a severity label (page or ticket) and a runbook_url annotation",
          "No rule uses severity: critical — only page or ticket are valid values",
          "Every rule has a for: clause to debounce transient blips",
          "Page-severity rules cover: skew rate spike, freshness SLO breach, PSI > 0.25, null-rate 3σ spike",
          "Ticket-severity rules cover: PSI > 0.1 watch (and any other watch-level conditions)",
        ],
      }),
      expectedOutputs: { groups: 4, rules: 8, allSeveritiesMapped: true },
      datasetRefs: ["fixtures/alertmanager_routes_expected.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "`for: 10m` is your transient-noise filter — without it, every blip pages.",
          "`severity: page` vs `severity: ticket` is the single most important routing label — wire it to Alertmanager `receiver:` rules.",
          "Always include `runbook_url` — a 3am page without a runbook is a 30-minute wake-up.",
          "Tier drift alerts: PSI > 0.1 ticket (watch); PSI > 0.25 page (act). Single threshold either over-pages or under-warns.",
          "labels: { severity: page, team: ml-platform }",
        ],
        successFeedback: "Alert pack is now hand-tuned: pages only on actionable conditions, tickets for watch-list, runbooks everywhere.",
        failureFeedback: "Most slips: every alert is `severity: page` (alert fatigue → ignored alerts); no `for:` (every transient blip pages); no runbook_url (slow 2am triage).",
        portfolioRelevance: "An alert pack that explains WHY each rule is page vs ticket is the senior-MLOps differentiator. Pin it as the README centerpiece.",
        finalExplanation: "Metrics without alert rules are dashboards. Alert rules without severity + runbook + debounce are noise. The full pack is the difference between an SRE-grade pipeline and a science-project pipeline.",
        misconceptionToWatchFor: "Believing the metric IS the monitor. The metric is necessary; the tuned alert rule is what closes the loop.",
      }),
    },
  ],
};
