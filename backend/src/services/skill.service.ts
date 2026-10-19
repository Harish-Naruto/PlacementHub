import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import type { AddSkillInput, UpdateSkillInput } from "../validators/student.validator.ts";
import { skillInfo } from "../skills/canonical.ts";

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
// Resolve skill by name or alias
// ---------------------------------------------------------------------------
export async function resolveOrCreateSkill(rawName: string) {
  // The shared taxonomy decides the canonical name, so "ReactJS" and "React.js" are one skill row.
  const known = skillInfo(rawName);
  const skillName = known?.name ?? rawName.trim();

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

  // Create the skill (with its category when the taxonomy knows it)
  try {
    skill = await prisma.skill.create({
      data: { name: skillName, ...(known ? { category: known.category } : {}) },
    });
  } catch (err) {
    // Another request created the same skill a moment ago (unique name): use that one.
    const raced = await prisma.skill.findFirst({ where: { name: { equals: skillName, mode: "insensitive" } } });
    if (!raced) throw err;
    skill = raced;
  }

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
// Get student skills with friendly status labels and resume associations
// ---------------------------------------------------------------------------
export async function getStudentSkills(userId: string, resumeId?: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) return [];

  // Fetch all parsed resumes for this user to map skills to their source resumes
  const userResumes = await prisma.parsedResume.findMany({
    where: { userId },
    select: { id: true, data: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const resumeMap = new Map<string, { id: string; name: string; createdAt: Date; skills: Set<string> }>();
  for (const r of userResumes) {
    const data = r.data as any;
    const skillsInResume = new Set<string>();
    for (const s of data?.skills || []) {
      const name = (s.canonical_name || s.name || "").trim().toLowerCase();
      if (name) skillsInResume.add(name);
    }
    resumeMap.set(r.id, {
      id: r.id,
      name: `Resume (${new Date(r.createdAt).toLocaleDateString()})`,
      createdAt: r.createdAt,
      skills: skillsInResume,
    });
  }

  const skills = await prisma.studentSkill.findMany({
    where: { studentProfileId: profile.id },
    include: { skill: true, evidence: true },
    orderBy: { createdAt: "asc" },
  });

  const formatted = skills.map((s) => {
    const normalizedName = s.skill.name.toLowerCase();

    // Collect resume IDs from SkillEvidence
    const evidenceResumeIds = s.evidence
      .filter((e) => e.sourceType === "OTHER" && e.sourceUrl && resumeMap.has(e.sourceUrl))
      .map((e) => e.sourceUrl!);

    // Also check content match against user's parsed resumes
    const matchedResumes: Array<{ id: string; name: string; createdAt: Date }> = [];
    for (const [rId, rMeta] of resumeMap.entries()) {
      if (rMeta.skills.has(normalizedName) || evidenceResumeIds.includes(rId)) {
        matchedResumes.push({ id: rId, name: rMeta.name, createdAt: rMeta.createdAt });
      }
    }

    return {
      id: s.id,
      skillId: s.skillId,
      skillName: s.skill.name,
      skill: {
        id: s.skill.id,
        name: s.skill.name,
        category: s.skill.category,
      },
      declaredLevel: s.declaredLevel,
      verificationStatus: s.verificationStatus,
      verificationLabel: mapVerificationStatus(s.verificationStatus),
      // Proof behind the status: assessment results and GitHub evidence (resume links use sourceType OTHER).
      proof: s.evidence
        .filter((e) => e.sourceType === "ASSESSMENT" || e.sourceType === "GITHUB_REPOSITORY")
        .map((e) => ({
          id: e.id,
          sourceType: e.sourceType,
          sourceUrl: e.sourceUrl,
          description: e.description,
          status: e.status,
          createdAt: e.createdAt,
        })),
      resumeIds: matchedResumes.map((r) => r.id),
      resumes: matchedResumes,
      primaryResumeId: matchedResumes[0]?.id || null,
      createdAt: s.createdAt,
    };
  });

  if (resumeId) {
    return formatted.filter((s) => s.resumeIds.includes(resumeId));
  }

  return formatted;
}

// ---------------------------------------------------------------------------
// Add skill to student profile
// ---------------------------------------------------------------------------
export async function addStudentSkill(userId: string, input: AddSkillInput) {
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
    skill: {
      id: studentSkill.skill.id,
      name: studentSkill.skill.name,
      category: studentSkill.skill.category,
    },
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
