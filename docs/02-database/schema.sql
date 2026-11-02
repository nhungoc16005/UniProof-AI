-- Reference DDL generated from apps/backend/prisma/schema.prisma on 2026-11-02.
-- Not a data backup. Use prisma migrate deploy for an existing Supabase database.
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "TermStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'REVIEWING', 'CLOSED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RubricVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CriterionAssessmentStatus" AS ENUM ('NEEDS_VERIFICATION', 'READY_FOR_REVIEW', 'FINALIZED');

-- CreateEnum
CREATE TYPE "AssessmentSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AssessmentHandoffStatus" AS ENUM ('WORKING', 'SENT', 'RETURNED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('DRAFT', 'PROCESSING', 'VERIFIED', 'PLAUSIBLE', 'NEEDS_SUPPLEMENT', 'NEEDS_HUMAN_REVIEW', 'INVALID', 'APPROVED', 'REJECTED', 'APPEALING', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AiProcessingJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNAVAILABLE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'PLAUSIBLE', 'SUSPICIOUS', 'INVALID', 'NEEDS_HUMAN_REVIEW');

-- CreateEnum
CREATE TYPE "AnomalyFlagType" AS ENUM ('DUPLICATE', 'INCONSISTENT_INFO', 'IMAGE_WEB_MATCH', 'MISSING_INFO', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'SCORE_ADJUSTED', 'SUPPLEMENT_REQUESTED');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cohort" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "studentCode" TEXT,
    "classId" TEXT,
    "facultyId" TEXT,
    "isFirstLogin" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "submissionDeadline" TIMESTAMP(3) NOT NULL,
    "reviewDeadline" TIMESTAMP(3) NOT NULL,
    "appealDeadline" TIMESTAMP(3) NOT NULL,
    "status" "TermStatus" NOT NULL DEFAULT 'UPCOMING',
    "workflowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "organizer" TEXT NOT NULL,
    "termId" TEXT,
    "facultyId" TEXT,
    "criterionId" TEXT,
    "createdById" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityParticipant" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "formRole" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulationDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "fileUrl" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulationChunk" (
    "id" TEXT NOT NULL,
    "regulationDocumentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" vector(1536) NOT NULL,

    CONSTRAINT "RegulationChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "rubricVersionId" TEXT,
    "categoryId" TEXT,
    "scoringConfig" JSONB,
    "rolesScore" JSONB,
    "regulationDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricVersion" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RubricVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'DUT_OFFICIAL_RUBRIC',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeNote" TEXT,
    "sourceTemplateVersionId" TEXT,
    "sourceTermCode" TEXT,

    CONSTRAINT "RubricVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RubricTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RubricVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "sourceDescription" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "RubricTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricCategory" (
    "id" TEXT NOT NULL,
    "rubricVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RubricCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "AssessmentHandoff" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "rubricVersionId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "status" "AssessmentHandoffStatus" NOT NULL DEFAULT 'WORKING',
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3),
    "returnReason" TEXT,
    "notSubmittedReason" TEXT,
    "snapshot" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentPublication" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "rubricVersionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterionAssessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "selfScore" DOUBLE PRECISION,
    "selfNote" TEXT,
    "classScore" DOUBLE PRECISION,
    "classNote" TEXT,
    "classEvaluatorId" TEXT,
    "verifiedData" JSONB,
    "verificationNote" TEXT,
    "suggestedScore" DOUBLE PRECISION,
    "suggestionReason" TEXT,
    "officialScore" DOUBLE PRECISION,
    "officialReason" TEXT,
    "finalReviewerId" TEXT,
    "status" "CriterionAssessmentStatus" NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriterionAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "criterionAssessmentId" TEXT,
    "activityId" TEXT,
    "declaredActivityName" TEXT,
    "description" TEXT,
    "declaredRole" TEXT,
    "evidenceType" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PROCESSING',
    "participationDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFile" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "AiPipelineRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "inputVersion" INTEGER NOT NULL,
    "inputHash" TEXT NOT NULL,
    "rubricVersionId" TEXT,
    "modelName" TEXT,
    "modelVersion" TEXT,
    "configVersion" TEXT,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiPipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPipelineStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputHash" TEXT,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiPipelineStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrResult" (
    "id" TEXT NOT NULL,
    "evidenceFileId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "studentNameExtracted" TEXT,
    "studentCodeExtracted" TEXT,
    "activityNameExtracted" TEXT,
    "organizerExtracted" TEXT,
    "dateExtracted" TEXT,
    "locationExtracted" TEXT,
    "certificateCode" TEXT,
    "extractedFieldsJson" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "reviewedByHuman" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationResult" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "verificationLevel" INTEGER NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "activityExistsVerified" BOOLEAN NOT NULL DEFAULT false,
    "studentParticipationVerified" BOOLEAN NOT NULL DEFAULT false,
    "sourceDescription" TEXT NOT NULL,
    "evidenceGap" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyFlag" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "flagType" "AnomalyFlagType" NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "resolvedByHuman" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnomalyFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "criterionId" TEXT,
    "suggestedScore" DOUBLE PRECISION,
    "suggestedRole" TEXT,
    "reasoning" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "criterionId" TEXT,
    "finalScore" DOUBLE PRECISION,
    "rejectBasis" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementRequest" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "missingItem" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT,
    "termId" TEXT,
    "criterionAssessmentId" TEXT,
    "publicationRevision" INTEGER,
    "previousEvidenceStatus" "EvidenceStatus",
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "requestedScore" DOUBLE PRECISION,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "resolverId" TEXT,
    "resolutionNote" TEXT,
    "adjustedScore" DOUBLE PRECISION,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedEvidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_code_key" ON "Faculty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Class_code_key" ON "Class"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentCode_key" ON "User"("studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Term_code_key" ON "Term"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityParticipant_activityId_studentId_key" ON "ActivityParticipant"("activityId", "studentId");

-- CreateIndex
CREATE INDEX "RegulationChunk_regulationDocumentId_idx" ON "RegulationChunk"("regulationDocumentId");

-- CreateIndex
CREATE INDEX "Criterion_rubricVersionId_category_idx" ON "Criterion"("rubricVersionId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Criterion_rubricVersionId_code_key" ON "Criterion"("rubricVersionId", "code");

-- CreateIndex
CREATE INDEX "RubricVersion_termId_status_idx" ON "RubricVersion"("termId", "status");

-- CreateIndex
CREATE INDEX "RubricVersion_sourceTemplateVersionId_idx" ON "RubricVersion"("sourceTemplateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "RubricVersion_termId_version_key" ON "RubricVersion"("termId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RubricTemplate_code_key" ON "RubricTemplate"("code");

-- CreateIndex
CREATE INDEX "RubricTemplateVersion_templateId_status_idx" ON "RubricTemplateVersion"("templateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RubricTemplateVersion_templateId_version_key" ON "RubricTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "RubricCategory_rubricVersionId_position_idx" ON "RubricCategory"("rubricVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RubricCategory_rubricVersionId_code_key" ON "RubricCategory"("rubricVersionId", "code");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_termId_status_idx" ON "AssessmentSubmission"("termId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSubmission_studentId_termId_rubricVersionId_key" ON "AssessmentSubmission"("studentId", "termId", "rubricVersionId");

-- CreateIndex
CREATE INDEX "AssessmentHandoff_termId_facultyId_classId_status_idx" ON "AssessmentHandoff"("termId", "facultyId", "classId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentHandoff_studentId_termId_key" ON "AssessmentHandoff"("studentId", "termId");

-- CreateIndex
CREATE INDEX "AssessmentPublication_termId_studentId_publishedAt_idx" ON "AssessmentPublication"("termId", "studentId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPublication_studentId_termId_revision_key" ON "AssessmentPublication"("studentId", "termId", "revision");

-- CreateIndex
CREATE INDEX "CriterionAssessment_studentId_termId_status_idx" ON "CriterionAssessment"("studentId", "termId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CriterionAssessment_studentId_termId_criterionId_key" ON "CriterionAssessment"("studentId", "termId", "criterionId");

-- CreateIndex
CREATE INDEX "Evidence_studentId_termId_status_idx" ON "Evidence"("studentId", "termId", "status");

-- CreateIndex
CREATE INDEX "Evidence_criterionAssessmentId_idx" ON "Evidence"("criterionAssessmentId");

-- CreateIndex
CREATE INDEX "AiProcessingJob_status_createdAt_idx" ON "AiProcessingJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiProcessingJob_status_startedAt_idx" ON "AiProcessingJob"("status", "startedAt");

-- CreateIndex
CREATE INDEX "AiProcessingJob_evidenceId_createdAt_idx" ON "AiProcessingJob"("evidenceId", "createdAt");

-- CreateIndex
CREATE INDEX "AiPipelineRun_evidenceId_startedAt_idx" ON "AiPipelineRun"("evidenceId", "startedAt");

-- CreateIndex
CREATE INDEX "AiPipelineRun_status_startedAt_idx" ON "AiPipelineRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiPipelineRun_jobId_attempt_key" ON "AiPipelineRun"("jobId", "attempt");

-- CreateIndex
CREATE INDEX "AiPipelineStep_runId_startedAt_idx" ON "AiPipelineStep"("runId", "startedAt");

-- CreateIndex
CREATE INDEX "OcrResult_evidenceId_idx" ON "OcrResult"("evidenceId");

-- CreateIndex
CREATE INDEX "VerificationResult_evidenceId_idx" ON "VerificationResult"("evidenceId");

-- CreateIndex
CREATE INDEX "AnomalyFlag_evidenceId_idx" ON "AnomalyFlag"("evidenceId");

-- CreateIndex
CREATE INDEX "AiSuggestion_evidenceId_idx" ON "AiSuggestion"("evidenceId");

-- CreateIndex
CREATE INDEX "Review_evidenceId_idx" ON "Review"("evidenceId");

-- CreateIndex
CREATE INDEX "SupplementRequest_evidenceId_idx" ON "SupplementRequest"("evidenceId");

-- CreateIndex
CREATE INDEX "Appeal_termId_status_idx" ON "Appeal"("termId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationDocument" ADD CONSTRAINT "RegulationDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationChunk" ADD CONSTRAINT "RegulationChunk_regulationDocumentId_fkey" FOREIGN KEY ("regulationDocumentId") REFERENCES "RegulationDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RubricCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_regulationDocumentId_fkey" FOREIGN KEY ("regulationDocumentId") REFERENCES "RegulationDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricVersion" ADD CONSTRAINT "RubricVersion_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricVersion" ADD CONSTRAINT "RubricVersion_sourceTemplateVersionId_fkey" FOREIGN KEY ("sourceTemplateVersionId") REFERENCES "RubricTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricTemplateVersion" ADD CONSTRAINT "RubricTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RubricTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricCategory" ADD CONSTRAINT "RubricCategory_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHandoff" ADD CONSTRAINT "AssessmentHandoff_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHandoff" ADD CONSTRAINT "AssessmentHandoff_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHandoff" ADD CONSTRAINT "AssessmentHandoff_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHandoff" ADD CONSTRAINT "AssessmentHandoff_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHandoff" ADD CONSTRAINT "AssessmentHandoff_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHandoff" ADD CONSTRAINT "AssessmentHandoff_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPublication" ADD CONSTRAINT "AssessmentPublication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPublication" ADD CONSTRAINT "AssessmentPublication_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPublication" ADD CONSTRAINT "AssessmentPublication_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPublication" ADD CONSTRAINT "AssessmentPublication_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_classEvaluatorId_fkey" FOREIGN KEY ("classEvaluatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_finalReviewerId_fkey" FOREIGN KEY ("finalReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_criterionAssessmentId_fkey" FOREIGN KEY ("criterionAssessmentId") REFERENCES "CriterionAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProcessingJob" ADD CONSTRAINT "AiProcessingJob_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiPipelineRun" ADD CONSTRAINT "AiPipelineRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AiProcessingJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiPipelineRun" ADD CONSTRAINT "AiPipelineRun_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiPipelineStep" ADD CONSTRAINT "AiPipelineStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiPipelineRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationResult" ADD CONSTRAINT "VerificationResult_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyFlag" ADD CONSTRAINT "AnomalyFlag_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequest" ADD CONSTRAINT "SupplementRequest_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementRequest" ADD CONSTRAINT "SupplementRequest_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_criterionAssessmentId_fkey" FOREIGN KEY ("criterionAssessmentId") REFERENCES "CriterionAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedEvidenceId_fkey" FOREIGN KEY ("relatedEvidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
