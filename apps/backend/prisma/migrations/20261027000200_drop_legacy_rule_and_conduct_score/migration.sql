-- The versioned rubric stores deterministic scoring in Criterion.scoringConfig.
-- Official results are derived from CriterionAssessment and immutable
-- AssessmentPublication snapshots. Refuse to discard unexpected legacy data.
DO $$
BEGIN
  IF to_regclass('public."Rule"') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public."Rule" LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot drop Rule: legacy rows still exist';
  END IF;

  IF to_regclass('public."ConductScore"') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public."ConductScore" LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot drop ConductScore: legacy rows still exist';
  END IF;
END $$;

DROP TABLE IF EXISTS public."Rule";
DROP TABLE IF EXISTS public."ConductScore";
DROP TYPE IF EXISTS public."RuleStatus";
