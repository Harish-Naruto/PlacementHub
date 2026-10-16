import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../config/prisma.ts";

const router = Router();

/**
 * GET /skills/search?q=react&category=Framework&limit=20
 * Public endpoint – search skills by name prefix/substring.
 * Used by the recruiter job-posting form to pick skill requirements.
 */
router.get("/search", async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  const category = (req.query.category as string | undefined)?.trim();
  const limit = Math.min(Math.max(1, parseInt((req.query.limit as string) ?? "20", 10)), 100);

  const skills = await prisma.skill.findMany({
    where: {
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, category: true },
    orderBy: [
      // exact prefix first, then alphabetical
      { name: "asc" },
    ],
    take: limit,
  });

  res.status(200).json({ error: false, data: { skills } });
});

/**
 * GET /skills/categories
 * Public endpoint – list all distinct skill categories.
 */
router.get("/categories", async (_req: Request, res: Response) => {
  const rows = await prisma.skill.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  const categories = rows.map((r) => r.category).filter(Boolean);
  res.status(200).json({ error: false, data: { categories } });
});

export default router;
