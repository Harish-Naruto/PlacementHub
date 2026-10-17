// One place where an application changes status, so students, recruiters and the placement team
// all see the same validated history (ApplicationEvent).

import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import { checkTransition, STAGES, stageOf, type ApplicationStatus, type Stage } from "../pipeline/transitions.ts";

const APPLICATION_INCLUDE = {
  jobPosting: { select: { id: true, title: true, companyId: true, recruiterProfileId: true, company: { select: { id: true, name: true } } } },
  studentProfile: { select: { id: true, branch: true, graduationYear: true, cgpa: true, user: { select: { name: true, email: true } } } },
  events: { orderBy: { createdAt: "asc" as const }, include: { actor: { select: { name: true, role: true } } } },
};

export interface ChangeStatusInput {
  applicationId: string;
  actorUserId: string;
  to: ApplicationStatus;
  note?: string | null;
  /** A recruiter may only touch applications on their own jobs. */
  recruiterProfileId?: string;
}

export async function changeApplicationStatus(input: ChangeStatusInput) {
  const app = await prisma.application.findUnique({
    where: { id: input.applicationId },
    include: { jobPosting: { select: { recruiterProfileId: true } } },
  });
  if (!app || (input.recruiterProfileId && app.jobPosting.recruiterProfileId !== input.recruiterProfileId)) {
    throw new ApiError("Application not found", 404);
  }

  const check = checkTransition(app.status, input.to);
  if (!check.ok) {
    const next = check.allowed.length ? ` Allowed next: ${check.allowed.join(", ")}.` : "";
    throw new ApiError(`${check.reason}.${next}`, 409, true, "INVALID_TRANSITION");
  }

  return prisma.$transaction(async (tx) => {
    // The status in the WHERE makes a concurrent change fail instead of overwriting it.
    const moved = await tx.application.updateMany({ where: { id: app.id, status: app.status }, data: { status: input.to } });
    if (moved.count === 0) throw new ApiError("The application changed while you were updating it. Reload and try again.", 409, true, "STALE_STATUS");
    await tx.applicationEvent.create({
      data: { applicationId: app.id, actorUserId: input.actorUserId, fromStatus: app.status, toStatus: input.to, note: input.note?.trim().slice(0, 1000) || null },
    });
    return tx.application.findUniqueOrThrow({ where: { id: app.id }, include: APPLICATION_INCLUDE });
  });
}

export interface BoardFilter {
  stage?: Stage;
  jobId?: string;
  recruiterProfileId?: string;
  institutionId?: string;
}

/** Applications with student and job briefs, newest first. Used by the placement board and recruiter lists. */
export async function listApplications(filter: BoardFilter) {
  const rows = await prisma.application.findMany({
    where: {
      ...(filter.jobId ? { jobPostingId: filter.jobId } : {}),
      ...(filter.stage ? { status: { in: STAGES[filter.stage] } } : {}),
      ...(filter.recruiterProfileId ? { jobPosting: { recruiterProfileId: filter.recruiterProfileId } } : {}),
      ...(filter.institutionId ? { studentProfile: { institutionId: filter.institutionId } } : {}),
    },
    omit: { resumeSnapshot: true },
    include: {
      jobPosting: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
      studentProfile: { select: { id: true, branch: true, graduationYear: true, cgpa: true, user: { select: { name: true, email: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return rows.map((a) => ({ ...a, stage: stageOf(a.status) }));
}

export async function getApplicationDetail(applicationId: string, recruiterProfileId?: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: APPLICATION_INCLUDE });
  if (!app || (recruiterProfileId && app.jobPosting.recruiterProfileId !== recruiterProfileId)) throw new ApiError("Application not found", 404);
  return { ...app, stage: stageOf(app.status) };
}
