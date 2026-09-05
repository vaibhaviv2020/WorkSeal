import { Router } from "express";
import type { Request, Response } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        error: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || user.password !== password) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    req.session.userId = user.id;

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);

    return res.status(500).json({
      error: "Internal server error.",
    });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout failed:", error);

      return res.status(500).json({
        error: "Unable to logout.",
      });
    }

    res.clearCookie("connect.sid");

    return res.status(200).json({
      message: "Logged out successfully.",
    });
  });
});

export default router;