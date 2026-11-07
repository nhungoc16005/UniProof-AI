CREATE TYPE "ProfileDataIssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');
CREATE TYPE "DeadlineExtensionTarget" AS ENUM ('STUDENT', 'CLASS');
CREATE TYPE "DeadlineExtensionType" AS ENUM ('SUBMISSION', 'REVIEW', 'APPEAL');
CREATE TYPE "PublicationCorrectionStatus" AS ENUM ('OPEN', 'FACULTY_RESUBMITTED', 'REPUBLISHED', 'CANCELLED');

ALTER TABLE "AssessmentHandoff"
  ADD COLUMN "exclusionReason" TEXT,
  ADD COLUMN "excludedById" TEXT,
  ADD COLUMN "excludedAt" TIMESTAMP(3);

ALTER TABLE "Notification"
  ADD COLUMN "eventKey" TEXT,
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "targetPath" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "readAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

CREATE TABLE "ProfileDataIssue" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "currentData" JSONB,
  "status" "ProfileDataIssueStatus" NOT NULL DEFAULT 'OPEN',
  "resolverId" TEXT,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileDataIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentDeadlineExtension" (
  "id" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "targetType" "DeadlineExtensionTarget" NOT NULL,
  "targetId" TEXT NOT NULL,
  "type" "DeadlineExtensionType" NOT NULL,
  "deadline" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentDeadlineExtension_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationCorrectionRequest" (
  "id" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "handoffId" TEXT NOT NULL,
  "sourcePublicationId" TEXT NOT NULL,
  "sourceRevision" INTEGER NOT NULL,
  "resultingRevision" INTEGER,
  "reason" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status" "PublicationCorrectionStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicationCorrectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileDataIssue_status_createdAt_idx" ON "ProfileDataIssue"("status", "createdAt");
CREATE INDEX "ProfileDataIssue_reporterId_createdAt_idx" ON "ProfileDataIssue"("reporterId", "createdAt");
CREATE INDEX "AssessmentDeadlineExtension_termId_targetType_targetId_type_revokedAt_idx" ON "AssessmentDeadlineExtension"("termId", "targetType", "targetId", "type", "revokedAt");
CREATE INDEX "PublicationCorrectionRequest_termId_status_createdAt_idx" ON "PublicationCorrectionRequest"("termId", "status", "createdAt");
CREATE INDEX "PublicationCorrectionRequest_handoffId_status_idx" ON "PublicationCorrectionRequest"("handoffId", "status");

ALTER TABLE "AssessmentHandoff" ADD CONSTRAINT "AssessmentHandoff_excludedById_fkey" FOREIGN KEY ("excludedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfileDataIssue" ADD CONSTRAINT "ProfileDataIssue_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfileDataIssue" ADD CONSTRAINT "ProfileDataIssue_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentDeadlineExtension" ADD CONSTRAINT "AssessmentDeadlineExtension_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentDeadlineExtension" ADD CONSTRAINT "AssessmentDeadlineExtension_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentDeadlineExtension" ADD CONSTRAINT "AssessmentDeadlineExtension_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationCorrectionRequest" ADD CONSTRAINT "PublicationCorrectionRequest_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationCorrectionRequest" ADD CONSTRAINT "PublicationCorrectionRequest_handoffId_fkey" FOREIGN KEY ("handoffId") REFERENCES "AssessmentHandoff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationCorrectionRequest" ADD CONSTRAINT "PublicationCorrectionRequest_sourcePublicationId_fkey" FOREIGN KEY ("sourcePublicationId") REFERENCES "AssessmentPublication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationCorrectionRequest" ADD CONSTRAINT "PublicationCorrectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
