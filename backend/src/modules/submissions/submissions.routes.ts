import { Router } from "express";
import prisma from "../../lib/prisma.js";

const router = Router();

// POST /api/milestones/:milestoneId/submissions
router.post("/milestones/:milestoneId/submissions", async (req, res) => {
  try {
    const { milestoneId } = req.params;
    const { appUrl, credentialsRef } = req.body;

    if (!appUrl || !credentialsRef) {
      return res.status(400).json({
        error: "appUrl and credentialsRef are required",
      });
    }

    const milestone = await prisma.milestone.findUnique({
      where: {
        id: milestoneId,
      },
    });

    if (!milestone) {
      return res.status(404).json({
        error: "Milestone not found",
      });
    }

    const latestSubmission = await prisma.submission.findFirst({
      where: {
        milestoneId,
      },
      orderBy: {
        version: "desc",
      },
    });

    const version = latestSubmission
      ? latestSubmission.version + 1
      : 1;

    const submission = await prisma.submission.create({
      data: {
        milestoneId,
        version,
        appUrl,
        credentialsRef,
      },
    });

    return res.status(201).json(submission);
  } catch (error) {
    console.error("Create submission error:", error);

    return res.status(500).json({
      error: "Failed to create submission",
    });
  }
});

export default router;