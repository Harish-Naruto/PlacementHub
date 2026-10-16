-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'RECRUITER');

-- CreateEnum
CREATE TYPE "ProficiencyLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "SkillVerificationStatus" AS ENUM ('SELF_DECLARED', 'REPOSITORY_OBSERVED', 'EVALUATED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'EVALUATED', 'NEEDS_CHANGES');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('PROJECT', 'GITHUB_REPOSITORY', 'ASSESSMENT', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING', 'OBSERVED', 'EVALUATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'INTERNSHIP', 'CONTRACT', 'PART_TIME');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "JobRequirementType" AS ENUM ('REQUIRED', 'PREFERRED');

-- CreateEnum
CREATE TYPE "JobSourceType" AS ENUM ('RECRUITER_POSTED', 'PARTNER_POSTING', 'ALUMNI_REFERRAL', 'JOB_API', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'IN_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320),
    "name" VARCHAR(160),
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "profileImage" VARCHAR(2048),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "website" VARCHAR(2048),
    "city" VARCHAR(120),
    "state" VARCHAR(120),
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "branch" VARCHAR(120),
    "degree" VARCHAR(120),
    "graduationYear" INTEGER,
    "cgpa" DECIMAL(4,2),
    "githubUsername" VARCHAR(39),
    "linkedinUrl" VARCHAR(2048),
    "bio" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "jobTitle" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RecruiterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "website" VARCHAR(2048),
    "description" TEXT,
    "city" VARCHAR(120),
    "country" VARCHAR(100),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" UUID NOT NULL,
    "recruiterProfileId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "location" VARCHAR(200),
    "workMode" "WorkMode" NOT NULL DEFAULT 'ONSITE',
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "minimumCgpa" DECIMAL(4,2),
    "applicationDeadline" TIMESTAMPTZ(6),
    "externalUrl" VARCHAR(2048),
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEligibleBranch" (
    "jobPostingId" UUID NOT NULL,
    "branch" VARCHAR(120) NOT NULL,

    CONSTRAINT "JobEligibleBranch_pkey" PRIMARY KEY ("jobPostingId","branch")
);

-- CreateTable
CREATE TABLE "JobEligibleGraduationYear" (
    "jobPostingId" UUID NOT NULL,
    "graduationYear" INTEGER NOT NULL,

    CONSTRAINT "JobEligibleGraduationYear_pkey" PRIMARY KEY ("jobPostingId","graduationYear")
);

-- CreateTable
CREATE TABLE "JobSkillRequirement" (
    "jobPostingId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "requirementType" "JobRequirementType" NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 1.0,

    CONSTRAINT "JobSkillRequirement_pkey" PRIMARY KEY ("jobPostingId","skillId")
);

-- CreateTable
CREATE TABLE "JobSource" (
    "id" UUID NOT NULL,
    "jobPostingId" UUID NOT NULL,
    "sourceType" "JobSourceType" NOT NULL,
    "sourceUrl" VARCHAR(2048),
    "externalId" VARCHAR(255),
    "fingerprint" VARCHAR(255),
    "importedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillAlias" (
    "id" UUID NOT NULL,
    "alias" VARCHAR(120) NOT NULL,
    "skillId" UUID NOT NULL,

    CONSTRAINT "SkillAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSkill" (
    "id" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "declaredLevel" "ProficiencyLevel",
    "verificationStatus" "SkillVerificationStatus" NOT NULL DEFAULT 'SELF_DECLARED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "personalContribution" TEXT,
    "repositoryUrl" VARCHAR(2048),
    "demoUrl" VARCHAR(2048),
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSkill" (
    "projectId" UUID NOT NULL,
    "skillId" UUID NOT NULL,

    CONSTRAINT "ProjectSkill_pkey" PRIMARY KEY ("projectId","skillId")
);

-- CreateTable
CREATE TABLE "SkillEvidence" (
    "id" UUID NOT NULL,
    "studentSkillId" UUID NOT NULL,
    "projectId" UUID,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "sourceUrl" VARCHAR(2048),
    "description" TEXT,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ(6),

    CONSTRAINT "SkillEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "jobPostingId" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "resumeUrl" VARCHAR(2048),
    "appliedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "note" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- CreateIndex
CREATE INDEX "Institution_name_idx" ON "Institution"("name");

-- CreateIndex
CREATE INDEX "Institution_city_state_idx" ON "Institution"("city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentProfile_institutionId_graduationYear_idx" ON "StudentProfile"("institutionId", "graduationYear");

-- CreateIndex
CREATE INDEX "StudentProfile_institutionId_branch_idx" ON "StudentProfile"("institutionId", "branch");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterProfile_userId_key" ON "RecruiterProfile"("userId");

-- CreateIndex
CREATE INDEX "RecruiterProfile_companyId_idx" ON "RecruiterProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "JobPosting_status_applicationDeadline_idx" ON "JobPosting"("status", "applicationDeadline");

-- CreateIndex
CREATE INDEX "JobPosting_recruiterProfileId_status_idx" ON "JobPosting"("recruiterProfileId", "status");

-- CreateIndex
CREATE INDEX "JobPosting_createdAt_idx" ON "JobPosting"("createdAt");

-- CreateIndex
CREATE INDEX "JobEligibleBranch_branch_idx" ON "JobEligibleBranch"("branch");

-- CreateIndex
CREATE INDEX "JobEligibleGraduationYear_graduationYear_idx" ON "JobEligibleGraduationYear"("graduationYear");

-- CreateIndex
CREATE INDEX "JobSkillRequirement_skillId_requirementType_idx" ON "JobSkillRequirement"("skillId", "requirementType");

-- CreateIndex
CREATE UNIQUE INDEX "JobSource_fingerprint_key" ON "JobSource"("fingerprint");

-- CreateIndex
CREATE INDEX "JobSource_jobPostingId_idx" ON "JobSource"("jobPostingId");

-- CreateIndex
CREATE INDEX "JobSource_sourceType_externalId_idx" ON "JobSource"("sourceType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "Skill_category_idx" ON "Skill"("category");

-- CreateIndex
CREATE UNIQUE INDEX "SkillAlias_alias_key" ON "SkillAlias"("alias");

-- CreateIndex
CREATE INDEX "SkillAlias_skillId_idx" ON "SkillAlias"("skillId");

-- CreateIndex
CREATE INDEX "StudentSkill_skillId_verificationStatus_idx" ON "StudentSkill"("skillId", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSkill_studentProfileId_skillId_key" ON "StudentSkill"("studentProfileId", "skillId");

-- CreateIndex
CREATE INDEX "Project_studentProfileId_status_idx" ON "Project"("studentProfileId", "status");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectSkill_skillId_idx" ON "ProjectSkill"("skillId");

-- CreateIndex
CREATE INDEX "SkillEvidence_studentSkillId_status_idx" ON "SkillEvidence"("studentSkillId", "status");

-- CreateIndex
CREATE INDEX "SkillEvidence_projectId_idx" ON "SkillEvidence"("projectId");

-- CreateIndex
CREATE INDEX "Application_studentProfileId_status_idx" ON "Application"("studentProfileId", "status");

-- CreateIndex
CREATE INDEX "Application_jobPostingId_status_idx" ON "Application"("jobPostingId", "status");

-- CreateIndex
CREATE INDEX "Application_appliedAt_idx" ON "Application"("appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Application_studentProfileId_jobPostingId_key" ON "Application"("studentProfileId", "jobPostingId");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_createdAt_idx" ON "ApplicationEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationEvent_actorUserId_createdAt_idx" ON "ApplicationEvent"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterProfile" ADD CONSTRAINT "RecruiterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterProfile" ADD CONSTRAINT "RecruiterProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_recruiterProfileId_fkey" FOREIGN KEY ("recruiterProfileId") REFERENCES "RecruiterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEligibleBranch" ADD CONSTRAINT "JobEligibleBranch_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEligibleGraduationYear" ADD CONSTRAINT "JobEligibleGraduationYear_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSkillRequirement" ADD CONSTRAINT "JobSkillRequirement_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSkillRequirement" ADD CONSTRAINT "JobSkillRequirement_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSource" ADD CONSTRAINT "JobSource_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAlias" ADD CONSTRAINT "SkillAlias_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSkill" ADD CONSTRAINT "ProjectSkill_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSkill" ADD CONSTRAINT "ProjectSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEvidence" ADD CONSTRAINT "SkillEvidence_studentSkillId_fkey" FOREIGN KEY ("studentSkillId") REFERENCES "StudentSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEvidence" ADD CONSTRAINT "SkillEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
