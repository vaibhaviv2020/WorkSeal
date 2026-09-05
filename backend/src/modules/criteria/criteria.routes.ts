import { Router } from "express";
import prisma from "../../lib/prisma.js";

const router = Router();

// POST /api/milestones/:milestoneId/criteria
router.post("/milestones/:milestoneId/criteria", async (req, res) => {
  try {
    const { milestoneId } = req.params;
    const { description, blocking } = req.body;

    if (!description) {
      return res.status(400).json({
        error: "description is required",
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

    const criterion = await prisma.criterion.create({
      data: {
        milestoneId,
        description,
        blocking: blocking ?? true,
      },
    });

    return res.status(201).json(criterion);
  } catch (error) {
    console.error("Create criterion error:", error);

    return res.status(500).json({
      error: "Failed to create criterion",
    });
  }
});

// GET /api/milestones/:milestoneId/criteria
router.get("/milestones/:milestoneId/criteria", async (req, res) => {
  try {
    const { milestoneId } = req.params;

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

    const criteria = await prisma.criterion.findMany({
      where: {
        milestoneId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return res.json(criteria);
  } catch (error) {
    console.error("Get criteria error:", error);

    return res.status(500).json({
      error: "Failed to fetch criteria",
    });
  }
});

export default router;