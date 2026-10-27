--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ActivityType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ActivityType" AS ENUM (
    'INTERNAL',
    'EXTERNAL'
);


--
-- Name: AnomalyFlagType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnomalyFlagType" AS ENUM (
    'DUPLICATE',
    'INCONSISTENT_INFO',
    'IMAGE_WEB_MATCH',
    'MISSING_INFO',
    'OTHER'
);


--
-- Name: AppealStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AppealStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED'
);


--
-- Name: DocumentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocumentStatus" AS ENUM (
    'ACTIVE',
    'EXPIRED'
);


--
-- Name: EvidenceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EvidenceStatus" AS ENUM (
    'DRAFT',
    'PROCESSING',
    'VERIFIED',
    'PLAUSIBLE',
    'NEEDS_SUPPLEMENT',
    'NEEDS_HUMAN_REVIEW',
    'INVALID',
    'APPROVED',
    'REJECTED',
    'APPEALING',
    'WITHDRAWN'
);


--
-- Name: ReviewDecision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReviewDecision" AS ENUM (
    'APPROVED',
    'REJECTED',
    'SCORE_ADJUSTED',
    'SUPPLEMENT_REQUESTED'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'STUDENT',
    'STAFF',
    'ADMIN'
);


--
-- Name: RuleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RuleStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
);


--
-- Name: TermStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TermStatus" AS ENUM (
    'UPCOMING',
    'ACTIVE',
    'REVIEWING',
    'CLOSED'
);


--
-- Name: VerificationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."VerificationStatus" AS ENUM (
    'VERIFIED',
    'PLAUSIBLE',
    'SUSPICIOUS',
    'INVALID',
    'NEEDS_HUMAN_REVIEW'
);


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Activity" (
    id text NOT NULL,
    name text NOT NULL,
    type public."ActivityType" NOT NULL,
    organizer text NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    location text,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ActivityParticipant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ActivityParticipant" (
    id text NOT NULL,
    "activityId" text NOT NULL,
    "studentId" text NOT NULL,
    "formRole" text,
    source text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AiSuggestion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiSuggestion" (
    id text NOT NULL,
    "evidenceId" text NOT NULL,
    "criterionId" text,
    "suggestedScore" double precision,
    "suggestedRole" text,
    reasoning text NOT NULL,
    "confidenceScore" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AnomalyFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnomalyFlag" (
    id text NOT NULL,
    "evidenceId" text NOT NULL,
    "flagType" public."AnomalyFlagType" NOT NULL,
    description text NOT NULL,
    severity text NOT NULL,
    "resolvedByHuman" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Appeal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Appeal" (
    id text NOT NULL,
    "evidenceId" text NOT NULL,
    "studentId" text NOT NULL,
    content text NOT NULL,
    "requestedScore" double precision,
    status public."AppealStatus" DEFAULT 'PENDING'::public."AppealStatus" NOT NULL,
    "resolverId" text,
    "resolutionNote" text,
    "adjustedScore" double precision,
    "resolvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    "oldValue" jsonb,
    "newValue" jsonb,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Class" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    cohort text NOT NULL,
    "facultyId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ConductScore; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ConductScore" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "termId" text NOT NULL,
    "totalScore" double precision NOT NULL,
    classification text,
    "finalizedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Criterion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Criterion" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    "minScore" double precision DEFAULT 0.0 NOT NULL,
    "maxScore" double precision NOT NULL,
    category text,
    "rolesScore" jsonb,
    "regulationDocumentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Evidence" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "termId" text NOT NULL,
    "activityId" text,
    "declaredActivityName" text,
    "declaredRole" text,
    "evidenceType" text NOT NULL,
    status public."EvidenceStatus" DEFAULT 'PROCESSING'::public."EvidenceStatus" NOT NULL,
    "participationDate" timestamp(3) without time zone,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lockedById" text,
    "lockedAt" timestamp(3) without time zone,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: EvidenceFile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EvidenceFile" (
    id text NOT NULL,
    "evidenceId" text NOT NULL,
    "fileUrl" text NOT NULL,
    "fileType" text NOT NULL,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Faculty; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Faculty" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    type text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "relatedEvidenceId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: OcrResult; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OcrResult" (
    id text NOT NULL,
    "evidenceFileId" text NOT NULL,
    "evidenceId" text NOT NULL,
    "extractedText" text NOT NULL,
    "studentNameExtracted" text,
    "studentCodeExtracted" text,
    "activityNameExtracted" text,
    "organizerExtracted" text,
    "dateExtracted" text,
    "locationExtracted" text,
    "certificateCode" text,
    "extractedFieldsJson" jsonb,
    "confidenceScore" double precision,
    "reviewedByHuman" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RegulationChunk; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RegulationChunk" (
    id text NOT NULL,
    "regulationDocumentId" text NOT NULL,
    content text NOT NULL,
    "chunkIndex" integer NOT NULL,
    embedding public.vector(1536) NOT NULL
);


--
-- Name: RegulationDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RegulationDocument" (
    id text NOT NULL,
    title text NOT NULL,
    version text NOT NULL,
    "effectiveDate" timestamp(3) without time zone NOT NULL,
    "expiryDate" timestamp(3) without time zone,
    "fileUrl" text NOT NULL,
    status public."DocumentStatus" DEFAULT 'ACTIVE'::public."DocumentStatus" NOT NULL,
    "uploadedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Review" (
    id text NOT NULL,
    "evidenceId" text NOT NULL,
    "reviewerId" text NOT NULL,
    decision public."ReviewDecision" NOT NULL,
    "criterionId" text,
    "finalScore" double precision,
    "rejectBasis" text,
    reason text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Rule" (
    id text NOT NULL,
    name text NOT NULL,
    "criterionId" text NOT NULL,
    "ruleType" text NOT NULL,
    "logicJson" jsonb NOT NULL,
    status public."RuleStatus" DEFAULT 'PUBLISHED'::public."RuleStatus" NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SupplementRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupplementRequest" (
    id text NOT NULL,
    "evidenceId" text NOT NULL,
    "reviewId" text NOT NULL,
    "missingItem" text NOT NULL,
    deadline timestamp(3) without time zone,
    "resolvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Term; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Term" (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "submissionDeadline" timestamp(3) without time zone NOT NULL,
    "reviewDeadline" timestamp(3) without time zone NOT NULL,
    "appealDeadline" timestamp(3) without time zone NOT NULL,
    status public."TermStatus" DEFAULT 'UPCOMING'::public."TermStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "fullName" text NOT NULL,
    role public."Role" NOT NULL,
    "studentCode" text,
    "classId" text,
    "facultyId" text,
    "isFirstLogin" boolean DEFAULT true NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    password text
);


--
-- Name: VerificationResult; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationResult" (
    id text NOT NULL,
    "evidenceId" text NOT NULL,
    "verificationLevel" integer NOT NULL,
    status public."VerificationStatus" NOT NULL,
    "activityExistsVerified" boolean DEFAULT false NOT NULL,
    "studentParticipationVerified" boolean DEFAULT false NOT NULL,
    "sourceDescription" text NOT NULL,
    "evidenceGap" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ActivityParticipant ActivityParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityParticipant"
    ADD CONSTRAINT "ActivityParticipant_pkey" PRIMARY KEY (id);


--
-- Name: Activity Activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_pkey" PRIMARY KEY (id);


--
-- Name: AiSuggestion AiSuggestion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiSuggestion"
    ADD CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY (id);


--
-- Name: AnomalyFlag AnomalyFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnomalyFlag"
    ADD CONSTRAINT "AnomalyFlag_pkey" PRIMARY KEY (id);


--
-- Name: Appeal Appeal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Appeal"
    ADD CONSTRAINT "Appeal_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Class Class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_pkey" PRIMARY KEY (id);


--
-- Name: ConductScore ConductScore_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConductScore"
    ADD CONSTRAINT "ConductScore_pkey" PRIMARY KEY (id);


--
-- Name: Criterion Criterion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Criterion"
    ADD CONSTRAINT "Criterion_pkey" PRIMARY KEY (id);


--
-- Name: EvidenceFile EvidenceFile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvidenceFile"
    ADD CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY (id);


--
-- Name: Evidence Evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_pkey" PRIMARY KEY (id);


--
-- Name: Faculty Faculty_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Faculty"
    ADD CONSTRAINT "Faculty_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OcrResult OcrResult_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OcrResult"
    ADD CONSTRAINT "OcrResult_pkey" PRIMARY KEY (id);


--
-- Name: RegulationChunk RegulationChunk_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegulationChunk"
    ADD CONSTRAINT "RegulationChunk_pkey" PRIMARY KEY (id);


--
-- Name: RegulationDocument RegulationDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegulationDocument"
    ADD CONSTRAINT "RegulationDocument_pkey" PRIMARY KEY (id);


--
-- Name: Review Review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_pkey" PRIMARY KEY (id);


--
-- Name: Rule Rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rule"
    ADD CONSTRAINT "Rule_pkey" PRIMARY KEY (id);


--
-- Name: SupplementRequest SupplementRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementRequest"
    ADD CONSTRAINT "SupplementRequest_pkey" PRIMARY KEY (id);


--
-- Name: Term Term_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Term"
    ADD CONSTRAINT "Term_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: VerificationResult VerificationResult_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationResult"
    ADD CONSTRAINT "VerificationResult_pkey" PRIMARY KEY (id);


--
-- Name: ActivityParticipant_activityId_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ActivityParticipant_activityId_studentId_key" ON public."ActivityParticipant" USING btree ("activityId", "studentId");


--
-- Name: AiSuggestion_evidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiSuggestion_evidenceId_idx" ON public."AiSuggestion" USING btree ("evidenceId");


--
-- Name: AnomalyFlag_evidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnomalyFlag_evidenceId_idx" ON public."AnomalyFlag" USING btree ("evidenceId");


--
-- Name: AuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");


--
-- Name: Class_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Class_code_key" ON public."Class" USING btree (code);


--
-- Name: ConductScore_studentId_termId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ConductScore_studentId_termId_key" ON public."ConductScore" USING btree ("studentId", "termId");


--
-- Name: Criterion_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Criterion_code_key" ON public."Criterion" USING btree (code);


--
-- Name: Evidence_studentId_termId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Evidence_studentId_termId_status_idx" ON public."Evidence" USING btree ("studentId", "termId", status);


--
-- Name: Faculty_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Faculty_code_key" ON public."Faculty" USING btree (code);


--
-- Name: Notification_userId_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_isRead_idx" ON public."Notification" USING btree ("userId", "isRead");


--
-- Name: OcrResult_evidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OcrResult_evidenceId_idx" ON public."OcrResult" USING btree ("evidenceId");


--
-- Name: RegulationChunk_regulationDocumentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegulationChunk_regulationDocumentId_idx" ON public."RegulationChunk" USING btree ("regulationDocumentId");


--
-- Name: Review_evidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Review_evidenceId_idx" ON public."Review" USING btree ("evidenceId");


--
-- Name: SupplementRequest_evidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementRequest_evidenceId_idx" ON public."SupplementRequest" USING btree ("evidenceId");


--
-- Name: Term_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Term_code_key" ON public."Term" USING btree (code);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_studentCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_studentCode_key" ON public."User" USING btree ("studentCode");


--
-- Name: VerificationResult_evidenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationResult_evidenceId_idx" ON public."VerificationResult" USING btree ("evidenceId");


--
-- Name: ActivityParticipant ActivityParticipant_activityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityParticipant"
    ADD CONSTRAINT "ActivityParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES public."Activity"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ActivityParticipant ActivityParticipant_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityParticipant"
    ADD CONSTRAINT "ActivityParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AiSuggestion AiSuggestion_criterionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiSuggestion"
    ADD CONSTRAINT "AiSuggestion_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES public."Criterion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AiSuggestion AiSuggestion_evidenceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiSuggestion"
    ADD CONSTRAINT "AiSuggestion_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES public."Evidence"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AnomalyFlag AnomalyFlag_evidenceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnomalyFlag"
    ADD CONSTRAINT "AnomalyFlag_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES public."Evidence"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Appeal Appeal_evidenceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Appeal"
    ADD CONSTRAINT "Appeal_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES public."Evidence"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Appeal Appeal_resolverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Appeal"
    ADD CONSTRAINT "Appeal_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Appeal Appeal_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Appeal"
    ADD CONSTRAINT "Appeal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Class Class_facultyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES public."Faculty"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConductScore ConductScore_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConductScore"
    ADD CONSTRAINT "ConductScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ConductScore ConductScore_termId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConductScore"
    ADD CONSTRAINT "ConductScore_termId_fkey" FOREIGN KEY ("termId") REFERENCES public."Term"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Criterion Criterion_regulationDocumentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Criterion"
    ADD CONSTRAINT "Criterion_regulationDocumentId_fkey" FOREIGN KEY ("regulationDocumentId") REFERENCES public."RegulationDocument"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EvidenceFile EvidenceFile_evidenceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvidenceFile"
    ADD CONSTRAINT "EvidenceFile_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES public."Evidence"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Evidence Evidence_activityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES public."Activity"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Evidence Evidence_lockedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Evidence Evidence_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Evidence Evidence_termId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_termId_fkey" FOREIGN KEY ("termId") REFERENCES public."Term"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_relatedEvidenceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_relatedEvidenceId_fkey" FOREIGN KEY ("relatedEvidenceId") REFERENCES public."Evidence"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OcrResult OcrResult_evidenceFileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OcrResult"
    ADD CONSTRAINT "OcrResult_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES public."EvidenceFile"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OcrResult OcrResult_evidenceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OcrResult"
    ADD CONSTRAINT "OcrResult_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES public."Evidence"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RegulationChunk RegulationChunk_regulationDocumentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegulationChunk"
    ADD CONSTRAINT "RegulationChunk_regulationDocumentId_fkey" FOREIGN KEY ("regulationDocumentId") REFERENCES public."RegulationDocument"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RegulationDocument RegulationDocument_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegulationDocument"
    ADD CONSTRAINT "RegulationDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Review Review_criterionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES public."Criterion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Review Review_evidenceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES public."Evidence"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Review Review_reviewerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Rule Rule_criterionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Rule"
    ADD CONSTRAINT "Rule_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES public."Criterion"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SupplementRequest SupplementRequest_evidenceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementRequest"
    ADD CONSTRAINT "SupplementRequest_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES public."Evidence"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SupplementRequest SupplementRequest_reviewId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementRequest"
    ADD CONSTRAINT "SupplementRequest_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES public."Review"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_facultyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES public."Faculty"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VerificationResult VerificationResult_evidenceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationResult"
    ADD CONSTRAINT "VerificationResult_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES public."Evidence"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Activity" ENABLE ROW LEVEL SECURITY;

--
-- Name: ActivityParticipant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ActivityParticipant" ENABLE ROW LEVEL SECURITY;

--
-- Name: AiSuggestion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AiSuggestion" ENABLE ROW LEVEL SECURITY;

--
-- Name: AnomalyFlag; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AnomalyFlag" ENABLE ROW LEVEL SECURITY;

--
-- Name: Appeal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Appeal" ENABLE ROW LEVEL SECURITY;

--
-- Name: AuditLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: Class; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Class" ENABLE ROW LEVEL SECURITY;

--
-- Name: ConductScore; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ConductScore" ENABLE ROW LEVEL SECURITY;

--
-- Name: Criterion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Criterion" ENABLE ROW LEVEL SECURITY;

--
-- Name: Evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Evidence" ENABLE ROW LEVEL SECURITY;

--
-- Name: EvidenceFile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."EvidenceFile" ENABLE ROW LEVEL SECURITY;

--
-- Name: Faculty; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Faculty" ENABLE ROW LEVEL SECURITY;

--
-- Name: Notification; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;

--
-- Name: OcrResult; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OcrResult" ENABLE ROW LEVEL SECURITY;

--
-- Name: RegulationChunk; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RegulationChunk" ENABLE ROW LEVEL SECURITY;

--
-- Name: RegulationDocument; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RegulationDocument" ENABLE ROW LEVEL SECURITY;

--
-- Name: Review; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Review" ENABLE ROW LEVEL SECURITY;

--
-- Name: Rule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Rule" ENABLE ROW LEVEL SECURITY;

--
-- Name: SupplementRequest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."SupplementRequest" ENABLE ROW LEVEL SECURITY;

--
-- Name: Term; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Term" ENABLE ROW LEVEL SECURITY;

--
-- Name: User; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

--
-- Name: VerificationResult; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."VerificationResult" ENABLE ROW LEVEL SECURITY;


--
-- PostgreSQL database dump complete
--
