import { resolve, join } from "node:path";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import crypto from "node:crypto";
import type { Express } from "express";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const UPLOAD_DIR = resolve(process.cwd(), "uploads", "resumes");
export const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_RESUME_SIZE_BYTES ?? "5242880"); // 5 MB
export const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const ALLOWED_EXT = [".pdf", ".docx"];

// Magic bytes for validation
const MAGIC_PDF = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const MAGIC_DOCX = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK..

// ---------------------------------------------------------------------------
// Ensure upload directory exists
// ---------------------------------------------------------------------------

export function ensureUploadDir(): void {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Generate a safe storage filename
// ---------------------------------------------------------------------------

export function generateStorageName(ext: string): string {
  return `${crypto.randomUUID()}${ext}`;
}

// ---------------------------------------------------------------------------
// Get absolute path for a stored file
// ---------------------------------------------------------------------------

export function getFilePath(storageName: string): string {
  // Guard against directory traversal
  const base = resolve(UPLOAD_DIR, storageName);
  if (!base.startsWith(UPLOAD_DIR)) {
    throw new Error("Invalid storage path");
  }
  return base;
}

// ---------------------------------------------------------------------------
// Validate file buffer magic bytes
// ---------------------------------------------------------------------------

export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    return buffer.slice(0, 4).equals(MAGIC_PDF);
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return buffer.slice(0, 4).equals(MAGIC_DOCX);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Cleanup — delete file from disk safely
// ---------------------------------------------------------------------------

export function deleteFile(storagePath: string): void {
  try {
    const abs = getFilePath(storagePath);
    if (existsSync(abs)) {
      unlinkSync(abs);
    }
  } catch {
    // Best-effort — log in production
    console.warn(`[fileStorage] Could not delete file: ${storagePath}`);
  }
}
