import { db } from "@workspace/db";
import { domains, tracks, projects, projectSteps, masterySections, masteryModules, masteryLessons } from "@workspace/db";
import { eq, and } from "drizzle-orm";

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function seed() {
  console.log("Seeding database...");

  // --- Data Engineering Domain ---
  const [deBase] = await db.insert(domains).values({
    slug: "data-engineering",
    title: "Data Engineering",
    tagline: "Build real data pipelines used by top tech companies",
    description: "Master ETL pipelines, data warehouses, orchestration, and stream processing through 40 hands-on projects.",
    iconName: "Database",
    colorHex: "#3B82F6",
    isAvailable: true,
    comingSoon: false,
    totalProjects: 40,
    orderIndex: 1,
  }).onConflictDoNothing().returning();

  const deDomain = deBase ?? await db.query.domains.findFirst({ where: eq(domains.slug, "data-engineering") });
  if (!deDomain) { console.error("Could not create/find domain"); process.exit(1); }
  console.log(`Domain: ${deDomain.title} (${deDomain.id})`);

  // --- Coming-soon domain placeholders ---
  // Infrastructure for future curriculums. Inserting the domain row gives us
  // a stable slug, icon, color, and waitlist surface before any content ships.
  const comingSoonDomains = [
    {
      slug: "ai-mlops",
      title: "AI / MLOps",
      tagline: "Ship production ML systems",
      description: "Master the engineering disciplines behind production AI: training pipelines, feature stores, model serving, evaluation, and the operations that keep ML systems reliable in the wild.",
      iconName: "Brain",
      colorHex: "#A855F7",
      orderIndex: 2,
    },
    {
      slug: "ai-engineering",
      title: "AI Engineering",
      tagline: "Build with LLMs in production",
      description: "Master the engineering craft of building real applications on top of LLMs: prompt design, RAG systems, agents, evals, fine-tuning, and the production patterns that separate demos from products.",
      iconName: "Sparkles",
      colorHex: "#F59E0B",
      orderIndex: 3,
    },
    {
      slug: "data-science",
      title: "Data Science",
      tagline: "Extract insight, ship models",
      description: "From statistics and experimentation to feature engineering, predictive modeling, and shipping insights that move the business — the full data science workflow taught project-by-project.",
      iconName: "LineChart",
      colorHex: "#10B981",
      orderIndex: 4,
    },
  ];
  for (const d of comingSoonDomains) {
    await db.insert(domains).values({
      ...d,
      isAvailable: false,
      comingSoon: true,
      totalProjects: 0,
    }).onConflictDoNothing();
    console.log(`Domain: ${d.title} (coming soon)`);
  }

  // --- Track: Data Engineering Core ---
  const [trackBase] = await db.insert(tracks).values({
    domainId: deDomain.id,
    slug: "de-core",
    title: "Data Engineering Core",
    description: "The complete Data Engineering curriculum from fundamentals to expert-level projects.",
    difficultyLevel: "beginner",
    estimatedHours: 200,
    projectCount: 40,
    orderIndex: 1,
    prerequisites: [],
    isPremium: false,
  }).onConflictDoNothing().returning();

  const deTrack = trackBase ?? await db.query.tracks.findFirst({ where: and(eq(tracks.domainId, deDomain.id), eq(tracks.slug, "de-core")) });
  if (!deTrack) { console.error("Could not create/find track"); process.exit(1); }
  console.log(`Track: ${deTrack.title} (${deTrack.id})`);

  // --- Projects 1-10 Full Content ---
  type Diff = "beginner" | "intermediate" | "advanced";
  const projectData: Array<{
    slug: string;
    title: string;
    shortDescription: string;
    fullDescription: string;
    difficulty: Diff;
    position: number;
    estimatedMinutes: number;
    xpReward: number;
    isPremium: boolean;
    tags: string[];
    learningObjectives: string[];
    techStack: string[];
    language: "python" | "sql" | "both";
    steps: Array<{
      stepNumber: number;
      title: string;
      instruction: string;
      starterCode?: string;
      validationHint?: string;
      xpReward: number;
    }>;
  }> = [
    {
      slug: "csv-to-postgres-pipeline",
      title: "CSV to PostgreSQL Pipeline",
      shortDescription: "Build your first ETL pipeline loading CSV data into PostgreSQL.",
      fullDescription: "In this project, you'll build a production-ready ETL pipeline that reads CSV files, validates the data, and loads it into PostgreSQL using bulk insert with psycopg2. You'll learn schema design, error handling, and idempotent pipeline patterns.",
      difficulty: "beginner",
      position: 1,
      estimatedMinutes: 240,
      xpReward: 300,
      isPremium: false,
      tags: ["python", "postgresql", "etl", "pandas"],
      learningObjectives: ["Understand ETL pipeline fundamentals", "Design relational schemas for tabular data", "Handle CSV parsing edge cases", "Write idempotent pipeline runs"],
      techStack: ["Python", "psycopg2", "pandas", "PostgreSQL"],
      language: "python",
      steps: [
        {
          stepNumber: 1,
          title: "Set Up Your Environment & Connection",
          instruction: "## Step 1: PostgreSQL Connection\n\nBefore ingesting any data, we need a reliable database connection.\n\n```python\nimport psycopg2\n\nconn = psycopg2.connect(\n    host='localhost',\n    database='atlas_de',\n    user='postgres',\n    password='yourpassword'\n)\nprint(conn.status)  # Should print 1 (STATUS_READY)\n```\n\n**Your task:** Write a `connect_db(url)` function that accepts a connection string and returns a psycopg2 connection. Verify it works by checking `conn.status`.",
          starterCode: "import psycopg2\n\ndef connect_db(url: str):\n    \"\"\"\n    Connect to PostgreSQL using a connection string URL.\n    Returns a psycopg2 connection.\n    \"\"\"\n    # TODO: implement using psycopg2.connect(url)\n    pass\n\n# Test (replace with your DB URL)\n# conn = connect_db('postgresql://user:pass@localhost:5432/mydb')\n# print(conn.status)  # Expected: 1\nprint('Function defined - implement the body!')\n",
          validationHint: "Use psycopg2.connect(url) and return the connection. conn.status == 1 means connected.",
          xpReward: 50,
        },
        {
          stepNumber: 2,
          title: "Design the Schema",
          instruction: "## Step 2: Create Your Schema\n\nGood schema design prevents headaches later. Key rules:\n- Use `TIMESTAMPTZ` for timestamps (timezone-aware)\n- Add `created_at` for pipeline auditing (when was this row ingested?)\n- Use `JSONB` for flexible metadata\n\n```sql\nCREATE TABLE IF NOT EXISTS raw_events (\n    id SERIAL PRIMARY KEY,\n    event_type VARCHAR(50) NOT NULL,\n    user_id INTEGER NOT NULL,\n    event_ts TIMESTAMPTZ NOT NULL,\n    properties JSONB,\n    created_at TIMESTAMPTZ DEFAULT NOW()\n);\n```\n\n**Your task:** Write a `create_schema(conn)` function that creates this table.",
          starterCode: "import psycopg2\n\ndef create_schema(conn):\n    \"\"\"\n    Create the raw_events table if it doesn't exist.\n    Use CREATE TABLE IF NOT EXISTS for idempotency.\n    \"\"\"\n    sql = \"\"\"\n    -- TODO: Write the CREATE TABLE IF NOT EXISTS statement\n    \"\"\"\n    with conn.cursor() as cur:\n        cur.execute(sql)\n    conn.commit()\n    print('Schema created!')\n\n# Demonstrate what the SQL should look like:\nprint('Implement create_schema with the raw_events DDL')\n",
          validationHint: "Use CREATE TABLE IF NOT EXISTS raw_events with SERIAL PRIMARY KEY, VARCHAR, INTEGER, TIMESTAMPTZ, and JSONB columns.",
          xpReward: 75,
        },
        {
          stepNumber: 3,
          title: "Parse and Clean CSV Data",
          instruction: "## Step 3: Load & Validate Your CSV\n\nReal-world CSVs have messy data. Always validate before loading:\n\n```python\nimport pandas as pd\n\ndf = pd.read_csv('events.csv', parse_dates=['event_ts'])\nrequired = {'event_type', 'user_id', 'event_ts'}\nassert required.issubset(df.columns)\ndf = df.dropna(subset=['event_type', 'user_id', 'event_ts'])\nprint(f'Loaded {len(df)} valid rows')\n```\n\n**Your task:** Write `load_csv(filepath)` that returns a cleaned DataFrame.",
          starterCode: "import pandas as pd\n\ndef load_csv(filepath: str) -> pd.DataFrame:\n    \"\"\"\n    Load CSV and return a cleaned DataFrame.\n    Requirements:\n    - Parse event_ts as datetime\n    - Drop rows where event_type, user_id, or event_ts is null\n    - Return the cleaned DataFrame\n    \"\"\"\n    # TODO: implement\n    pass\n\n# Test\nsample_data = 'event_type,user_id,event_ts\\nclick,1,2024-01-01T10:00:00Z\\n,2,2024-01-01T11:00:00Z\\npurchase,3,2024-01-01T12:00:00Z'\nwith open('/tmp/test_events.csv', 'w') as f:\n    f.write(sample_data)\n\ndf = load_csv('/tmp/test_events.csv')\nprint(f'Shape: {df.shape}')  # Expected: (2, 3) - the null row is dropped\nprint(df)\n",
          validationHint: "Use pd.read_csv with parse_dates=['event_ts'], then df.dropna(subset=['event_type','user_id','event_ts']).",
          xpReward: 75,
        },
        {
          stepNumber: 4,
          title: "Bulk Insert with COPY",
          instruction: "## Step 4: High-Performance Bulk Insert\n\nPostgreSQL's `COPY` command is 10-100x faster than individual INSERTs for bulk loads:\n\n```python\nfrom io import StringIO\n\ndef bulk_insert(conn, df, table_name):\n    buf = StringIO()\n    df.to_csv(buf, index=False, header=False)\n    buf.seek(0)\n    with conn.cursor() as cur:\n        cur.copy_expert(\n            f\"COPY {table_name} (event_type, user_id, event_ts) FROM STDIN WITH CSV\",\n            buf\n        )\n    conn.commit()\n    return len(df)\n```\n\n**Your task:** Implement `bulk_insert(conn, df, table_name)` and return the row count.",
          starterCode: "from io import StringIO\nimport pandas as pd\n\ndef bulk_insert(conn, df: pd.DataFrame, table_name: str, columns: list) -> int:\n    \"\"\"\n    Bulk insert df into table_name using PostgreSQL COPY.\n    Arguments:\n        conn: psycopg2 connection\n        df: DataFrame to insert\n        table_name: target table\n        columns: list of column names to insert\n    Returns:\n        number of rows inserted\n    \"\"\"\n    # TODO: implement using StringIO and cursor.copy_expert()\n    pass\n\nprint('Implement bulk_insert using COPY for high performance!')\n",
          validationHint: "Use StringIO as an in-memory buffer, df.to_csv(buf, index=False, header=False), then cursor.copy_expert(\"COPY ... FROM STDIN WITH CSV\", buf).",
          xpReward: 100,
        },
      ],
    },
    {
      slug: "api-to-warehouse-ingestion",
      title: "REST API to Data Warehouse Ingestion",
      shortDescription: "Fetch paginated API data and load it incrementally into a data warehouse.",
      fullDescription: "Build a production REST API ingestion pipeline with pagination handling, watermark-based incremental loading, deduplication with upserts, and rate limit management.",
      difficulty: "beginner",
      position: 2,
      estimatedMinutes: 300,
      xpReward: 350,
      isPremium: false,
      tags: ["python", "api", "rest", "etl", "incremental"],
      learningObjectives: ["Handle REST API pagination", "Implement incremental loading with watermarks", "Deduplicate with upserts", "Manage API rate limits"],
      techStack: ["Python", "requests", "PostgreSQL"],
      language: "python",
      steps: [
        {
          stepNumber: 1,
          title: "Handle Paginated APIs",
          instruction: "## Paginated API Fetching\n\nMost production APIs return data in pages. Never assume all data fits in one response.\n\n```python\nimport requests\nimport time\n\ndef fetch_all_pages(url, headers, params=None):\n    results = []\n    while url:\n        resp = requests.get(url, headers=headers, params=params)\n        resp.raise_for_status()\n        data = resp.json()\n        results.extend(data.get('items', []))\n        url = data.get('next')  # Follow pagination\n        params = None  # Only on first request\n        time.sleep(0.1)  # Rate limit\n    return results\n```\n\n**Task:** Write `fetch_all_pages(base_url, headers)` that follows `next` pagination links.",
          starterCode: "import requests\nimport time\nfrom typing import Optional\n\ndef fetch_all_pages(base_url: str, headers: dict = None, params: dict = None) -> list:\n    \"\"\"\n    Fetch all pages from a paginated REST API.\n    The API response format: {items: [...], next: url_or_null}\n    Returns all items across all pages.\n    \"\"\"\n    results = []\n    url: Optional[str] = base_url\n    first = True\n    while url:\n        # TODO: Fetch the page, extend results, follow next link\n        pass\n    return results\n\nprint('Implement fetch_all_pages!')\n",
          validationHint: "Get each page, extend results with data['items'], set url = data.get('next'), add time.sleep(0.1) for rate limiting.",
          xpReward: 125,
        },
        {
          stepNumber: 2,
          title: "Watermark-Based Incremental Load",
          instruction: "## Incremental Loading\n\nOnly load NEW data since the last run — this is the foundation of efficient pipelines.\n\n```python\ndef get_watermark(conn, table: str, col: str = 'updated_at'):\n    with conn.cursor() as cur:\n        cur.execute(f'SELECT MAX({col}) FROM {table}')\n        row = cur.fetchone()\n    return row[0] if row and row[0] else None\n\n# Use it:\nwatermark = get_watermark(conn, 'raw_orders')\nparams = {'updated_since': watermark.isoformat()} if watermark else {}\nrecords = fetch_all_pages(API_URL, headers, params)\n```\n\n**Task:** Implement `get_watermark(conn, table, col)` and `fetch_incremental(api_url, since)`.",
          starterCode: "from datetime import datetime\nfrom typing import Optional\n\ndef get_watermark(conn, table: str, watermark_col: str = 'updated_at') -> Optional[datetime]:\n    \"\"\"\n    Get the max value of watermark_col from table.\n    Returns None if table is empty.\n    \"\"\"\n    # TODO: Execute SELECT MAX(watermark_col) FROM table\n    pass\n\ndef fetch_incremental(api_url: str, since: Optional[datetime] = None) -> list:\n    \"\"\"\n    Fetch records from the API updated after 'since'.\n    If since is None, fetch everything (full load).\n    \"\"\"\n    # TODO: Build params dict and call fetch_all_pages\n    pass\n\nprint('Implement watermark-based incremental loading!')\n",
          validationHint: "SELECT MAX(updated_at) FROM table returns None if empty. Format datetime with .isoformat() for API params.",
          xpReward: 125,
        },
      ],
    },
    {
      slug: "airflow-etl-dag",
      title: "Build Your First Airflow DAG",
      shortDescription: "Orchestrate a multi-step ETL pipeline with Apache Airflow.",
      fullDescription: "Learn to build production-grade Airflow DAGs with proper task dependencies, retries, SLAs, and monitoring. You'll orchestrate an end-to-end pipeline from data ingestion to transformation.",
      difficulty: "intermediate",
      position: 3,
      estimatedMinutes: 360,
      xpReward: 450,
      isPremium: false,
      tags: ["airflow", "orchestration", "dag", "python"],
      learningObjectives: ["Understand DAG anatomy", "Configure retries and failure handling", "Use Airflow operators and hooks", "Monitor pipeline runs"],
      techStack: ["Apache Airflow", "Python", "PostgresOperator"],
      language: "python",
      steps: [
        {
          stepNumber: 1,
          title: "Define a DAG with Default Args",
          instruction: "## Your First Airflow DAG\n\nA DAG defines the structure of your pipeline. Default args configure retry behavior for all tasks.\n\n```python\nfrom datetime import datetime, timedelta\nfrom airflow import DAG\n\ndefault_args = {\n    'owner': 'data-team',\n    'retries': 3,\n    'retry_delay': timedelta(minutes=5),\n    'email_on_failure': True,\n}\n\ndag = DAG(\n    'etl_pipeline',\n    default_args=default_args,\n    schedule_interval='@daily',\n    start_date=datetime(2024, 1, 1),\n    catchup=False,\n    tags=['etl', 'production'],\n)\n```\n\n**Task:** Write the DAG definition for a `sales_etl` pipeline that runs daily.",
          starterCode: "# Write a DAG definition for 'sales_etl'\n# Requirements:\n# - owner: 'data-engineering'\n# - retries: 2, retry_delay: 5 minutes  \n# - schedule: daily at midnight UTC\n# - start_date: January 1, 2024\n# - catchup: False\n# - tags: ['sales', 'etl']\n\nfrom datetime import datetime, timedelta\n\n# TODO: Define default_args dict and DAG object\ndefault_args = {}\n\n# dag = DAG(...)\n\nprint('Define the sales_etl DAG!')\n",
          validationHint: "Set retries=2, retry_delay=timedelta(minutes=5), schedule_interval='@daily', catchup=False.",
          xpReward: 150,
        },
      ],
    },
    {
      slug: "dbt-data-models",
      title: "Data Modeling with dbt",
      shortDescription: "Transform raw data into analytics-ready models using dbt.",
      fullDescription: "Apply medallion architecture (bronze/silver/gold) with dbt. Learn staging models, mart models, ref() and source() macros, and how to test your transformations.",
      difficulty: "intermediate",
      position: 4,
      estimatedMinutes: 420,
      xpReward: 500,
      isPremium: false,
      tags: ["dbt", "sql", "data-modeling", "analytics"],
      learningObjectives: ["Set up dbt project structure", "Build bronze/silver/gold models", "Write dbt tests", "Use ref() and source() macros"],
      techStack: ["dbt", "SQL", "PostgreSQL"],
      language: "sql",
      steps: [
        {
          stepNumber: 1,
          title: "dbt Project Setup",
          instruction: "## dbt Project Configuration\n\nThe `dbt_project.yml` is the heart of your dbt project. It defines model materializations (view vs table) per layer.\n\n```yaml\nname: atlas_transforms\nversion: '1.0'\n\nmodels:\n  atlas_transforms:\n    staging:     # Raw → cleaned\n      +materialized: view\n    marts:       # Business logic\n      +materialized: table\n```\n\n**Task:** Write the `dbt_project.yml` content as a Python string and explain why staging = view and marts = table.",
          starterCode: "# Write the dbt_project.yml content as a Python string\ndbt_project_yml = \"\"\"\n# TODO: Define the YAML for atlas_transforms project\n# - name: atlas_transforms\n# - staging models: materialized as view (why: fast iteration, no storage cost)\n# - mart models: materialized as table (why: query performance for BI tools)\n\"\"\"\n\n# Explain the choice\nstaging_reason = \"\"  # TODO: why are staging models views?\nmart_reason = \"\"     # TODO: why are mart models tables?\n\nprint(dbt_project_yml)\nprint(f'Staging as view: {staging_reason}')\nprint(f'Marts as table: {mart_reason}')\n",
          validationHint: "Staging models are views because they're rebuilt on every query and don't need storage. Mart models are tables for BI tool performance.",
          xpReward: 150,
        },
      ],
    },
    {
      slug: "spark-batch-processing",
      title: "Distributed Batch Processing with Spark",
      shortDescription: "Process large datasets at scale with Apache Spark.",
      fullDescription: "Learn PySpark fundamentals: SparkSession setup, reading/writing Parquet files, DataFrame transformations, join strategies, and performance tuning with partitioning.",
      difficulty: "intermediate",
      position: 5,
      estimatedMinutes: 480,
      xpReward: 600,
      isPremium: true,
      tags: ["spark", "pyspark", "distributed", "batch"],
      learningObjectives: ["Understand Spark's execution model", "Read/write Parquet and Delta", "Optimize joins with partitioning", "Tune Spark configurations"],
      techStack: ["PySpark", "Apache Spark"],
      language: "python",
      steps: [
        {
          stepNumber: 1,
          title: "Initialize SparkSession",
          instruction: "## SparkSession Setup\n\nSparkSession is the entry point to Spark. Configure it for optimal performance:\n\n```python\nfrom pyspark.sql import SparkSession\n\nspark = SparkSession.builder \\\n    .appName('DataPipeline') \\\n    .config('spark.sql.adaptive.enabled', 'true') \\\n    .config('spark.sql.adaptive.coalescePartitions.enabled', 'true') \\\n    .getOrCreate()\n```\n\n**Why these configs?**\n- Adaptive Query Execution (AQE) automatically optimizes queries at runtime\n- Auto coalescing reduces shuffle partitions for better performance\n\n**Task:** Create a SparkSession with AQE enabled.",
          starterCode: "# Create a SparkSession with these settings:\n# - appName: 'DataPipeline'\n# - adaptive query execution: enabled\n# - auto coalesce partitions: enabled\n# - log level: WARN (reduces noise)\n\nfrom pyspark.sql import SparkSession\n\n# TODO: Build the SparkSession\nspark = None  # Replace with SparkSession.builder chain\n\nif spark:\n    spark.sparkContext.setLogLevel('WARN')\n    print(f'Spark {spark.version} ready')\nelse:\n    print('SparkSession not created yet!')\n",
          validationHint: "Use .config('spark.sql.adaptive.enabled', 'true') and .config('spark.sql.adaptive.coalescePartitions.enabled', 'true') in your builder chain.",
          xpReward: 200,
        },
      ],
    },
    {
      slug: "kafka-streaming-pipeline",
      title: "Real-Time Streaming with Kafka",
      shortDescription: "Build a real-time event streaming pipeline using Apache Kafka.",
      fullDescription: "Process clickstream events in real-time with Kafka. Learn producers, consumers, consumer groups, offset management, and at-least-once delivery guarantees.",
      difficulty: "advanced",
      position: 6,
      estimatedMinutes: 600,
      xpReward: 700,
      isPremium: true,
      tags: ["kafka", "streaming", "real-time", "python"],
      learningObjectives: ["Understand Kafka topics and partitions", "Produce and consume messages", "Implement delivery guarantees", "Monitor consumer lag"],
      techStack: ["Apache Kafka", "confluent-kafka", "Python"],
      language: "python",
      steps: [
        {
          stepNumber: 1,
          title: "Kafka Message Serialization",
          instruction: "## Kafka Producers\n\nMessages in Kafka are bytes. You control serialization. JSON is common:\n\n```python\nimport json\nfrom confluent_kafka import Producer\n\nconf = {'bootstrap.servers': 'localhost:9092'}\nproducer = Producer(conf)\n\ndef send_event(topic: str, event: dict):\n    payload = json.dumps(event).encode('utf-8')\n    producer.produce(topic, payload, callback=on_delivery)\n    producer.poll(0)  # Trigger delivery reports\n```\n\n**Task:** Implement `serialize_event(event)` and `deserialize_event(raw)` for Kafka messages.",
          starterCode: "import json\nfrom typing import Any\n\ndef serialize_event(event: dict) -> bytes:\n    \"\"\"\n    Serialize a dict to bytes for Kafka.\n    Use JSON encoding with UTF-8.\n    Must be reversible by deserialize_event.\n    \"\"\"\n    # TODO: json.dumps + .encode()\n    pass\n\ndef deserialize_event(raw: bytes) -> dict:\n    \"\"\"\n    Deserialize bytes from Kafka back to dict.\n    \"\"\"\n    # TODO: .decode() + json.loads()\n    pass\n\n# Test round-trip\nevent = {'user_id': 42, 'action': 'purchase', 'amount': 99.99, 'ts': '2024-01-01T00:00:00Z'}\nraw = serialize_event(event)\nassert isinstance(raw, bytes)\nrestored = deserialize_event(raw)\nassert restored == event\nprint(f'Serialized: {len(raw)} bytes')\nprint(f'Round-trip OK: {restored}')\n",
          validationHint: "json.dumps(event).encode('utf-8') to serialize, json.loads(raw.decode('utf-8')) to deserialize.",
          xpReward: 200,
        },
      ],
    },
    {
      slug: "data-quality-framework",
      title: "Data Quality & Validation Framework",
      shortDescription: "Build a comprehensive data validation framework for pipelines.",
      fullDescription: "Build a data quality framework with custom expectations, validation rules, and quality reports. Catch bad data before it pollutes your warehouse.",
      difficulty: "intermediate",
      position: 7,
      estimatedMinutes: 360,
      xpReward: 500,
      isPremium: true,
      tags: ["data-quality", "testing", "python", "validation"],
      learningObjectives: ["Define data quality expectations", "Validate DataFrames programmatically", "Generate quality reports", "Integrate checks into pipelines"],
      techStack: ["Python", "pandas"],
      language: "python",
      steps: [
        {
          stepNumber: 1,
          title: "Build a Validation Suite",
          instruction: "## Data Quality Framework\n\nA validation suite runs a set of checks against a DataFrame:\n\n```python\ndef validate_dataframe(df, rules) -> dict:\n    results = {'passed': [], 'failed': [], 'errors': []}\n    for rule in rules:\n        try:\n            if rule['fn'](df):\n                results['passed'].append(rule['name'])\n            else:\n                results['failed'].append(rule['name'])\n        except Exception as e:\n            results['errors'].append(f\"{rule['name']}: {e}\")\n    results['is_valid'] = len(results['failed']) == 0\n    return results\n```\n\n**Task:** Implement a validate_dataframe function with 3 checks: no nulls in user_id, amount >= 0, event_type in allowed set.",
          starterCode: "import pandas as pd\n\ndef validate_dataframe(df: pd.DataFrame) -> dict:\n    \"\"\"\n    Validate df and return:\n    {'passed': [...], 'failed': [...], 'is_valid': bool}\n    \n    Checks:\n    1. No nulls in 'user_id'\n    2. 'amount' >= 0 for all rows\n    3. 'event_type' only contains: 'click', 'purchase', 'view'\n    \"\"\"\n    passed = []\n    failed = []\n    \n    # Check 1: No nulls in user_id\n    # TODO\n    \n    # Check 2: amount >= 0\n    # TODO\n    \n    # Check 3: event_type in allowed set\n    # TODO\n    \n    return {'passed': passed, 'failed': failed, 'is_valid': len(failed) == 0}\n\n# Test\ndf = pd.DataFrame({\n    'user_id': [1, 2, None, 4],\n    'amount': [10.0, -5.0, 3.0, 0.0],\n    'event_type': ['click', 'purchase', 'view', 'unknown']\n})\nresult = validate_dataframe(df)\nprint(result)\n# Expected: 3 checks, some failed\n",
          validationHint: "df['user_id'].isnull().any() checks for nulls. (df['amount'] < 0).any() checks for negatives. ~df['event_type'].isin(['click','purchase','view']).any() checks for invalid types.",
          xpReward: 175,
        },
      ],
    },
    {
      slug: "snowflake-data-warehouse",
      title: "Modern Data Warehouse on Snowflake",
      shortDescription: "Design and implement a cloud data warehouse on Snowflake.",
      fullDescription: "Design star and snowflake schemas, configure virtual warehouses, implement row-level security, and optimize with clustering keys on Snowflake.",
      difficulty: "intermediate",
      position: 8,
      estimatedMinutes: 480,
      xpReward: 550,
      isPremium: true,
      tags: ["snowflake", "data-warehouse", "sql", "cloud"],
      learningObjectives: ["Design star and snowflake schemas", "Configure virtual warehouses", "Implement row-level security", "Optimize with clustering keys"],
      techStack: ["Snowflake", "SQL"],
      language: "sql",
      steps: [
        {
          stepNumber: 1,
          title: "Design a Star Schema",
          instruction: "## Star Schema Design\n\nStar schemas power most BI tools. One fact table, multiple dimension tables:\n\n```sql\n-- Fact table (measurements, metrics)\nCREATE TABLE fact_orders (\n    order_id BIGINT PRIMARY KEY,\n    customer_key INT REFERENCES dim_customer(customer_key),\n    product_key INT REFERENCES dim_product(product_key),\n    date_key INT REFERENCES dim_date(date_key),\n    quantity INT NOT NULL,\n    unit_price DECIMAL(10,2) NOT NULL,\n    total_amount DECIMAL(10,2) NOT NULL\n);\n```\n\n**Task:** Write the complete star schema for an e-commerce analytics warehouse: fact_sales + dim_customer + dim_product + dim_date.",
          starterCode: "# Write SQL DDL for a star schema (as Python strings)\n# Fact: fact_sales\n# Dimensions: dim_customer, dim_product, dim_date\n\nfact_sales = \"\"\"\nCREATE TABLE fact_sales (\n    -- TODO: sale_id PK, customer_key FK, product_key FK,\n    -- date_key FK, quantity INT, unit_price DECIMAL, \n    -- discount_pct DECIMAL, total_amount DECIMAL\n);\n\"\"\"\n\ndim_customer = \"\"\"\nCREATE TABLE dim_customer (\n    -- TODO: customer_key PK, customer_id UNIQUE, \n    -- name, email, segment (B2B/B2C), region, created_at\n);\n\"\"\"\n\ndim_product = \"\"\"\nCREATE TABLE dim_product (\n    -- TODO: product_key PK, product_id UNIQUE,\n    -- name, category, subcategory, unit_cost\n);\n\"\"\"\n\ndim_date = \"\"\"\nCREATE TABLE dim_date (\n    -- TODO: date_key PK (YYYYMMDD INT), full_date DATE UNIQUE,\n    -- year, quarter, month, week, day_of_week, is_weekend\n);\n\"\"\"\n\nprint('Define all 4 tables!')\n",
          validationHint: "Use surrogate keys (SERIAL/IDENTITY) as PKs in dimensions. fact_sales references all dimension PKs as FKs.",
          xpReward: 175,
        },
      ],
    },
    {
      slug: "delta-lake-lakehouse",
      title: "Lakehouse Architecture with Delta Lake",
      shortDescription: "Build a production lakehouse with ACID transactions and time travel.",
      fullDescription: "Use Delta Lake to add ACID transactions, schema enforcement, and time travel to your data lake. Learn MERGE, VACUUM, and OPTIMIZE operations.",
      difficulty: "advanced",
      position: 9,
      estimatedMinutes: 540,
      xpReward: 650,
      isPremium: true,
      tags: ["delta-lake", "lakehouse", "spark", "acid"],
      learningObjectives: ["Understand lakehouse architecture", "Write ACID transactions", "Use time travel", "Implement schema evolution"],
      techStack: ["Delta Lake", "PySpark"],
      language: "python",
      steps: [
        {
          stepNumber: 1,
          title: "Simulate Delta Table with Versioning",
          instruction: "## Delta Lake Core Concepts\n\nDelta Lake adds a transaction log to Parquet files:\n- **ACID** — each write is atomic and durable\n- **Time travel** — read data as of any past version\n- **Schema enforcement** — rejects bad writes\n\nSimulate these concepts:\n\n```python\nclass SimpleDeltaTable:\n    def __init__(self):\n        self.log = []  # Transaction log\n        self.data = []  # Current state\n    \n    def write(self, records, mode='append'):\n        if mode == 'overwrite':\n            self.data = records\n        else:\n            self.data.extend(records)\n        self.log.append({'version': len(self.log), 'op': mode, 'count': len(records)})\n```\n\n**Task:** Implement a `SimpleDeltaTable` with write, read (with time travel), and history methods.",
          starterCode: "class SimpleDeltaTable:\n    \"\"\"Simplified Delta Lake simulation.\"\"\"\n    \n    def __init__(self):\n        self.versions = []  # List of snapshots [{records}, ...]\n        self.log = []       # Transaction log\n    \n    def write(self, records: list, mode: str = 'append') -> None:\n        \"\"\"\n        Write records. \n        - mode='append': add to current data\n        - mode='overwrite': replace all data\n        Append a log entry with version, operation, and record count.\n        \"\"\"\n        # TODO: implement\n        pass\n    \n    def read(self, version: int = None) -> list:\n        \"\"\"\n        Read records.\n        - If version=None, return current data\n        - If version specified, return that historical version (time travel!)\n        \"\"\"\n        # TODO: implement\n        pass\n    \n    def history(self) -> list:\n        \"\"\"Return transaction log with version, operation, record_count.\"\"\"\n        # TODO: return self.log\n        pass\n\n# Test\ntable = SimpleDeltaTable()\ntable.write([{'id': 1}, {'id': 2}])  # v0: append\ntable.write([{'id': 3}])              # v1: append\ntable.write([{'id': 99}], 'overwrite') # v2: overwrite\n\nprint('Current:', table.read())         # Should be [{'id': 99}]\nprint('v0:', table.read(version=0))     # Time travel to v0\nprint('History:', table.history())\n",
          validationHint: "Store each version as a snapshot. append = previous_version_data + new_records. overwrite = just new_records. read(version=0) returns versions[0].",
          xpReward: 200,
        },
      ],
    },
    {
      slug: "ml-feature-store",
      title: "Build an ML Feature Store",
      shortDescription: "Design and implement a feature store serving pre-computed features to ML models.",
      fullDescription: "Build a dual-store feature store with an offline store (PostgreSQL) for training data and an online store (Redis) for low-latency serving. Implement feature versioning, TTL, and lineage tracking.",
      difficulty: "advanced",
      position: 10,
      estimatedMinutes: 600,
      xpReward: 750,
      isPremium: true,
      tags: ["feature-store", "ml", "redis", "python"],
      learningObjectives: ["Understand feature store architecture", "Implement online/offline stores", "Handle feature versioning", "Serve features with low latency"],
      techStack: ["Python", "Redis", "PostgreSQL", "FastAPI"],
      language: "python",
      steps: [
        {
          stepNumber: 1,
          title: "Define Features with Metadata",
          instruction: "## Feature Store Architecture\n\nA feature store separates feature computation (offline) from feature serving (online):\n\n```\nOffline: PostgreSQL ← training data (full history)\nOnline:  Redis ← latest features (low latency, TTL)\n```\n\nDefine features with type information and validation:\n\n```python\n@dataclass\nclass Feature:\n    name: str\n    dtype: str  # 'float', 'int', 'string', 'bool'\n    ttl_seconds: int = 3600\n    \n    def validate(self, value):\n        return isinstance(value, {'float': float, 'int': int, 'string': str, 'bool': bool}[self.dtype])\n```\n\n**Task:** Implement the `Feature` class with validation and a `FeatureView` that groups related features.",
          starterCode: "from dataclasses import dataclass, field\nfrom typing import Any\n\n@dataclass\nclass Feature:\n    name: str\n    dtype: str  # 'float', 'int', 'string', 'bool'\n    description: str = ''\n    ttl_seconds: int = 3600\n    tags: list = field(default_factory=list)\n    \n    def validate(self, value: Any) -> bool:\n        \"\"\"\n        Return True if value matches the feature's dtype.\n        dtype 'string' corresponds to Python str.\n        \"\"\"\n        # TODO: build a dtype->type map and use isinstance()\n        pass\n    \n    def to_dict(self) -> dict:\n        \"\"\"Serialize to dict.\"\"\"\n        # TODO: return all fields as a dict\n        pass\n\n@dataclass\nclass FeatureView:\n    name: str\n    features: list  # list of Feature objects\n    entity: str     # e.g. 'user_id'\n    ttl_seconds: int = 3600\n    \n    def get_feature_names(self) -> list:\n        \"\"\"Return list of feature names.\"\"\"\n        # TODO: [f.name for f in self.features]\n        pass\n\n# Test\nage = Feature('user_age', 'int', 'Age in years', ttl_seconds=86400)\nprint(age.validate(25))    # True\nprint(age.validate('25'))  # False\nprint(age.to_dict())\n",
          validationHint: "dtype_map = {'float': float, 'int': int, 'string': str, 'bool': bool}. Use isinstance(value, dtype_map[self.dtype]).",
          xpReward: 250,
        },
      ],
    },
  ];

  for (const pd of projectData) {
    const existing = await db.query.projects.findFirst({ where: eq(projects.slug, pd.slug) });
    if (existing) {
      console.log(`  Skipping existing: ${pd.title}`);
      continue;
    }

    const [proj] = await db.insert(projects).values({
      trackId: deTrack.id,
      domainId: deDomain.id,
      slug: pd.slug,
      title: pd.title,
      shortDescription: pd.shortDescription,
      fullDescription: pd.fullDescription,
      difficultyLevel: pd.difficulty,
      estimatedMinutes: pd.estimatedMinutes,
      techStack: pd.techStack,
      learningObjectives: pd.learningObjectives,
      orderIndex: pd.position,
      isPremium: pd.isPremium,
      language: pd.language,
      totalSteps: pd.steps.length,
      tags: pd.tags,
      xpReward: pd.xpReward,
    }).returning();

    console.log(`  Created: ${pd.title} (${proj.id})`);

    for (const step of pd.steps) {
      await db.insert(projectSteps).values({
        projectId: proj.id,
        stepNumber: step.stepNumber,
        title: step.title,
        instructionMd: step.instruction,
        starterCode: step.starterCode ?? null,
        validationHint: step.validationHint ?? null,
        validationType: "self_attest",
        validationConfig: {},
        xpReward: step.xpReward,
        type: "code_python",
      });
    }
    console.log(`    + ${pd.steps.length} steps`);
  }

  // --- Stub Projects 11-40 ---
  const stubProjects = [
    { slug: "stream-processing-flink", title: "Stream Processing with Apache Flink", desc: "Stateful stream processing at scale.", pos: 11, diff: "advanced", mins: 600, xp: 700, premium: true, tech: ["Apache Flink", "Java"], tags: ["flink", "streaming"] },
    { slug: "data-catalog-implementation", title: "Building a Data Catalog", desc: "Track data assets, lineage, and ownership.", pos: 12, diff: "intermediate", mins: 420, xp: 500, premium: true, tech: ["Python", "PostgreSQL"], tags: ["metadata", "lineage"] },
    { slug: "real-time-dashboard", title: "Real-Time Analytics Dashboard", desc: "Live dashboard with sub-second queries.", pos: 13, diff: "advanced", mins: 540, xp: 650, premium: true, tech: ["Redis", "Kafka"], tags: ["kafka", "redis", "dashboard"] },
    { slug: "data-mesh-design", title: "Data Mesh Architecture", desc: "Domain-oriented data product design.", pos: 14, diff: "advanced", mins: 720, xp: 900, premium: true, tech: ["Architecture"], tags: ["data-mesh"] },
    { slug: "column-store-engine", title: "Build a Column-Store Engine", desc: "Implement columnar storage from scratch.", pos: 15, diff: "advanced", mins: 900, xp: 1000, premium: true, tech: ["Python"], tags: ["columnar", "storage"] },
    { slug: "iceberg-table-format", title: "Apache Iceberg Table Format", desc: "ACID transactions on S3 with Iceberg.", pos: 16, diff: "advanced", mins: 480, xp: 600, premium: true, tech: ["Apache Iceberg", "Spark"], tags: ["iceberg", "acid"] },
    { slug: "debezium-cdc", title: "CDC with Debezium", desc: "Capture database changes with Debezium.", pos: 17, diff: "advanced", mins: 480, xp: 600, premium: true, tech: ["Debezium", "Kafka"], tags: ["cdc", "debezium"] },
    { slug: "mlflow-pipeline", title: "ML Pipeline with MLflow", desc: "Track experiments and serve models.", pos: 18, diff: "intermediate", mins: 420, xp: 550, premium: true, tech: ["MLflow", "Python"], tags: ["mlflow", "ml-ops"] },
    { slug: "warehouse-cost-optimization", title: "Data Warehouse Cost Optimization", desc: "Reduce cloud warehouse costs with smart partitioning.", pos: 19, diff: "intermediate", mins: 360, xp: 450, premium: true, tech: ["Snowflake", "SQL"], tags: ["cost", "optimization"] },
    { slug: "data-lineage-graph", title: "Data Lineage & Impact Analysis", desc: "Column-level lineage tracking.", pos: 20, diff: "advanced", mins: 540, xp: 650, premium: true, tech: ["Python", "Neo4j"], tags: ["lineage", "graph"] },
    { slug: "vector-database-search", title: "Vector Database for Semantic Search", desc: "Semantic search with pgvector.", pos: 21, diff: "advanced", mins: 480, xp: 600, premium: true, tech: ["PostgreSQL", "pgvector"], tags: ["vector-db", "embeddings"] },
    { slug: "dbt-advanced-patterns", title: "Advanced dbt Patterns", desc: "Macros, packages, snapshots, and incremental models.", pos: 22, diff: "intermediate", mins: 420, xp: 500, premium: true, tech: ["dbt", "SQL"], tags: ["dbt", "macros"] },
    { slug: "kubernetes-data-platform", title: "Data Platform on Kubernetes", desc: "Deploy Airflow and Spark on Kubernetes.", pos: 23, diff: "advanced", mins: 840, xp: 950, premium: true, tech: ["Kubernetes", "Helm"], tags: ["kubernetes", "helm"] },
    { slug: "trino-federated-queries", title: "Federated Queries with Trino", desc: "Query S3, Postgres, and Kafka with one SQL.", pos: 24, diff: "advanced", mins: 480, xp: 600, premium: true, tech: ["Trino"], tags: ["trino", "federation"] },
    { slug: "data-contracts", title: "Implementing Data Contracts", desc: "Enforce contracts between data producers and consumers.", pos: 25, diff: "intermediate", mins: 360, xp: 500, premium: true, tech: ["Schema Registry"], tags: ["contracts", "kafka"] },
    { slug: "advanced-partitioning", title: "Advanced Partitioning Strategies", desc: "Time, hash, and range partitioning.", pos: 26, diff: "intermediate", mins: 360, xp: 450, premium: true, tech: ["PostgreSQL", "SQL"], tags: ["partitioning", "performance"] },
    { slug: "log-analytics-pipeline", title: "Log Analytics at Scale", desc: "Process millions of log events per minute.", pos: 27, diff: "advanced", mins: 540, xp: 650, premium: true, tech: ["Elasticsearch", "Kafka"], tags: ["logs", "analytics"] },
    { slug: "geospatial-data-pipeline", title: "Geospatial Data Pipeline", desc: "Location analytics with PostGIS and H3.", pos: 28, diff: "intermediate", mins: 420, xp: 500, premium: true, tech: ["PostGIS", "H3"], tags: ["geospatial", "postgis"] },
    { slug: "data-freshness-monitoring", title: "Data Freshness Monitoring", desc: "Detect stale data before users notice.", pos: 29, diff: "intermediate", mins: 360, xp: 450, premium: true, tech: ["Python"], tags: ["monitoring", "freshness"] },
    { slug: "reverse-etl-pipeline", title: "Reverse ETL Pipeline", desc: "Sync enriched data from warehouse to SaaS tools.", pos: 30, diff: "intermediate", mins: 360, xp: 450, premium: true, tech: ["Python"], tags: ["reverse-etl", "sync"] },
    { slug: "graph-data-pipeline", title: "Graph Data Pipeline", desc: "Fraud detection with graph analytics.", pos: 31, diff: "advanced", mins: 480, xp: 600, premium: true, tech: ["Neo4j", "Python"], tags: ["graph", "fraud"] },
    { slug: "time-series-pipeline", title: "Time Series Data Engineering", desc: "High-performance time series with TimescaleDB.", pos: 32, diff: "intermediate", mins: 420, xp: 500, premium: true, tech: ["TimescaleDB"], tags: ["time-series", "iot"] },
    { slug: "data-platform-api", title: "Data Platform API with FastAPI", desc: "REST API layer for self-service analytics.", pos: 33, diff: "intermediate", mins: 420, xp: 500, premium: true, tech: ["FastAPI", "Python"], tags: ["fastapi", "api"] },
    { slug: "streaming-joins-windows", title: "Streaming Joins and Windowing", desc: "Temporal joins and watermarking.", pos: 34, diff: "advanced", mins: 540, xp: 650, premium: true, tech: ["Flink", "Kafka"], tags: ["streaming", "joins"] },
    { slug: "dbt-testing-ci", title: "dbt Testing and CI/CD", desc: "dbt-expectations + GitHub Actions.", pos: 35, diff: "intermediate", mins: 360, xp: 450, premium: true, tech: ["dbt", "GitHub Actions"], tags: ["testing", "ci-cd"] },
    { slug: "data-access-governance", title: "Data Access Governance", desc: "RBAC, column masking, and audit logging.", pos: 36, diff: "advanced", mins: 480, xp: 600, premium: true, tech: ["PostgreSQL"], tags: ["governance", "rbac"] },
    { slug: "multi-cloud-platform", title: "Multi-Cloud Data Platform", desc: "Unified data platform across AWS, GCP, Azure.", pos: 37, diff: "advanced", mins: 840, xp: 1000, premium: true, tech: ["AWS", "GCP", "Azure"], tags: ["multi-cloud"] },
    { slug: "llm-data-pipeline", title: "LLM-Powered Data Pipeline", desc: "AI-powered data cleaning and schema inference.", pos: 38, diff: "advanced", mins: 540, xp: 700, premium: true, tech: ["Python", "OpenAI"], tags: ["llm", "ai"] },
    { slug: "capstone-lakehouse", title: "Capstone: Production Lakehouse", desc: "End-to-end production lakehouse: ingest → process → serve → monitor.", pos: 39, diff: "advanced", mins: 1200, xp: 1500, premium: true, tech: ["Delta Lake", "Spark", "Airflow"], tags: ["capstone", "lakehouse"] },
    { slug: "capstone-streaming", title: "Capstone: Real-Time Data Platform", desc: "Full real-time platform from ingestion to analytics.", pos: 40, diff: "advanced", mins: 1200, xp: 1500, premium: true, tech: ["Kafka", "Flink", "Redis"], tags: ["capstone", "streaming"] },
  ] as const;

  for (const sp of stubProjects) {
    const existing = await db.query.projects.findFirst({ where: eq(projects.slug, sp.slug) });
    if (existing) continue;
    await db.insert(projects).values({
      trackId: deTrack.id,
      domainId: deDomain.id,
      slug: sp.slug,
      title: sp.title,
      shortDescription: sp.desc,
      fullDescription: sp.desc,
      difficultyLevel: sp.diff as any,
      estimatedMinutes: sp.mins,
      techStack: sp.tech as unknown as string[],
      learningObjectives: [],
      orderIndex: sp.pos,
      isPremium: sp.premium,
      language: "python",
      totalSteps: 0,
      tags: sp.tags as unknown as string[],
      xpReward: sp.xp,
    });
    console.log(`  Stub: ${sp.title}`);
  }

  // --- Mastery Sections ---
  let pythonSection = await db.query.masterySections.findFirst({ where: eq(masterySections.slug, "python-mastery") });
  if (!pythonSection) {
    [pythonSection] = await db.insert(masterySections).values({
      slug: "python-mastery",
      title: "Python Mastery",
      description: "Python from fundamentals to advanced patterns for data engineers",
      type: "python_mastery",
      orderIndex: 1,
    }).returning();
    console.log("Created Python Mastery section");
  }

  let sqlSection = await db.query.masterySections.findFirst({ where: eq(masterySections.slug, "sql-mastery") });
  if (!sqlSection) {
    [sqlSection] = await db.insert(masterySections).values({
      slug: "sql-mastery",
      title: "SQL Mastery",
      description: "SQL from fundamentals to advanced analytics for data engineers",
      type: "sql_mastery",
      orderIndex: 2,
    }).returning();
    console.log("Created SQL Mastery section");
  }

  // --- Python Modules ---
  const pythonMods = [
    {
      slug: "python-fundamentals",
      title: "Python Fundamentals for Data Engineers",
      description: "Master Python data types, control flow, functions, and file I/O patterns used in real data pipelines.",
      orderIndex: 1,
      isPremium: false,
      lessonCount: 12,
      estimatedHours: 4,
      difficultyLevel: "beginner",
      learningObjectives: ["Understand Python data types", "Write functions and classes", "Handle files and exceptions", "Use list comprehensions and generators"],
      lessons: [
        { slug: "python-data-types", title: "Python Data Types & Collections", content: "# Python Data Types\n\nIn data engineering, you'll work with these core types constantly.\n\n## Lists vs Tuples\n- **Lists** are mutable, ordered — use for data you'll modify\n- **Tuples** are immutable, faster — use for fixed records\n\n## Dictionaries\nPerfect for JSON records:\n```python\nrecord = {'user_id': 42, 'event': 'click', 'ts': '2024-01-01'}\n```\n\n## Sets\nFor deduplication:\n```python\nunique_ids = set(df['user_id'].tolist())\n```", type: "reading", orderIndex: 1, mins: 15, xp: 25 },
        { slug: "control-flow", title: "Control Flow & Iteration", content: "# Control Flow in Data Pipelines\n\n## List Comprehensions (Pythonic)\n```python\n# Filter and transform in one line\nclean = [r for r in records if r.get('user_id')]\n```\n\n## Generators for Large Data\n```python\ndef parse_lines(file):\n    for line in file:\n        yield json.loads(line)  # Lazy evaluation\n```\nGenerators don't load everything into memory — critical for large files!", type: "reading", orderIndex: 2, mins: 20, xp: 25 },
        { slug: "functions-decorators", title: "Functions & Decorators", content: "# Functions in Data Engineering\n\n## Decorators for Cross-Cutting Concerns\n```python\nimport time\nfrom functools import wraps\n\ndef timed(fn):\n    @wraps(fn)\n    def wrapper(*args, **kwargs):\n        t0 = time.time()\n        result = fn(*args, **kwargs)\n        print(f'{fn.__name__}: {time.time()-t0:.2f}s')\n        return result\n    return wrapper\n\n@timed\ndef load_file(path): ...\n```\n\nDecorators add behavior without modifying the original function.", type: "reading", orderIndex: 3, mins: 20, xp: 30 },
      ],
    },
    {
      slug: "python-advanced-patterns",
      title: "Advanced Python Patterns",
      description: "Generators, context managers, async/await, and design patterns for production data engineering code.",
      orderIndex: 2,
      isPremium: true,
      lessonCount: 10,
      estimatedHours: 3,
      difficultyLevel: "intermediate",
      learningObjectives: ["Write memory-efficient generators", "Use context managers", "Understand async I/O", "Apply pipeline design patterns"],
      lessons: [
        { slug: "generators", title: "Generators & Iterators", content: "# Generators for Large Data\n\nProcess data without loading it all into RAM:\n\n```python\ndef read_csv_chunks(filepath, chunk_size=10_000):\n    import csv\n    with open(filepath) as f:\n        reader = csv.DictReader(f)\n        chunk = []\n        for row in reader:\n            chunk.append(row)\n            if len(chunk) == chunk_size:\n                yield chunk\n                chunk = []\n        if chunk:\n            yield chunk  # Last partial chunk\n\n# Process 100M rows without OOM\nfor chunk in read_csv_chunks('huge_file.csv'):\n    load_to_db(chunk)\n```", type: "reading", orderIndex: 1, mins: 20, xp: 35 },
        { slug: "context-managers", title: "Context Managers", content: "# Context Managers\n\nManage resources (DB connections, file handles) safely:\n\n```python\nfrom contextlib import contextmanager\n\n@contextmanager\ndef db_transaction(conn):\n    try:\n        yield conn\n        conn.commit()\n    except Exception:\n        conn.rollback()\n        raise\n    finally:\n        conn.close()\n\n# Usage — connection always cleaned up\nwith db_transaction(get_connection()) as conn:\n    insert_data(conn, records)\n```", type: "reading", orderIndex: 2, mins: 20, xp: 35 },
      ],
    },
  ];

  for (const mod of pythonMods) {
    let existingMod = await db.query.masteryModules.findFirst({ where: eq(masteryModules.slug, mod.slug) });
    if (!existingMod) {
      [existingMod] = await db.insert(masteryModules).values({
        sectionId: pythonSection!.id,
        slug: mod.slug,
        title: mod.title,
        description: mod.description,
        difficultyLevel: mod.difficultyLevel as any,
        orderIndex: mod.orderIndex,
        isPremium: mod.isPremium,
        lessonCount: mod.lessonCount,
        estimatedHours: mod.estimatedHours,
        learningObjectives: mod.learningObjectives,
      }).returning();
      console.log(`Python module: ${mod.title}`);
    }
    for (const l of mod.lessons) {
      const existingLesson = await db.query.masteryLessons.findFirst({ where: and(eq(masteryLessons.moduleId, existingMod.id), eq(masteryLessons.slug, l.slug)) });
      if (!existingLesson) {
        await db.insert(masteryLessons).values({
          moduleId: existingMod.id,
          slug: l.slug,
          title: l.title,
          contentMd: l.content,
          type: l.type as any,
          orderIndex: l.orderIndex,
          estimatedMinutes: l.mins,
          xpReward: l.xp,
        });
      }
    }
  }

  // --- SQL Modules ---
  const sqlMods = [
    {
      slug: "sql-foundations",
      title: "SQL Foundations",
      description: "SELECT, WHERE, GROUP BY, JOINs, and aggregations — the building blocks of all SQL queries.",
      orderIndex: 1,
      isPremium: false,
      lessonCount: 10,
      estimatedHours: 3,
      difficultyLevel: "beginner",
      learningObjectives: ["Write complex SELECT queries", "Master all JOIN types", "Group and aggregate data", "Filter with WHERE and HAVING"],
      lessons: [
        { slug: "select-filtering", title: "SELECT & Filtering", content: "# SELECT Fundamentals\n\n```sql\nSELECT user_id, email, created_at\nFROM users\nWHERE is_active = TRUE\n  AND created_at >= '2024-01-01'\nORDER BY created_at DESC;\n```\n\n**Tips:**\n- Use `IS NULL` not `= NULL`\n- `LIMIT` before you run heavy queries\n- `EXPLAIN` to see what the DB will do", type: "reading", orderIndex: 1, mins: 15, xp: 20 },
        { slug: "joins", title: "JOINs Demystified", content: "# SQL Joins\n\n```sql\n-- INNER JOIN: only matching rows from both tables\nSELECT u.email, o.total\nFROM users u\nINNER JOIN orders o ON u.id = o.user_id;\n\n-- LEFT JOIN: all users, even with no orders\nSELECT u.email, COUNT(o.id) as orders\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id\nGROUP BY u.email;\n```\n\n**Key:** INNER = intersection, LEFT = keep all left rows", type: "reading", orderIndex: 2, mins: 25, xp: 25 },
        { slug: "aggregations", title: "Aggregations & GROUP BY", content: "# Aggregations\n\n```sql\nSELECT\n    DATE_TRUNC('month', event_ts) as month,\n    COUNT(*) as events,\n    COUNT(DISTINCT user_id) as unique_users,\n    SUM(revenue) as total_revenue\nFROM events\nGROUP BY 1\nHAVING COUNT(*) > 100  -- Filter AFTER grouping\nORDER BY 1 DESC;\n```\n\n**Remember:** `WHERE` filters before grouping, `HAVING` filters after.", type: "reading", orderIndex: 3, mins: 20, xp: 25 },
      ],
    },
    {
      slug: "advanced-sql",
      title: "Advanced SQL Queries",
      description: "CTEs, window functions, and performance optimization for complex analytical SQL.",
      orderIndex: 2,
      isPremium: true,
      lessonCount: 10,
      estimatedHours: 3,
      difficultyLevel: "intermediate",
      learningObjectives: ["Write CTEs for readable queries", "Use window functions", "Optimize query performance", "Understand execution plans"],
      lessons: [
        { slug: "ctes", title: "CTEs & Readable Queries", content: "# Common Table Expressions\n\nCTEs make complex queries readable and maintainable:\n\n```sql\nWITH revenue_by_user AS (\n    SELECT user_id, SUM(amount) as total\n    FROM orders\n    GROUP BY user_id\n),\nhigh_value AS (\n    SELECT user_id, total\n    FROM revenue_by_user\n    WHERE total > 1000\n)\nSELECT u.email, h.total\nFROM high_value h\nJOIN users u ON h.user_id = u.id\nORDER BY h.total DESC;\n```", type: "reading", orderIndex: 1, mins: 25, xp: 35 },
        { slug: "window-functions", title: "Window Functions", content: "# Window Functions\n\nThe most powerful SQL feature for analytics:\n\n```sql\nSELECT\n    order_id,\n    user_id,\n    revenue,\n    SUM(revenue) OVER (PARTITION BY user_id ORDER BY order_date) as running_total,\n    RANK() OVER (PARTITION BY user_id ORDER BY revenue DESC) as rank_in_user,\n    LAG(revenue) OVER (PARTITION BY user_id ORDER BY order_date) as prev_revenue\nFROM orders;\n```\n\n`PARTITION BY` = group, `ORDER BY` = sort within group", type: "reading", orderIndex: 2, mins: 30, xp: 40 },
      ],
    },
    {
      slug: "sql-for-analytics",
      title: "SQL for Analytics Engineering",
      description: "Cohort analysis, funnel analysis, time-series, and advanced aggregation patterns used in analytics.",
      orderIndex: 3,
      isPremium: true,
      lessonCount: 8,
      estimatedHours: 3,
      difficultyLevel: "intermediate",
      learningObjectives: ["Build cohort retention analysis", "Write funnel queries", "Time-series aggregations", "Create pivot tables"],
      lessons: [
        { slug: "cohort-analysis", title: "Cohort Retention Analysis", content: "# Cohort Analysis\n\nMeasure how many users return month-over-month:\n\n```sql\nWITH cohorts AS (\n    SELECT user_id,\n           DATE_TRUNC('month', MIN(created_at)) as cohort_month\n    FROM users GROUP BY user_id\n),\nactivity AS (\n    SELECT user_id,\n           DATE_TRUNC('month', event_ts) as active_month\n    FROM events GROUP BY 1, 2\n)\nSELECT\n    c.cohort_month,\n    DATE_DIFF('month', c.cohort_month, a.active_month) as month_number,\n    COUNT(DISTINCT a.user_id) / COUNT(DISTINCT c.user_id)::float as retention\nFROM cohorts c\nLEFT JOIN activity a USING (user_id)\nGROUP BY 1, 2\nORDER BY 1, 2;\n```", type: "reading", orderIndex: 1, mins: 30, xp: 40 },
      ],
    },
  ];

  for (const mod of sqlMods) {
    let existingMod = await db.query.masteryModules.findFirst({ where: eq(masteryModules.slug, mod.slug) });
    if (!existingMod) {
      [existingMod] = await db.insert(masteryModules).values({
        sectionId: sqlSection!.id,
        slug: mod.slug,
        title: mod.title,
        description: mod.description,
        difficultyLevel: mod.difficultyLevel as any,
        orderIndex: mod.orderIndex,
        isPremium: mod.isPremium,
        lessonCount: mod.lessonCount,
        estimatedHours: mod.estimatedHours,
        learningObjectives: mod.learningObjectives,
      }).returning();
      console.log(`SQL module: ${mod.title}`);
    }
    for (const l of mod.lessons) {
      const existingLesson = await db.query.masteryLessons.findFirst({ where: and(eq(masteryLessons.moduleId, existingMod.id), eq(masteryLessons.slug, l.slug)) });
      if (!existingLesson) {
        await db.insert(masteryLessons).values({
          moduleId: existingMod.id,
          slug: l.slug,
          title: l.title,
          contentMd: l.content,
          type: l.type as any,
          orderIndex: l.orderIndex,
          estimatedMinutes: l.mins,
          xpReward: l.xp,
        });
      }
    }
  }

  console.log("\nSeed complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
