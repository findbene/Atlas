import { Router } from "express";
import { db } from "@workspace/db";
import { userCodeRuns, projects } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cap stored payload sizes — these are debug aids, not full transcripts.
// Anything bigger than this is truncated so a runaway loop can't fill the DB.
const MAX_CODE_BYTES = 8000;
const MAX_OUT_BYTES = 4000;

function clip(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.length > max ? s.slice(0, max) + "\n…[truncated]" : s;
}

// POST /runs — record a single Pyodide run. The client posts the code +
// stdout/stderr it captured locally. No code is executed server-side.
router.post("/runs", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { projectId, stepId, code, stdout, stderr, ok } = req.body ?? {};
    if (typeof projectId !== "string" || !UUID_RE.test(projectId)) {
      res.status(400).json({ error: "Invalid projectId" });
      return;
    }
    const stepIdValidated =
      typeof stepId === "string" && UUID_RE.test(stepId) ? stepId : null;
    if (typeof code !== "string" || code.length === 0) {
      res.status(400).json({ error: "Missing code" });
      return;
    }

    // Cheap project-existence check — we don't want to litter the table with
    // foreign-key violations or runs for nonexistent projects.
    const exists = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true },
    });
    if (!exists) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await db.insert(userCodeRuns).values({
      userId: user.id,
      projectId,
      stepId: stepIdValidated,
      code: clip(code, MAX_CODE_BYTES),
      stdout: clip(stdout, MAX_OUT_BYTES),
      stderr: clip(stderr, MAX_OUT_BYTES),
      ok: Boolean(ok),
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to record code run");
    res.status(500).json({ error: "Failed to record run" });
  }
});

// GET /runs?stepId=... — last 20 runs for the current user, scoped to the
// step (or whole project if no stepId is supplied). Always user-scoped so
// learners only see their own attempts.
router.get("/runs", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { stepId, projectId } = req.query as Record<string, string | undefined>;

    const whereParts = [eq(userCodeRuns.userId, user.id)];
    if (stepId && UUID_RE.test(stepId)) {
      whereParts.push(eq(userCodeRuns.stepId, stepId));
    } else if (projectId && UUID_RE.test(projectId)) {
      whereParts.push(eq(userCodeRuns.projectId, projectId));
    } else {
      res.status(400).json({ error: "Provide stepId or projectId" });
      return;
    }

    const rows = await db.query.userCodeRuns.findMany({
      where: and(...whereParts),
      orderBy: [desc(userCodeRuns.createdAt)],
      limit: 20,
    });

    res.json(
      rows.map(r => ({
        id: r.id,
        code: r.code,
        stdout: r.stdout,
        stderr: r.stderr,
        ok: r.ok,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list code runs");
    res.status(500).json({ error: "Failed to list runs" });
  }
});

// DELETE /runs/:id — remove a single run owned by the current user.
router.delete("/runs/:id", requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    // user_id in the WHERE makes this implicitly authorization-safe — a user
    // can only delete their own rows even if they guess another row's id.
    await db.execute(sql`
      DELETE FROM user_code_runs
      WHERE id = ${id} AND user_id = ${user.id}
    `);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete code run");
    res.status(500).json({ error: "Failed to delete run" });
  }
});

export default router;
