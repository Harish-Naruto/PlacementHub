export type Role = "STUDENT" | "RECRUITER" | "PLACEMENT";

/** Where each role lands after signing in. */
export const homeFor = (role: Role): string => (role === "RECRUITER" ? "/recruiter" : role === "PLACEMENT" ? "/placement" : "/dashboard");

export const ROLE_LABEL: Record<Role, string> = { STUDENT: "Student Candidate", RECRUITER: "Hiring Recruiter", PLACEMENT: "Placement Team" };
