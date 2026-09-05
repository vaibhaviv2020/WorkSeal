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

    const tickets = await prisma.ticket.findMany({
      where: {
        userId: req.session.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      tickets,
    });
  } catch (error) {
    console.error("Ticket history request failed:", error);

    return res.status(500).json({
      error: "Internal server error.",
    });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const ticketId = Number(req.params.id);

    if (!Number.isInteger(ticketId)) {
      return res.status(400).json({
        error: "Invalid ticket ID.",
      });
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        userId: req.session.userId,
      },
    });

    if (!ticket) {
      return res.status(404).json({
        error: "Ticket not found.",
      });
    }

    return res.status(200).json({
      ticket,
    });
  } catch (error) {
    console.error("Ticket details request failed:", error);

    return res.status(500).json({
      error: "Internal server error.",
    });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    if (process.env.DEMO_FAILURE_MODE === "true") {
  return res.status(500).json({
    error: "Demo failure mode is enabled.",
  });
}
    if (!req.session.userId) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const { subject, description, priority } = req.body;

    if (
      typeof subject !== "string" ||
      typeof description !== "string" ||
      typeof priority !== "string" ||
      !subject.trim() ||
      !description.trim() ||
      !priority.trim()
    ) {
      return res.status(400).json({
        error: "Subject, description, and priority are required.",
      });
    }

    const ticket = await prisma.ticket.create({
  data: {
    subject: subject.trim(),
    description: description.trim(),
    priority: priority.trim(),
    status: "OPEN",
    userId: req.session.userId,
  },
});

    return res.status(201).json({
      ticket,
    });
  } catch (error) {
    console.error("Ticket creation failed:", error);

    return res.status(500).json({
      error: "Internal server error.",
    });
  }
});

export default router;