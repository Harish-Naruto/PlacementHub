import { ApiError } from "../utils/apiError.ts";
import { extname } from "node:path";
import type { Express } from "express";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXT = [".pdf", ".docx"];
const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

// ---------------------------------------------------------------------------
// List resumes — mock / empty list while team implements DB model
// ---------------------------------------------------------------------------
export async function listResumes(_userId: string) {
  return [];
}

// ---------------------------------------------------------------------------
// Save resume — validates file and returns success message directly
// ---------------------------------------------------------------------------
export async function saveResume(
  _userId: string,
  file?: Express.Multer.File,
) {
  if (!file) {
    throw new ApiError("No resume file uploaded", 400);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ApiError("File exceeds maximum allowed size of 10 MB", 400);
  }

  const ext = extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new ApiError("Only PDF and DOCX files are accepted", 400);
  }

  const mimeType = file.mimetype?.toLowerCase();
  if (mimeType && !ALLOWED_MIME.includes(mimeType)) {
    throw new ApiError("Invalid file type. Only PDF and DOCX are allowed", 400);
  }

  return {
    success: true,
    message: "Resume uploaded successfully",
    fileName: file.originalname,
    fileSize: file.size,
  };
}

// ---------------------------------------------------------------------------
// Download resume stub
// ---------------------------------------------------------------------------
export async function getResumeFile(_userId: string, _resumeId: string) {
  throw new ApiError("Resume storage is being configured by the team", 501);
}

// ---------------------------------------------------------------------------
// Delete resume stub
// ---------------------------------------------------------------------------
export async function deleteResume(_userId: string, _resumeId: string) {
  return { success: true, message: "Resume deleted successfully" };
}
