import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import type { AddSkillInput, UpdateSkillInput } from "../validators/student.validator.ts";

// ---------------------------------------------------------------------------
// Map SkillVerificationStatus to friendly labels
// ---------------------------------------------------------------------------
export function mapVerificationStatus(status: string) {
  switch (status) {
    case "EVALUATED": return "VERIFIED";
    case "REPOSITORY_OBSERVED": return "OBSERVED";
    default: return "UNVERIFIED";
  }
}

// ---------------------------------------------------------------------------
// Normalize skill name (for alias resolution and dedup)
// ---------------------------------------------------------------------------
function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Resolve skill by name or alias
// ---------------------------------------------------------------------------
async function resolveOrCreateSkill(skillName: string) {
  const normalized = normalizeSkillName(skillName);

  // Try exact name match first (case-insensitive)
  let skill = await prisma.skill.findFirst({
    where: { name: { equals: skillName, mode: "insensitive" } },
  });
  if (skill) return skill;

  // Try alias match
  const alias = await prisma.skillAlias.findFirst({
    where: { alias: { equals: skillName, mode: "insensitive" } },
    include: { skill: true },
  });
  if (alias) return alias.skill;

  // Create new custom skill
  skill = await prisma.skill.create({
    data: { name: skillName.trim() },
  });

  return skill;
}

// ---------------------------------------------------------------------------
// List catalog skills
// ---------------------------------------------------------------------------
export async function getCatalogSkills() {
  return prisma.skill.findMany({
    include: { aliases: true },
    orderBy: { name: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Get student skills with friendly status labels
// ---------------------------------------------------------------------------
export async function getStudentSkills(userId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) return [];

  const skills = await prisma.studentSkill.findMany({
    where: { studentProfileId: profile.id },
    include: { skill: true },
    orderBy: { createdAt: "asc" },
  });

  return skills.map((s) => ({
    id: s.id,
    skillId: s.skillId,
    skillName: s.skill.name,
    declaredLevel: s.declaredLevel,
    verificationStatus: s.verificationStatus,
    verificationLabel: mapVerificationStatus(s.verificationStatus),
    createdAt: s.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Add skill to student profile
// ---------------------------------------------------------------------------
export async function addStudentSkill(userId: string, input: AddSkillInput) {
  let profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.studentProfile.create({ data: { userId } });
  }

  const skill = await resolveOrCreateSkill(input.skillName);

  // Check for duplicate
  const existing = await prisma.studentSkill.findUnique({
    where: { studentProfileId_skillId: { studentProfileId: profile.id, skillId: skill.id } },
  });
  if (existing) throw new ApiError("You already have this skill", 409);

  const studentSkill = await prisma.studentSkill.create({
    data: {
      studentProfileId: profile.id,
      skillId: skill.id,
      declaredLevel: input.declaredLevel ?? null,
      // IMPORTANT: Server always assigns SELF_DECLARED — never trust client
      verificationStatus: "SELF_DECLARED",
    },
    include: { skill: true },
  });

  return {
    id: studentSkill.id,
    skillId: studentSkill.skillId,
    skillName: studentSkill.skill.name,
    declaredLevel: studentSkill.declaredLevel,
    verificationStatus: studentSkill.verificationStatus,
    verificationLabel: mapVerificationStatus(studentSkill.verificationStatus),
    createdAt: studentSkill.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Update student skill (proficiency level only — not verification status)
// ---------------------------------------------------------------------------
export async function updateStudentSkill(
  userId: string,
  studentSkillId: string,
  input: UpdateSkillInput,
) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw new ApiError("Student profile not found", 404);

  const ss = await prisma.studentSkill.findFirst({
    where: { id: studentSkillId, studentProfileId: profile.id },
    include: { skill: true },
  });
  if (!ss) throw new ApiError("Skill not found or does not belong to you", 404);

  const updated = await prisma.studentSkill.update({
    where: { id: studentSkillId },
    data: { declaredLevel: input.declaredLevel },
    include: { skill: true },
  });

  return {
    id: updated.id,
    skillName: updated.skill.name,
    declaredLevel: updated.declaredLevel,
    verificationStatus: updated.verificationStatus,
    verificationLabel: mapVerificationStatus(updated.verificationStatus),
  };
}

// ---------------------------------------------------------------------------
// Remove student skill
// ---------------------------------------------------------------------------
export async function removeStudentSkill(userId: string, studentSkillId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw new ApiError("Student profile not found", 404);

  const ss = await prisma.studentSkill.findFirst({
    where: { id: studentSkillId, studentProfileId: profile.id },
  });
  if (!ss) throw new ApiError("Skill not found or does not belong to you", 404);

  await prisma.studentSkill.delete({ where: { id: studentSkillId } });
  return { deleted: true };
}
