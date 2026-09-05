import { Router } from "express";
import prisma from "../../lib/prisma.js";

const router = Router();

// POST /api/projects/:projectId/milestones
router.post("/projects/:projectId/milestones", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, amount, currency } = req.body;

    if (!name || amount === undefined || !currency) {
      return res.status(400).json({
        error: "name, amount and currency are required",
      });
    }

    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const milestone = await prisma.milestone.create({
      data: {
        projectId,
        name,
        amount,
        currency,
      },
    });

    return res.status(201).json(milestone);
  } catch (error) {
    console.error("Create milestone error:", error);

    return res.status(500).json({
      error: "Failed to create milestone",
    });
  }
});

// GET /api/milestones/:id
router.get("/milestones/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const milestone = await prisma.milestone.findUnique({
      where: {
        id,
      },
      include: {
        project: true,
        criteria: true,
      },
    });

    if (!milestone) {
      return res.status(404).json({
        error: "Milestone not found",
      });
    }

    return res.json(milestone);
  } catch (error) {
    console.error("Get milestone error:", error);

    return res.status(500).json({
      error: "Failed to fetch milestone",
    });
  }
});

export default router;