import { Router } from "express";
import authRoutes from "./auth.routes.ts";
import studentRoutes from "./student.routes.ts";
import jobRoutes from "./job.routes.ts";
import institutionRoutes from "./institution.routes.ts";

export default function routes() {
  const router = Router();

  router.get("/ping", (_req, res) => {
    res.status(200).json({ message: "pong", status: "API is working" });
  });

  router.use("/auth", authRoutes);
  router.use("/students", studentRoutes);
  router.use("/jobs", jobRoutes);
  router.use("/institutions", institutionRoutes);

  return router;
}