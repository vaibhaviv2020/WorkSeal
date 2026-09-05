import { Router } from "express";
import prisma from "../../lib/prisma.js";
import {
  runCriterionVerification,
} from "../../orchestrator/verification-runner.js";
import {
  determineMilestoneDecision,
} from "./decision-engine.js";

const router = Router();

router.post(
  "/milestones/:milestoneId/verifications",
  async (req, res) => {
    try {
      const { milestoneId } = req.params;

      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: {
          criteria: true,
          submissions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      });

      if (!milestone) {
        return res.status(404).json({
          error: "Milestone not found",
        });
      }

      const submission = milestone.submissions[0];

      if (!submission) {
        return res.status(400).json({
          error: "No submission exists for this milestone",
        });
      }

      if (milestone.criteria.length === 0) {
        return res.status(400).json({
          error: "No criteria exist for this milestone",
        });
      }

      const run = await prisma.verificationRun.create({
        data: {
          milestoneId,
          submissionId: submission.id,
          status: "EXECUTING",
          startedAt: new Date(),
          tasks: {
            create: milestone.criteria.map((criterion) => ({
              criterionId: criterion.id,
              tool: "BROWSER",
              action: {},
              status: "EXECUTING",
            })),
          },
        },
        include: {
          tasks: true,
        },
      });

      const results = [];

for (const criterion of milestone.criteria) {
  const task = run.tasks.find(
    (item) => item.criterionId === criterion.id
  );

  if (!task) {
    continue;
  }

  const result = await runCriterionVerification({
    criterion: {
      id: criterion.id,
      description: criterion.description,
      aiInterpretation: criterion.aiInterpretation,
    },
    submission: {
      id: submission.id,
      appUrl: submission.appUrl,
    },
    runId: run.id,
    taskId: task.id,
  });

  results.push(result);
}

      const decision = determineMilestoneDecision(
        results.map((result) => {
          const criterion = milestone.criteria.find(
            (item) => item.id === result.criterionId
          );

          return {
            result: result.result,
            blocking: criterion?.blocking ?? true,
          };
        })
      );

      for (const result of results) {
        const task = run.tasks.find(
          (item) => item.criterionId === result.criterionId
        );

        if (!task) {
          continue;
        }

        await prisma.verificationTask.update({
          where: { id: task.id },
          data: {
            status: "COMPLETED",
            result: result.result,
          },
        });

        for (const evidence of result.evidence) {
          if (!evidence.path) {
            continue;
          }

          await prisma.evidence.create({
            data: {
              runId: run.id,
              taskId: task.id,
              criterionId: result.criterionId,
              type: evidence.type,
              path: evidence.path,
              metadata: {
                description: evidence.description,
                reason: result.reason,
              },
            },
          });
        }
      }

      const runResult =
        decision === "READY_FOR_APPROVAL"
          ? "PASS"
          : decision === "NOT_READY"
            ? "FAIL"
            : "UNCERTAIN";

      await prisma.verificationRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          overallResult: runResult,
          completedAt: new Date(),
        },
      });

      await prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          status:
            decision === "READY_FOR_APPROVAL"
              ? "READY_FOR_APPROVAL"
              : decision === "NOT_READY"
                ? "NOT_READY"
                : "REVIEW_REQUIRED",
        },
      });

      return res.status(201).json({
        runId: run.id,
        milestoneId,
        decision,
        overallResult: runResult,
        criteria: results,
      });
    } catch (error) {
      console.error("Verification run error:", error);

      return res.status(500).json({
        error: "Verification run failed",
      });
    }
  }
);

export default router;