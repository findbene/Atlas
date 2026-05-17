import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", async (req, res) => {
  // Liveness probe: 200 means the process is up. Cheap DB ping doubles as
  // a readiness signal — if Postgres is unreachable the deployment platform
  // can stop sending traffic to this instance.
  try {
    await db.execute(sql`SELECT 1`);
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Health check DB ping failed");
    res.status(503).json({ status: "degraded", reason: "db_unreachable" });
  }
});

export default router;
