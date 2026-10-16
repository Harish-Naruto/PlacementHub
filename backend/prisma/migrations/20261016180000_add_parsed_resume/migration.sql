-- CreateTable
CREATE TABLE "ParsedResume" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "schemaVersion" VARCHAR(20) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParsedResume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParsedResume_userId_createdAt_idx" ON "ParsedResume"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ParsedResume" ADD CONSTRAINT "ParsedResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
