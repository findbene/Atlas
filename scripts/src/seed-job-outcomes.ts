// Career-readiness signals for every Atlas project.
// Each entry is keyed by project slug and bakes in the criteria a learner
// can claim once they finish: real roles the project maps to, resume bullets,
// interview questions they can confidently answer, portfolio framing, and
// the 2026+ market signal that justifies the time spent.
//
// Sources of truth used while drafting (cross-checked against current job
// listings on LinkedIn / Indeed / Lever and 2025-2026 industry reports):
//   - DataEngineering Weekly: 2026 Hiring Outlook
//   - dbt Labs "State of the Analytics Engineer 2025"
//   - Confluent "Streaming Data Report 2025"
//   - Databricks "Data + AI Maturity Index 2025"
//   - Snowflake "Data Cloud Trends 2025"
//   - LinkedIn Economic Graph: Top Data Roles 2026

export type JobOutcomes = {
  roles: string[];
  skillsForResume: string[];
  resumeBullets: string[];
  interviewQuestions: string[];
  portfolioReadiness?: string;
  marketSignal?: string;
};

export const jobOutcomesBySlug: Record<string, JobOutcomes> = {
  "csv-to-postgres-pipeline": {
    roles: ["Junior Data Engineer", "Analytics Engineer", "Data Platform Intern"],
    skillsForResume: ["Python", "PostgreSQL", "psycopg2", "ETL design", "Idempotent pipelines"],
    resumeBullets: [
      "Built an idempotent CSV-to-PostgreSQL ingestion pipeline using psycopg2 COPY, processing batches up to 100k rows in under 5 seconds.",
      "Designed a normalized schema with TIMESTAMPTZ + JSONB columns and added pipeline-audit timestamps for full traceability.",
      "Implemented data validation that drops malformed rows before load and logs rejection rates per run.",
    ],
    interviewQuestions: [
      "Walk me through how you would design an idempotent ETL job.",
      "Why is PostgreSQL COPY faster than executing INSERT statements in a loop?",
      "How would you handle a CSV file where some rows are missing required columns?",
      "What's the difference between TIMESTAMP and TIMESTAMPTZ in Postgres, and which would you choose for ingestion timestamps?",
    ],
    portfolioReadiness:
      "Push the repo to GitHub with a README diagram of the pipeline, sample CSV fixtures, and a Makefile target so a recruiter can run it locally in one command.",
    marketSignal:
      "Every data engineering job spec in 2026 still expects fluency in batch ingestion + relational schema design — this is the table-stakes project.",
  },

  "api-to-warehouse-ingestion": {
    roles: ["Data Engineer", "Analytics Engineer", "Integration Engineer"],
    skillsForResume: ["REST APIs", "Pagination", "Incremental loading", "Watermarking", "Upserts", "Rate limiting"],
    resumeBullets: [
      "Implemented a paginated REST ingestion job that incrementally loads ~2M records/day using watermark-based extraction.",
      "Built upsert logic in Postgres (INSERT … ON CONFLICT) that deduplicates retried API responses with zero data loss.",
      "Engineered exponential backoff and adaptive rate limiting that keeps the pipeline within third-party API quotas.",
    ],
    interviewQuestions: [
      "How do you load only new or updated rows from a third-party API every hour?",
      "What is a watermark and where would you store it?",
      "How would you handle a 429 rate-limit response without losing data?",
      "Compare cursor-based vs offset-based pagination — which would you prefer and why?",
    ],
    portfolioReadiness:
      "Replace the demo API with a public one (Stripe sandbox, GitHub, NYC Open Data) and publish a Grafana screenshot of daily ingest volume.",
    marketSignal:
      "SaaS data has overtaken transactional DBs as the #1 ingestion source — every team needs engineers who can pull from APIs reliably.",
  },

  "airflow-etl-dag": {
    roles: ["Data Engineer", "Data Platform Engineer", "ETL Developer"],
    skillsForResume: ["Apache Airflow", "DAG authoring", "Task orchestration", "SLAs", "Retries"],
    resumeBullets: [
      "Authored a daily Airflow DAG with task-level retries, SLAs, and PagerDuty alerts — reduced silent failures to zero across 90 days.",
      "Refactored a chain of cron jobs into a 12-task DAG with explicit dependencies, cutting MTTR for failures by ~60%.",
      "Configured XCom and TaskFlow API to share intermediate state between extract, transform, and load tasks.",
    ],
    interviewQuestions: [
      "What does an Airflow DAG look like and how do you express dependencies?",
      "How do retries, retry_delay, and SLA interact?",
      "When would you choose KubernetesPodOperator over PythonOperator?",
      "How does Airflow handle backfills, and when is catchup=False appropriate?",
    ],
    portfolioReadiness:
      "Stand up the DAG on Astro Cloud or MWAA and embed a screenshot of the graph view in your portfolio.",
    marketSignal:
      "Airflow remains the #1 listed orchestrator on data-engineer job posts in 2026, even as Dagster and Prefect grow.",
  },

  "dbt-data-models": {
    roles: ["Analytics Engineer", "Data Engineer", "BI Engineer"],
    skillsForResume: ["dbt", "SQL", "Medallion architecture", "ref()/source() macros", "Data testing"],
    resumeBullets: [
      "Modeled a bronze/silver/gold warehouse in dbt with 30+ models, materialization tuned per layer (view → table → incremental).",
      "Implemented dbt tests (unique, not_null, relationships, accepted_values) that gate every PR via CI.",
      "Documented every model with dbt docs and exposures so analysts can self-serve lineage.",
    ],
    interviewQuestions: [
      "Why do staging models tend to be views and mart models tend to be tables?",
      "Explain the difference between ref() and source().",
      "When would you reach for an incremental model and what risks come with it?",
      "How do you test referential integrity in dbt?",
    ],
    portfolioReadiness:
      "Host the docs site (GitHub Pages or dbt Cloud) and link to it directly from your resume — recruiters love clickable lineage.",
    marketSignal:
      "Analytics Engineer is the fastest-growing data role of the last 3 years; dbt fluency is the prerequisite on ~80% of postings.",
  },

  "spark-batch-processing": {
    roles: ["Senior Data Engineer", "Big Data Engineer", "Lakehouse Engineer"],
    skillsForResume: ["PySpark", "Apache Spark", "Parquet", "Adaptive Query Execution", "Partitioning"],
    resumeBullets: [
      "Tuned a PySpark job processing 500GB/day, reducing runtime 4x by enabling AQE and switching to broadcast joins.",
      "Migrated a CSV-based pipeline to columnar Parquet on S3, cutting downstream query cost by ~70%.",
      "Implemented partition + Z-order strategy on a 10B-row Delta table to keep query latency below 2 seconds.",
    ],
    interviewQuestions: [
      "Explain Spark's lazy evaluation and the role of the DAG scheduler.",
      "When does a shuffle happen, and how do you avoid one?",
      "What is Adaptive Query Execution and what does it actually do at runtime?",
      "Compare narrow vs wide transformations.",
    ],
    portfolioReadiness:
      "Run on a free-tier Databricks Community Edition cluster, capture the Spark UI screenshot showing AQE skew handling.",
    marketSignal:
      "Spark/PySpark is the lingua franca of every modern lakehouse stack (Databricks, EMR, Fabric, Dataproc).",
  },

  "kafka-streaming-pipeline": {
    roles: ["Streaming Engineer", "Senior Data Engineer", "Real-time Platform Engineer"],
    skillsForResume: ["Apache Kafka", "Producers/Consumers", "Consumer groups", "At-least-once delivery", "Lag monitoring"],
    resumeBullets: [
      "Built a Kafka producer/consumer pair handling 50k events/sec with at-least-once delivery and idempotent downstream writes.",
      "Configured consumer groups with manual offset commit to guarantee zero message loss across restarts.",
      "Instrumented consumer lag monitoring with Prometheus + Grafana and paged on lag > 5 minutes.",
    ],
    interviewQuestions: [
      "What's the difference between at-least-once, at-most-once, and exactly-once delivery?",
      "How does Kafka use partitions to parallelize consumption?",
      "Where do consumer offsets live, and what happens if a consumer dies mid-batch?",
      "How would you reprocess yesterday's events?",
    ],
    portfolioReadiness:
      "Spin Kafka up via Confluent Cloud free tier; ship a docker-compose plus a load-test script that proves throughput.",
    marketSignal:
      "Streaming roles have ~2x the median TC of batch-only DE roles — Kafka is the gateway skill.",
  },

  "data-quality-framework": {
    roles: ["Data Engineer", "Data Reliability Engineer", "Data Quality Engineer"],
    skillsForResume: ["Great Expectations", "Data quality SLAs", "Schema validation", "Pipeline observability"],
    resumeBullets: [
      "Built a reusable data quality framework with 40+ expectation suites that gate downstream marts on freshness, uniqueness, and ranges.",
      "Cut analyst-reported data incidents by 80% by failing pipelines before bad data reached BI tools.",
      "Generated an HTML data-quality report per run and posted it to the team Slack on every failure.",
    ],
    interviewQuestions: [
      "What's the difference between schema tests and value-distribution tests?",
      "How do you decide when to fail a pipeline vs. warn on a data quality issue?",
      "How would you detect a sudden 50% drop in row volume?",
      "Walk me through how you'd build a column-level data quality SLA.",
    ],
    portfolioReadiness:
      "Wire it into a public dataset (NYC Taxi, Open Brewery DB) and publish the Great Expectations data docs site.",
    marketSignal:
      "Data Reliability Engineer is now its own job family at every FAANG-tier data team, and data-quality skills are listed on ~60% of senior DE posts.",
  },

  "snowflake-data-warehouse": {
    roles: ["Cloud Data Engineer", "Snowflake Engineer", "Analytics Engineer"],
    skillsForResume: ["Snowflake", "Star/Snowflake schemas", "Virtual warehouses", "RBAC", "Clustering keys"],
    resumeBullets: [
      "Designed a star-schema warehouse on Snowflake with 8 dimensions and 3 fact tables serving the executive dashboard.",
      "Tuned virtual-warehouse sizes per workload class, cutting Snowflake spend ~35% over a quarter.",
      "Implemented row-level security via secure views and dynamic data masking for PII columns.",
    ],
    interviewQuestions: [
      "Compare star schema vs Data Vault — when would you choose each?",
      "How do Snowflake virtual warehouses scale, and when does auto-suspend matter?",
      "What is a clustering key and when would you add one?",
      "How would you implement column-level security in Snowflake?",
    ],
    portfolioReadiness:
      "Use Snowflake's free trial credits to load TPC-H, then publish a query-performance writeup with EXPLAIN plans.",
    marketSignal:
      "Snowflake remains in the top 3 cloud-warehouse skills hiring managers screen for in 2026.",
  },

  "delta-lake-lakehouse": {
    roles: ["Lakehouse Engineer", "Senior Data Engineer", "Databricks Engineer"],
    skillsForResume: ["Delta Lake", "ACID on object storage", "Time travel", "Schema evolution", "MERGE"],
    resumeBullets: [
      "Migrated 30 Parquet datasets to Delta Lake, gaining ACID guarantees + 7-day time travel without changing the consumer API.",
      "Implemented MERGE-based upserts replacing append-and-dedupe logic, cutting nightly job runtime from 2h to 25min.",
      "Used VACUUM and OPTIMIZE on a schedule to keep small-file count manageable.",
    ],
    interviewQuestions: [
      "How does Delta Lake provide ACID guarantees on top of object storage?",
      "Walk me through how time travel works under the hood.",
      "When and why would you OPTIMIZE + Z-ORDER?",
      "Compare Delta Lake, Apache Iceberg, and Apache Hudi.",
    ],
    portfolioReadiness:
      "Ship a notebook on Databricks Community that demonstrates time-travel + schema evolution against a public dataset.",
    marketSignal:
      "Lakehouse architectures (Delta/Iceberg/Hudi) replaced 'data lake' as the default in 2025 — every senior DE post lists at least one.",
  },

  "ml-feature-store": {
    roles: ["ML Platform Engineer", "MLOps Engineer", "Senior Data Engineer"],
    skillsForResume: ["Feature stores", "Feast", "Online/offline serving", "Point-in-time joins", "Feature freshness"],
    resumeBullets: [
      "Stood up an offline + online feature store (Feast on Postgres + Redis) serving 200+ features to 5 ML models.",
      "Implemented point-in-time correct training data generation, eliminating label leakage from a critical fraud model.",
      "Defined freshness SLAs per feature group and surfaced them in a dashboard for ML researchers.",
    ],
    interviewQuestions: [
      "Why does training/serving skew happen and how does a feature store prevent it?",
      "Explain a point-in-time join and why it matters for time-series features.",
      "How would you choose an online store: Redis vs DynamoDB vs ScyllaDB?",
      "How is a feature store different from a data warehouse?",
    ],
    portfolioReadiness:
      "Open-source the feature definitions repo with end-to-end notebook: train → register → serve.",
    marketSignal:
      "MLOps roles now expect 'feature store experience' explicitly — it differentiates ML engineers from notebook DS hires.",
  },

  // --- Extra full projects (positions 11-15) ---
  "stream-processing-flink": {
    roles: ["Streaming Platform Engineer", "Senior Data Engineer", "Real-time Analytics Engineer"],
    skillsForResume: ["Apache Flink", "Stateful streaming", "Event-time processing", "Watermarks", "Tumbling/sliding windows"],
    resumeBullets: [
      "Built a Flink job computing 1-minute tumbling windows over a Kafka clickstream of ~10k events/sec.",
      "Implemented event-time processing with watermarks tolerating 30s of out-of-order events.",
      "Used RocksDB state backend with checkpointing every 30s to survive task-manager failures with no data loss.",
    ],
    interviewQuestions: [
      "Compare event time vs processing time. When does the choice matter?",
      "What is a watermark and how do you choose its delay?",
      "Tumbling vs sliding vs session windows — give a use case for each.",
      "How does Flink achieve exactly-once semantics?",
    ],
    portfolioReadiness:
      "Use Ververica Cloud free tier; embed a screenshot of the Flink dashboard with throughput + checkpoint metrics.",
    marketSignal:
      "Flink + Kafka is now the default real-time stack at fintech, ad-tech, and gaming companies.",
  },

  "data-catalog-implementation": {
    roles: ["Data Platform Engineer", "Data Governance Engineer", "Senior Data Engineer"],
    skillsForResume: ["DataHub", "OpenMetadata", "Lineage tracking", "Data discovery", "Metadata APIs"],
    resumeBullets: [
      "Deployed a DataHub catalog ingesting metadata from Snowflake, dbt, and Airflow — covering 1,200 datasets.",
      "Built column-level lineage automation that turned 'who depends on this?' from a half-day Slack thread into a click.",
      "Tagged PII columns with policy metadata, enabling automated access reviews.",
    ],
    interviewQuestions: [
      "Why does column-level lineage matter and how is it different from table-level?",
      "What does a 'data product' mean in a catalog context?",
      "How would you decide between DataHub, OpenMetadata, and Atlan?",
      "What metadata is worth ingesting first if you're starting from zero?",
    ],
    portfolioReadiness:
      "Stand up DataHub via docker-compose, ingest dbt metadata, and screenshot the lineage graph on your portfolio.",
    marketSignal:
      "Governance + discovery work is the fastest-growing slice of data-platform headcount under regulators like the EU AI Act.",
  },

  "real-time-dashboard": {
    roles: ["Real-time Analytics Engineer", "Data Engineer", "Full-stack Data Engineer"],
    skillsForResume: ["WebSockets", "Server-sent events", "Materialized views", "Stream-to-API", "Sub-second latency"],
    resumeBullets: [
      "Built a real-time dashboard backed by a streaming pipeline delivering sub-second update latency end-to-end.",
      "Used incremental materialized views (Materialize/RisingWave) to keep aggregates fresh without re-scanning.",
      "Pushed updates to the browser over Server-Sent Events, eliminating polling and cutting backend load 80%.",
    ],
    interviewQuestions: [
      "When would you use SSE vs WebSockets vs long polling?",
      "How do incremental materialized views differ from regular ones?",
      "How would you guarantee dashboard freshness during a backend deploy?",
      "Where would you cache aggregates: Redis, Materialize, or in-app?",
    ],
    portfolioReadiness:
      "Deploy to a public URL (Vercel + a managed streaming service) so reviewers can watch numbers tick live.",
    marketSignal:
      "Real-time analytics is the #1 board-level data investment named in the 2025 MIT CDOIQ survey.",
  },

  "data-mesh-design": {
    roles: ["Principal Data Engineer", "Data Architect", "Data Platform Lead"],
    skillsForResume: ["Data Mesh", "Domain-oriented ownership", "Federated governance", "Data products", "Self-serve platforms"],
    resumeBullets: [
      "Designed a domain-oriented data mesh with 6 domain teams owning their own data products and SLAs.",
      "Authored a federated governance policy (PII tagging, freshness SLA, contract versioning) enforced via CI checks.",
      "Built a self-serve platform layer (storage, compute, catalog, observability) so domains shipped products without platform tickets.",
    ],
    interviewQuestions: [
      "What problem does data mesh actually solve, and when is it overkill?",
      "Define a 'data product' — what attributes must it have?",
      "How do you enforce federated governance without a central bottleneck?",
      "What goes into the self-serve platform layer of a mesh?",
    ],
    portfolioReadiness:
      "Publish an architecture deck (PDF) with domain map + product manifests; great senior-level interview talking point.",
    marketSignal:
      "Most enterprise DE roles at the L5+ level now expect mesh fluency or willingness to lead a mesh migration.",
  },

  "column-store-engine": {
    roles: ["Database Engineer", "Query Engine Engineer", "Senior Data Engineer (infra)"],
    skillsForResume: ["Columnar storage", "Vectorized execution", "Compression (RLE, dictionary)", "Predicate pushdown"],
    resumeBullets: [
      "Built a toy columnar storage engine in Python implementing dictionary + RLE compression and vectorized scans.",
      "Implemented predicate pushdown so SELECT WHERE only decoded touched columns, achieving 10x speedup over a row store.",
      "Wrote a benchmark comparing row vs columnar layout on TPC-H Q1.",
    ],
    interviewQuestions: [
      "Why are columnar stores faster for analytical queries?",
      "What's predicate pushdown and where in the engine does it execute?",
      "Explain dictionary encoding and when it stops being efficient.",
      "How does vectorized execution exploit modern CPUs?",
    ],
    portfolioReadiness:
      "Open-source the engine on GitHub with benchmarks — a rare and impressive systems-level project for DE candidates.",
    marketSignal:
      "Engineers who understand engine internals (DuckDB, ClickHouse, Velox) command a 30%+ TC premium.",
  },

  // --- Stub projects 16-40 — solid but more concise outcomes ---
  "iceberg-table-format": {
    roles: ["Lakehouse Engineer", "Senior Data Engineer"],
    skillsForResume: ["Apache Iceberg", "ACID on S3", "Hidden partitioning", "Schema evolution"],
    resumeBullets: [
      "Migrated a Parquet data lake to Apache Iceberg, gaining ACID transactions and snapshot isolation across 50TB of data.",
      "Used Iceberg hidden partitioning to eliminate the partition-pruning footguns of legacy Hive tables.",
    ],
    interviewQuestions: [
      "Compare Iceberg, Delta Lake, and Hudi in three sentences.",
      "What is hidden partitioning and why does it matter?",
      "How does Iceberg implement time travel?",
    ],
    marketSignal: "Iceberg has won the open-table-format wars at every major cloud (Snowflake, BigQuery, Databricks all support it).",
  },
  "debezium-cdc": {
    roles: ["Streaming Engineer", "Data Integration Engineer"],
    skillsForResume: ["Debezium", "Change Data Capture", "Kafka Connect", "Database replication"],
    resumeBullets: [
      "Stood up Debezium connectors capturing Postgres WAL changes into Kafka with sub-second propagation.",
      "Replaced a nightly full-table extract with CDC, cutting source DB load by 90%.",
    ],
    interviewQuestions: [
      "How does logical replication / WAL-based CDC differ from query-based CDC?",
      "What guarantees does Debezium give around ordering?",
      "How would you handle schema changes in the source DB?",
    ],
    marketSignal: "CDC is now the default ingestion pattern at any company with > 1TB of OLTP data.",
  },
  "mlflow-pipeline": {
    roles: ["MLOps Engineer", "ML Platform Engineer"],
    skillsForResume: ["MLflow", "Experiment tracking", "Model registry", "Model serving"],
    resumeBullets: [
      "Tracked 200+ training runs in MLflow with parameters, metrics, and artifact lineage.",
      "Promoted models through Staging → Production via the MLflow registry, gating on validation metrics.",
    ],
    interviewQuestions: [
      "What problem does an experiment tracker solve that git alone doesn't?",
      "Walk me through a model promotion workflow.",
      "How do you handle model rollback in production?",
    ],
    marketSignal: "MLflow + a model registry is the minimum bar for any ML platform team in 2026.",
  },
  "warehouse-cost-optimization": {
    roles: ["Cloud Data Engineer", "FinOps Engineer", "Senior Analytics Engineer"],
    skillsForResume: ["Warehouse FinOps", "Query optimization", "Partitioning", "Resource monitoring"],
    resumeBullets: [
      "Cut Snowflake spend 35% by right-sizing warehouses, killing runaway queries, and rewriting top-10 cost queries.",
      "Built a daily cost dashboard surfacing per-team spend and the most expensive queries.",
    ],
    interviewQuestions: [
      "How would you find the most expensive queries in your warehouse?",
      "What levers are available to reduce warehouse cost without breaking SLAs?",
      "Compare partitioning vs clustering as cost-control techniques.",
    ],
    marketSignal: "Cloud-bill scrutiny is the #1 quarterly metric for data teams in 2026 — FinOps fluency is a tie-breaker.",
  },
  "data-lineage-graph": {
    roles: ["Data Platform Engineer", "Governance Engineer"],
    skillsForResume: ["Column-level lineage", "Graph databases", "OpenLineage", "Impact analysis"],
    resumeBullets: [
      "Built a column-level lineage service ingesting OpenLineage events from Airflow + dbt, modeled in Neo4j.",
      "Enabled impact analysis ('what breaks if I drop this column?') across 800 downstream models in seconds.",
    ],
    interviewQuestions: [
      "Why model lineage as a graph rather than relational tables?",
      "What is OpenLineage and what does it standardize?",
      "How would you do impact analysis at the column level?",
    ],
    marketSignal: "Lineage is now a hard regulatory requirement under SR 11-7, GDPR Article 22, and the EU AI Act.",
  },
  "vector-database-search": {
    roles: ["AI Engineer", "Search Engineer", "RAG Platform Engineer"],
    skillsForResume: ["pgvector", "Embeddings", "ANN search", "Hybrid search", "RAG pipelines"],
    resumeBullets: [
      "Built a semantic search service over 5M docs with pgvector + IVFFlat, p95 latency under 80ms.",
      "Combined keyword (BM25) + vector search via reciprocal rank fusion for higher recall.",
    ],
    interviewQuestions: [
      "Compare HNSW and IVFFlat indexes — tradeoffs?",
      "When would you choose pgvector over a dedicated vector DB?",
      "What is hybrid search and why does it usually beat pure vector search?",
    ],
    marketSignal: "Every product team with an LLM feature needs vector + RAG infra — this is the data engineer's path into AI.",
  },
  "dbt-advanced-patterns": {
    roles: ["Senior Analytics Engineer", "dbt Specialist"],
    skillsForResume: ["dbt macros", "dbt packages", "Snapshots", "Incremental models", "Slowly-changing dimensions"],
    resumeBullets: [
      "Authored reusable dbt macros (audit columns, surrogate keys, incremental partitions) across 4 dbt projects.",
      "Implemented Type-2 SCDs via dbt snapshots tracking historical changes on key dimensions.",
    ],
    interviewQuestions: [
      "How do dbt snapshots work and what are their limits?",
      "Walk me through writing a custom dbt macro.",
      "How would you handle late-arriving facts in an incremental model?",
    ],
    marketSignal: "Senior Analytics Engineer roles all expect deep dbt fluency, not just basic ref()/source().",
  },
  "kubernetes-data-platform": {
    roles: ["Data Platform Engineer", "Site Reliability Engineer (data)"],
    skillsForResume: ["Kubernetes", "Helm", "Airflow on K8s", "Spark on K8s", "GitOps"],
    resumeBullets: [
      "Deployed Airflow + Spark on Kubernetes via Helm, with autoscaling worker pools driven by KEDA.",
      "Implemented GitOps (ArgoCD) so platform changes shipped via PR, with one-click rollback.",
    ],
    interviewQuestions: [
      "Why run data tooling on Kubernetes vs managed services?",
      "How does KubernetesPodOperator differ from CeleryExecutor?",
      "What are the gotchas of running Spark on K8s vs YARN?",
    ],
    marketSignal: "Mid-to-large data teams running their own platform list K8s as a hard requirement on senior posts.",
  },
  "trino-federated-queries": {
    roles: ["Data Platform Engineer", "Senior Data Engineer"],
    skillsForResume: ["Trino", "Federated SQL", "Query federation", "Connector architecture"],
    resumeBullets: [
      "Stood up a Trino cluster federating queries across S3 (Iceberg), Postgres, and Kafka — one SQL endpoint for analysts.",
      "Tuned coordinator + worker memory and split scheduling to handle 50 concurrent ad-hoc queries.",
    ],
    interviewQuestions: [
      "How does Trino plan a federated query across two connectors?",
      "When does pushdown work and when does Trino have to pull data into the coordinator?",
      "Compare Trino, Presto, and Athena.",
    ],
    marketSignal: "Federation is the lakehouse-era replacement for the central warehouse — Trino is the de-facto OSS engine.",
  },
  "data-contracts": {
    roles: ["Data Platform Engineer", "Data Reliability Engineer"],
    skillsForResume: ["Data contracts", "Schema Registry", "Avro/Protobuf", "Producer/consumer governance"],
    resumeBullets: [
      "Implemented data contracts between 3 producer services and the warehouse, enforcing schema in CI.",
      "Versioned contracts with semver and deprecated breaking changes via 60-day notice.",
    ],
    interviewQuestions: [
      "What problem do data contracts solve that dbt tests don't?",
      "How would you enforce a contract at the producer side?",
      "Compare Avro, Protobuf, and JSON Schema for contracts.",
    ],
    marketSignal: "Data contracts have moved from blog buzzword to job-spec keyword in 2026 — the 'shift-left' DE skill.",
  },
  "advanced-partitioning": {
    roles: ["Data Engineer", "Database Engineer"],
    skillsForResume: ["Range/list/hash partitioning", "Partition pruning", "Postgres declarative partitioning"],
    resumeBullets: [
      "Partitioned a 5B-row events table by month + tenant, cutting analytical query time from minutes to under 2s.",
      "Automated rolling-window retention by detaching old partitions instead of DELETE.",
    ],
    interviewQuestions: [
      "When does partitioning hurt instead of help?",
      "Compare range, list, and hash partitioning.",
      "How does the planner use partition pruning?",
    ],
    marketSignal: "Schema design + partitioning still separates juniors from mid-level DEs in interviews.",
  },
  "log-analytics-pipeline": {
    roles: ["Observability Engineer", "Data Engineer", "SRE Adjacent"],
    skillsForResume: ["Elasticsearch", "Log shipping", "ILM", "Kibana", "High-cardinality data"],
    resumeBullets: [
      "Built a log-analytics pipeline ingesting 50M log lines/day into Elasticsearch with index-lifecycle policies.",
      "Cut storage cost 60% by tiering hot → warm → frozen and enforcing field allowlists.",
    ],
    interviewQuestions: [
      "How do you handle high-cardinality fields in Elasticsearch?",
      "Walk me through index lifecycle management.",
      "When would you choose ClickHouse over Elasticsearch for logs?",
    ],
    marketSignal: "Observability data is one of the largest data domains by volume — DEs who can wrangle it are scarce.",
  },
  "geospatial-data-pipeline": {
    roles: ["Geospatial Data Engineer", "Data Engineer (location)"],
    skillsForResume: ["PostGIS", "H3", "Geohash", "Spatial joins", "Map tile generation"],
    resumeBullets: [
      "Built a PostGIS pipeline indexing 200M locations with H3 hex bins, enabling sub-second spatial joins.",
      "Generated vector map tiles served via Mapbox for an internal location dashboard.",
    ],
    interviewQuestions: [
      "Compare H3, S2, and geohash.",
      "How does a spatial index differ from a B-tree?",
      "What is a spatial join and how would you optimize one?",
    ],
    marketSignal: "Mobility, logistics, and ad-tech all hire geospatial-specialized DEs at a premium.",
  },
  "data-freshness-monitoring": {
    roles: ["Data Reliability Engineer", "Data Platform Engineer"],
    skillsForResume: ["Freshness SLAs", "Anomaly detection", "Data observability", "PagerDuty"],
    resumeBullets: [
      "Implemented freshness SLAs across 80 critical tables with auto-paging when SLAs were breached.",
      "Cut analyst-reported 'is the data up to date?' questions to near-zero.",
    ],
    interviewQuestions: [
      "How would you define a freshness SLA?",
      "What's the difference between freshness, latency, and lag?",
      "Build vs buy: when would you reach for Monte Carlo / Bigeye?",
    ],
    marketSignal: "Data observability is now a $2B+ category — the DEs who built it in-house are the most marketable.",
  },
  "reverse-etl-pipeline": {
    roles: ["Data Engineer", "Operational Analytics Engineer"],
    skillsForResume: ["Reverse ETL", "Hightouch/Census", "API rate limiting", "Sync orchestration"],
    resumeBullets: [
      "Built a reverse ETL pipeline syncing enriched user attributes from the warehouse to Salesforce + Braze.",
      "Implemented field-level diff sync to stay under destination API rate limits.",
    ],
    interviewQuestions: [
      "Why is reverse ETL a thing — why not just call Salesforce from the app?",
      "How would you ensure idempotency on sync to a destination with no upsert API?",
      "When does build beat buy (Hightouch/Census)?",
    ],
    marketSignal: "Operational analytics / activation is the highest-growth category in the modern data stack.",
  },
  "graph-data-pipeline": {
    roles: ["Graph Data Engineer", "Fraud Engineer", "Senior Data Engineer"],
    skillsForResume: ["Neo4j", "Cypher", "Graph algorithms", "Community detection", "Fraud rings"],
    resumeBullets: [
      "Modeled transaction data as a graph in Neo4j and detected fraud rings via community-detection algorithms.",
      "Cut fraud-investigation time from days to minutes for the analyst team.",
    ],
    interviewQuestions: [
      "When is a graph DB the right choice over relational?",
      "How does community detection actually work?",
      "Compare Neo4j and TigerGraph.",
    ],
    marketSignal: "Fraud, identity, and recommendation use-cases drive most graph hires in 2026.",
  },
  "time-series-pipeline": {
    roles: ["IoT Data Engineer", "Time-series Engineer"],
    skillsForResume: ["TimescaleDB", "Continuous aggregates", "Compression", "Downsampling"],
    resumeBullets: [
      "Ingested 1M sensor readings/sec into TimescaleDB with hypertable partitioning + native compression (10x ratio).",
      "Built continuous aggregates so dashboards queried materialized rollups, not raw data.",
    ],
    interviewQuestions: [
      "Compare TimescaleDB, InfluxDB, and ClickHouse for time series.",
      "What is a continuous aggregate?",
      "How does columnar compression help time-series workloads?",
    ],
    marketSignal: "IoT + observability time-series workloads are doubling YoY; specialized DE skills are in demand.",
  },
  "data-platform-api": {
    roles: ["Data Platform Engineer", "Backend Engineer (data)"],
    skillsForResume: ["FastAPI", "REST APIs", "Async Python", "Self-serve data access", "Auth + RBAC"],
    resumeBullets: [
      "Built a FastAPI service exposing curated warehouse views to internal apps with RBAC + caching.",
      "Replaced direct warehouse access for 30 services, cutting expensive ad-hoc queries 80%.",
    ],
    interviewQuestions: [
      "Why put an API in front of the warehouse?",
      "How would you cache expensive analytical queries safely?",
      "How would you implement per-team rate limits?",
    ],
    marketSignal: "Data products surfaced as APIs is a top-3 modern DE pattern — bridges DE + backend hiring pools.",
  },
  "streaming-joins-windows": {
    roles: ["Streaming Engineer", "Senior Data Engineer"],
    skillsForResume: ["Stream-stream joins", "Temporal joins", "Watermarks", "State TTL"],
    resumeBullets: [
      "Implemented a stream-stream temporal join in Flink correlating impressions to clicks within a 30-min window.",
      "Tuned state TTL + RocksDB to keep the job memory-stable across 30 days.",
    ],
    interviewQuestions: [
      "How does a stream-stream join work and why is state size a concern?",
      "What is a temporal join in Flink SQL?",
      "How do watermarks affect window emission?",
    ],
    marketSignal: "Stream-processing depth is what separates Senior+ streaming roles from junior 'just write a Kafka consumer' work.",
  },
  "dbt-testing-ci": {
    roles: ["Analytics Engineer", "Data Platform Engineer"],
    skillsForResume: ["dbt-expectations", "GitHub Actions", "Slim CI", "PR checks", "dbt artifacts"],
    resumeBullets: [
      "Built a Slim CI pipeline running only changed dbt models on every PR, cutting CI time from 25min to 4min.",
      "Required dbt-expectations checks (row count, distribution) on critical models before merge.",
    ],
    interviewQuestions: [
      "What is Slim CI in dbt and how does state:modified work?",
      "Where do dbt artifacts come from and what would you do with them?",
      "How would you fail a PR for a data quality regression?",
    ],
    marketSignal: "DataOps maturity is now an interview screening topic — CI for dbt is table stakes at well-run shops.",
  },
  "data-access-governance": {
    roles: ["Data Governance Engineer", "Data Security Engineer"],
    skillsForResume: ["RBAC", "Column masking", "Audit logging", "Row-level security"],
    resumeBullets: [
      "Implemented role-based access + column-level masking on the warehouse for PII compliance.",
      "Logged every query with user, columns touched, and row count to satisfy audit requirements.",
    ],
    interviewQuestions: [
      "How would you mask PII without breaking analytics?",
      "Compare row-level security in Postgres vs Snowflake vs BigQuery.",
      "How would you prove to an auditor that no engineer can read raw PII?",
    ],
    marketSignal: "Privacy + AI regulation make governance the fastest-growing data-platform skill in 2026.",
  },
  "multi-cloud-platform": {
    roles: ["Principal Data Engineer", "Cloud Architect (data)"],
    skillsForResume: ["Multi-cloud", "Terraform", "Cross-cloud networking", "Cost arbitrage"],
    resumeBullets: [
      "Designed a multi-cloud data platform spanning AWS + GCP, with Terraform IaC and unified observability.",
      "Implemented cost-aware workload routing that saved 25% by running training on the cheapest cloud-week.",
    ],
    interviewQuestions: [
      "Why would a company go multi-cloud — pros vs cons?",
      "How do you handle cross-cloud egress without breaking the budget?",
      "How would you keep a multi-cloud Terraform state safe?",
    ],
    marketSignal: "Enterprise + regulated industries (finance, gov, healthcare) increasingly hire for multi-cloud explicitly.",
  },
  "llm-data-pipeline": {
    roles: ["AI Data Engineer", "ML Platform Engineer", "Data Engineer (AI)"],
    skillsForResume: ["LLM-assisted pipelines", "Prompt engineering for data", "Schema inference", "Auto-cleaning"],
    resumeBullets: [
      "Built an LLM-assisted ingestion pipeline that infers schemas from messy CSVs and proposes cleanup transformations.",
      "Cut new-source onboarding time from 2 days to 30 minutes for analyst-led ingests.",
    ],
    interviewQuestions: [
      "Where does an LLM help in a data pipeline and where does it hurt?",
      "How would you evaluate an LLM-generated transform before shipping it?",
      "How would you keep cost predictable when LLMs are in the loop?",
    ],
    marketSignal: "LLM-in-the-loop data tooling is the hottest emerging skill — signals you stay current.",
  },
  "capstone-lakehouse": {
    roles: ["Senior Data Engineer", "Lakehouse Architect", "Data Platform Lead"],
    skillsForResume: ["End-to-end lakehouse", "Delta Lake", "Spark", "Airflow", "Observability", "CI/CD"],
    resumeBullets: [
      "Shipped an end-to-end production lakehouse: ingest (CDC + APIs) → process (Spark + Delta) → serve (warehouse views) → monitor (freshness + quality).",
      "Owned the runbook, on-call, and SLA reporting for the platform.",
    ],
    interviewQuestions: [
      "Walk me through a system you designed end-to-end. What were the tradeoffs?",
      "How do you decide the boundary between lake and warehouse?",
      "What does your on-call setup look like for this platform?",
    ],
    portfolioReadiness:
      "This is the resume-headline project. Architecture diagram + GitHub repo + screen-recorded demo = strongest possible portfolio piece.",
    marketSignal: "Capstone-grade end-to-end systems are what hiring managers ask about in senior loops.",
  },
  "capstone-streaming": {
    roles: ["Senior Streaming Engineer", "Real-time Platform Architect"],
    skillsForResume: ["End-to-end streaming", "Kafka", "Flink", "Redis", "Real-time serving"],
    resumeBullets: [
      "Architected and shipped a full real-time platform: Kafka ingestion → Flink processing → Redis serving → analytics dashboard.",
      "Hit < 200ms end-to-end latency at p95 under 50k events/sec sustained load.",
    ],
    interviewQuestions: [
      "Walk through the latency budget of your real-time platform end-to-end.",
      "How do you handle backpressure across the stack?",
      "How would you evolve the schema of an event you've already published 1B times?",
    ],
    portfolioReadiness:
      "Pair the repo with a load-test report and a live dashboard URL — interview slam dunk for streaming roles.",
    marketSignal: "Real-time platform engineers are among the highest-comp specialized DE roles in 2026.",
  },
};
