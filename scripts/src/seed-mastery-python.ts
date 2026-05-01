// Python Mastery curriculum: comprehensive modules for data engineers + ML practitioners.
// Each module: 4-6 lessons with real markdown + xp + estimated minutes.
// Some lessons are `code` type with starter code (rendered in the lesson player).

export type MasteryLesson = {
  slug: string;
  title: string;
  content: string;
  type: "reading" | "code" | "quiz";
  orderIndex: number;
  mins: number;
  xp: number;
};

export type MasteryModule = {
  slug: string;
  title: string;
  description: string;
  orderIndex: number;
  isPremium: boolean;
  lessonCount: number;
  estimatedHours: number;
  difficultyLevel: "beginner" | "intermediate" | "advanced";
  learningObjectives: string[];
  lessons: MasteryLesson[];
};

export const pythonMasteryModules: MasteryModule[] = [
  {
    slug: "python-fundamentals",
    title: "Python Fundamentals for Data Engineers",
    description: "Master Python data types, control flow, functions, and file I/O patterns used in real data pipelines.",
    orderIndex: 1,
    isPremium: false,
    lessonCount: 5,
    estimatedHours: 4,
    difficultyLevel: "beginner",
    learningObjectives: [
      "Understand Python data types",
      "Write functions and classes",
      "Handle files and exceptions",
      "Use list comprehensions and generators",
    ],
    lessons: [
      {
        slug: "python-data-types",
        title: "Python Data Types & Collections",
        content: "# Python Data Types\n\nIn data engineering, you'll work with these core types constantly.\n\n## Lists vs Tuples\n- **Lists** are mutable, ordered — use for data you'll modify\n- **Tuples** are immutable, faster — use for fixed records\n\n## Dictionaries\nPerfect for JSON records:\n```python\nrecord = {'user_id': 42, 'event': 'click', 'ts': '2024-01-01'}\n```\n\n## Sets\nFor deduplication:\n```python\nunique_ids = set(df['user_id'].tolist())\n```",
        type: "reading", orderIndex: 1, mins: 15, xp: 25,
      },
      {
        slug: "control-flow",
        title: "Control Flow & Iteration",
        content: "# Control Flow in Data Pipelines\n\n## List Comprehensions (Pythonic)\n```python\n# Filter and transform in one line\nclean = [r for r in records if r.get('user_id')]\n```\n\n## Generators for Large Data\n```python\ndef parse_lines(file):\n    for line in file:\n        yield json.loads(line)  # Lazy evaluation\n```\nGenerators don't load everything into memory — critical for large files!",
        type: "reading", orderIndex: 2, mins: 20, xp: 25,
      },
      {
        slug: "functions-decorators",
        title: "Functions & Decorators",
        content: "# Functions in Data Engineering\n\n## Decorators for Cross-Cutting Concerns\n```python\nimport time\nfrom functools import wraps\n\ndef timed(fn):\n    @wraps(fn)\n    def wrapper(*args, **kwargs):\n        t0 = time.time()\n        result = fn(*args, **kwargs)\n        print(f'{fn.__name__}: {time.time()-t0:.2f}s')\n        return result\n    return wrapper\n\n@timed\ndef load_file(path): ...\n```\n\nDecorators add behavior without modifying the original function.",
        type: "reading", orderIndex: 3, mins: 20, xp: 30,
      },
      {
        slug: "exceptions-files",
        title: "Exceptions & File I/O",
        content: "# Robust File I/O\n\nReal pipelines fail. Make yours fail loudly and recover gracefully.\n\n```python\nimport json, logging\n\ndef load_jsonl(path):\n    records, errors = [], 0\n    with open(path, 'r', encoding='utf-8') as f:\n        for i, line in enumerate(f, 1):\n            try:\n                records.append(json.loads(line))\n            except json.JSONDecodeError as e:\n                errors += 1\n                logging.warning(f'Bad JSON on line {i}: {e}')\n    if errors / max(len(records), 1) > 0.05:\n        raise RuntimeError(f'Too many bad records: {errors}')\n    return records\n```\n\n**Rules:**\n- Always specify `encoding='utf-8'`\n- Use `with` so files always close\n- Decide upfront: skip bad rows, raise, or quarantine",
        type: "reading", orderIndex: 4, mins: 20, xp: 30,
      },
      {
        slug: "fundamentals-practice",
        title: "Practice: Group records by hour",
        content: "# Hands-on practice\n\nGroup a list of event records by the hour of their timestamp.\n\nGiven a list of events, produce a dict from hour-of-day → count of events.\n\nUse `collections.Counter` and `datetime.fromisoformat`.",
        type: "code", orderIndex: 5, mins: 25, xp: 50,
      },
    ],
  },
  {
    slug: "python-advanced-patterns",
    title: "Advanced Python Patterns",
    description: "Generators, context managers, async/await, and design patterns for production data engineering code.",
    orderIndex: 2,
    isPremium: true,
    lessonCount: 5,
    estimatedHours: 4,
    difficultyLevel: "intermediate",
    learningObjectives: [
      "Write memory-efficient generators",
      "Use context managers",
      "Understand async I/O",
      "Apply pipeline design patterns",
    ],
    lessons: [
      {
        slug: "generators",
        title: "Generators & Iterators",
        content: "# Generators for Large Data\n\nProcess data without loading it all into RAM:\n\n```python\ndef read_csv_chunks(filepath, chunk_size=10_000):\n    import csv\n    with open(filepath) as f:\n        reader = csv.DictReader(f)\n        chunk = []\n        for row in reader:\n            chunk.append(row)\n            if len(chunk) == chunk_size:\n                yield chunk\n                chunk = []\n        if chunk:\n            yield chunk  # Last partial chunk\n\n# Process 100M rows without OOM\nfor chunk in read_csv_chunks('huge_file.csv'):\n    load_to_db(chunk)\n```",
        type: "reading", orderIndex: 1, mins: 20, xp: 35,
      },
      {
        slug: "context-managers",
        title: "Context Managers",
        content: "# Context Managers\n\nManage resources (DB connections, file handles) safely:\n\n```python\nfrom contextlib import contextmanager\n\n@contextmanager\ndef db_transaction(conn):\n    try:\n        yield conn\n        conn.commit()\n    except Exception:\n        conn.rollback()\n        raise\n    finally:\n        conn.close()\n\n# Usage — connection always cleaned up\nwith db_transaction(get_connection()) as conn:\n    insert_data(conn, records)\n```",
        type: "reading", orderIndex: 2, mins: 20, xp: 35,
      },
      {
        slug: "asyncio-basics",
        title: "asyncio for I/O-Bound Pipelines",
        content: "# asyncio Basics\n\nWhen your bottleneck is the network (API calls, DB queries), `asyncio` lets one Python process handle many I/O operations concurrently.\n\n```python\nimport asyncio, aiohttp\n\nasync def fetch(session, url):\n    async with session.get(url) as r:\n        return await r.json()\n\nasync def fetch_all(urls):\n    async with aiohttp.ClientSession() as session:\n        return await asyncio.gather(*[fetch(session, u) for u in urls])\n\nrows = asyncio.run(fetch_all(api_urls))\n```\n\n**Rule of thumb:** asyncio for I/O-bound, multiprocessing for CPU-bound.",
        type: "reading", orderIndex: 3, mins: 25, xp: 40,
      },
      {
        slug: "dataclasses-typing",
        title: "Dataclasses & Type Hints",
        content: "# Dataclasses for Records\n\nReplace dict-of-strings with typed records:\n\n```python\nfrom dataclasses import dataclass\nfrom datetime import datetime\nfrom typing import Optional\n\n@dataclass\nclass Event:\n    user_id: int\n    event_name: str\n    ts: datetime\n    properties: Optional[dict] = None\n\n    @classmethod\n    def from_row(cls, row: dict) -> 'Event':\n        return cls(\n            user_id=int(row['user_id']),\n            event_name=row['event_name'],\n            ts=datetime.fromisoformat(row['ts']),\n            properties=row.get('properties'),\n        )\n```\n\nPair with `mypy` to catch shape bugs at lint time, not 3am.",
        type: "reading", orderIndex: 4, mins: 20, xp: 35,
      },
      {
        slug: "pipeline-pattern",
        title: "Pipeline Design Pattern",
        content: "# Composable Pipelines\n\nKeep transformations small and pure — chain them with generators:\n\n```python\nfrom typing import Iterable, Iterator\n\ndef extract(path: str) -> Iterator[dict]:\n    with open(path) as f:\n        for line in f:\n            yield json.loads(line)\n\ndef clean(rows: Iterable[dict]) -> Iterator[dict]:\n    for r in rows:\n        if r.get('user_id'):\n            yield r\n\ndef enrich(rows: Iterable[dict]) -> Iterator[dict]:\n    for r in rows:\n        r['hour'] = r['ts'][:13]\n        yield r\n\nfor row in enrich(clean(extract('events.jsonl'))):\n    load(row)\n```\n\nEach stage is testable in isolation. Memory stays flat.",
        type: "reading", orderIndex: 5, mins: 25, xp: 40,
      },
    ],
  },
  {
    slug: "pandas-essentials",
    title: "Pandas for Data Engineering",
    description: "DataFrames, groupby, merge, time series, and the patterns you'll use 80% of the time.",
    orderIndex: 3,
    isPremium: false,
    lessonCount: 6,
    estimatedHours: 5,
    difficultyLevel: "beginner",
    learningObjectives: [
      "Load and inspect tabular data",
      "Filter, transform, and aggregate with groupby",
      "Join DataFrames with merge",
      "Handle missing values and dtypes",
      "Work with time-series indexes",
    ],
    lessons: [
      {
        slug: "pandas-intro",
        title: "DataFrames: The 80/20",
        content: "# Pandas DataFrames\n\nThe `DataFrame` is a 2-D labeled table. Think SQL table that lives in Python memory.\n\n```python\nimport pandas as pd\n\ndf = pd.read_csv('orders.csv', parse_dates=['ordered_at'])\ndf.head()\ndf.info()           # dtypes + memory\ndf.describe()       # numeric summary\ndf['user_id'].nunique()\n```\n\n**Always check `dtypes` first.** A column you expect to be `int` showing as `object` means there's a string hiding in your numbers — and every numeric op will silently break.",
        type: "reading", orderIndex: 1, mins: 20, xp: 30,
      },
      {
        slug: "pandas-select-filter",
        title: "Selecting & Filtering",
        content: "# .loc, .iloc, and Boolean Masks\n\n```python\n# Label-based\ndf.loc[df['country'] == 'US', ['user_id', 'total']]\n\n# Position-based\ndf.iloc[0:5, 0:3]\n\n# Combine masks with & | ~  (NOT and/or/not)\nmask = (df['total'] > 100) & (df['country'].isin(['US', 'CA']))\ndf[mask]\n```\n\n**Common mistake:** Using `and`/`or` instead of `&`/`|` raises 'truth value is ambiguous'. Always parenthesize each comparison.",
        type: "reading", orderIndex: 2, mins: 20, xp: 30,
      },
      {
        slug: "pandas-groupby",
        title: "GroupBy & Aggregation",
        content: "# GroupBy: split-apply-combine\n\n```python\n# Basic aggregation\ndf.groupby('country')['total'].sum()\n\n# Multiple aggregations per column\ndf.groupby('country').agg(\n    revenue=('total', 'sum'),\n    orders=('order_id', 'count'),\n    avg_order=('total', 'mean'),\n).reset_index()\n\n# Custom aggregation\ndf.groupby('user_id').agg({'total': lambda s: s.quantile(0.95)})\n```\n\n**Tip:** Use named aggregation `agg(name=(col, func))` — the resulting column names are predictable and self-documenting.",
        type: "reading", orderIndex: 3, mins: 25, xp: 35,
      },
      {
        slug: "pandas-merge",
        title: "Joining DataFrames with merge",
        content: "# merge(): SQL JOINs in pandas\n\n```python\nresult = users.merge(\n    orders,\n    left_on='id',\n    right_on='user_id',\n    how='left',         # 'inner', 'left', 'right', 'outer'\n    suffixes=('_u', '_o'),\n    validate='one_to_many',  # raises if assumption broken\n)\n```\n\n**Always pass `validate=`.** `one_to_one`, `one_to_many`, `many_to_one`. If your merge silently fans out, you'll spend a day debugging duplicated revenue.",
        type: "reading", orderIndex: 4, mins: 25, xp: 35,
      },
      {
        slug: "pandas-missing",
        title: "Missing Data & Dtypes",
        content: "# Nulls, NaN, NA, and dtype gotchas\n\n```python\ndf.isna().sum()                    # null count per column\ndf.dropna(subset=['user_id'])      # require user_id\ndf['country'] = df['country'].fillna('UNKNOWN')\n\n# Memory-efficient dtypes\ndf['user_id'] = df['user_id'].astype('int32')\ndf['country'] = df['country'].astype('category')\n```\n\n**Pandas 2 with PyArrow backend:** `pd.read_csv(..., dtype_backend='pyarrow')` for nullable types, faster string ops, and 2-5x lower memory.",
        type: "reading", orderIndex: 5, mins: 20, xp: 35,
      },
      {
        slug: "pandas-time-series",
        title: "Time Series & Resampling",
        content: "# DatetimeIndex & resample\n\n```python\ndf = df.set_index('ordered_at').sort_index()\n\n# Daily revenue\ndaily = df['total'].resample('D').sum()\n\n# Rolling 7-day average\ndaily.rolling('7D').mean()\n\n# Lag features\ndf['prev_day_total'] = df.groupby('user_id')['total'].shift(1)\n```\n\nA `DatetimeIndex` unlocks `resample`, `rolling`, time-based slicing (`df.loc['2024-01']`), and timezone math.",
        type: "reading", orderIndex: 6, mins: 25, xp: 40,
      },
    ],
  },
  {
    slug: "numpy-essentials",
    title: "NumPy: Vectorized Computation",
    description: "ndarray, broadcasting, vectorized ops, and the math layer underneath every Python data tool.",
    orderIndex: 4,
    isPremium: false,
    lessonCount: 4,
    estimatedHours: 3,
    difficultyLevel: "beginner",
    learningObjectives: [
      "Create and reshape arrays",
      "Use broadcasting to avoid loops",
      "Index with masks and fancy indexing",
      "Understand performance vs Python lists",
    ],
    lessons: [
      {
        slug: "numpy-arrays",
        title: "ndarray Basics",
        content: "# Why NumPy is Fast\n\nA Python list of 1M floats stores 1M boxed `PyFloat` objects (≈ 28 MB + pointer overhead). A NumPy `float64` array stores 8 MB of raw bytes.\n\n```python\nimport numpy as np\n\na = np.array([1.0, 2.0, 3.0])\nb = np.zeros((3, 4))           # shape (3,4), all zeros\nc = np.arange(0, 1, 0.1)\nd = np.linspace(0, 1, 11)\n\nprint(a.dtype, a.shape, a.nbytes)\n```\n\nVectorized C loops + cache-friendly memory = 50-100× faster than Python loops on numeric work.",
        type: "reading", orderIndex: 1, mins: 20, xp: 30,
      },
      {
        slug: "numpy-broadcasting",
        title: "Broadcasting",
        content: "# Broadcasting: arrays of different shapes\n\nNumPy automatically stretches smaller arrays so element-wise ops work without explicit loops.\n\n```python\nx = np.array([[1, 2, 3],\n              [4, 5, 6]])    # (2, 3)\nrow = np.array([10, 20, 30])  # (3,)\nx + row                       # (2, 3) — row broadcast over each row\n\ncol = np.array([[100], [200]])  # (2, 1)\nx + col                         # (2, 3) — col broadcast over each col\n```\n\n**Rule:** dimensions are compared right-to-left. They must be equal, or one must be 1.",
        type: "reading", orderIndex: 2, mins: 25, xp: 35,
      },
      {
        slug: "numpy-indexing",
        title: "Indexing & Masking",
        content: "# Boolean masks and fancy indexing\n\n```python\na = np.arange(10)\n\na[a > 5]                  # [6 7 8 9]\na[(a > 2) & (a < 8)]      # [3 4 5 6 7]\na[[0, 3, 5]]              # picks specific positions\n\n# 2-D\nm = np.arange(12).reshape(3, 4)\nm[m % 2 == 0]             # all evens, flattened\nm[:, [0, 2]]              # columns 0 and 2\n```\n\nBoolean masks are how you'd write `WHERE` clauses without leaving NumPy.",
        type: "reading", orderIndex: 3, mins: 20, xp: 35,
      },
      {
        slug: "numpy-perf",
        title: "Performance: Vectorize > Loop",
        content: "# When to drop into NumPy\n\nA Python loop over 1M elements: ~1s. The same op vectorized: ~10ms.\n\n```python\n# Slow\nresult = [x ** 2 + 1 for x in big_list]\n\n# Fast\nresult = big_array ** 2 + 1\n\n# Reduction\nbig_array.sum(), big_array.mean(), big_array.std()\n\n# When you must loop, use np.frompyfunc / numba.jit\n```\n\n**Profile first** — don't optimize what isn't slow. `%timeit` in Jupyter is the easiest way.",
        type: "reading", orderIndex: 4, mins: 20, xp: 35,
      },
    ],
  },
  {
    slug: "scipy-essentials",
    title: "SciPy: Scientific Computing",
    description: "Statistics, optimization, signal processing, and sparse matrices for data engineers and analysts.",
    orderIndex: 5,
    isPremium: true,
    lessonCount: 4,
    estimatedHours: 3,
    difficultyLevel: "intermediate",
    learningObjectives: [
      "Run statistical tests with scipy.stats",
      "Solve optimization problems",
      "Work with sparse matrices",
      "Apply common signal processing techniques",
    ],
    lessons: [
      {
        slug: "scipy-stats",
        title: "Statistical Tests",
        content: "# scipy.stats\n\n```python\nfrom scipy import stats\n\n# Two-sample t-test (A/B test)\nt_stat, p_value = stats.ttest_ind(group_a, group_b, equal_var=False)\n\n# Chi-square for categorical\nchi2, p, dof, expected = stats.chi2_contingency(crosstab)\n\n# Distributions\nstats.norm.cdf(1.96)        # 0.975\nstats.binom.pmf(k=3, n=10, p=0.5)\n```\n\n**Always state H0 / H1 + significance level before running the test** — otherwise it's p-hacking.",
        type: "reading", orderIndex: 1, mins: 25, xp: 40,
      },
      {
        slug: "scipy-optimize",
        title: "Optimization",
        content: "# scipy.optimize\n\nFind parameters that minimize a cost — the engine behind every classical ML model.\n\n```python\nfrom scipy.optimize import minimize\n\ndef rosen(x):\n    return sum(100*(x[1:] - x[:-1]**2)**2 + (1 - x[:-1])**2)\n\nresult = minimize(rosen, x0=[0, 0, 0], method='BFGS')\nprint(result.x, result.fun)\n```\n\nFor curve fitting:\n```python\nfrom scipy.optimize import curve_fit\nparams, cov = curve_fit(model_fn, x_data, y_data, p0=[1.0, 0.5])\n```",
        type: "reading", orderIndex: 2, mins: 25, xp: 40,
      },
      {
        slug: "scipy-sparse",
        title: "Sparse Matrices",
        content: "# scipy.sparse\n\nWhen 99% of your matrix is zero (TF-IDF, recommendation matrices, graph adjacency) — dense storage wastes RAM and CPU.\n\n```python\nfrom scipy.sparse import csr_matrix\nimport numpy as np\n\nrows  = np.array([0, 0, 1, 2])\ncols  = np.array([0, 2, 1, 0])\nvals  = np.array([1, 2, 3, 4])\nm = csr_matrix((vals, (rows, cols)), shape=(3, 3))\n\nm @ m.T            # sparse matmul\nm.toarray()         # dense (use sparingly)\n```\n\n`csr_matrix` for fast row ops, `csc_matrix` for fast column ops.",
        type: "reading", orderIndex: 3, mins: 25, xp: 40,
      },
      {
        slug: "scipy-signal",
        title: "Signal Processing",
        content: "# scipy.signal\n\n```python\nfrom scipy import signal\nimport numpy as np\n\n# Smooth a noisy time series\nsmoothed = signal.savgol_filter(noisy_data, window_length=11, polyorder=2)\n\n# Find peaks (e.g. detect spikes in metrics)\npeaks, props = signal.find_peaks(series, prominence=0.5, distance=10)\n\n# FFT — frequency-domain analysis\nfreqs = np.fft.rfftfreq(len(x), d=1/sample_rate)\nspectrum = np.abs(np.fft.rfft(x))\n```\n\nUseful for anomaly detection, sensor data, and any periodic signal.",
        type: "reading", orderIndex: 4, mins: 20, xp: 40,
      },
    ],
  },
  {
    slug: "matplotlib-essentials",
    title: "Matplotlib: Plotting Foundations",
    description: "Figures, axes, subplots, and the patterns to produce publication-quality charts.",
    orderIndex: 6,
    isPremium: false,
    lessonCount: 4,
    estimatedHours: 2,
    difficultyLevel: "beginner",
    learningObjectives: [
      "Use the figure/axes object-oriented API",
      "Build subplots and grids",
      "Style ticks, labels, and legends",
      "Save high-DPI publication-ready charts",
    ],
    lessons: [
      {
        slug: "mpl-figure-axes",
        title: "Figure, Axes, & the OO API",
        content: "# The Object-Oriented API\n\nForget `plt.plot()`. The OO API is more explicit and scales to complex figures.\n\n```python\nimport matplotlib.pyplot as plt\n\nfig, ax = plt.subplots(figsize=(8, 4), dpi=120)\nax.plot(x, y, label='Revenue')\nax.set_xlabel('Month')\nax.set_ylabel('Revenue ($)')\nax.set_title('Monthly Revenue')\nax.legend()\nax.grid(alpha=0.3)\nfig.tight_layout()\n```\n\n- `Figure` = the whole image\n- `Axes` = one chart inside the figure\n- Always operate on `ax`, not `plt`",
        type: "reading", orderIndex: 1, mins: 20, xp: 30,
      },
      {
        slug: "mpl-subplots",
        title: "Subplots & Grids",
        content: "# Multiple charts in one figure\n\n```python\nfig, axes = plt.subplots(2, 2, figsize=(10, 8), sharex=True)\n\naxes[0, 0].plot(x, y1); axes[0, 0].set_title('Revenue')\naxes[0, 1].bar(x, y2); axes[0, 1].set_title('Orders')\naxes[1, 0].scatter(x, y3); axes[1, 0].set_title('AOV')\naxes[1, 1].hist(y4, bins=30); axes[1, 1].set_title('Spend distribution')\n\nfig.suptitle('Q3 Dashboard', fontsize=14)\nfig.tight_layout()\n```\n\n`sharex=True` keeps x-axes synced — handy for time series.",
        type: "reading", orderIndex: 2, mins: 20, xp: 30,
      },
      {
        slug: "mpl-styling",
        title: "Styling & Annotations",
        content: "# Tick formatting & callouts\n\n```python\nfrom matplotlib.ticker import FuncFormatter\n\nax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f'${v/1e3:.0f}K'))\nax.set_xticks(range(12))\nax.set_xticklabels(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])\n\n# Highlight a point\npeak = y.idxmax()\nax.annotate(f'Peak: ${y.max():,.0f}',\n            xy=(peak, y.max()),\n            xytext=(peak, y.max()*1.1),\n            arrowprops={'arrowstyle': '->'})\n```",
        type: "reading", orderIndex: 3, mins: 20, xp: 35,
      },
      {
        slug: "mpl-saving",
        title: "Saving Publication-Ready Charts",
        content: "# Export\n\n```python\n# Web/screen — PNG @ 2x dpi for retina\nfig.savefig('chart.png', dpi=200, bbox_inches='tight')\n\n# Print/PDF — vector, no rasterization\nfig.savefig('chart.pdf', bbox_inches='tight')\n\n# SVG for blog/web embed\nfig.savefig('chart.svg', bbox_inches='tight')\n```\n\n`bbox_inches='tight'` removes excess whitespace. For dashboards, prefer SVG so labels stay crisp at every zoom level.",
        type: "reading", orderIndex: 4, mins: 15, xp: 30,
      },
    ],
  },
  {
    slug: "seaborn-essentials",
    title: "Seaborn: Statistical Visualization",
    description: "High-level statistical plots: distributions, relationships, categories, and faceting.",
    orderIndex: 7,
    isPremium: false,
    lessonCount: 4,
    estimatedHours: 2,
    difficultyLevel: "beginner",
    learningObjectives: [
      "Plot distributions and pairplots",
      "Visualize relationships with regression and joint plots",
      "Use categorical plots (box, violin, strip)",
      "Build faceted small-multiples with FacetGrid",
    ],
    lessons: [
      {
        slug: "sns-distributions",
        title: "Distribution Plots",
        content: "# Distributions\n\n```python\nimport seaborn as sns\nsns.set_theme(style='whitegrid')\n\nsns.histplot(df, x='order_total', bins=50, kde=True)\nsns.kdeplot(df, x='order_total', hue='country', fill=True, alpha=0.3)\nsns.ecdfplot(df, x='order_total', hue='country')   # cumulative\n```\n\nPrefer ECDF over histograms when comparing 2+ groups — no bin choices, no occlusion.",
        type: "reading", orderIndex: 1, mins: 15, xp: 30,
      },
      {
        slug: "sns-relationships",
        title: "Relationships: regplot & jointplot",
        content: "# Bivariate relationships\n\n```python\nsns.regplot(df, x='spend', y='revenue', scatter_kws={'alpha': 0.3})\nsns.jointplot(df, x='spend', y='revenue', kind='hex')\nsns.lmplot(df, x='spend', y='revenue', hue='country', col='channel')\n```\n\n`lmplot` is `regplot` + faceting — use it to compare slopes across segments.",
        type: "reading", orderIndex: 2, mins: 20, xp: 35,
      },
      {
        slug: "sns-categorical",
        title: "Categorical: box, violin, strip",
        content: "# Categorical plots\n\n```python\nsns.boxplot(df, x='channel', y='order_total')           # 5-number summary\nsns.violinplot(df, x='channel', y='order_total')       # + kde\nsns.stripplot(df, x='channel', y='order_total', alpha=0.4)  # raw points\nsns.barplot(df, x='channel', y='order_total', errorbar='ci')\n```\n\nBoxplots hide bimodality. Always overlay a stripplot or use a violin when n is small.",
        type: "reading", orderIndex: 3, mins: 20, xp: 35,
      },
      {
        slug: "sns-faceting",
        title: "Faceting & Heatmaps",
        content: "# Small multiples & matrices\n\n```python\n# Faceting\ng = sns.relplot(df, x='date', y='revenue', col='product', col_wrap=3, kind='line')\n\n# Correlation heatmap\nimport numpy as np\ncorr = df.select_dtypes('number').corr()\nmask = np.triu(np.ones_like(corr, dtype=bool))\nsns.heatmap(corr, mask=mask, annot=True, fmt='.2f', cmap='RdBu_r', center=0)\n```\n\nHeatmaps with diverging colormaps (`RdBu_r`) make negative correlations pop visually.",
        type: "reading", orderIndex: 4, mins: 25, xp: 35,
      },
    ],
  },
  {
    slug: "scikit-learn-essentials",
    title: "scikit-learn: Classical ML",
    description: "Train/test split, pipelines, model evaluation, and the workflow for every supervised learning task.",
    orderIndex: 8,
    isPremium: true,
    lessonCount: 5,
    estimatedHours: 4,
    difficultyLevel: "intermediate",
    learningObjectives: [
      "Build sklearn Pipelines",
      "Apply preprocessing with ColumnTransformer",
      "Train regressors and classifiers",
      "Evaluate with proper cross-validation",
      "Tune hyperparameters with GridSearchCV",
    ],
    lessons: [
      {
        slug: "sk-train-test",
        title: "Train/Test Split & Baselines",
        content: "# Always split first\n\n```python\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.dummy import DummyClassifier\nfrom sklearn.metrics import accuracy_score\n\nX_train, X_test, y_train, y_test = train_test_split(\n    X, y, test_size=0.2, random_state=42, stratify=y,\n)\n\nbaseline = DummyClassifier(strategy='most_frequent').fit(X_train, y_train)\nprint('Baseline:', accuracy_score(y_test, baseline.predict(X_test)))\n```\n\nIf your fancy model can't beat `DummyClassifier`, you have a data problem, not a model problem.",
        type: "reading", orderIndex: 1, mins: 20, xp: 35,
      },
      {
        slug: "sk-pipelines",
        title: "Pipelines & ColumnTransformer",
        content: "# Avoid leakage with Pipelines\n\nPreprocessing fit on the full dataset = leakage. Pipelines fit only on training data inside CV splits.\n\n```python\nfrom sklearn.pipeline import Pipeline\nfrom sklearn.compose import ColumnTransformer\nfrom sklearn.preprocessing import StandardScaler, OneHotEncoder\nfrom sklearn.impute import SimpleImputer\nfrom sklearn.linear_model import LogisticRegression\n\nnumeric  = ['age', 'income', 'tenure_days']\ncategoric = ['country', 'channel']\n\npreprocess = ColumnTransformer([\n    ('num', Pipeline([('imp', SimpleImputer()), ('sc', StandardScaler())]), numeric),\n    ('cat', OneHotEncoder(handle_unknown='ignore'), categoric),\n])\n\nmodel = Pipeline([('prep', preprocess), ('clf', LogisticRegression(max_iter=1000))])\nmodel.fit(X_train, y_train)\n```",
        type: "reading", orderIndex: 2, mins: 30, xp: 45,
      },
      {
        slug: "sk-models",
        title: "Common Models",
        content: "# A short menu\n\n| Task | Start with |\n|---|---|\n| Tabular classification | `LogisticRegression`, then `HistGradientBoostingClassifier` |\n| Tabular regression | `Ridge`, then `HistGradientBoostingRegressor` |\n| Anomaly detection | `IsolationForest` |\n| Clustering | `KMeans`, `DBSCAN` |\n| Dim. reduction | `PCA`, `TruncatedSVD` for sparse |\n\n```python\nfrom sklearn.ensemble import HistGradientBoostingClassifier\nclf = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05)\nclf.fit(X_train, y_train)\n```\n\n`HistGradientBoosting*` natively handles missing values and is competitive with XGBoost on most tabular problems.",
        type: "reading", orderIndex: 3, mins: 25, xp: 40,
      },
      {
        slug: "sk-evaluation",
        title: "Evaluation & Cross-Validation",
        content: "# Honest scores\n\n```python\nfrom sklearn.model_selection import StratifiedKFold, cross_validate\nfrom sklearn.metrics import classification_report, roc_auc_score\n\ncv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)\nscores = cross_validate(model, X, y, cv=cv,\n                        scoring=['accuracy', 'roc_auc', 'f1'],\n                        return_train_score=True)\n\nprint(scores['test_roc_auc'].mean(), scores['test_roc_auc'].std())\n```\n\nFor imbalanced classes prefer `roc_auc` / `average_precision`. Accuracy lies when 95% of the data is one class.",
        type: "reading", orderIndex: 4, mins: 25, xp: 40,
      },
      {
        slug: "sk-tuning",
        title: "Hyperparameter Tuning",
        content: "# GridSearchCV / HalvingGridSearchCV\n\n```python\nfrom sklearn.model_selection import GridSearchCV\n\nparam_grid = {\n    'clf__max_iter':        [100, 200, 400],\n    'clf__learning_rate':   [0.01, 0.05, 0.1],\n    'clf__max_leaf_nodes':  [31, 63, 127],\n}\n\nsearch = GridSearchCV(model, param_grid, cv=cv, scoring='roc_auc', n_jobs=-1)\nsearch.fit(X_train, y_train)\nprint(search.best_params_, search.best_score_)\n```\n\nFor large grids, `HalvingGridSearchCV` (successive halving) finds the winner ~10x faster.",
        type: "reading", orderIndex: 5, mins: 25, xp: 45,
      },
    ],
  },
  {
    slug: "pytorch-essentials",
    title: "PyTorch: Deep Learning Foundations",
    description: "Tensors, autograd, modules, and the training loop pattern used across modern deep learning.",
    orderIndex: 9,
    isPremium: true,
    lessonCount: 5,
    estimatedHours: 5,
    difficultyLevel: "intermediate",
    learningObjectives: [
      "Manipulate tensors and use autograd",
      "Define models with nn.Module",
      "Write a clean training loop",
      "Use DataLoader and Datasets",
      "Save and load checkpoints",
    ],
    lessons: [
      {
        slug: "torch-tensors",
        title: "Tensors & Autograd",
        content: "# Tensors\n\n```python\nimport torch\n\nx = torch.tensor([[1., 2.], [3., 4.]], requires_grad=True)\ny = (x ** 2).sum()\ny.backward()\nprint(x.grad)   # dy/dx = 2x\n```\n\n`requires_grad=True` enables autograd — PyTorch builds a computation graph and `.backward()` walks it to compute gradients automatically.",
        type: "reading", orderIndex: 1, mins: 25, xp: 40,
      },
      {
        slug: "torch-nn-module",
        title: "nn.Module: Building Models",
        content: "# Define a model\n\n```python\nimport torch.nn as nn\n\nclass MLP(nn.Module):\n    def __init__(self, in_dim, hidden, out_dim):\n        super().__init__()\n        self.net = nn.Sequential(\n            nn.Linear(in_dim, hidden),\n            nn.ReLU(),\n            nn.Dropout(0.2),\n            nn.Linear(hidden, out_dim),\n        )\n    def forward(self, x):\n        return self.net(x)\n\nmodel = MLP(784, 256, 10)\nprint(sum(p.numel() for p in model.parameters()))\n```",
        type: "reading", orderIndex: 2, mins: 25, xp: 40,
      },
      {
        slug: "torch-training-loop",
        title: "The Training Loop",
        content: "# Canonical training loop\n\n```python\nfrom torch.utils.data import DataLoader\nimport torch.optim as optim\n\ndevice = 'cuda' if torch.cuda.is_available() else 'cpu'\nmodel = model.to(device)\n\noptimizer = optim.AdamW(model.parameters(), lr=1e-3)\nloss_fn = nn.CrossEntropyLoss()\n\nfor epoch in range(epochs):\n    model.train()\n    for xb, yb in train_loader:\n        xb, yb = xb.to(device), yb.to(device)\n        optimizer.zero_grad()\n        loss = loss_fn(model(xb), yb)\n        loss.backward()\n        optimizer.step()\n    # ... eval, log, checkpoint\n```\n\n**Always:** `zero_grad → forward → loss → backward → step`. Forget `zero_grad` and gradients accumulate forever.",
        type: "reading", orderIndex: 3, mins: 30, xp: 50,
      },
      {
        slug: "torch-data",
        title: "Dataset & DataLoader",
        content: "# Custom Dataset\n\n```python\nfrom torch.utils.data import Dataset, DataLoader\n\nclass CSVDataset(Dataset):\n    def __init__(self, X, y):\n        self.X = torch.tensor(X, dtype=torch.float32)\n        self.y = torch.tensor(y, dtype=torch.long)\n    def __len__(self):\n        return len(self.y)\n    def __getitem__(self, idx):\n        return self.X[idx], self.y[idx]\n\nloader = DataLoader(CSVDataset(X, y), batch_size=64, shuffle=True, num_workers=2)\n```\n\n`num_workers > 0` parallelizes data loading. Set `pin_memory=True` for faster GPU transfer.",
        type: "reading", orderIndex: 4, mins: 25, xp: 45,
      },
      {
        slug: "torch-checkpoints",
        title: "Saving & Loading Checkpoints",
        content: "# Checkpointing\n\n```python\n# Save\ntorch.save({\n    'epoch': epoch,\n    'model_state_dict': model.state_dict(),\n    'optimizer_state_dict': optimizer.state_dict(),\n    'best_val_loss': best_val_loss,\n}, 'checkpoint.pt')\n\n# Load\nckpt = torch.load('checkpoint.pt', map_location=device)\nmodel.load_state_dict(ckpt['model_state_dict'])\noptimizer.load_state_dict(ckpt['optimizer_state_dict'])\n```\n\n**Save state_dicts, not whole models.** State dicts are portable across code refactors; pickled models break.",
        type: "reading", orderIndex: 5, mins: 20, xp: 40,
      },
    ],
  },
  {
    slug: "tensorflow-essentials",
    title: "TensorFlow & Keras",
    description: "Build, train, and serve models with the high-level Keras API on top of TensorFlow.",
    orderIndex: 10,
    isPremium: true,
    lessonCount: 4,
    estimatedHours: 4,
    difficultyLevel: "intermediate",
    learningObjectives: [
      "Build models with the Keras Sequential and Functional APIs",
      "Use tf.data for performant input pipelines",
      "Train and evaluate with model.fit",
      "Save SavedModel and serve with TF Serving",
    ],
    lessons: [
      {
        slug: "tf-keras-intro",
        title: "Keras Sequential & Functional",
        content: "# Two ways to build a model\n\n```python\nimport tensorflow as tf\nfrom tensorflow.keras import layers, Model, Input\n\n# Sequential — linear stack\nmodel = tf.keras.Sequential([\n    layers.Dense(128, activation='relu', input_shape=(784,)),\n    layers.Dropout(0.2),\n    layers.Dense(10, activation='softmax'),\n])\n\n# Functional — branching graphs\ninp = Input(shape=(784,))\nh = layers.Dense(128, activation='relu')(inp)\nh = layers.Dropout(0.2)(h)\nout = layers.Dense(10, activation='softmax')(h)\nmodel = Model(inp, out)\n```",
        type: "reading", orderIndex: 1, mins: 25, xp: 40,
      },
      {
        slug: "tf-data",
        title: "tf.data: Input Pipelines",
        content: "# tf.data for training-loop-free I/O\n\n```python\nds = tf.data.Dataset.from_tensor_slices((X, y))\nds = (ds\n      .shuffle(10_000)\n      .batch(64)\n      .map(preprocess, num_parallel_calls=tf.data.AUTOTUNE)\n      .prefetch(tf.data.AUTOTUNE))\n```\n\n`AUTOTUNE` lets TF decide parallelism at runtime. `prefetch` overlaps preprocessing with GPU compute — usually the single biggest wall-clock win.",
        type: "reading", orderIndex: 2, mins: 25, xp: 40,
      },
      {
        slug: "tf-fit-evaluate",
        title: "compile, fit, evaluate",
        content: "# The Keras training trifecta\n\n```python\nmodel.compile(\n    optimizer=tf.keras.optimizers.Adam(1e-3),\n    loss='sparse_categorical_crossentropy',\n    metrics=['accuracy'],\n)\n\nhistory = model.fit(\n    train_ds,\n    validation_data=val_ds,\n    epochs=20,\n    callbacks=[\n        tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True),\n        tf.keras.callbacks.ModelCheckpoint('best.keras', save_best_only=True),\n    ],\n)\n\nmodel.evaluate(test_ds)\n```\n\nCallbacks are how you add early stopping, LR scheduling, TensorBoard, and W&B without writing a custom loop.",
        type: "reading", orderIndex: 3, mins: 25, xp: 40,
      },
      {
        slug: "tf-savedmodel",
        title: "SavedModel & Serving",
        content: "# Save once, serve anywhere\n\n```python\nmodel.save('models/my_model')              # SavedModel format\n\n# Load\nrestored = tf.keras.models.load_model('models/my_model')\n\n# Serve with TF Serving (Docker)\n# docker run -p 8501:8501 \\\n#   -v $PWD/models:/models -e MODEL_NAME=my_model \\\n#   tensorflow/serving\n```\n\nThe SavedModel bundle contains the graph, weights, and signatures — TF Serving exposes them as a REST/gRPC endpoint with no extra code.",
        type: "reading", orderIndex: 4, mins: 25, xp: 45,
      },
    ],
  },
  {
    slug: "huggingface-transformers",
    title: "Hugging Face Transformers",
    description: "Use pretrained models for text classification, embeddings, and generation with the transformers library.",
    orderIndex: 11,
    isPremium: true,
    lessonCount: 4,
    estimatedHours: 4,
    difficultyLevel: "intermediate",
    learningObjectives: [
      "Use pipelines for quick inference",
      "Tokenize text and feed it to a model",
      "Generate embeddings for semantic search",
      "Fine-tune a transformer with the Trainer API",
    ],
    lessons: [
      {
        slug: "hf-pipelines",
        title: "Pipelines: One-Liner Inference",
        content: "# Pipelines\n\n```python\nfrom transformers import pipeline\n\nclf = pipeline('sentiment-analysis')\nclf(\"I love this curriculum!\")\n# [{'label': 'POSITIVE', 'score': 0.999}]\n\nner = pipeline('ner', aggregation_strategy='simple')\nner(\"Stripe acquired Bridge in 2024.\")\n\ngen = pipeline('text-generation', model='gpt2')\ngen('Once upon a time', max_new_tokens=40)\n```\n\nPipelines auto-download the model + tokenizer the first time. Great for prototyping.",
        type: "reading", orderIndex: 1, mins: 20, xp: 40,
      },
      {
        slug: "hf-tokenizers",
        title: "Tokenizers & AutoModel",
        content: "# Lower-level: tokenizer + model\n\n```python\nfrom transformers import AutoTokenizer, AutoModel\nimport torch\n\nname = 'sentence-transformers/all-MiniLM-L6-v2'\ntokenizer = AutoTokenizer.from_pretrained(name)\nmodel = AutoModel.from_pretrained(name)\n\ntexts = ['hello world', 'good morning']\nencoded = tokenizer(texts, padding=True, truncation=True, return_tensors='pt')\n\nwith torch.no_grad():\n    out = model(**encoded)\n\nprint(out.last_hidden_state.shape)  # (batch, seq_len, hidden)\n```\n\n`padding=True` pads to the longest in the batch; `truncation=True` clips to model max length.",
        type: "reading", orderIndex: 2, mins: 25, xp: 45,
      },
      {
        slug: "hf-embeddings",
        title: "Sentence Embeddings for Search",
        content: "# Sentence embeddings + cosine similarity\n\n```python\nfrom sentence_transformers import SentenceTransformer\nfrom sklearn.metrics.pairwise import cosine_similarity\n\nmodel = SentenceTransformer('all-MiniLM-L6-v2')\n\ncorpus = ['How do I reset my password?',\n          'When will my order ship?',\n          'I want to upgrade my plan.']\nemb = model.encode(corpus)\n\nq = model.encode(['cancel my subscription'])\nsims = cosine_similarity(q, emb)[0]\nprint(corpus[sims.argmax()])\n```\n\nThis is the entire idea behind RAG retrieval — embed once, search by cosine.",
        type: "reading", orderIndex: 3, mins: 25, xp: 45,
      },
      {
        slug: "hf-trainer",
        title: "Fine-tuning with Trainer",
        content: "# Trainer API\n\n```python\nfrom transformers import (AutoTokenizer, AutoModelForSequenceClassification,\n                          Trainer, TrainingArguments)\nfrom datasets import load_dataset\n\nds = load_dataset('imdb')\ntok = AutoTokenizer.from_pretrained('distilbert-base-uncased')\nds = ds.map(lambda x: tok(x['text'], truncation=True), batched=True)\n\nmodel = AutoModelForSequenceClassification.from_pretrained(\n    'distilbert-base-uncased', num_labels=2,\n)\n\nargs = TrainingArguments(\n    output_dir='out', learning_rate=2e-5, per_device_train_batch_size=16,\n    num_train_epochs=2, evaluation_strategy='epoch',\n)\n\nTrainer(model=model, args=args, train_dataset=ds['train'], eval_dataset=ds['test']).train()\n```\n\nFine-tuning a small DistilBERT on IMDb takes ~10 min on a T4 GPU.",
        type: "reading", orderIndex: 4, mins: 30, xp: 50,
      },
    ],
  },
  {
    slug: "langchain-essentials",
    title: "LangChain: Building LLM Apps",
    description: "Compose chains, prompts, retrievers, and agents to build RAG systems and tool-using agents.",
    orderIndex: 12,
    isPremium: true,
    lessonCount: 4,
    estimatedHours: 4,
    difficultyLevel: "intermediate",
    learningObjectives: [
      "Compose prompts and runnables with LCEL",
      "Build a retrieval-augmented generation (RAG) pipeline",
      "Use vector stores for semantic search",
      "Build agents that call tools",
    ],
    lessons: [
      {
        slug: "lc-runnables",
        title: "LCEL: Composing Runnables",
        content: "# LangChain Expression Language (LCEL)\n\n```python\nfrom langchain_core.prompts import ChatPromptTemplate\nfrom langchain_core.output_parsers import StrOutputParser\nfrom langchain_anthropic import ChatAnthropic\n\nllm = ChatAnthropic(model='claude-haiku-4-5')\nprompt = ChatPromptTemplate.from_messages([\n    ('system', 'You are a helpful data engineering assistant.'),\n    ('human', '{question}'),\n])\n\nchain = prompt | llm | StrOutputParser()\nprint(chain.invoke({'question': 'Explain ELT vs ETL.'}))\n```\n\nThe `|` operator pipes outputs forward — like Unix pipes for LLM apps.",
        type: "reading", orderIndex: 1, mins: 25, xp: 45,
      },
      {
        slug: "lc-rag",
        title: "RAG: Retrieval-Augmented Generation",
        content: "# Build a RAG chain\n\n```python\nfrom langchain_community.vectorstores import FAISS\nfrom langchain_community.embeddings import HuggingFaceEmbeddings\nfrom langchain.text_splitter import RecursiveCharacterTextSplitter\nfrom langchain_core.runnables import RunnablePassthrough\n\ndocs = load_docs('./docs')\nsplitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)\nchunks = splitter.split_documents(docs)\n\nvs = FAISS.from_documents(chunks, HuggingFaceEmbeddings('all-MiniLM-L6-v2'))\nretriever = vs.as_retriever(k=4)\n\nrag_prompt = ChatPromptTemplate.from_template(\n    \"\"\"Answer based only on the context below.\\n\\nContext: {context}\\n\\nQuestion: {q}\"\"\"\n)\n\nrag = ({'context': retriever, 'q': RunnablePassthrough()} | rag_prompt | llm | StrOutputParser())\nrag.invoke('How do incremental dbt models work?')\n```",
        type: "reading", orderIndex: 2, mins: 30, xp: 50,
      },
      {
        slug: "lc-vectorstores",
        title: "Vector Stores",
        content: "# Pick the right store\n\n| Store | When |\n|---|---|\n| FAISS | Local, in-memory, single-machine |\n| Chroma | Local, persistent, easy |\n| pgvector | You already run Postgres |\n| Pinecone / Weaviate | Managed, multi-tenant |\n\n```python\n# Persist locally with Chroma\nfrom langchain_community.vectorstores import Chroma\nvs = Chroma.from_documents(chunks, emb, persist_directory='./chroma')\nvs.persist()\n\n# Reload\nvs = Chroma(persist_directory='./chroma', embedding_function=emb)\n```\n\nFor evaluation, **always measure recall@k** on a labeled query set before tuning chunking.",
        type: "reading", orderIndex: 3, mins: 25, xp: 45,
      },
      {
        slug: "lc-agents",
        title: "Tool-Using Agents",
        content: "# Agents with tools\n\n```python\nfrom langchain.agents import tool, AgentExecutor, create_tool_calling_agent\n\n@tool\ndef get_revenue(month: str) -> str:\n    \"\"\"Return total revenue for a given YYYY-MM month.\"\"\"\n    return run_sql(\"SELECT SUM(total) FROM orders WHERE TO_CHAR(ts, 'YYYY-MM') = %s\", [month])\n\n@tool\ndef get_users(month: str) -> str:\n    \"\"\"Return active user count for a given YYYY-MM month.\"\"\"\n    return run_sql(\"SELECT COUNT(DISTINCT user_id) FROM events WHERE TO_CHAR(ts, 'YYYY-MM') = %s\", [month])\n\nagent = create_tool_calling_agent(llm, [get_revenue, get_users], prompt)\nexecutor = AgentExecutor(agent=agent, tools=[get_revenue, get_users])\n\nexecutor.invoke({'input': 'What was our ARPU in 2024-09?'})\n```\n\nThe LLM decides which tools to call, in what order, and combines the results — entirely from your typed function signatures.",
        type: "reading", orderIndex: 4, mins: 30, xp: 50,
      },
    ],
  },
];
