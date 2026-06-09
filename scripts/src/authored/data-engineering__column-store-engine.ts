/**
 * Phase 10 batch-2 / data-engineering (advanced).
 * Candidate 41d1a898-798e-44cc-bf54-4dbc03bf9084 — Mini Column-Store Engine
 * (dictionary encoding, vectorized scan, predicate pushdown, late materialization).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringColumnStoreEngine: AuthoredProject = {
  slug: "data-engineering-column-store-engine",
  candidateId: "41d1a898-798e-44cc-bf54-4dbc03bf9084",
  title: "Mini Column-Store Engine — Dictionary Encoding, Vectorized Scans, Late Materialization",
  shortDescription:
    "Build the internals of DuckDB/Parquet at small scale: columnar layout with dictionary encoding for cardinality compression, RLE for runs, vectorized batched scans, predicate pushdown into the scan, and late materialization. Benchmark against a row-store baseline.",
  fullDescription:
    "Senior data-engineering interviews probe 'how does a column store actually work?'. You'll build one. Numpy-backed columnar arrays, dictionary encoding for low-cardinality columns, RLE for runs, batched scans (no per-row overhead), predicate pushdown so the scan skips rows that can't satisfy WHERE, and late materialization (project only after filtering). End with a 10M-row benchmark showing 10x+ speedup over the row-store baseline.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "numpy", "pyarrow"],
  tags: ["columnar", "duckdb", "parquet", "dictionary-encoding", "rle", "vectorization", "predicate-pushdown", "late-materialization"],
  learningObjectives: [
    "Lay out tables columnar with per-column arrays + per-column dtype.",
    "Compress low-cardinality columns with dictionary encoding.",
    "Implement RLE for run-length-heavy columns + auto-pick the encoding.",
    "Run vectorized scans operating on batches of 1024 rows, not loops.",
    "Push predicates INTO the scan + late-materialize only surviving columns.",
  ],
  estimatedMinutes: 220,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Staff DE at an analytics company. The legacy row-store query engine takes 18s on a 10M-row aggregate; the migration to DuckDB is 6 months off. You build an in-memory column store as the bridge, learning the internals along the way.",
    hiringRelevance2026:
      "Senior DE interviews probe 'why is DuckDB fast?'. Building the answer hands-on = the highest-signal portfolio piece for staff-track roles.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (col arrays + encodings + scan loop)",
      "Step 1 columnar layout", "Step 2 dictionary encoding",
      "Step 3 vectorized scan", "Step 4 predicate pushdown",
      "Step 5 late materialization + benchmark", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "GitHub repo with the engine (~700 LOC), 10M-row benchmark script comparing 3 query plans (naive row-store baseline / column store no-pushdown / column store + pushdown + late materialization), and a write-up explaining each speedup source.",
    portfolioRelevance:
      "Reviewers fixate on 'do you understand WHY column stores are fast'. A benchmark you ran + numbers you can explain is the proof.",
    repoUrl: "https://github.com/<your-handle>/mini-column-store",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Columnar table layout",
      instructionMd:
        "Implement `ColumnTable` with `from_rows(rows: list[dict]) -> ColumnTable` (transpose rows into per-column numpy arrays with inferred dtype) and `to_rows()` (round-trip). Validator: 10k mixed-dtype rows round-trip identically; per-column dtypes are correctly inferred (int64, float64, object for strings); memory footprint ≤60% of a list-of-dicts baseline (column homogeneity wins).",
      learningObjective: "Transpose row data into per-column homogeneous arrays — the entire column-store value prop starts here.",
      requiredSkill: "Numpy dtypes + columnar layout + memory profiling",
      starterCode: SRC(`# table.py
from dataclasses import dataclass, field
import numpy as np
import sys

@dataclass
class ColumnTable:
    columns: dict[str, np.ndarray] = field(default_factory=dict)

    @classmethod
    def from_rows(cls, rows: list[dict]) -> 'ColumnTable':
        if not rows: return cls()
        keys = list(rows[0].keys())
        # TODO: For each column name, build a numpy array from [r[k] for r in rows] with inferred dtype.
        # numpy infers ints as int64, floats as float64, strings as object — let it.
        return cls({k: np.empty(0) for k in keys})

    def to_rows(self) -> list[dict]:
        if not self.columns: return []
        keys = list(self.columns)
        n = len(next(iter(self.columns.values())))
        # TODO: list of {k: self.columns[k][i].item() if numeric else self.columns[k][i]} for i in range(n)
        return []

    def memory_bytes(self) -> int:
        return sum(arr.nbytes for arr in self.columns.values())
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Verify that 10k mixed-dtype rows round-trip identically through from_rows/to_rows, that dtypes are correctly inferred (id=int64, price=float64, name=object), and that column-store memory footprint is ≤60% of the list-of-dicts baseline.",
      }),
      expectedOutputs: { round_trip: true, mem_ratio: 0.42 },
      datasetRefs: ["fixtures/sales_10k.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Numpy arrays for homogeneous columns kill ~40% of memory vs Python list-of-dicts (no per-row overhead).",
          "Use `np.array([...])` not `np.asarray([...])` — asarray returns object dtype for mixed input, you want inference.",
          "Object dtype for strings is fine for v1 — string dictionary encoding (next step) handles compression.",
          "Always provide a `to_rows` for tests + debug paths — round-trip is the cheapest correctness check.",
          "for k in keys: self.columns[k] = np.array([r[k] for r in rows])  # numpy infers dtype",
        ],
        successFeedback: "Columnar layout is live. Every later step (encoding, scan, pushdown) builds on this homogeneous representation.",
        failureFeedback: "Common slips: stored all columns as object (lost dtype + memory wins); forgot dtype inference (every column treated as object); per-row Python loops in to_rows (10x slower than vectorized).",
        portfolioRelevance: "Knowing why columnar layout matters cold (vectorization + memory + compression) is the senior signal.",
        finalExplanation: "Columnar storage isn't about compression alone — it enables vectorized execution + dictionary tricks. The layout IS the optimization.",
        misconceptionToWatchFor: "Storing per-row Python objects in 'columnar' arrays. Loses every benefit of the layout.",
      }),
    },
    {
      stepNumber: 2,
      title: "Dictionary encoding for low-cardinality columns",
      instructionMd:
        "Implement `DictColumn(values: np.ndarray)` that stores a `dict_` (sorted unique values) + `codes` (int32 indices into dict_). Add `encode(arr) -> DictColumn` that auto-applies when cardinality ratio (n_unique / len) < 0.5, else returns the raw array. Validator: a 10k-row `country` column with 12 distinct values compresses to ≤16% of raw object-array bytes; lookup via `dict_[codes[i]]` round-trips losslessly.",
      learningObjective: "Compress low-cardinality columns via dictionary encoding — the single biggest column-store win.",
      requiredSkill: "Dictionary encoding + cardinality-driven encoding selection + bytewise compression math",
      starterCode: SRC(`# encodings.py
from dataclasses import dataclass
import numpy as np

@dataclass
class DictColumn:
    dict_: np.ndarray   # unique values, sorted
    codes: np.ndarray   # int32 indices into dict_

    def get(self, i: int):
        return self.dict_[self.codes[i]]

    @property
    def nbytes(self) -> int:
        return self.dict_.nbytes + self.codes.nbytes

def encode(arr: np.ndarray, max_cardinality_ratio: float = 0.5) -> 'np.ndarray | DictColumn':
    n = len(arr)
    if n == 0: return arr
    unique, inverse = np.unique(arr, return_inverse=True)
    if len(unique) / n >= max_cardinality_ratio:
        return arr  # not worth dictionary encoding
    # TODO: build a DictColumn with dict_=unique, codes=inverse.astype(int32)
    return arr
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Verify that a 10k-row 'country' column with 12 distinct values compresses to ≤16% of raw object-array bytes after dictionary encoding, and that encoded.get(i) == raw[i] for every index (lossless round-trip).",
      }),
      expectedOutputs: { compression_ratio: 0.12, lossless: true },
      datasetRefs: ["fixtures/country_10k.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Dictionary encoding wins when cardinality << row count — measure cardinality_ratio = n_unique/n_rows first.",
          "Use int32 codes (4 bytes) instead of int64 (8) — unless your dict size > 2^31 (almost never).",
          "Object arrays of short strings are ~50 bytes/elem in CPython — even int8 codes win at >2% cardinality.",
          "np.unique returns sorted, which gives dict + codes both for free.",
          "return DictColumn(dict_=unique, codes=inverse.astype(np.int32))",
        ],
        successFeedback: "Dictionary encoding is in. Low-cardinality string columns are now ~10x smaller.",
        failureFeedback: "Common slips: applied dict encoding to high-cardinality columns (overhead with no compression); used int64 codes (wasted bytes); forgot lossless check (silent corruption).",
        portfolioRelevance: "Reciting dictionary encoding + when it pays off is a senior DE interview opener. Builds + benches = real signal.",
        finalExplanation: "Dictionary encoding is the cheapest, highest-impact column-store technique. Every serious engine implements it.",
        misconceptionToWatchFor: "Using dict encoding on UUIDs or hashes (high cardinality). Overhead with zero compression.",
      }),
    },
    {
      stepNumber: 3,
      title: "Vectorized scan in 1024-row batches",
      instructionMd:
        "Implement `scan(table, project: list[str], batch_size=1024) -> Iterator[dict[str, np.ndarray]]` yielding column batches. Each yielded dict has only the projected columns, each batch ≤batch_size rows. Self-check: running over 1M rows should yield exactly 977 batches (last partial); every batch should contain only the projected columns; the implementation should use numpy slicing — not a Python-level per-row loop.",
      learningObjective: "Process data in vectorized batches — eliminate per-row Python overhead.",
      requiredSkill: "Batched iteration + numpy slicing + projection",
      starterCode: SRC(`# scan.py
from typing import Iterator
import numpy as np

def scan(table, project: list[str], batch_size: int = 1024) -> Iterator[dict]:
    n = len(next(iter(table.columns.values())))
    cols = {k: table.columns[k] for k in project}
    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)
        # TODO: yield {k: v[start:end] for k, v in cols.items()}
        yield {}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "Calling scan(table, project=['id','price'], batch_size=1024) over a 1M-row table yields exactly 977 batches (ceil(1000000/1024) = 977).",
          "Every yielded batch dict has exactly the keys {'id', 'price'} — no other columns.",
          "Every batch except the last has length 1024; the last batch has length 576 (1000000 mod 1024).",
          "No Python-level per-row loop exists in the scan — only numpy slice operations (v[start:end]).",
          "Projecting only ['id','price'] from a wider table means non-projected columns are never loaded into the batch.",
        ],
      }),
      expectedOutputs: { batches: 977, last_len: 576 },
      datasetRefs: ["fixtures/sales_1M_shape.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "1024 is the sweet-spot batch size for L1/L2 cache locality — used by Velox, DuckDB, Arrow Compute.",
          "Always slice numpy arrays (`v[start:end]`) — never iterate. Vectorization is the entire point.",
          "Project AT scan time, not after — don't load columns you'll discard.",
          "ceil(n / batch_size) gives the batch count without per-row math.",
          "yield {k: v[start:end] for k, v in cols.items()}",
        ],
        successFeedback: "Scans are vectorized + batched. The next steps (pushdown, late materialization) compose on top.",
        failureFeedback: "Common slips: looped row-by-row in scan (defeats the whole architecture); projected after the loop (wasted IO); used overly small batch sizes (per-batch overhead dominates).",
        portfolioRelevance: "Batched vectorized scans = the heart of every modern OLAP engine. Building it = staff-level DE signal.",
        finalExplanation: "Vectorization isn't a 'nice-to-have' — it's the architecture. Per-row processing is 100x slower at scale.",
        misconceptionToWatchFor: "Confusing 'using numpy' with 'vectorized'. Iterating over numpy arrays is still per-row Python.",
      }),
    },
    {
      stepNumber: 4,
      title: "Predicate pushdown into the scan",
      instructionMd:
        "Extend `scan(table, project, where=(col, op, val), batch_size=1024)` so the predicate is evaluated INSIDE the scan and only matching rows are yielded. Supported ops: `==, !=, <, <=, >, >=, in`. Build the mask vectorially per batch + apply mask to projected columns. Validator: 1M rows, project=['id','revenue'], where=('region', '==', 'EU'); expects ~250k matching rows yielded, 0 EU=false rows in any batch.",
      learningObjective: "Filter inside the scan loop — never materialize rows you'll discard.",
      requiredSkill: "Predicate pushdown + vectorized boolean masks + numpy isin",
      starterCode: SRC(`# scan_pushdown.py
from typing import Iterator
import numpy as np

OPS = {
    '==': lambda a, v: a == v,
    '!=': lambda a, v: a != v,
    '<':  lambda a, v: a < v,
    '<=': lambda a, v: a <= v,
    '>':  lambda a, v: a > v,
    '>=': lambda a, v: a >= v,
    'in': lambda a, v: np.isin(a, list(v)),
}

def scan(table, project: list[str], where: tuple | None = None, batch_size: int = 1024) -> Iterator[dict]:
    n = len(next(iter(table.columns.values())))
    filter_col = where[0] if where else None
    all_cols_needed = set(project) | ({filter_col} if filter_col else set())
    cols = {k: table.columns[k] for k in all_cols_needed}
    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)
        batch = {k: v[start:end] for k, v in cols.items()}
        if where is not None:
            col, op, val = where
            mask = OPS[op](batch[col], val)
            # TODO: apply mask to each projected column, yield {k: batch[k][mask] for k in project} if mask.any()
            continue
        yield {k: batch[k] for k in project}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Verify that scanning 1M rows with project=['id','revenue'] and where=('region', '==', 'EU') yields approximately 240k–260k matching rows, and that every row in every yielded batch has region='EU' (no false positives slip through).",
      }),
      expectedOutputs: { matched: 250000, all_eu: true },
      datasetRefs: ["fixtures/sales_1M_shape.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Always read the filter column even if not projected — needed to build the mask.",
          "Apply the mask AFTER projection but BEFORE yielding — minimizes per-batch work.",
          "Skip empty batches with `if not mask.any(): continue` — eliminates needless yields.",
          "`np.isin` is the right primitive for `IN (...)` predicates; don't fall back to Python `in`.",
          "if mask.any():\\n    yield {k: batch[k][mask] for k in project}",
        ],
        successFeedback: "Predicate pushdown works. Selective queries now read + transfer ~25% the data of a full scan.",
        failureFeedback: "Common slips: filtered after collecting all batches (no IO savings); projected without including filter column (KeyError); skipped the empty-batch early-out (wasted yields).",
        portfolioRelevance: "Predicate pushdown is the second-biggest column-store speedup (after vectorization). Knowing why = senior signal.",
        finalExplanation: "Pushdown is the database-internals embodiment of 'do less work'. It's the highest-leverage optimization possible.",
        misconceptionToWatchFor: "Believing 'columnar' alone makes selective queries fast. Without pushdown, you still scan every value.",
      }),
    },
    {
      stepNumber: 5,
      title: "Late materialization + benchmark",
      instructionMd:
        "Implement late materialization: when project list is large, fetch only the FILTER column first, build the mask, then fetch projected columns ONLY for surviving rows. Benchmark 3 plans on 10M rows with a selective `where region='EU' AND revenue > 1000` (1% selectivity): naive row-store (baseline), columnar-no-pushdown, columnar+pushdown+late-materialization. Validator: plan-3 runs in ≤30% of plan-1's time AND ≤70% of plan-2's time on the fixture.",
      learningObjective: "Defer column materialization until after filtering — the canonical column-store late-materialization win.",
      requiredSkill: "Late materialization + multi-predicate pushdown + benchmark methodology",
      starterCode: SRC(`# late_materialize.py
import numpy as np, time

def query_late_mat(table, project, where_clauses, batch_size=1024):
    # where_clauses: list[(col, op, val)] — ANDed together.
    n = len(next(iter(table.columns.values())))
    # Step 1: build mask using ONLY filter columns.
    filter_cols = {col: table.columns[col] for col, _, _ in where_clauses}
    out = {k: [] for k in project}
    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)
        mask = np.ones(end - start, dtype=bool)
        for col, op, val in where_clauses:
            from .scan_pushdown import OPS
            mask &= OPS[op](filter_cols[col][start:end], val)
        if not mask.any(): continue
        # Step 2: ONLY NOW pull projected columns for surviving rows.
        # TODO: for k in project: out[k].append(table.columns[k][start:end][mask])
    return {k: np.concatenate(v) if v else np.array([]) for k, v in out.items()}

def benchmark(table, project, where_clauses, repeats=3) -> dict[str, float]:
    # TODO: time naive_rowstore vs columnar_pushdown vs late_materialize over 'repeats' runs each.
    return {'naive_rowstore_ms': 0, 'columnar_pushdown_ms': 0, 'late_materialize_ms': 0}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Verify that on a 10M-row benchmark with ~1% selectivity: late_materialize runs in ≤30% of naive_rowstore time (≥3.3x speedup), and late_materialize runs in ≤70% of columnar_pushdown time (additional late-materialization win >30%).",
      }),
      expectedOutputs: { late_vs_naive: 0.18, late_vs_pushdown: 0.55 },
      datasetRefs: ["fixtures/sales_10M_shape.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Late materialization shines at low selectivity (<5%) — high-selectivity queries gain less since you'd materialize most rows anyway.",
          "Multi-predicate pushdown should evaluate the CHEAPEST + MOST SELECTIVE predicates first; reorder ANDs by selectivity for free wins.",
          "Always benchmark with warm caches + ≥3 repeats; first run includes load overhead that distorts numbers.",
          "Late materialization is THE reason DuckDB beats pandas on selective queries — name + demo it.",
          "for k in project:\\n    out[k].append(table.columns[k][start:end][mask])",
        ],
        successFeedback: "Late materialization wins are real + benchmark-able. The engine is now production-shaped at the architectural level.",
        failureFeedback: "Common slips: materialized projection BEFORE filtering (no late-mat win); benchmarked first run (cold-cache noise); didn't reorder predicates (sub-optimal pushdown).",
        portfolioRelevance: "Late materialization + benchmark numbers is the single best portfolio piece for staff-level DE. Reviewers love numbers they can argue with.",
        finalExplanation: "Column store performance = vectorized scan + dict encoding + pushdown + late materialization. All four are required; none are optional.",
        misconceptionToWatchFor: "Believing one optimization (e.g. just vectorization) is 'enough'. The wins compose multiplicatively.",
      }),
    },
  ],
};
