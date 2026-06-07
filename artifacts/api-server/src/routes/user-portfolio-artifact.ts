/**
 * Phase 60B — GET /api/user/projects/:projectSlug/portfolio-artifact
 *
 * Authenticated, read-only. Returns a deterministic JSON bundle of the
 * recruiter-readable artifact files produced by the Phase-60A generator from
 * THIS user's safe completion/evidence records.
 *
 * Privacy / access contract (symmetric with user-portfolio.ts + cert-verify.ts):
 *   - userId comes EXCLUSIVELY from the authenticated session. There is no
 *     path/query/body param that accepts a userId.
 *   - 404 (never 403) when the project is hidden / soft-deleted / unknown, or
 *     when the user is not enrolled — no hidden-project existence leak.
 *   - The response never contains validationConfig, expectedRows,
 *     expectedRowsHash, reference queries, comparator internals, raw
 *     submissions, or secrets (guaranteed by the assembly chokepoint + the
 *     pure generator's leak-free-by-construction input model).
 *   - No write side effects.
 */
import { Router, type IRouter } from "express";
import { findBannedClaims } from "@workspace/execution-core/honest-claims";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { assemblePortfolioArtifactInput } from "../lib/portfolioArtifactAssembly";
import { generatePortfolioArtifact } from "../lib/portfolioArtifact";

const router: IRouter = Router();

router.get(
  "/user/projects/:projectSlug/portfolio-artifact",
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

      const files = generatePortfolioArtifact(input);

      // Defense-in-depth H3 guard: the generator's fixed copy is honest by
      // construction, but it interpolates author-authored fields (project
      // title, skills, step titles). Run the assembled bundle through the
      // CANONICAL banned-claim guard and fail closed rather than ever serve a
      // recruiter-facing artifact that over-claims (e.g. an authored title
      // containing "tamper-proof"). This is belt-and-suspenders over the
      // authoring-time `audit:authoring` + source guard.
      const banned = findBannedClaims(Object.values(files).join("\n"));
      if (banned.length > 0) {
        req.log.error(
          { banned, projectSlug: input.project.slug },
          "Portfolio artifact blocked: banned honest-claim pattern in author copy",
        );
        res.status(500).json({ error: "Failed to build portfolio artifact" });
        return;
      }

      res.json({ projectSlug: input.project.slug, generatedAt, files });
    } catch (err) {
      req.log.error({ err }, "Failed to build portfolio artifact");
      res.status(500).json({ error: "Failed to build portfolio artifact" });
    }
  },
);

export default router;
