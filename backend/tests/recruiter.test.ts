import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import app from "../src/app.ts";
import prisma from "../src/config/prisma.ts";
import config from "../src/config/index.ts";
import { SignJWT } from "jose";
import type { Server } from "node:http";

const jwtSecretKey = new TextEncoder().encode(config.jwtAccessSecret);

async function signTestToken(userId: string, role: "STUDENT" | "RECRUITER"): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(config.jwtIssuer)
    .setAudience(config.jwtAudience)
    .setIssuedAt()
    .setExpirationTime(config.jwtAccessTtl)
    .sign(jwtSecretKey);
}

describe("Recruiter Endpoints Integration Tests", () => {
  let server: Server;
  let baseUrl: string;

  // Test identities
  let recruiter1Id: string;
  let recruiter1Token: string;

  let recruiter2Id: string;
  let recruiter2Token: string;

  let studentId: string;
  let studentToken: string;

  // Created resources
  let testSkillId: string;
  let testJobId: string;
  let testApplicationId: string;

  beforeAll(async () => {
    // 1. Start ephemeral HTTP server
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 4000;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });

    // 2. Clean up any previous test artifacts with our test emails
    const testEmails = [
      "recruiter1_test@placementhub.test",
      "recruiter2_test@placementhub.test",
      "student_test@placementhub.test",
    ];

    const existingUsers = await prisma.user.findMany({
      where: { email: { in: testEmails } },
      select: { id: true },
    });

    if (existingUsers.length > 0) {
      const userIds = existingUsers.map((u) => u.id);
      await prisma.applicationEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
      await prisma.application.deleteMany({
        where: {
          OR: [
            { studentProfile: { userId: { in: userIds } } },
            { jobPosting: { recruiterProfile: { userId: { in: userIds } } } },
          ],
        },
      });
      await prisma.jobPosting.deleteMany({
        where: { recruiterProfile: { userId: { in: userIds } } },
      });
      await prisma.recruiterProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.company.deleteMany({ where: { createdById: { in: userIds } } });
      await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    // 3. Create canonical test skill if not present
    let skill = await prisma.skill.findUnique({ where: { name: "TypeScript Test Skill" } });
    if (!skill) {
      skill = await prisma.skill.create({
        data: {
          name: "TypeScript Test Skill",
          category: "Languages",
        },
      });
    }
    testSkillId = skill.id;

    // 4. Create Recruiter 1
    const r1 = await prisma.user.create({
      data: {
        email: "recruiter1_test@placementhub.test",
        name: "Test Recruiter One",
        passwordHash: "dummy-hash",
        role: "RECRUITER",
      },
    });
    recruiter1Id = r1.id;
    recruiter1Token = await signTestToken(r1.id, "RECRUITER");

    // 5. Create Recruiter 2
    const r2 = await prisma.user.create({
      data: {
        email: "recruiter2_test@placementhub.test",
        name: "Test Recruiter Two",
        passwordHash: "dummy-hash",
        role: "RECRUITER",
      },
    });
    recruiter2Id = r2.id;
    recruiter2Token = await signTestToken(r2.id, "RECRUITER");

    // Recruiter 2 gets its own company and profile to test cross-recruiter ownership
    const r2Company = await prisma.company.create({
      data: {
        name: "Recruiter 2 Corp",
        slug: "recruiter-2-corp-test",
        createdById: r2.id,
      },
    });
    await prisma.recruiterProfile.create({
      data: {
        userId: r2.id,
        companyId: r2Company.id,
        jobTitle: "Senior Talent Lead",
      },
    });

    // 6. Create Student
    const s = await prisma.user.create({
      data: {
        email: "student_test@placementhub.test",
        name: "Test Student",
        passwordHash: "dummy-hash",
        role: "STUDENT",
      },
    });
    studentId = s.id;
    studentToken = await signTestToken(s.id, "STUDENT");

    // Create an institution and student profile for test application
    let institution = await prisma.institution.findUnique({
      where: { slug: "test-institution" },
    });
    if (!institution) {
      institution = await prisma.institution.create({
        data: {
          name: "Test Institute of Technology",
          slug: "test-institution",
          city: "Bengaluru",
          state: "Karnataka",
        },
      });
    }

    await prisma.studentProfile.create({
      data: {
        userId: s.id,
        institutionId: institution.id,
        branch: "Computer Science",
        graduationYear: 2026,
        cgpa: 8.5,
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    const testEmails = [
      "recruiter1_test@placementhub.test",
      "recruiter2_test@placementhub.test",
      "student_test@placementhub.test",
    ];

    const users = await prisma.user.findMany({
      where: { email: { in: testEmails } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    if (userIds.length > 0) {
      await prisma.applicationEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
      await prisma.application.deleteMany({
        where: {
          OR: [
            { studentProfile: { userId: { in: userIds } } },
            { jobPosting: { recruiterProfile: { userId: { in: userIds } } } },
          ],
        },
      });
      await prisma.jobSkillRequirement.deleteMany({
        where: { jobPosting: { recruiterProfile: { userId: { in: userIds } } } },
      });
      await prisma.jobEligibleBranch.deleteMany({
        where: { jobPosting: { recruiterProfile: { userId: { in: userIds } } } },
      });
      await prisma.jobEligibleGraduationYear.deleteMany({
        where: { jobPosting: { recruiterProfile: { userId: { in: userIds } } } },
      });
      await prisma.jobPosting.deleteMany({
        where: { recruiterProfile: { userId: { in: userIds } } },
      });
      await prisma.recruiterProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.company.deleteMany({ where: { createdById: { in: userIds } } });
      await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // =========================================================================
  // 1. GET /recruiters/me/profile
  // =========================================================================
  describe("GET /recruiters/me/profile", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/profile`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe(true);
    });

    it("should return 403 when a student tries to access recruiter profile", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/profile`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe(true);
    });

    it("should return profile: null when recruiter has not set up profile yet", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/profile`, {
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.profile).toBeNull();
    });
  });

  // =========================================================================
  // 2. PUT /recruiters/me/profile
  // =========================================================================
  describe("PUT /recruiters/me/profile", () => {
    it("should fail validation (400) when companyName is missing", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${recruiter1Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobTitle: "Talent Partner",
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toBeDefined();
    });

    it("should fail validation (400) with invalid website URL", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${recruiter1Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: "Acme Tech",
          website: "not-a-valid-url",
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe(true);
    });

    it("should create new company and recruiter profile when none exists", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${recruiter1Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: "Acme Innovations",
          companySlug: "acme-innovations-test",
          website: "https://acme.example.com",
          description: "Leading technology provider",
          city: "Bengaluru",
          country: "India",
          jobTitle: "Head of Talent",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.profile).toBeDefined();
      expect(body.data.profile.jobTitle).toBe("Head of Talent");
      expect(body.data.company.name).toBe("Acme Innovations");
      expect(body.data.company.slug).toBe("acme-innovations-test");
    });

    it("should fetch the newly created profile via GET /recruiters/me/profile", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/profile`, {
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.profile).toBeDefined();
      expect(body.data.profile.company.name).toBe("Acme Innovations");
    });

    it("should update existing company and recruiter profile", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${recruiter1Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: "Acme Innovations Ltd",
          description: "Updated description for Acme Innovations",
          jobTitle: "Director of University Recruiting",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.profile.jobTitle).toBe("Director of University Recruiting");
      expect(body.data.company.name).toBe("Acme Innovations Ltd");
    });
  });

  // =========================================================================
  // 3. POST /recruiters/me/jobs
  // =========================================================================
  describe("POST /recruiters/me/jobs", () => {
    it("should reject job creation if title is missing (400)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${recruiter1Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: "A great software engineer role",
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toBeDefined();
    });

    it("should reject job creation with non-existent skill ID (400)", async () => {
      const fakeSkillUuid = "00000000-0000-0000-0000-000000000000";
      const res = await fetch(`${baseUrl}/recruiters/me/jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${recruiter1Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Full Stack Engineer",
          description: "Build robust full-stack applications.",
          skillRequirements: [
            {
              skillId: fakeSkillUuid,
              requirementType: "REQUIRED",
              weight: 1.0,
            },
          ],
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toContain("One or more skill IDs are invalid");
    });

    it("should create a job posting in DRAFT status with valid parameters", async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const res = await fetch(`${baseUrl}/recruiters/me/jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${recruiter1Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Graduate Software Engineer 2026",
          description: "Join our platform engineering team to build scalable services.",
          location: "Bengaluru, India",
          workMode: "HYBRID",
          employmentType: "FULL_TIME",
          minimumCgpa: 7.5,
          applicationDeadline: futureDate,
          eligibleBranches: ["Computer Science", "Information Technology"],
          eligibleGraduationYears: [2026],
          skillRequirements: [
            {
              skillId: testSkillId,
              requirementType: "REQUIRED",
              weight: 1.5,
            },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.job).toBeDefined();
      expect(body.data.job.status).toBe("DRAFT");
      expect(body.data.job.title).toBe("Graduate Software Engineer 2026");
      expect(body.data.job.eligibleBranches.length).toBe(2);
      expect(body.data.job.graduationYears.length).toBe(1);
      expect(body.data.job.skillRequirements.length).toBe(1);

      testJobId = body.data.job.id;
    });
  });

  // =========================================================================
  // 4. GET /recruiters/me/jobs
  // =========================================================================
  describe("GET /recruiters/me/jobs", () => {
    it("should list jobs owned by the recruiter with pagination metadata", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(Array.isArray(body.data.jobs)).toBe(true);
      expect(body.data.total).toBeGreaterThanOrEqual(1);
      expect(body.data.jobs.some((j: any) => j.id === testJobId)).toBe(true);
    });

    it("should filter jobs by status", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs?status=DRAFT`, {
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.jobs.every((j: any) => j.status === "DRAFT")).toBe(true);
    });

    it("should not return jobs belonging to another recruiter", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs`, {
        headers: { Authorization: `Bearer ${recruiter2Token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      // Recruiter 2 should not see Recruiter 1's jobs
      expect(body.data.jobs.some((j: any) => j.id === testJobId)).toBe(false);
    });
  });

  // =========================================================================
  // 5. GET /recruiters/me/jobs/:jobId
  // =========================================================================
  describe("GET /recruiters/me/jobs/:jobId", () => {
    it("should return full job details for an owned job", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}`, {
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.job.id).toBe(testJobId);
      expect(body.data.job.title).toBe("Graduate Software Engineer 2026");
      expect(body.data.job.skillRequirements[0].skill.id).toBe(testSkillId);
    });

    it("should return 404 for a non-existent job ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${nonExistentId}`, {
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe(true);
    });

    it("should return 403 when another recruiter tries to view the job", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}`, {
        headers: { Authorization: `Bearer ${recruiter2Token}` },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toContain("permission");
    });
  });

  // =========================================================================
  // 6. PATCH /recruiters/me/jobs/:jobId
  // =========================================================================
  describe("PATCH /recruiters/me/jobs/:jobId", () => {
    it("should update job fields successfully", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${recruiter1Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Graduate Software Engineer (Updated)",
          location: "Remote",
          workMode: "REMOTE",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.job.title).toBe("Graduate Software Engineer (Updated)");
      expect(body.data.job.workMode).toBe("REMOTE");
    });

    it("should reject update from an unauthorized recruiter (403)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${recruiter2Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Hacked Title",
        }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe(true);
    });
  });

  // =========================================================================
  // 7. POST /recruiters/me/jobs/:jobId/publish
  // =========================================================================
  describe("POST /recruiters/me/jobs/:jobId/publish", () => {
    it("should reject publish from an unauthorized recruiter (403)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter2Token}` },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe(true);
    });

    it("should publish a valid DRAFT job successfully", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.job.status).toBe("PUBLISHED");
    });

    it("should reject publishing an already PUBLISHED job (409 conflict)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toContain("already published");
    });
  });

  // =========================================================================
  // 8. GET /recruiters/me/jobs/:jobId/applications
  // =========================================================================
  describe("GET /recruiters/me/jobs/:jobId/applications", () => {
    beforeAll(async () => {
      // Create a student application for testJobId so we can test application flows
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: studentId },
      });

      const application = await prisma.application.create({
        data: {
          studentProfileId: studentProfile!.id,
          jobPostingId: testJobId,
          status: "APPLIED",
        },
      });
      testApplicationId = application.id;

      // Create initial application event
      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          actorUserId: studentId,
          toStatus: "APPLIED",
          note: "Applied via Placement Hub",
        },
      });
    });

    it("should return applications for the recruiter's job with pagination", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/jobs/${testJobId}/applications?page=1&limit=10`,
        {
          headers: { Authorization: `Bearer ${recruiter1Token}` },
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.applications.length).toBeGreaterThanOrEqual(1);
      expect(body.data.applications[0].id).toBe(testApplicationId);
      expect(body.data.applications[0].studentProfile.user.name).toBe("Test Student");
    });

    it("should filter applications by status", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/jobs/${testJobId}/applications?status=APPLIED`,
        {
          headers: { Authorization: `Bearer ${recruiter1Token}` },
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.applications.every((a: any) => a.status === "APPLIED")).toBe(true);
    });

    it("should reject another recruiter from viewing applications (403)", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/jobs/${testJobId}/applications`,
        {
          headers: { Authorization: `Bearer ${recruiter2Token}` },
        },
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe(true);
    });
  });

  // =========================================================================
  // 9. GET /recruiters/me/applications/:applicationId
  // =========================================================================
  describe("GET /recruiters/me/applications/:applicationId", () => {
    it("should return full application and candidate details for authorized recruiter", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/applications/${testApplicationId}`,
        {
          headers: { Authorization: `Bearer ${recruiter1Token}` },
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.application.id).toBe(testApplicationId);
      expect(body.data.application.studentProfile).toBeDefined();
      expect(body.data.application.events.length).toBeGreaterThanOrEqual(1);
    });

    it("should return 404 for a non-existent application ID", async () => {
      const fakeAppId = "00000000-0000-0000-0000-000000000000";
      const res = await fetch(`${baseUrl}/recruiters/me/applications/${fakeAppId}`, {
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe(true);
    });

    it("should return 403 when an unauthorized recruiter tries to view the application", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/applications/${testApplicationId}`,
        {
          headers: { Authorization: `Bearer ${recruiter2Token}` },
        },
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe(true);
    });
  });

  // =========================================================================
  // 10. PATCH /recruiters/me/applications/:applicationId/status
  // =========================================================================
  describe("PATCH /recruiters/me/applications/:applicationId/status", () => {
    it("should reject an invalid status transition (e.g. APPLIED -> HIRED directly) (409)", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/applications/${testApplicationId}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${recruiter1Token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "HIRED",
          }),
        },
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toContain("Cannot transition");
    });

    it("should reject status update from an unauthorized recruiter (403)", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/applications/${testApplicationId}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${recruiter2Token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "IN_REVIEW",
          }),
        },
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe(true);
    });

    it("should perform a valid transition (APPLIED -> IN_REVIEW) with note", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/applications/${testApplicationId}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${recruiter1Token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "IN_REVIEW",
            note: "Resume matches basic criteria, reviewing projects",
          }),
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.application.status).toBe("IN_REVIEW");
    });

    it("should perform subsequent valid transition (IN_REVIEW -> SHORTLISTED)", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/applications/${testApplicationId}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${recruiter1Token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "SHORTLISTED",
            note: "Candidate shortlisted for technical round",
          }),
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.application.status).toBe("SHORTLISTED");
    });
  });

  // =========================================================================
  // 11. GET /recruiters/me/applications/:applicationId/events
  // =========================================================================
  describe("GET /recruiters/me/applications/:applicationId/events", () => {
    it("should return the complete chronological event history", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/applications/${testApplicationId}/events`,
        {
          headers: { Authorization: `Bearer ${recruiter1Token}` },
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(Array.isArray(body.data.events)).toBe(true);
      expect(body.data.events.length).toBeGreaterThanOrEqual(3);

      // Check chronological order and statuses recorded
      const statuses = body.data.events.map((e: any) => e.toStatus);
      expect(statuses).toContain("APPLIED");
      expect(statuses).toContain("IN_REVIEW");
      expect(statuses).toContain("SHORTLISTED");

      // Verify the actor information is populated
      const lastEvent = body.data.events[body.data.events.length - 1];
      expect(lastEvent.actor).toBeDefined();
      expect(lastEvent.actor.id).toBe(recruiter1Id);
    });

    it("should reject an unauthorized recruiter from viewing events (403)", async () => {
      const res = await fetch(
        `${baseUrl}/recruiters/me/applications/${testApplicationId}/events`,
        {
          headers: { Authorization: `Bearer ${recruiter2Token}` },
        },
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe(true);
    });
  });

  // =========================================================================
  // POST /recruiters/me/jobs/:jobId/pause
  // =========================================================================
  describe("POST /recruiters/me/jobs/:jobId/pause", () => {
    it("should reject pause from an unauthorized recruiter (403)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/pause`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter2Token}` },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe(true);
    });

    it("should pause a published job successfully (200)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/pause`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.job.status).toBe("PAUSED");
    });

    it("should reject pausing an already PAUSED job (409)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/pause`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toContain("already paused");
    });

    it("should allow resuming/re-publishing a PAUSED job", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.job.status).toBe("PUBLISHED");
    });
  });

  // =========================================================================
  // 12. POST /recruiters/me/jobs/:jobId/close
  // =========================================================================
  describe("POST /recruiters/me/jobs/:jobId/close", () => {
    it("should reject close action from an unauthorized recruiter (403)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter2Token}` },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe(true);
    });

    it("should close the job successfully", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.job.status).toBe("CLOSED");
    });

    it("should reject closing an already CLOSED job (409 conflict)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toContain("already closed");
    });

    it("should reject updating a CLOSED job (409 conflict)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${recruiter1Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Attempt to update closed job",
        }),
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toContain("Closed jobs cannot be edited");
    });

    it("should reject re-publishing a CLOSED job (409 conflict)", async () => {
      const res = await fetch(`${baseUrl}/recruiters/me/jobs/${testJobId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${recruiter1Token}` },
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toContain("Closed jobs cannot be re-published");
    });
  });
});
