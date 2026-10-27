CREATE TYPE "AssessmentSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED');
CREATE TYPE "AiProcessingJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNAVAILABLE', 'CANCELLED');

CREATE TABLE "AssessmentSubmission" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "rubricVersionId" TEXT NOT NULL,
    "status" "AssessmentSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "returnReason" TEXT,
    "returnedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiProcessingJob" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "status" "AiProcessingJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AiProcessingJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Evidence" ADD COLUMN "description" TEXT;
ALTER TABLE "EvidenceFile" ADD COLUMN "fileName" TEXT, ADD COLUMN "fileSize" INTEGER;

CREATE UNIQUE INDEX "AssessmentSubmission_studentId_termId_rubricVersionId_key" ON "AssessmentSubmission"("studentId", "termId", "rubricVersionId");
CREATE INDEX "AssessmentSubmission_termId_status_idx" ON "AssessmentSubmission"("termId", "status");
CREATE INDEX "AiProcessingJob_status_createdAt_idx" ON "AiProcessingJob"("status", "createdAt");
CREATE INDEX "AiProcessingJob_evidenceId_createdAt_idx" ON "AiProcessingJob"("evidenceId", "createdAt");

ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiProcessingJob" ADD CONSTRAINT "AiProcessingJob_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
