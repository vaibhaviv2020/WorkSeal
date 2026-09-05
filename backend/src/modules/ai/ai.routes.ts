import { Router } from "express";
import prisma from "../../lib/prisma.js";
import {
  generateVerificationPlan,
} from "./ai-planner.js";
import {
  getAllowedApplicationOrigins,
  validateVerificationPlan,
} from "./ai.schemas.js";


type PrismaClient = typeof prisma;

type GenerateVerificationPlan = typeof generateVerificationPlan;

export function createAIRouter(
  dependencies: {
    prisma?: PrismaClient;
    generateVerificationPlan?: GenerateVerificationPlan;
    getAllowedApplicationOrigins?: typeof getAllowedApplicationOrigins;
  } = {}
) {
  const db =
    dependencies.prisma ?? prisma;

  const generatePlan =
    dependencies.generateVerificationPlan ??
    generateVerificationPlan;

  const getAllowedOrigins =
    dependencies.getAllowedApplicationOrigins ??
    getAllowedApplicationOrigins;

  const router = Router();

  router.post(
    "/criteria/:criterionId/plan",
    async (req, res) => {
      try {
        const { criterionId } =
          req.params;

        if (!criterionId) {
          return res.status(400).json({
            error: "criterionId is required",
          });
        }

        const criterion =
          await db.criterion.findUnique({
            where: {
              id: criterionId,
            },
          });

        if (!criterion) {
          return res.status(404).json({
            error: "Criterion not found",
          });
        }

        const milestone =
          await db.milestone.findUnique({
            where: {
              id: criterion.milestoneId,
            },
            include: {
              submissions: {
                orderBy: {
                  version: "desc",
                },
                take: 1,
              },
            },
          });

        if (!milestone) {
          return res.status(404).json({
            error: "Milestone not found",
          });
        }

        const submission =
          milestone.submissions[0];

        if (!submission) {
          return res.status(400).json({
            error:
              "No submission exists for this milestone",
          });
        }

        const allowedOrigins =
          getAllowedOrigins();

        const submittedUrl =
          new URL(submission.appUrl);

        if (
          !allowedOrigins.includes(
            submittedUrl.origin
          )
        ) {
          return res.status(400).json({
            error:
              "Submission application URL is not allowlisted",
          });
        }

        const plan =
  await generatePlan({
    criterionId: criterion.id,
    criterionDescription:
      criterion.description,
    submissionId: submission.id,
    applicationUrl:
      submittedUrl.origin,
    capabilities: {
      browserActions: [],
      apiActions: [],
    },
    knownSelectors: {},
  });

await db.criterion.update({
  where: {
    id: criterion.id,
  },
  data: {
    aiInterpretation: plan,
  },
});

return res.json({
  plan,
});
      } catch (error) {
        console.error(
          "AI planning error:",
          error
        );

        return res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate verification plan",
        });
      }
    }
  );
  router.get(
  "/criteria/:criterionId/plan",
  async (req, res) => {
    try {
      const { criterionId } = req.params;

      if (!criterionId) {
        return res.status(400).json({
          error: "criterionId is required",
        });
      }

      const criterion =
        await db.criterion.findUnique({
          where: {
            id: criterionId,
          },
        });

      if (!criterion) {
        return res.status(404).json({
          error: "Criterion not found",
        });
      }

      if (criterion.aiInterpretation === null) {
        return res.status(404).json({
          error:
            "No validated plan exists for this criterion",
        });
      }

      const plan =
        validateVerificationPlan(
          criterion.aiInterpretation,
          criterion.id
        );

      return res.json({
        plan,
      });
    } catch (error) {
      console.error(
        "AI plan retrieval error:",
        error
      );

      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Stored verification plan is invalid",
      });
    }
  }
);
  return router;
}

const router = createAIRouter();

export default router;