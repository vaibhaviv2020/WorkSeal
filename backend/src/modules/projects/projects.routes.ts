import { Router } from "express";
import prisma from "../../lib/prisma.js";

const router = Router();

// POST /api/projects
router.post("/", async (req, res) => {
  try {
    const { ownerId, name } = req.body;

    if (!ownerId || !name) {
      return res.status(400).json({
        error: "ownerId and name are required",
      });
    }

    const project = await prisma.project.create({
      data: {
        ownerId,
        name,
      },
    });

    return res.status(201).json(project);
  } catch (error) {
    console.error("Create project error:", error);

    return res.status(500).json({
      error: "Failed to create project",
    });
  }
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: {
        id,
      },
      include: {
        milestones: {
          include: {
            criteria: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    return res.json(project);
  } catch (error) {
    console.error("Get project error:", error);

    return res.status(500).json({
      error: "Failed to fetch project",
    });
  }
});

export default router;