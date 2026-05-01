import { Router } from "express";
import { requireAuth } from "../lib/auth";

const router = Router();

// Code execution moved to the browser via Pyodide. The web client now runs
// Python locally with no server round-trip, so this endpoint is a no-op kept
// for API compatibility. It returns a clear stderr instead of a 5xx so any
// stale client surfaces a useful message rather than a confusing error.
router.post("/execute/python", requireAuth, async (_req, res) => {
  res.json({
    stdout: "",
    stderr:
      "Server-side Python execution is no longer used. Please refresh the page to load the in-browser runtime.",
    exitCode: 1,
    timedOut: false,
    executionTimeMs: 0,
  });
});

export default router;
