import { Router } from "express";
import { FIXED_INSTITUTIONS } from "../services/student.service.ts";
import prisma from "../config/prisma.ts";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    // Try DB first, fallback to fixed institutions
    let institutions = await prisma.institution.findMany({
      orderBy: { name: "asc" },
    });

    if (institutions.length === 0) {
      institutions = [...FIXED_INSTITUTIONS] as unknown as typeof institutions;
    }

    res.status(200).json({ error: false, data: institutions });
  } catch (err) {
    // Fallback to static list on any DB connection lag
    res.status(200).json({ error: false, data: FIXED_INSTITUTIONS });
  }
});

export default router;
