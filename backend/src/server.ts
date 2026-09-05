import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import projectsRouter from "./modules/projects/projects.routes.js";
import milestonesRouter from "./modules/milestones/milestones.routes.js";
import criteriaRouter from "./modules/criteria/criteria.routes.js";
import submissionsRouter from "./modules/submissions/submissions.routes.js";
import verificationRouter from "./modules/verification/verification.routes.js";
import aiRouter from "./modules/ai/ai.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use("/api/projects", projectsRouter);
app.use("/api", milestonesRouter);
app.use("/api", criteriaRouter);
app.use("/api", submissionsRouter);
app.use("/api", verificationRouter);
app.use("/api", aiRouter);



app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "workseal-backend",
  });
});

app.listen(PORT, () => {
  console.log(`Workseal backend running on http://localhost:${PORT}`);
});