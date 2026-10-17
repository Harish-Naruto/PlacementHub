// ---------------------------------------------------------------------------
// Prisma implementation of the skill-evidence repository, plus the entry point
// that persists a scored assessment into StudentSkill + SkillEvidence.
// ---------------------------------------------------------------------------

import prisma from "../config/prisma.ts";
import {
  applySkillPlan,
  planSkillPersistence,
  type PersistenceSummary,
  type SkillEvidenceRepo,
  type StudentSkillStatus,
} from "../scoring/skillPersistence.ts";
import type { CombinedSkillResult } from "../scoring/skillScoring.ts";
import { resolveOrCreateSkill } from "./skill.service.ts";

export const prismaSkillEvidenceRepo: SkillEvidenceRepo = {
  async getProfileId(userId) {
    const existing = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    if (existing) return existing.id;
    const defaultInst = await prisma.institution.findFirst();
    const created = await prisma.studentProfile.create({
      data: { userId, ...(defaultInst ? { institutionId: defaultInst.id } : {}) },
      select: { id: true },
    });
    return created.id;
  },

  async resolveSkillId(name) {
    return (await resolveOrCreateSkill(name)).id;
  },

  async ensureStudentSkill(profileId, skillId) {
    const key = { studentProfileId_skillId: { studentProfileId: profileId, skillId } };
    const found = await prisma.studentSkill.findUnique({ where: key, select: { id: true, verificationStatus: true } });
    if (found) return found;
    return prisma.studentSkill.create({
      data: { studentProfileId: profileId, skillId, verificationStatus: "SELF_DECLARED" },
      select: { id: true, verificationStatus: true },
    });
  },

  async setVerificationStatus(studentSkillId, status: StudentSkillStatus) {
    await prisma.studentSkill.update({ where: { id: studentSkillId }, data: { verificationStatus: status } });
  },

  async upsertEvidence(studentSkillId, e) {
    // System-evaluated rows are stamped as reviewed; plain observations are not.
    const reviewedAt = e.status === "OBSERVED" ? null : new Date();
    const existing = await prisma.skillEvidence.findFirst({
      where: { studentSkillId, sourceType: e.sourceType, sourceUrl: e.sourceUrl },
      select: { id: true },
    });
    if (existing) {
      await prisma.skillEvidence.update({
        where: { id: existing.id },
        data: { description: e.description, status: e.status, reviewedAt },
      });
      return "updated";
    }
    await prisma.skillEvidence.create({
      data: { studentSkillId, sourceType: e.sourceType, sourceUrl: e.sourceUrl, description: e.description, status: e.status, reviewedAt },
    });
    return "created";
  },
};

/** Writes the scored skills for one assessment session to the student's skill profile. Idempotent. */
export function persistSkillVerification(
  userId: string,
  sessionId: string,
  results: CombinedSkillResult[],
): Promise<PersistenceSummary> {
  return applySkillPlan(prismaSkillEvidenceRepo, userId, planSkillPersistence(results, { sessionId }));
}
