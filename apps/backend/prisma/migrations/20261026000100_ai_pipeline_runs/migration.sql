CREATE TABLE "AiPipelineRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "inputVersion" INTEGER NOT NULL,
    "inputHash" TEXT NOT NULL,
    "rubricVersionId" TEXT,
    "modelName" TEXT,
    "modelVersion" TEXT,
    "configVersion" TEXT,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AiPipelineRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiPipelineStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputHash" TEXT,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AiPipelineStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiPipelineRun_jobId_attempt_key" ON "AiPipelineRun"("jobId", "attempt");
CREATE INDEX "AiPipelineRun_evidenceId_startedAt_idx" ON "AiPipelineRun"("evidenceId", "startedAt");
CREATE INDEX "AiPipelineRun_status_startedAt_idx" ON "AiPipelineRun"("status", "startedAt");
CREATE INDEX "AiPipelineStep_runId_startedAt_idx" ON "AiPipelineStep"("runId", "startedAt");

ALTER TABLE "AiPipelineRun" ADD CONSTRAINT "AiPipelineRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AiProcessingJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiPipelineRun" ADD CONSTRAINT "AiPipelineRun_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiPipelineStep" ADD CONSTRAINT "AiPipelineStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiPipelineRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
