ALTER TABLE "CriterionAssessment"
  ADD COLUMN "clubGroundingIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
