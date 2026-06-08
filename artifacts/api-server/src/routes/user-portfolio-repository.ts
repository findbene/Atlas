/**
 * Phase 60G — GET /api/user/projects/:projectSlug/portfolio-repository
 *
 * Authenticated, read-only. Returns a deterministic JSON bundle of a
 * GitHub-ready local repository (the Phase-60A Markdown files + a
 * machine-readable `atlas-portfolio.json` + an optional learner-evidence
 * `evidence/submission-summary.md`) for the learner to download and MANUALLY
 * upload to GitHub. No OAuth, no token, no direct push, no publishing.
 *
 * Privacy / access contract is identical to the Phase-60B artifact route
 * (symmetric with user-portfolio.ts + cert-verify.ts):
 *   - userId comes EXCLUSIVELY from the authenticated session — no path/query/
 *     body param accepts a userId.
 *   - 404 (never 403) when the project is hidden / soft-deleted / unknown, or
 *     the user is not enrolled — no hidden-project existence leak.
 *   - The response never contains validationConfig, expectedRows,
 *     expectedRowsHash, reference queries, comparator internals, raw
 *     submissions, or secrets (the assembly chokepoint + the leak-free-by-
 *     construction generator input + the export layer's path guard + a runtime
 *     banned-claim guard).
 *   - No write side effects.
 */
import { Router, type IRouter } from "express";
import { findBannedClaims } from "@workspace/execution-core/honest-claims";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { assemblePortfolioArtifactInput } from "../lib/portfolioArtifactAssembly";
import { generatePortfolioRepository } from "../lib/portfolioRepository";

const router: IRouter = Router();

router.get(
  "/user/projects/:projectSlug/portfolio-repository",
  requireAuth,
  async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const projectSlug = String(req.params.projectSlug ?? "");
      const generatedAt = new Date().toISOString();

      const input = await assemblePortfolioArtifactInput(
        user.id,
        projectSlug,
        generatedAt,
      );
      // null = hidden / deleted / unknown project, or user not enrolled →
      // 404, never 403, so a hidden project's existence is not revealed.
      if (!input) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const repository = generatePortfolioRepository(input);

      // Defense-in-depth H3 guard: the generator copy is honest by
      // construction, but it interpolates author-authored fields (title,
      // skills, step titles). Run the WHOLE bundle through the CANONICAL
      // banned-claim guard and fail closed rather than ever serve an artifact
      // that over-claims.
      const banned = findBannedClaims(Object.values(repository.files).join("\n"));
      if (banned.length > 0) {
        req.log.error(
          { banned, projectSlug: input.project.slug },
          "Portfolio repository blocked: banned honest-claim pattern in author copy",
        );
        res.status(500).json({ error: "Failed to build portfolio repository" });
        return;
      }

      res.json(repository);
    } catch (err) {
      req.log.error({ err }, "Failed to build portfolio repository");
      res.status(500).json({ error: "Failed to build portfolio repository" });
    }
  },
);

export default router;
