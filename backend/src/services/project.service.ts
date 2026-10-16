import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import type { CreateProjectInput, UpdateProjectInput } from "../validators/student.validator.ts";

// Resolve or create skill by name (for project tech stack)
async function resolveOrCreateSkill(name: string) {
  let skill = await prisma.skill.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (skill) return skill;

  const alias = await prisma.skillAlias.findFirst({
    where: { alias: { equals: name, mode: "insensitive" } },
    include: { skill: true },
  });
  if (alias) return alias.skill;

  return prisma.skill.create({ data: { name: name.trim() } });
}

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
    profile = await prisma.studentProfile.create({ data: { userId } });
  }

  const skillNames = input.skillNames ?? [];

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        studentProfileId: profile.id,
        title: input.title,
        description: input.description,
        personalContribution: input.personalContribution ?? null,
        repositoryUrl: input.repositoryUrl ?? null,
        demoUrl: input.demoUrl ?? null,
        status: input.status ?? "DRAFT",
      },
    });

    for (const name of skillNames) {
      const skill = await resolveOrCreateSkill(name);
      await tx.projectSkill.create({
        data: { projectId: project.id, skillId: skill.id },
      }).catch(() => {}); // Skip duplicate
    }

    return tx.project.findUnique({
      where: { id: project.id },
      include: { skills: { include: { skill: true } } },
    });
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

  return prisma.$transaction(async (tx) => {
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

    if (input.skillNames !== undefined) {
      // Replace tech stack
      await tx.projectSkill.deleteMany({ where: { projectId } });
      for (const name of skillNames) {
        const skill = await resolveOrCreateSkill(name);
        await tx.projectSkill.create({
          data: { projectId, skillId: skill.id },
        }).catch(() => {});
      }
    }

    return tx.project.findUnique({
      where: { id: projectId },
      include: { skills: { include: { skill: true } } },
    });
  });
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
