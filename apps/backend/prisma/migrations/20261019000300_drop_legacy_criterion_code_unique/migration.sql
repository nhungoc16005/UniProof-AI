-- Criterion codes are scoped to rubric versions. The legacy global index
-- prevents a versioned rubric from reusing codes such as 1 through 16.
DROP INDEX IF EXISTS public."Criterion_code_key";
