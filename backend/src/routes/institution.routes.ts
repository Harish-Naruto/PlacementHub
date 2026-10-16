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
      for (const inst of FIXED_INSTITUTIONS) {
        await prisma.institution.upsert({
          where: { id: inst.id },
          update: {},
          create: { ...inst },
        });
      }
      institutions = await prisma.institution.findMany({
        orderBy: { name: "asc" },
      });
    }

    res.status(200).json({ error: false, data: institutions });
  } catch (err) {
    res.status(200).json({ error: false, data: FIXED_INSTITUTIONS });
  }
});

export default router;
