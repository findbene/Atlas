import { Router } from "express";
import { requireAuth } from "../lib/auth";

const router = Router();

const PISTON_API = "https://emkc.org/api/v2/piston";

router.post("/execute/python", requireAuth, async (req, res) => {
  try {
    const { code, stdin = "", timeoutSeconds = 10 } = req.body;

    const response = await fetch(`${PISTON_API}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "python",
        version: "3.10.0",
        files: [{ content: code }],
        stdin,
        run_timeout: timeoutSeconds * 1000,
        compile_timeout: 10000,
      }),
    });

    if (!response.ok) {
      res.status(502).json({ error: "Code execution service unavailable" });
      return;
    }

    const data = await response.json() as {
      run?: { stdout?: string; stderr?: string; code?: number; signal?: string };
      compile?: { stdout?: string; stderr?: string };
    };

    const run = data.run ?? {};
    res.json({
      stdout: run.stdout ?? "",
      stderr: run.stderr ?? "",
      exitCode: run.code ?? 0,
      timedOut: run.signal === "SIGKILL",
      executionTimeMs: 0,
    });
  } catch (err) {
    req.log.error({ err }, "Code execution failed");
    res.status(500).json({ error: "Code execution failed" });
  }
});

export default router;
