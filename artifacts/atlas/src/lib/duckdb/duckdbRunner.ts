import type { ExecutionAdapter, RunInput, RunResult } from "@workspace/execution-core";
import * as duckdb from "@duckdb/duckdb-wasm";
// Vite-recognized bundle URLs. The `?url` suffix yields a public URL for the
// asset so the worker can be instantiated cross-origin-safe.
import mvpWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehWasm from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

/**
 * DuckDB-WASM adapter — in-browser SQL execution against an ephemeral DB.
 *
 * Lifecycle: a single AsyncDuckDB is lazy-instantiated on first use and reused
 * for the page lifetime. A fresh connection is opened per `run()` so each
 * learner attempt is isolated; tables registered from CSV are session-scoped
 * (DROPped after the run completes) so the next step doesn't see stale data.
 */

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
};

async function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const bundle = await duckdb.selectBundle(BUNDLES);
    if (!bundle.mainWorker) {
      throw new Error("DuckDB-WASM: no suitable worker bundle for this browser.");
    }
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    return db;
  })();
  return dbPromise;
}

/**
 * Resolve a dataset reference (e.g. "nyc_taxi_sample") to a public URL the
 * worker can fetch. Datasets ship under `artifacts/atlas/public/datasets/` and
 * are served at `${BASE_URL}datasets/<name>.csv`.
 */
function datasetUrl(ref: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "/");
  return `${base}datasets/${ref}.csv`;
}

/**
 * Register a CSV dataset as a DuckDB table named after the ref. Idempotent
 * for the lifetime of a connection: CREATE OR REPLACE means re-runs cleanly
 * replace the table without errors.
 */
async function registerCsv(
  db: duckdb.AsyncDuckDB,
  conn: duckdb.AsyncDuckDBConnection,
  ref: string,
): Promise<void> {
  const url = datasetUrl(ref);
  const fileName = `${ref}.csv`;
  // registerFileURL is a no-op if the file is already registered for this URL.
  await db.registerFileURL(fileName, url, duckdb.DuckDBDataProtocol.HTTP, false);
  await conn.query(
    `CREATE OR REPLACE TABLE "${ref}" AS SELECT * FROM read_csv_auto('${fileName}', header=true);`,
  );
}

function isTabularError(message: string): string {
  // DuckDB error messages are usually very long with parser noise. Trim to
  // the first meaningful line so learners see something actionable.
  const firstLine = message.split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? message;
  return firstLine.length > 280 ? `${firstLine.slice(0, 277)}...` : firstLine;
}

export const duckdbAdapter: ExecutionAdapter = {
  id: "browser.duckdb-wasm",
  mode: "simulated",
  supports: ["sql"],
  async run(input: RunInput): Promise<RunResult> {
    if (input.language !== "sql") {
      return {
        ok: false,
        durationMs: 0,
        error: `DuckDB adapter received ${input.language} code; expected sql.`,
      };
    }
    const start = performance.now();
    const db = await getDb();
    const conn = await db.connect();
    try {
      for (const ref of input.datasetRefs ?? []) {
        await registerCsv(db, conn, ref);
      }
      const result = await conn.query(input.code);
      // Arrow Table → { columns, rows[][] }
      const columns = result.schema.fields.map((f) => f.name);
      const rows: Array<Array<string | number | boolean | null>> = [];
      for (const record of result.toArray()) {
        const row: Array<string | number | boolean | null> = [];
        for (const col of columns) {
          const v = (record as Record<string, unknown>)[col];
          if (v == null) row.push(null);
          else if (typeof v === "bigint") {
            // DuckDB returns COUNT/SUM/etc as BIGINT. Coerce to Number only
            // when it round-trips losslessly; otherwise preserve as a string
            // so validation comparisons stay precision-safe and learners see
            // the real value instead of a silently truncated one.
            row.push(
              v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER)
                ? Number(v)
                : v.toString(),
            );
          }
          else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") row.push(v);
          else row.push(String(v));
        }
        rows.push(row);
      }
      return {
        ok: true,
        columns,
        rows,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        durationMs: Math.round(performance.now() - start),
        error: isTabularError(msg),
      };
    } finally {
      try {
        await conn.close();
      } catch {
        // best-effort
      }
    }
  },
};
