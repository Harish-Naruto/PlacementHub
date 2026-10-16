import { Router } from "express";
import authRoutes from "./auth.routes.ts";
import recruiterRoutes from "./recruiter.routes.ts";
import skillsRoutes from "./skills.routes.ts";

export default function routes() {
  const router = Router();

  router.get("/ping", (_req, res) => {
    res.status(200).json({ message: "pong", status: "API is working" });
  });

  router.use("/auth", authRoutes);
  router.use("/recruiters", recruiterRoutes);
  router.use("/skills", skillsRoutes);

  return router;
}