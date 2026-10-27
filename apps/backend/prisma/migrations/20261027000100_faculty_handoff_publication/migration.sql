-- Additive migration. Closed terms retain their original scoring behavior.
ALTER TABLE "Term" ADD COLUMN "workflowEnabled" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Term" SET "workflowEnabled" = true WHERE "status" <> 'CLOSED';
ALTER TABLE "Term" ALTER COLUMN "workflowEnabled" SET DEFAULT true;
ALTER TABLE "Appeal" ALTER COLUMN "evidenceId" DROP NOT NULL;
ALTER TABLE "Appeal" ADD COLUMN "termId" TEXT, ADD COLUMN "criterionAssessmentId" TEXT, ADD COLUMN "publicationRevision" INTEGER, ADD COLUMN "previousEvidenceStatus" "EvidenceStatus";
UPDATE "Appeal" a SET "termId" = e."termId" FROM "Evidence" e WHERE e."id" = a."evidenceId";
CREATE INDEX "Appeal_termId_status_idx" ON "Appeal"("termId", "status");
ALTER TABLE "Activity" ADD COLUMN "termId" TEXT, ADD COLUMN "facultyId" TEXT, ADD COLUMN "criterionId" TEXT, ADD COLUMN "createdById" TEXT;
CREATE TABLE "AssessmentHandoff" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "rubricVersionId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "facultyId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'WORKING',
  "sentById" TEXT,
  "sentAt" TIMESTAMP(3),
  "returnReason" TEXT,
  "notSubmittedReason" TEXT,
  "snapshot" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "AssessmentHandoff_studentId_termId_key" ON "AssessmentHandoff"("studentId", "termId");
CREATE INDEX "AssessmentHandoff_termId_facultyId_classId_status_idx" ON "AssessmentHandoff"("termId", "facultyId", "classId", "status");
CREATE TABLE "AssessmentPublication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "rubricVersionId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "publishedById" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AssessmentPublication_studentId_termId_revision_key" ON "AssessmentPublication"("studentId", "termId", "revision");
CREATE INDEX "AssessmentPublication_termId_studentId_publishedAt_idx" ON "AssessmentPublication"("termId", "studentId", "publishedAt");
-- Freeze the eligible roster for terms already open; no scores are synthesized.
INSERT INTO "AssessmentHandoff" ("id", "studentId", "termId", "rubricVersionId", "classId", "facultyId", "updatedAt")
SELECT gen_random_uuid()::text, u."id", t."id", r."id", c."id", c."facultyId", CURRENT_TIMESTAMP
FROM "Term" t JOIN "RubricVersion" r ON r."termId" = t."id" AND r."status" = 'PUBLISHED'
CROSS JOIN "User" u JOIN "Class" c ON c."id" = u."classId"
WHERE t."workflowEnabled" AND t."status" IN ('ACTIVE', 'REVIEWING') AND u."role" = 'STUDENT' AND u."isActive"
ON CONFLICT ("studentId", "termId") DO NOTHING;
