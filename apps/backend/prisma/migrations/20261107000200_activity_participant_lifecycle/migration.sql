CREATE TYPE "ActivityParticipantStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'REVOKED');

ALTER TABLE "ActivityParticipant"
  ADD COLUMN "status" "ActivityParticipantStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "confirmedById" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokeReason" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "ActivityParticipant_studentId_status_idx" ON "ActivityParticipant"("studentId", "status");
CREATE INDEX "ActivityParticipant_activityId_status_idx" ON "ActivityParticipant"("activityId", "status");
