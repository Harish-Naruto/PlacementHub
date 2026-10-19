import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import type { CreateProjectInput, UpdateProjectInput } from "../validators/student.validator.ts";
import { resolveOrCreateSkill as resolveSkill } from "./skill.service.ts";

// Project tech stacks use the same skill resolution as everything else (taxonomy aware).
const resolveOrCreateSkill = resolveSkill;

// ---------------------------------------------------------------------------
// List own projects
// ---------------------------------------------------------------------------
export async function listProjects(userId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) return [];

  return prisma.project.findMany({
    where: { studentProfileId: profile.id },
    include: { skills: { include: { skill: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Get single project
// ---------------------------------------------------------------------------
export async function getProject(userId: string, projectId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw new ApiError("Student profile not found", 404);

  const project = await prisma.project.findFirst({
    where: { id: projectId, studentProfileId: profile.id },
    include: { skills: { include: { skill: true } } },
  });
  if (!project) throw new ApiError("Project not found or does not belong to you", 404);

  return project;
}

// ---------------------------------------------------------------------------
// Create project with tech stack in a transaction
// ---------------------------------------------------------------------------
export async function createProject(userId: string, input: CreateProjectInput) {
  let profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) {
    const defaultInst = await prisma.institution.findFirst();
    profile = await prisma.studentProfile.create({
      data: {
        userId,
        ...(defaultInst ? { institutionId: defaultInst.id } : {}),
      },
    });
  }

  const skillNames = input.skillNames ?? [];

  // Resolve all skills before writing (avoids multiple network roundtrips inside a transaction)
  const resolvedSkills = await Promise.all(
    skillNames.map((name) => resolveOrCreateSkill(name)),
  );

  return prisma.project.create({
    data: {
      studentProfileId: profile.id,
      title: input.title,
      description: input.description,
      personalContribution: input.personalContribution ?? null,
      repositoryUrl: input.repositoryUrl ?? null,
      demoUrl: input.demoUrl ?? null,
      status: input.status ?? "DRAFT",
      skills: {
        create: resolvedSkills.map((skill) => ({
          skillId: skill.id,
        })),
      },
    },
    include: {
      skills: { include: { skill: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Update project (ownership verified)
// ---------------------------------------------------------------------------
export async function updateProject(
  userId: string,
  projectId: string,
  input: UpdateProjectInput,
) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw new ApiError("Student profile not found", 404);

  const existing = await prisma.project.findFirst({
    where: { id: projectId, studentProfileId: profile.id },
  });
  if (!existing) throw new ApiError("Project not found or does not belong to you", 404);

  const skillNames = input.skillNames ?? [];

  // Resolve skills outside of transaction
  const resolvedSkills = input.skillNames !== undefined
    ? await Promise.all(skillNames.map((name) => resolveOrCreateSkill(name)))
    : null;

  return prisma.$transaction(
    async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.description && { description: input.description }),
          ...(input.personalContribution !== undefined && { personalContribution: input.personalContribution }),
          ...(input.repositoryUrl !== undefined && { repositoryUrl: input.repositoryUrl }),
          ...(input.demoUrl !== undefined && { demoUrl: input.demoUrl }),
          ...(input.status && { status: input.status }),
        },
      });

      if (resolvedSkills) {
        await tx.projectSkill.deleteMany({ where: { projectId } });
        if (resolvedSkills.length > 0) {
          await tx.projectSkill.createMany({
            data: resolvedSkills.map((s) => ({ projectId, skillId: s.id })),
            skipDuplicates: true,
          });
        }
      }

      return tx.project.findUnique({
        where: { id: projectId },
        include: { skills: { include: { skill: true } } },
      });
    },
    { timeout: 20000, maxWait: 10000 },
  );
}

// ---------------------------------------------------------------------------
// Delete project (ownership verified)
// ---------------------------------------------------------------------------
export async function deleteProject(userId: string, projectId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw new ApiError("Student profile not found", 404);

  const existing = await prisma.project.findFirst({
    where: { id: projectId, studentProfileId: profile.id },
  });
  if (!existing) throw new ApiError("Project not found or does not belong to you", 404);

  await prisma.project.delete({ where: { id: projectId } });
  return { deleted: true };
}
