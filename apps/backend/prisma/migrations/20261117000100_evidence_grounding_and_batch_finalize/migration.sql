-- CreateEnum
CREATE TYPE "ImportBatchType" AS ENUM ('ACADEMIC', 'ACTIVITY', 'CLUB_LEADERSHIP');
CREATE TYPE "ImportBatchStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "GroundingStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable Term
ALTER TABLE "Term" ADD COLUMN "evidenceBasisWorkflowEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable ActivityParticipant
ALTER TABLE "ActivityParticipant" ADD COLUMN "batchId" TEXT;

-- CreateTable ImportBatch
CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "facultyId" TEXT NOT NULL,
  "type" "ImportBatchType" NOT NULL,
  "source" TEXT NOT NULL,
  "importedById" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'ACTIVE',
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable AcademicGrounding
CREATE TABLE "AcademicGrounding" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "criterionCode" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "source" TEXT,
  "note" TEXT,
  "status" "GroundingStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AcademicGrounding_pkey" PRIMARY KEY ("id")
);

-- CreateTable ClubLeadershipGrounding
CREATE TABLE "ClubLeadershipGrounding" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "criterionCode" TEXT NOT NULL,
  "organizationName" TEXT NOT NULL,
  "roleTitle" TEXT NOT NULL,
  "source" TEXT,
  "note" TEXT,
  "status" "GroundingStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClubLeadershipGrounding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_idempotencyKey_key" ON "ImportBatch"("idempotencyKey");
CREATE INDEX "ImportBatch_termId_facultyId_type_status_idx" ON "ImportBatch"("termId", "facultyId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicGrounding_batchId_studentId_criterionCode_key" ON "AcademicGrounding"("batchId", "studentId", "criterionCode");
CREATE INDEX "AcademicGrounding_termId_studentId_criterionCode_status_idx" ON "AcademicGrounding"("termId", "studentId", "criterionCode", "status");

-- CreateIndex
CREATE INDEX "ClubLeadershipGrounding_termId_studentId_criterionCode_status_idx" ON "ClubLeadershipGrounding"("termId", "studentId", "criterionCode", "status");

-- CreateIndex
CREATE INDEX "ActivityParticipant_batchId_idx" ON "ActivityParticipant"("batchId");

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicGrounding" ADD CONSTRAINT "AcademicGrounding_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicGrounding" ADD CONSTRAINT "AcademicGrounding_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicGrounding" ADD CONSTRAINT "AcademicGrounding_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubLeadershipGrounding" ADD CONSTRAINT "ClubLeadershipGrounding_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubLeadershipGrounding" ADD CONSTRAINT "ClubLeadershipGrounding_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubLeadershipGrounding" ADD CONSTRAINT "ClubLeadershipGrounding_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
