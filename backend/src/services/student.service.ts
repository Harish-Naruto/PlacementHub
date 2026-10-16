import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import type { UpdateProfileInput } from "../validators/student.validator.ts";

// Fixed institutions — seeded once; never fetched from GitHub
export const FIXED_INSTITUTIONS = [
  { id: "a1b2c3d4-0001-0001-0001-000000000001", name: "D.Y. Patil University", slug: "dpu-pune", city: "Pune", state: "Maharashtra" },
  { id: "a1b2c3d4-0002-0002-0002-000000000002", name: "Indian Institute of Technology Bombay", slug: "iit-bombay", city: "Mumbai", state: "Maharashtra" },
  { id: "a1b2c3d4-0003-0003-0003-000000000003", name: "COEP Technological University", slug: "coep-pune", city: "Pune", state: "Maharashtra" },
  { id: "a1b2c3d4-0004-0004-0004-000000000004", name: "Pune Institute of Computer Technology", slug: "pict-pune", city: "Pune", state: "Maharashtra" },
] as const;

// ---------------------------------------------------------------------------
// Get own student profile (creates bare record if missing)
// ---------------------------------------------------------------------------
export async function getStudentProfile(userId: string) {
  // Ensure profile exists
  let profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      institution: true,
      skills: {
        include: { skill: true },
        orderBy: { createdAt: "asc" },
      },
      projects: {
        include: { skills: { include: { skill: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!profile) {
    const defaultInst = await prisma.institution.findFirst();
    profile = await prisma.studentProfile.create({
      data: {
        userId,
        ...(defaultInst ? { institutionId: defaultInst.id } : {}),
      },
      include: {
        institution: true,
        skills: { include: { skill: true } },
        projects: { include: { skills: { include: { skill: true } } } },
      },
    });
  }

  return profile;
}

// ---------------------------------------------------------------------------
// Update profile — strict allowlist, no role / ownership mutation
// ---------------------------------------------------------------------------
export async function updateStudentProfile(userId: string, input: UpdateProfileInput) {
  // Validate institution if provided
  if (input.institutionId) {
    let inst = await prisma.institution.findUnique({
      where: { id: input.institutionId },
    });

    if (!inst) {
      const valid = FIXED_INSTITUTIONS.find((i) => i.id === input.institutionId);
      if (valid) {
        inst = await prisma.institution.upsert({
          where: { id: valid.id },
          update: {},
          create: {
            id: valid.id,
            name: valid.name,
            slug: valid.slug,
            city: valid.city,
            state: valid.state,
          },
        });
      }
    }

    if (!inst) {
      throw new ApiError("Invalid institution ID", 400);
    }
  }

  // Ensure profile exists
  const existing = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!existing) {
    const defaultInst = input.institutionId || (await prisma.institution.findFirst())?.id;
    await prisma.studentProfile.create({
      data: {
        userId,
        ...(defaultInst ? { institutionId: defaultInst } : {}),
      },
    });
  }

  // Allowlisted fields only
  const updated = await prisma.studentProfile.update({
    where: { userId },
    data: {
      ...(input.institutionId !== undefined && { institutionId: input.institutionId }),
      ...(input.branch !== undefined && { branch: input.branch }),
      ...(input.degree !== undefined && { degree: input.degree }),
      ...(input.graduationYear !== undefined && { graduationYear: input.graduationYear }),
      ...(input.cgpa !== undefined && { cgpa: input.cgpa }),
      ...(input.githubUsername !== undefined && { githubUsername: input.githubUsername }),
      ...(input.linkedinUrl !== undefined && { linkedinUrl: input.linkedinUrl }),
      ...(input.bio !== undefined && { bio: input.bio }),
    },
    include: { institution: true },
  });

  // If name provided, update User table
  if (input.name) {
    await prisma.user.update({
      where: { id: userId },
      data: { name: input.name },
    });
  }

  return updated;
}

// ---------------------------------------------------------------------------
// List fixed institutions
// ---------------------------------------------------------------------------
export function listInstitutions() {
  return FIXED_INSTITUTIONS;
}
