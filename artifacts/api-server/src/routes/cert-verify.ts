import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, userProgress, users, projects } from "@workspace/db";

const router: IRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public certificate verification. Anyone with the certId (the
 * user_progress.id UUID of a completed project) can confirm authenticity.
 * Returns minimal recipient + project metadata; never leaks private fields.
 */
router.get("/verify/:certId", async (req, res) => {
  const certId = String(req.params.certId ?? "");
  if (!UUID_RE.test(certId)) {
    res.status(404).json({ error: "Certificate not found" });
    return;
  }
  try {
    const row = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.id, certId), eq(userProgress.status, "completed")),
    });
    if (!row || !row.completedAt) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }
    const [user, project] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, row.userId) }),
      db.query.projects.findFirst({ where: eq(projects.id, row.projectId) }),
    ]);
    if (!user || !project) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }
    res.json({
      certId,
      recipientName: user.name ?? user.username ?? "Atlas Learner",
      recipientUsername: user.username ?? null,
      projectTitle: project.title,
      projectSlug: project.slug,
      completedAt: row.completedAt.toISOString(),
      issuer: "Atlas Projects",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to verify certificate");
    res.status(500).json({ error: "Failed to verify certificate" });
  }
});

export default router;
