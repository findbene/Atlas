import type { PyodideInterface } from "pyodide";

export type PyodideStatus = "idle" | "loading" | "ready" | "error";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

let pyodidePromise: Promise<PyodideInterface> | null = null;
let pyodideInstance: PyodideInterface | null = null;
const statusListeners = new Set<(s: PyodideStatus) => void>();
let currentStatus: PyodideStatus = "idle";

const PYODIDE_VERSION = "0.28.4";
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

function setStatus(s: PyodideStatus) {
  currentStatus = s;
  statusListeners.forEach((fn) => fn(s));
}

export function getPyodideStatus(): PyodideStatus {
  return currentStatus;
}

export function subscribePyodideStatus(fn: (s: PyodideStatus) => void): () => void {
  statusListeners.add(fn);
  fn(currentStatus);
  return () => statusListeners.delete(fn);
}

export async function loadPyodideOnce(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodidePromise) return pyodidePromise;

  setStatus("loading");
  pyodidePromise = (async () => {
    try {
      // Inject the loader script tag so we use the same CDN bundle that ships
      // wasm + stdlib together. Importing directly from "pyodide" works, but
      // bundling the wasm with vite is non-trivial — the CDN is the simplest
      // proven path.
      await ensurePyodideScript();
      const loader = (window as unknown as { loadPyodide: (opts: { indexURL: string }) => Promise<PyodideInterface> }).loadPyodide;
      const py = await loader({ indexURL: PYODIDE_INDEX_URL });
      pyodideInstance = py;
      setStatus("ready");
      return py;
    } catch (err) {
      setStatus("error");
      pyodidePromise = null;
      throw err;
    }
  })();
  return pyodidePromise;
}

function ensurePyodideScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { loadPyodide?: unknown }).loadPyodide) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[data-pyodide="1"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Pyodide")));
      return;
    }
    const script = document.createElement("script");
    script.src = `${PYODIDE_INDEX_URL}pyodide.js`;
    script.async = true;
    script.dataset.pyodide = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pyodide"));
    document.head.appendChild(script);
  });
}

const KNOWN_PACKAGES = new Set([
  "numpy",
  "pandas",
  "scipy",
  "matplotlib",
  "scikit-learn",
  "sklearn",
  "sympy",
  "networkx",
  "statsmodels",
  "regex",
  "pyyaml",
  "yaml",
  "pillow",
  "pil",
  "beautifulsoup4",
  "bs4",
  "lxml",
  "requests",
  "pytz",
  "python-dateutil",
  "dateutil",
]);

const PACKAGE_ALIASES: Record<string, string> = {
  sklearn: "scikit-learn",
  pil: "pillow",
  bs4: "beautifulsoup4",
  yaml: "pyyaml",
  dateutil: "python-dateutil",
};

function detectImports(code: string): string[] {
  const found = new Set<string>();
  const importRe = /^\s*(?:from|import)\s+([a-zA-Z_][\w\.]*)/gm;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(code)) !== null) {
    const top = m[1].split(".")[0].toLowerCase();
    if (KNOWN_PACKAGES.has(top)) {
      found.add(PACKAGE_ALIASES[top] ?? top);
    }
  }
  return [...found];
}

// Pyodide runs in a single global VM, and `setStdout`/`setStderr` are global on
// that VM. We serialize all runs through this promise chain so output buffers
// never interleave between concurrent callers.
let runChain: Promise<unknown> = Promise.resolve();

export async function runPython(
  code: string,
  opts: { timeoutMs?: number } = {}
): Promise<ExecResult> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const next = runChain.then(() => runPythonInner(code, timeoutMs));
  // Don't let one failure poison the chain.
  runChain = next.catch(() => undefined);
  return next;
}

async function runPythonInner(code: string, timeoutMs: number): Promise<ExecResult> {
  const py = await loadPyodideOnce();

  // Pre-load any packages we can detect from the import lines.
  const pkgs = detectImports(code);
  if (pkgs.length > 0) {
    try {
      await py.loadPackage(pkgs);
    } catch (err) {
      // Non-fatal: let Python raise the real ImportError if it can't load.
      // eslint-disable-next-line no-console
      console.warn("Pyodide loadPackage failed", err);
    }
  }

  let stdout = "";
  let stderr = "";
  let abandoned = false;
  py.setStdout({
    batched: (s: string) => {
      if (!abandoned) stdout += s + "\n";
    },
  });
  py.setStderr({
    batched: (s: string) => {
      if (!abandoned) stderr += s + "\n";
    },
  });

  const exec = (async () => {
    try {
      await py.runPythonAsync(code);
      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!abandoned) {
        stderr += msg.endsWith("\n") ? msg : `${msg}\n`;
      }
      return { ok: false as const };
    }
  })();

  const timeout = new Promise<{ timedOut: true }>((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), timeoutMs)
  );

  const winner = await Promise.race([exec, timeout]);
  if ("timedOut" in winner) {
    // Pyodide can't actually be cancelled from JS — the python work continues
    // in the background. We mark the run abandoned so any late stdout/stderr
    // is dropped, and keep awaiting `exec` privately so the next queued run
    // doesn't start mid-execution.
    abandoned = true;
    stderr += `\nExecution timed out after ${Math.round(timeoutMs / 1000)}s.\n`;
    void exec; // already awaited via runChain serialization below
    await exec.catch(() => undefined); // ensure chain order
    return { stdout, stderr, exitCode: 1, timedOut: true };
  }

  return {
    stdout,
    stderr,
    exitCode: winner.ok ? 0 : 1,
    timedOut: false,
  };
}
