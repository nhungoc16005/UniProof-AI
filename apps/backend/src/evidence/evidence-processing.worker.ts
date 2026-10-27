import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { AiProcessingJobStatus, EvidenceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EvidenceService } from './evidence.service';

type PipelineSuggestion = { criterionId: string; suggestedScore?: number | null; reasoning: string; confidenceScore?: number | null };

@Injectable()
export class EvidenceProcessingWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly evidenceService: EvidenceService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processNext(), 3000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async processNext() {
    if (this.running) return;
    this.running = true;
    try {
      const job = await this.prisma.aiProcessingJob.findFirst({ where: { status: AiProcessingJobStatus.QUEUED }, orderBy: { createdAt: 'asc' } });
      if (!job) return;
      const claimed = await this.prisma.aiProcessingJob.updateMany({ where: { id: job.id, status: AiProcessingJobStatus.QUEUED }, data: { status: AiProcessingJobStatus.PROCESSING, startedAt: new Date(), attempts: { increment: 1 } } });
      if (!claimed.count) return;
      await this.processClaimed(job.id);
    } catch (error) {
      // A polling failure leaves the persistent job available for the next tick.
      console.error('AI evidence queue polling failed', error);
    } finally {
      this.running = false;
    }
  }

  private async processClaimed(jobId: string) {
    const job = await this.prisma.aiProcessingJob.findUnique({ where: { id: jobId }, include: { evidence: { include: { files: true, term: true, criterionAssessment: { include: { criterion: true } } } } } });
    if (!job) return;
    if (!(await this.isStillSubmitted(jobId, job.evidence.studentId, job.evidence.termId, job.evidence.criterionAssessment?.criterion.rubricVersionId))) return;
    const inputFingerprint = createHash('sha256').update(JSON.stringify({
      evidenceId: job.evidenceId,
      evidenceVersion: job.evidence.version,
      activityName: job.evidence.declaredActivityName,
      description: job.evidence.description,
      declaredRole: job.evidence.declaredRole,
      evidenceType: job.evidence.evidenceType,
      participationDate: job.evidence.participationDate?.toISOString() ?? null,
      files: job.evidence.files.map((file) => ({ id: file.id, storageKey: file.fileUrl, fileType: file.fileType, fileName: file.fileName })),
      criterionId: job.evidence.criterionAssessment?.criterion.id ?? null,
      rubricVersionId: job.evidence.criterionAssessment?.criterion.rubricVersionId ?? null,
    })).digest('hex');
    const run = await this.prisma.aiPipelineRun.create({
      data: {
        jobId,
        evidenceId: job.evidenceId,
        attempt: job.attempts,
        status: 'PROCESSING',
        inputVersion: job.evidence.version,
        inputHash: inputFingerprint,
        rubricVersionId: job.evidence.criterionAssessment?.criterion.rubricVersionId ?? null,
        modelName: process.env.AI_MODEL_NAME || null,
        modelVersion: process.env.AI_MODEL_VERSION || null,
        configVersion: process.env.AI_PIPELINE_CONFIG_VERSION || null,
        steps: { create: { stepKey: 'EXTERNAL_PIPELINE', status: 'PENDING', inputHash: inputFingerprint } },
      },
      include: { steps: true },
    });
    const pipelineStep = run.steps[0];
    const pipelineUrl = process.env.AI_PIPELINE_URL;
    if (!pipelineUrl) {
      await this.prisma.$transaction(async (tx) => {
        if (!(await this.acceptResult(tx, job, run, pipelineStep.id))) return;
        await tx.aiProcessingJob.update({ where: { id: jobId }, data: { status: AiProcessingJobStatus.UNAVAILABLE, error: 'AI_PIPELINE_URL chưa được cấu hình.', completedAt: new Date() } });
        await tx.evidence.update({ where: { id: job.evidenceId }, data: { status: EvidenceStatus.NEEDS_HUMAN_REVIEW } });
        await tx.aiPipelineRun.update({ where: { id: run.id }, data: { status: 'UNAVAILABLE', error: 'AI_PIPELINE_URL chưa được cấu hình.', completedAt: new Date() } });
        await tx.aiPipelineStep.update({ where: { id: pipelineStep.id }, data: { status: 'UNAVAILABLE', error: 'AI_PIPELINE_URL chưa được cấu hình.', completedAt: new Date() } });
      });
      return;
    }

    try {
      const rubricCriterion = job.evidence.criterionAssessment?.criterion;
      const files = await Promise.all(job.evidence.files.map(async (file) => ({
        url: await this.evidenceService.getFileUrl(file.fileUrl),
        fileName: file.fileName,
        fileType: file.fileType,
      })));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_PIPELINE_TIMEOUT_MS || 60000));
      let response: Response;
      try {
        response = await fetch(`${pipelineUrl.replace(/\/$/, '')}/evidence/process`, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...(process.env.AI_PIPELINE_TOKEN ? { Authorization: `Bearer ${process.env.AI_PIPELINE_TOKEN}` } : {}) },
          body: JSON.stringify({
            evidenceId: job.evidenceId,
            termId: job.evidence.termId,
            activityName: job.evidence.declaredActivityName,
            description: job.evidence.description,
            declaredRole: job.evidence.declaredRole,
            evidenceType: job.evidence.evidenceType,
            participationDate: job.evidence.participationDate,
            criterion: rubricCriterion ? { id: rubricCriterion.id, code: rubricCriterion.code, name: rubricCriterion.name, maxScore: rubricCriterion.maxScore, scoringConfig: rubricCriterion.scoringConfig } : null,
            files,
          }),
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) throw new Error(`AI pipeline trả HTTP ${response.status}`);
      const output = await response.json() as { suggestions?: PipelineSuggestion[] };
      if (!Array.isArray(output.suggestions)) throw new Error('AI pipeline response thiếu danh sách suggestions');
      const criteria = rubricCriterion ? await this.prisma.criterion.findMany({ where: { rubricVersionId: rubricCriterion.rubricVersionId } }) : [];
      const caps = new Map(criteria.map((criterion) => [criterion.id, criterion.maxScore]));
      const suggestions = output.suggestions.map((suggestion) => {
        const maxScore = caps.get(suggestion.criterionId);
        if (maxScore === undefined || !suggestion.reasoning?.trim()) throw new Error('AI trả về tiêu chí ngoài rubric hoặc thiếu giải thích');
        if (suggestion.suggestedScore != null && (!Number.isFinite(suggestion.suggestedScore) || suggestion.suggestedScore < 0 || suggestion.suggestedScore > maxScore)) throw new Error('Điểm AI không hợp lệ hoặc vượt trần tiêu chí');
        if (suggestion.confidenceScore != null && (!Number.isFinite(suggestion.confidenceScore) || suggestion.confidenceScore < 0 || suggestion.confidenceScore > 1)) throw new Error('Độ tin cậy AI phải nằm trong khoảng 0–1');
        return suggestion;
      });
      await this.prisma.$transaction(async (tx) => {
        if (!(await this.acceptResult(tx, job, run, pipelineStep.id))) return;
        for (const suggestion of suggestions) await tx.aiSuggestion.create({ data: { evidenceId: job.evidenceId, criterionId: suggestion.criterionId, suggestedScore: suggestion.suggestedScore ?? null, reasoning: suggestion.reasoning.trim(), confidenceScore: suggestion.confidenceScore ?? null } });
        await tx.aiProcessingJob.update({ where: { id: jobId }, data: { status: AiProcessingJobStatus.COMPLETED, error: null, completedAt: new Date() } });
        await tx.evidence.update({ where: { id: job.evidenceId }, data: { status: EvidenceStatus.NEEDS_HUMAN_REVIEW } });
        const output = { suggestionCount: suggestions.length, criterionIds: suggestions.map((suggestion) => suggestion.criterionId) };
        await tx.aiPipelineRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', output, completedAt: new Date() } });
        await tx.aiPipelineStep.update({ where: { id: pipelineStep.id }, data: { status: 'COMPLETED', output, completedAt: new Date() } });
      });
    } catch (error: any) {
      const message = error?.message || 'AI pipeline xử lý thất bại';
      await this.prisma.$transaction(async (tx) => {
        if (!(await this.acceptResult(tx, job, run, pipelineStep.id))) return;
        const retry = job.attempts < 3;
        await tx.aiProcessingJob.update({ where: { id: jobId }, data: {
          status: retry ? AiProcessingJobStatus.QUEUED : AiProcessingJobStatus.FAILED,
          error: message, completedAt: retry ? null : new Date(),
        } });
        if (!retry) await tx.evidence.update({ where: { id: job.evidenceId }, data: { status: EvidenceStatus.NEEDS_HUMAN_REVIEW } });
        await tx.aiPipelineRun.update({ where: { id: run.id }, data: { status: retry ? 'RETRYING' : 'FAILED', error: message, completedAt: new Date() } });
        await tx.aiPipelineStep.update({ where: { id: pipelineStep.id }, data: { status: 'FAILED', error: message, completedAt: new Date() } });
      });
    }
  }

  // Use the same term lock as faculty decisions and CTSV handoff. Validation and
  // writes must share a transaction so a late AI response cannot reopen a decision.
  private async acceptResult(
    tx: Prisma.TransactionClient,
    job: { id: string; evidenceId: string; evidence: { studentId: string; termId: string } },
    run: { id: string; inputVersion: number; rubricVersionId: string | null },
    stepId: string,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "Term" WHERE "id" = ${job.evidence.termId} FOR UPDATE`;
    const evidence = await tx.evidence.findUniqueOrThrow({ where: { id: job.evidenceId }, include: { term: true, criterionAssessment: { include: { criterion: true } } } });
    const currentJob = await tx.aiProcessingJob.findUnique({ where: { id: job.id }, select: { status: true } });
    const submission = run.rubricVersionId ? await tx.assessmentSubmission.findUnique({ where: { studentId_termId_rubricVersionId: { studentId: job.evidence.studentId, termId: job.evidence.termId, rubricVersionId: run.rubricVersionId } } }) : null;
    const handoff = await tx.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId: job.evidence.studentId, termId: job.evidence.termId } } });
    if (currentJob?.status === 'PROCESSING' && submission?.status === 'SUBMITTED'
      && evidence.version === run.inputVersion
      && evidence.criterionAssessment?.criterion.rubricVersionId === run.rubricVersionId
      && ['ACTIVE', 'REVIEWING'].includes(evidence.term.status)
      && !['SENT', 'EXCLUDED'].includes(handoff?.status ?? '')
      && ['PROCESSING', 'PLAUSIBLE', 'VERIFIED', 'NEEDS_HUMAN_REVIEW'].includes(evidence.status)) return true;
    const error = 'Hồ sơ đã thay đổi, đã có quyết định hoặc đã khóa; không áp dụng kết quả AI.';
    await tx.aiProcessingJob.updateMany({ where: { id: job.id, status: 'PROCESSING' }, data: { status: 'CANCELLED', error, completedAt: new Date() } });
    await tx.aiPipelineRun.update({ where: { id: run.id }, data: { status: 'CANCELLED', error, completedAt: new Date() } });
    await tx.aiPipelineStep.update({ where: { id: stepId }, data: { status: 'CANCELLED', error, completedAt: new Date() } });
    return false;
  }

  private async isStillSubmitted(jobId: string, studentId: string, termId: string, rubricVersionId?: string) {
    if (!rubricVersionId) return false;
    const [currentJob, submission] = await Promise.all([
      this.prisma.aiProcessingJob.findUnique({ where: { id: jobId }, select: { status: true } }),
      this.prisma.assessmentSubmission.findUnique({ where: { studentId_termId_rubricVersionId: { studentId, termId, rubricVersionId } }, select: { status: true } }),
    ]);
    return currentJob?.status === AiProcessingJobStatus.PROCESSING && submission?.status === 'SUBMITTED';
  }
}
