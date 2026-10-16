import { z } from "zod";

// ---------------------------------------------------------------------------
// Password policy
// ---------------------------------------------------------------------------

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .max(320)
    .transform((e) => e.trim().toLowerCase()),
  name: z
    .string()
    .min(1, "Name is required")
    .max(160)
    .transform((n) => n.trim()),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`),
  role: z
    .string()
    .optional()
    .transform((r) => (r ? (r.toUpperCase() as "STUDENT" | "RECRUITER") : "STUDENT"))
    .refine((r) => r === "STUDENT" || r === "RECRUITER", {
      message: "Role must be STUDENT or RECRUITER",
    }),
  invitationCode: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1, "Password is required"),
  role: z
    .string()
    .optional()
    .transform((r) => (r ? (r.toUpperCase() as "STUDENT" | "RECRUITER") : undefined))
    .refine((r) => r === undefined || r === "STUDENT" || r === "RECRUITER", {
      message: "Role must be STUDENT or RECRUITER",
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;
