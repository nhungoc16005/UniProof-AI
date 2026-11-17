ALTER TABLE "AiPipelineRun"
ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'AI';

UPDATE "VerificationResult"
SET "evidenceGap" = ("evidenceGap" - ('automatically' || 'Rejected'))
  || jsonb_build_object('systemInvalidated', "evidenceGap"->('automatically' || 'Rejected'))
WHERE "evidenceGap" ? ('automatically' || 'Rejected');
