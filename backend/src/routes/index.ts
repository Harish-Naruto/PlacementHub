import { Router } from "express";
import authRoutes from "./auth.routes.ts";
import resumeRoutes from "./resume.ts";
import assessmentRoutes from "./assessment.routes.ts";

export default function routes() {
  const router = Router();

  router.get("/ping", (_req, res) => {
    res.status(200).json({ message: "pong", status: "API is working" });
  });

  router.use("/resumes", resumeRoutes);
  router.use("/auth", authRoutes);
  router.use("/assessments", assessmentRoutes);

  return router;
}