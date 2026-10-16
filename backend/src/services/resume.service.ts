import { ApiError } from "../utils/apiError.ts";
import prisma from "../config/prisma.ts";
import { extractText } from "../resume/extractText.ts";
import { parseResume } from "../resume/parseResume.ts";
import type { ParsedResume } from "../resume/schema.ts";
import type { Express } from "express";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Assessment generator and GitHub verifier can call this instead of re-parsing the file.
export async function getParsedResume(id: string): Promise<ParsedResume | null> {
  const row = await prisma.parsedResume.findUnique({ where: { id } });
  return row ? (row.data as unknown as ParsedResume) : null;
}

// ---------------------------------------------------------------------------
// Parse resume buffer and save structured data (raw file is not saved to DB)
// ---------------------------------------------------------------------------
export async function saveResume(userId: string, file?: Express.Multer.File) {
  if (!file) {
    throw new ApiError('Upload a resume in the "resume" field', 400, true, "NO_FILE");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ApiError("Resume file is too large (max 10MB)", 413, true, "FILE_TOO_LARGE");
  }

  // Extract text from memory buffer using pdf-parse or mammoth
  const text = await extractText(file.buffer);

  // Send extracted text to Gemini LLM for structured schema parsing
  const parsed = await parseResume(text);

  let row;
  try {
    row = await prisma.parsedResume.create({
      data: {
        userId,
        schemaVersion: parsed.schema_version,
        data: parsed as object,
      },
    });
  } catch {
    throw new ApiError("Could not save the parsed resume", 500, true, "SAVE_FAILED");
  }

  // Auto-sync extracted skills to student profile as SELF_DECLARED (mentioned by user)
  try {
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

    if (parsed.skills && Array.isArray(parsed.skills)) {
      for (const item of parsed.skills) {
        const skillName = (item.canonical_name || item.name || "").trim();
        if (!skillName) continue;

        let skill = await prisma.skill.findFirst({
          where: { name: { equals: skillName, mode: "insensitive" } },
        });
        if (!skill) {
          skill = await prisma.skill.create({
            data: { name: skillName, category: item.category || undefined },
          });
        }

        const existing = await prisma.studentSkill.findUnique({
          where: {
            studentProfileId_skillId: {
              studentProfileId: profile.id,
              skillId: skill.id,
            },
          },
        });

        if (!existing) {
          await prisma.studentSkill.create({
            data: {
              studentProfileId: profile.id,
              skillId: skill.id,
              declaredLevel: "INTERMEDIATE",
              verificationStatus: "SELF_DECLARED",
            },
          });
        }
      }
    }
  } catch (syncErr) {
    console.error("Non-fatal: could not auto-sync parsed skills to student profile:", syncErr);
  }

  return {
    success: true,
    message: "Resume uploaded and parsed successfully",
    id: row.id,
    fileName: file.originalname,
    fileSize: file.size,
    resume: parsed,
  };
}

export const parseAndSaveResume = saveResume;

// ---------------------------------------------------------------------------
// List student's parsed resumes
// ---------------------------------------------------------------------------
export async function listResumes(userId: string) {
  const rows = await prisma.parsedResume.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    schemaVersion: row.schemaVersion,
    resume: row.data,
    createdAt: row.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Get parsed resume by ID
// ---------------------------------------------------------------------------
export async function getResumeById(userId: string, id: string, role?: string) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const row = uuid.test(id) ? await prisma.parsedResume.findUnique({ where: { id } }) : null;

  if (!row || (row.userId !== userId && role !== "RECRUITER")) {
    throw new ApiError("Resume not found", 404, true, "NOT_FOUND");
  }

  return {
    id: row.id,
    schemaVersion: row.schemaVersion,
    resume: row.data,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Delete resume
// ---------------------------------------------------------------------------
export async function deleteResume(userId: string, id: string) {
  const row = await prisma.parsedResume.findUnique({ where: { id } });
  if (!row || row.userId !== userId) {
    throw new ApiError("Resume not found", 404, true, "NOT_FOUND");
  }

  await prisma.parsedResume.delete({ where: { id } });
  return { success: true, message: "Resume deleted successfully" };
}
