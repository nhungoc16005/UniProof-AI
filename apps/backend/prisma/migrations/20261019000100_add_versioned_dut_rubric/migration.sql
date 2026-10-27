-- Versioned rubric and per-student criterion assessments.
-- This migration is intentionally not applied to the configured Supabase database.
CREATE TYPE "RubricVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CriterionAssessmentStatus" AS ENUM ('NEEDS_VERIFICATION', 'READY_FOR_REVIEW', 'FINALIZED');

CREATE TABLE "RubricVersion" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RubricVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'DUT_OFFICIAL_RUBRIC',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RubricCategory" (
    "id" TEXT NOT NULL,
    "rubricVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "RubricCategory_pkey" PRIMARY KEY ("id")
);
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

ALTER TABLE "Criterion" DROP CONSTRAINT IF EXISTS "Criterion_code_key";
ALTER TABLE "Criterion" ADD COLUMN "rubricVersionId" TEXT,
    ADD COLUMN "categoryId" TEXT,
    ADD COLUMN "scoringConfig" JSONB;
ALTER TABLE "Evidence" ADD COLUMN "criterionAssessmentId" TEXT;

CREATE UNIQUE INDEX "RubricVersion_termId_version_key" ON "RubricVersion"("termId", "version");
CREATE INDEX "RubricVersion_termId_status_idx" ON "RubricVersion"("termId", "status");
CREATE UNIQUE INDEX "RubricCategory_rubricVersionId_code_key" ON "RubricCategory"("rubricVersionId", "code");
CREATE INDEX "RubricCategory_rubricVersionId_position_idx" ON "RubricCategory"("rubricVersionId", "position");
CREATE UNIQUE INDEX "Criterion_rubricVersionId_code_key" ON "Criterion"("rubricVersionId", "code");
CREATE INDEX "Criterion_rubricVersionId_category_idx" ON "Criterion"("rubricVersionId", "category");
CREATE UNIQUE INDEX "CriterionAssessment_studentId_termId_criterionId_key" ON "CriterionAssessment"("studentId", "termId", "criterionId");
CREATE INDEX "CriterionAssessment_studentId_termId_status_idx" ON "CriterionAssessment"("studentId", "termId", "status");
CREATE INDEX "Evidence_criterionAssessmentId_idx" ON "Evidence"("criterionAssessmentId");

ALTER TABLE "RubricVersion" ADD CONSTRAINT "RubricVersion_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RubricCategory" ADD CONSTRAINT "RubricCategory_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RubricCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_classEvaluatorId_fkey" FOREIGN KEY ("classEvaluatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CriterionAssessment" ADD CONSTRAINT "CriterionAssessment_finalReviewerId_fkey" FOREIGN KEY ("finalReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_criterionAssessmentId_fkey" FOREIGN KEY ("criterionAssessmentId") REFERENCES "CriterionAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
