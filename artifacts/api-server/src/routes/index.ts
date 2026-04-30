import { Router, type IRouter } from "express";
import healthRouter from "./health";
import domainsRouter from "./domains";
import projectsRouter from "./projects";
import userRouter from "./user";
import aiRouter from "./ai";
import billingRouter from "./billing";
import executeRouter from "./execute";
import leaderboardRouter from "./leaderboard";
import modulesRouter from "./modules";

const router: IRouter = Router();

router.use(healthRouter);
router.use(domainsRouter);
router.use(projectsRouter);
router.use(userRouter);
router.use(aiRouter);
router.use(billingRouter);
router.use(executeRouter);
router.use(leaderboardRouter);
router.use(modulesRouter);

export default router;
