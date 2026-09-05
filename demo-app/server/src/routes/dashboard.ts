import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const userId = req.session.userId;

    const [open, inProgress, resolved] = await Promise.all([
      prisma.ticket.count({
        where: {
          userId,
          status: "OPEN",
        },
      }),

      prisma.ticket.count({
        where: {
          userId,
          status: "IN_PROGRESS",
        },
      }),

      prisma.ticket.count({
        where: {
          userId,
          status: "RESOLVED",
        },
      }),
    ]);

    return res.status(200).json({
      open,
      inProgress,
      resolved,
    });
  } catch (error) {
    console.error("Dashboard request failed:", error);

    return res.status(500).json({
      error: "Internal server error.",
    });
  }
});

export default router;