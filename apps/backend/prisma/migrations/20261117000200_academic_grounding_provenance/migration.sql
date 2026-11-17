-- Preserve the source of computed verification data independently of free-text notes.
ALTER TABLE "CriterionAssessment" ADD COLUMN "academicGroundingId" TEXT;

-- Revoked rows remain as history; only one active source may exist per criterion.
CREATE UNIQUE INDEX "AcademicGrounding_one_active_per_criterion"
ON "AcademicGrounding" ("termId", "studentId", "criterionCode")
WHERE "status" = 'ACTIVE';

-- Preserve revoked attendance history while permitting a new draft on re-import.
DROP INDEX "ActivityParticipant_activityId_studentId_key";
CREATE INDEX "ActivityParticipant_activityId_studentId_idx" ON "ActivityParticipant" ("activityId", "studentId");
CREATE UNIQUE INDEX "ActivityParticipant_one_current_per_student"
ON "ActivityParticipant" ("activityId", "studentId") WHERE "status" <> 'REVOKED';
