import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { AiProcessingJobStatus, EvidenceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EvidenceService } from './evidence.service';
import { getAiMode } from './ai-mode';

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
    if (getAiMode() === 'OFF') return;
    if (this.running) return;
    this.running = true;
    try {
      await this.recoverInterruptedJobs();
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

  // A lease outlives the external request timeout. Recovery is safe across processes:
  // term lock + compare-and-swap ensure only one worker recovers a given attempt.
  private async recoverInterruptedJobs() {
    const timeout = Number(process.env.AI_PIPELINE_TIMEOUT_MS || 60000);
    const leaseMs = Math.max(300000, (Number.isFinite(timeout) ? timeout : 60000) + 120000);
    const cutoff = new Date(Date.now() - leaseMs);
    const stale = await this.prisma.aiProcessingJob.findMany({ where: { status: 'PROCESSING', startedAt: { lt: cutoff } }, take: 20, include: { evidence: { select: { termId: true } } } });
    for (const job of stale) await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Term" WHERE "id" = ${job.evidence.termId} FOR UPDATE`;
      const changed = await tx.aiProcessingJob.updateMany({ where: { id: job.id, status: 'PROCESSING', attempts: job.attempts, startedAt: { lt: cutoff } }, data: { status: job.attempts < 3 ? 'QUEUED' : 'FAILED', error: 'Lượt xử lý bị gián đoạn hoặc hết thời gian giữ việc', completedAt: job.attempts < 3 ? null : new Date() } });
      if (!changed.count) return;
      const runs = await tx.aiPipelineRun.findMany({ where: { jobId: job.id, attempt: job.attempts, status: 'PROCESSING' }, select: { id: true } });
      await tx.aiPipelineStep.updateMany({ where: { runId: { in: runs.map(r => r.id) }, status: { in: ['PENDING', 'PROCESSING'] } }, data: { status: 'CANCELLED', error: 'Lượt xử lý bị gián đoạn', completedAt: new Date() } });
      await tx.aiPipelineRun.updateMany({ where: { id: { in: runs.map(r => r.id) } }, data: { status: 'CANCELLED', error: 'Lượt xử lý bị gián đoạn', completedAt: new Date() } });
      const term = await tx.term.findUnique({ where: { id: job.evidence.termId } });
      if (job.attempts >= 3 && term && ['ACTIVE', 'REVIEWING'].includes(term.status)) await tx.evidence.updateMany({ where: { id: job.evidenceId, status: 'PROCESSING' }, data: { status: 'NEEDS_HUMAN_REVIEW' } });
    });
  }

  private async processClaimed(jobId: string) {
    if (getAiMode() === 'OFF') return;
    const job = await this.prisma.aiProcessingJob.findUnique({ where: { id: jobId }, include: { evidence: { include: { files: true, term: true, student: { select: { fullName: true, studentCode: true } }, criterionAssessment: { include: { criterion: true } } } } } });
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
        actorType: 'AI',
        attempt: job.attempts,
        status: 'PROCESSING',
        inputVersion: job.evidence.version,
        inputHash: inputFingerprint,
        rubricVersionId: job.evidence.criterionAssessment?.criterion.rubricVersionId ?? null,
        modelName: process.env.AI_MODEL_NAME || null,
        modelVersion: process.env.AI_MODEL_VERSION || null,
        configVersion: process.env.AI_PIPELINE_CONFIG_VERSION || 'unversioned',
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
        if (getAiMode() === 'ASSIST') await tx.evidence.update({ where: { id: job.evidenceId }, data: { status: EvidenceStatus.NEEDS_HUMAN_REVIEW } });
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

      // P0-C: Fetch previous forensic hashes from pipeline runs for duplicate detection
      const previousRuns = await this.prisma.aiPipelineRun.findMany({
        where: {
          evidenceId: { not: job.evidenceId },
          status: 'COMPLETED',
          evidence: {
            termId: job.evidence.termId,  // same term
            status: { notIn: ['DRAFT', 'WITHDRAWN', 'REJECTED'] },
          },
        },
        select: { output: true },
        take: 500,
        orderBy: { completedAt: 'desc' },
      });
      const previousHashes = previousRuns
        .map((run) => {
          const output = run.output as Record<string, unknown> | null;
          const forensic = output?.forensicCheck as { sha256?: string; pHash?: string } | null;
          return forensic?.sha256 ? { sha256: forensic.sha256, pHash: forensic.pHash ?? '' } : null;
        })
        .filter((h): h is { sha256: string; pHash: string } => h !== null);

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
            termStartDate: job.evidence.term.startDate,
            termEndDate: job.evidence.term.endDate,
            declaredStudent: job.evidence.student,
            criterion: rubricCriterion ? { id: rubricCriterion.id, code: rubricCriterion.code, name: rubricCriterion.name, maxScore: rubricCriterion.maxScore, scoringConfig: rubricCriterion.scoringConfig } : null,
            files,
            previousHashes,
            enableWebSearch: true,
          }),
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) {
        throw new Error(`AI pipeline trả HTTP ${response.status}.`);
      }
       const output = await response.json() as {
        suggestions?: PipelineSuggestion[];
        analysis?: {
          schemaVersion?: string;
          scoreBreakdown?: Array<{ component: string; source: string; status: string; score: number; weight: number }>;
          aiConfidenceScore?: number;
          tier?: string;
          pipelineMode?: string;
          recommendation?: string;
          criterionAssessment?: {
            status?: string;
            matchScore?: number | null;
            threshold?: number;
            missingRequirements?: string[];
          };
          ocrExtraction?: {
            rawText?: string;
            available?: boolean;
            errorDetails?: string | null;
            studentNameExtracted?: string | null;
            studentCodeExtracted?: string | null;
            activityNameExtracted?: string | null;
            organizerExtracted?: string | null;
            issuedDateExtracted?: string | null;
            certificateNumber?: string | null;
            nameMatchRatio?: number;
            codeMatched?: boolean;
            codeMismatch?: boolean;
            bloodDonation?: Record<string, unknown> | null;
          } | null;
          webVerification?: {
            articleTitle?: string | null;
            articleUrl?: string | null;
            confidenceBoost?: number;
          };
          faceVerification?: {
            status?: string;
            facesDetected?: number;
            identityComparisonAvailable?: boolean;
          } | null;
          forensicCheck?: {
            isTampered?: boolean;
            sha256?: string;
            pHash?: string;
            elaAnomalyScore?: number;
            warnings?: string[];
          };
          qualityCheck?: { passed?: boolean; blurScore?: number; brightness?: number; qualityScore?: number; errorDetails?: string | null };
          documentChecks?: Array<{ key: string; label: string; status: string; details: string; score_delta?: number; evidence?: Record<string, unknown>; message_vi?: string }>;
          documentMarks?: {
            signatureStatus?: string;
            sealStatus?: string;
            signatureEvidence?: string;
            sealEvidence?: string;
          } | null;
          templateMatch?: {
            status?: string;
            matchedTemplateId?: string | null;
            confidence?: number;
            evidence?: string;
          } | null;
          breakdown?: Record<string, unknown>;
        };
      };
      if (!Array.isArray(output.suggestions)) throw new Error('AI pipeline response thiếu danh sách suggestions');
      if (output.analysis?.schemaVersion !== '1.0') throw new Error('AI pipeline trả thiếu hoặc không hỗ trợ schemaVersion; chuyển hồ sơ sang cán bộ kiểm tra.');
      if (!Array.isArray(output.analysis?.documentChecks) || !Array.isArray(output.analysis?.scoreBreakdown)) throw new Error('AI pipeline thiếu checker contract hoặc score breakdown; chuyển hồ sơ sang cán bộ kiểm tra.');
      for (const check of output.analysis.documentChecks) {
        if (!['PASS', 'REVIEW', 'FAIL', 'NOT_CHECKED'].includes(check.status)
          || !Number.isFinite(check.score_delta)
          || typeof check.message_vi !== 'string'
          || !check.evidence || typeof check.evidence !== 'object') {
          throw new Error('AI pipeline trả checker không hợp lệ; chuyển hồ sơ sang cán bộ kiểm tra.');
        }
      }
      for (const component of output.analysis.scoreBreakdown) {
        if (typeof component.component !== 'string'
          || typeof component.source !== 'string'
          || !['PASS', 'REVIEW', 'FAIL', 'NOT_CHECKED'].includes(component.status)
          || !Number.isFinite(component.score)
          || !Number.isFinite(component.weight)) {
          throw new Error('AI pipeline trả score breakdown không hợp lệ; chuyển hồ sơ sang cán bộ kiểm tra.');
        }
      }
      const criteria = rubricCriterion ? await this.prisma.criterion.findMany({ where: { rubricVersionId: rubricCriterion.rubricVersionId } }) : [];
      const caps = new Map(criteria.map((criterion) => [criterion.id, criterion.maxScore]));
      const suggestions = output.suggestions.map((suggestion) => {
        const maxScore = caps.get(suggestion.criterionId);
        if (maxScore === undefined || !suggestion.reasoning?.trim()) throw new Error('AI trả về tiêu chí ngoài rubric hoặc thiếu giải thích');
        if (suggestion.suggestedScore != null && (!Number.isFinite(suggestion.suggestedScore) || suggestion.suggestedScore < 0 || suggestion.suggestedScore > maxScore)) throw new Error('Điểm AI không hợp lệ hoặc vượt trần tiêu chí');
        if (suggestion.confidenceScore != null && (!Number.isFinite(suggestion.confidenceScore) || suggestion.confidenceScore < 0 || suggestion.confidenceScore > 1)) throw new Error('Độ tin cậy AI phải nằm trong khoảng 0–1');
        return suggestion;
      });
      const analysis = output.analysis;

      // P0-C: Extract duplicate detection result from AI response
      const isDuplicate = Boolean((output.analysis as any)?.isDuplicate);
      const duplicateMatchType = (output.analysis as any)?.duplicateMatchType ?? null;

      // P0-D: Audit sampling — randomly flag ~7.5% of GREEN evidences for human review
      const tier = output.analysis?.tier;
      const confidenceScore = output.analysis?.aiConfidenceScore ?? 0;
      const auditSampled = tier === 'GREEN' && confidenceScore >= 90 && Math.random() < 0.075;

      await this.prisma.$transaction(async (tx) => {
        if (!(await this.acceptResult(tx, job, run, pipelineStep.id))) return;
        if (getAiMode() === 'SHADOW') {
          const shadowOutput = {
            actorType: 'AI',
            configVersion: run.configVersion ?? process.env.AI_PIPELINE_CONFIG_VERSION ?? 'unversioned',
            schemaVersion: analysis?.schemaVersion,
            decision: 'REVIEW',
            decisionReason: 'Chạy nền SHADOW; kết quả không áp dụng vào hồ sơ.',
            checkerResults: (analysis?.documentChecks ?? []).map((check: any) => ({ checker: check.key, status: check.status, score_delta: check.score_delta ?? 0, evidence: check.evidence ?? {}, message_vi: check.message_vi ?? check.details })),
            scoreBreakdown: analysis?.scoreBreakdown ?? [],
            score: analysis?.aiConfidenceScore ?? null,
            pipelineMode: analysis?.pipelineMode ?? null,
          };
          await tx.aiProcessingJob.update({ where: { id: jobId }, data: { status: AiProcessingJobStatus.COMPLETED, error: null, completedAt: new Date() } });
          await tx.aiPipelineRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', output: shadowOutput, completedAt: new Date() } });
          await tx.aiPipelineStep.update({ where: { id: pipelineStep.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
          return;
        }
        const firstFile = job.evidence.files[0];
        const ocr = analysis?.ocrExtraction;
        const studentCodeMismatch = analysis?.pipelineMode === 'DOCUMENT_PIPELINE' && ocr?.codeMismatch === true;
        const studentNameMismatch = analysis?.pipelineMode === 'DOCUMENT_PIPELINE'
          && Boolean(ocr?.studentNameExtracted)
          && (ocr?.nameMatchRatio ?? 0) < 70;
        const termDateMismatch = analysis?.breakdown?.termDateMismatch === true;
        const citizenIdMismatch = analysis?.pipelineMode === 'DOCUMENT_PIPELINE'
          && analysis?.breakdown?.citizenIdMismatch === true;
        const identityMismatch = studentCodeMismatch || studentNameMismatch || citizenIdMismatch;
        const documentMismatch = identityMismatch || termDateMismatch;
        if (firstFile && ocr) {
          await tx.ocrResult.create({
            data: {
              evidenceFileId: firstFile.id,
              evidenceId: job.evidenceId,
              extractedText: ocr.rawText ?? '',
              studentNameExtracted: ocr.studentNameExtracted ?? null,
              studentCodeExtracted: ocr.studentCodeExtracted ?? null,
              activityNameExtracted: ocr.activityNameExtracted ?? null,
              organizerExtracted: ocr.organizerExtracted ?? null,
              dateExtracted: ocr.issuedDateExtracted ?? null,
              certificateCode: ocr.certificateNumber ?? null,
              extractedFieldsJson: {
                available: ocr.available ?? false,
                errorDetails: ocr.errorDetails ?? null,
                nameMatchRatio: ocr.nameMatchRatio ?? 0,
                codeMatched: ocr.codeMatched ?? false,
                codeMismatch: ocr.codeMismatch ?? false,
                bloodDonation: ocr.bloodDonation ?? null,
                recognitionMethod: (ocr as any).recognitionMethod ?? null,
                recognitionConfidence: (ocr as any).recognitionConfidence ?? null,
                processingTimeMs: (ocr as any).processingTimeMs ?? null,
              } as Prisma.InputJsonValue,
              confidenceScore: (analysis?.aiConfidenceScore ?? 0) / 100,
            },
          });
        }
        const article = analysis?.webVerification?.articleTitle;
        await tx.verificationResult.create({
          data: {
            evidenceId: job.evidenceId,
            verificationLevel: article ? 2 : 1,
            status: documentMismatch ? 'INVALID' : 'NEEDS_HUMAN_REVIEW',
            activityExistsVerified: Boolean(article),
            studentParticipationVerified: false,
            sourceDescription: [
              `AI ${analysis?.pipelineMode ?? 'pipeline'}: ${analysis?.aiConfidenceScore ?? 0}/100 (${analysis?.tier ?? 'chưa phân loại'}).`,
              analysis?.recommendation,
              article ? `Nguồn đối chiếu: ${article} (${analysis?.webVerification?.articleUrl ?? 'không có URL'}).` : null,
            ].filter(Boolean).join(' '),
            evidenceGap: {
              ocrAvailable: ocr?.available ?? false,
              studentNameMatch: (ocr?.nameMatchRatio ?? 0) >= 85,
              studentCodeMatched: ocr?.codeMatched ?? false,
              studentCodeMismatch,
              studentNameMismatch,
              citizenIdMismatch,
              termDateMismatch,
              needsHumanReview: !studentCodeMismatch,
              systemInvalidated: documentMismatch,
              isDuplicate,
              duplicateMatchType: duplicateMatchType ?? null,
            } as Prisma.InputJsonValue,
          },
        });
        if (analysis?.forensicCheck?.isTampered) {
          await tx.anomalyFlag.create({
            data: {
              evidenceId: job.evidenceId,
              flagType: 'OTHER',
              description: (analysis.forensicCheck.warnings ?? []).join(' ') || 'Kiểm tra ELA phát hiện dấu hiệu ảnh bất thường.',
              severity: 'MEDIUM',
            },
          });
        }
        if (ocr && !ocr.available) {
          await tx.anomalyFlag.create({
            data: {
              evidenceId: job.evidenceId,
              flagType: 'MISSING_INFO',
              description: ocr.errorDetails || 'OCR chưa khả dụng; cần cán bộ kiểm tra tệp gốc.',
              severity: 'LOW',
            },
          });
        }
        if (documentMismatch) {
          await tx.anomalyFlag.create({
            data: {
              evidenceId: job.evidenceId,
              flagType: 'OTHER',
              description: studentCodeMismatch
                ? 'MSSV đọc được trên minh chứng không khớp hồ sơ sinh viên; hệ thống tự động đánh dấu minh chứng không hợp lệ (ĐỎ).'
                : studentNameMismatch
                  ? 'Tên đọc được trên minh chứng khác đáng kể với hồ sơ sinh viên; hệ thống tự động đánh dấu cần xác minh (ĐỎ).'
                  : citizenIdMismatch
                    ? 'Số CCCD đọc được trên giấy hiến máu không khớp hồ sơ sinh viên; hệ thống tự động đánh dấu minh chứng không hợp lệ (ĐỎ).'
                    : 'Ngày cấp trên minh chứng nằm ngoài khoảng ngày học kỳ đang xét; hồ sơ cần xác minh (ĐỎ).',
              severity: 'HIGH',
            },
          });
          await tx.notification.create({
            data: {
              userId: job.evidence.studentId,
              relatedEvidenceId: job.evidenceId,
              type: 'EVIDENCE_INVALID',
              eventKey: 'EVIDENCE_INVALID',
              dedupeKey: `evidence-invalid:${job.evidenceId}:${run.id}`,
              title: 'Minh chứng cần xác minh',
              content: studentCodeMismatch
                ? 'MSSV đọc được trên giấy không khớp hồ sơ sinh viên. Minh chứng đã được đánh dấu cần xác minh; nếu OCR nhận diện nhầm, vui lòng liên hệ cán bộ phụ trách.'
                : studentNameMismatch
                  ? 'Tên đọc được trên giấy khác đáng kể với hồ sơ sinh viên. Minh chứng đã được đánh dấu cần xác minh; vui lòng liên hệ cán bộ phụ trách nếu OCR nhận diện nhầm.'
                  : citizenIdMismatch
                    ? 'Số CCCD đọc được trên giấy hiến máu không khớp hồ sơ sinh viên. Minh chứng đã được đánh dấu cần xác minh; vui lòng liên hệ cán bộ phụ trách nếu OCR nhận diện nhầm.'
                    : 'Ngày cấp trên giấy nằm ngoài khoảng ngày học kỳ đang xét. Minh chứng đã được đánh dấu cần xác minh; vui lòng liên hệ cán bộ phụ trách nếu thông tin học kỳ chưa chính xác.',
              targetPath: `/student/scores?termId=${job.evidence.termId}`,
              metadata: {
                evidenceId: job.evidenceId,
                termId: job.evidence.termId,
                reason: studentCodeMismatch ? 'STUDENT_CODE_MISMATCH' : studentNameMismatch ? 'STUDENT_NAME_MISMATCH' : citizenIdMismatch ? 'CITIZEN_ID_MISMATCH' : 'TERM_DATE_MISMATCH',
              },
            },
          });
        }
        // P0-C: Create anomaly flag when AI detects a duplicate submission
        if (isDuplicate) {
          await tx.anomalyFlag.create({
            data: {
              evidenceId: job.evidenceId,
              flagType: 'DUPLICATE',
              description: `Phát hiện trùng lặp (${duplicateMatchType ?? 'SIMILAR'}): hash ảnh khớp với minh chứng đã nộp trong kỳ. Cần cán bộ xác minh.`,
              severity: 'HIGH',
            },
          });
        }
        // P0-D: Create anomaly flag for audit-sampled GREEN evidences
        if (auditSampled) {
          await tx.anomalyFlag.create({
            data: {
              evidenceId: job.evidenceId,
              flagType: 'OTHER',
              description: 'Hồ sơ được rút ngẫu nhiên để kiểm toán chất lượng (5–10% mẫu XANH); cần cán bộ xem xét trực tiếp.',
              severity: 'LOW',
            },
          });
        }
        for (const suggestion of suggestions) await tx.aiSuggestion.create({ data: { evidenceId: job.evidenceId, criterionId: suggestion.criterionId, suggestedScore: suggestion.suggestedScore ?? null, reasoning: suggestion.reasoning.trim(), confidenceScore: suggestion.confidenceScore ?? null } });
        await tx.aiProcessingJob.update({ where: { id: jobId }, data: { status: AiProcessingJobStatus.COMPLETED, error: null, completedAt: new Date() } });
        await tx.evidence.update({
          where: { id: job.evidenceId },
          data: { status: documentMismatch ? EvidenceStatus.INVALID : EvidenceStatus.NEEDS_HUMAN_REVIEW },
        });
        const runOutput = {
          actorType: 'AI',
          configVersion: run.configVersion ?? process.env.AI_PIPELINE_CONFIG_VERSION ?? 'unversioned',
          aiDecision: documentMismatch ? 'INVALID' : 'REVIEW',
          schemaVersion: analysis?.schemaVersion,
          decisionReason: analysis?.recommendation ?? 'Cần cán bộ kiểm tra kết quả AI.',
          checkerResults: (analysis?.documentChecks ?? []).map((check: any) => ({
            checker: check.key,
            status: check.status,
            score_delta: check.score_delta ?? 0,
            evidence: check.evidence ?? {},
            message_vi: check.message_vi ?? check.details,
          })),
          scoreBreakdown: analysis?.scoreBreakdown ?? [],
          suggestionCount: suggestions.length,
          criterionIds: suggestions.map((suggestion) => suggestion.criterionId),
          pipelineMode: analysis?.pipelineMode ?? null,
          confidenceScore: analysis?.aiConfidenceScore ?? null,
          score: analysis?.aiConfidenceScore ?? null,
          tier: analysis?.tier ?? null,
          auditSampled,
          isDuplicate,
          duplicateMatchType,
          qualityCheck: analysis?.qualityCheck ?? null,
          criterionAssessment: analysis?.criterionAssessment ?? null,
          webVerification: analysis?.webVerification ?? null,
          faceVerification: analysis?.faceVerification?.status === 'NOT_CHECKED' ? null : analysis?.faceVerification ?? null,
          forensicCheck: analysis?.forensicCheck ?? null,
          documentChecks: analysis?.documentChecks ?? [],
          documentMarks: analysis?.documentMarks ?? null,
          templateMatch: analysis?.templateMatch ?? null,
        };
        await tx.aiPipelineRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', output: runOutput as Prisma.InputJsonValue, completedAt: new Date() } });
        await tx.aiPipelineStep.update({ where: { id: pipelineStep.id }, data: { status: 'COMPLETED', output: runOutput as Prisma.InputJsonValue, completedAt: new Date() } });
      });
    } catch (error: any) {
      // Do not persist provider response bodies or OCR-derived values in job/run errors.
      const message = 'AI chưa xử lý được phản hồi; hồ sơ được giữ để cán bộ kiểm tra.';
      await this.prisma.$transaction(async (tx) => {
        if (!(await this.acceptResult(tx, job, run, pipelineStep.id))) return;
        const retry = job.attempts < 3;
        await tx.aiProcessingJob.update({ where: { id: jobId }, data: {
          status: retry ? AiProcessingJobStatus.QUEUED : AiProcessingJobStatus.FAILED,
          error: message, completedAt: retry ? null : new Date(),
        } });
        if (!retry && getAiMode() === 'ASSIST') await tx.evidence.update({ where: { id: job.evidenceId }, data: { status: EvidenceStatus.NEEDS_HUMAN_REVIEW } });
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
    run: { id: string; attempt?: number; inputVersion: number; rubricVersionId: string | null },
    stepId: string,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "Term" WHERE "id" = ${job.evidence.termId} FOR UPDATE`;
    const evidence = await tx.evidence.findUniqueOrThrow({ where: { id: job.evidenceId }, include: { term: true, criterionAssessment: { include: { criterion: true } } } });
    const currentJob = await tx.aiProcessingJob.findUnique({ where: { id: job.id }, select: { status: true, attempts: true } });
    const submission = run.rubricVersionId ? await tx.assessmentSubmission.findUnique({ where: { studentId_termId_rubricVersionId: { studentId: job.evidence.studentId, termId: job.evidence.termId, rubricVersionId: run.rubricVersionId } } }) : null;
    const handoff = await tx.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId: job.evidence.studentId, termId: job.evidence.termId } } });
    const allowDraft = process.env.AI_ALLOW_DRAFT_PROCESSING === 'true';
    const submissionOk = submission?.status === 'SUBMITTED' || (allowDraft && evidence.status === 'DRAFT');
    const statusOk = ['PROCESSING', 'PLAUSIBLE', 'VERIFIED', 'NEEDS_HUMAN_REVIEW'].includes(evidence.status)
      || (allowDraft && evidence.status === 'DRAFT');
    if (currentJob?.status === 'PROCESSING' && (run.attempt === undefined || currentJob.attempts === run.attempt) && submissionOk
      && evidence.version === run.inputVersion
      && evidence.criterionAssessment?.criterion.rubricVersionId === run.rubricVersionId
      && ['ACTIVE', 'REVIEWING'].includes(evidence.term.status)
      && !['SENT', 'EXCLUDED'].includes(handoff?.status ?? '')
      && statusOk) return true;
    const error = 'Hồ sơ đã thay đổi, đã có quyết định hoặc đã khóa; không áp dụng kết quả AI.';
    await tx.aiProcessingJob.updateMany({ where: { id: job.id, status: 'PROCESSING', ...(run.attempt === undefined ? {} : { attempts: run.attempt }) }, data: { status: 'CANCELLED', error, completedAt: new Date() } });
    await tx.aiPipelineRun.update({ where: { id: run.id }, data: { status: 'CANCELLED', error, completedAt: new Date() } });
    await tx.aiPipelineStep.update({ where: { id: stepId }, data: { status: 'CANCELLED', error, completedAt: new Date() } });
    return false;
  }

  private async isStillSubmitted(jobId: string, studentId: string, termId: string, rubricVersionId?: string) {
    if (!rubricVersionId) {
      await this.prisma.aiProcessingJob.updateMany({ where: { id: jobId, status: 'PROCESSING' }, data: { status: 'CANCELLED', error: 'Minh chứng không có tiêu chí thuộc rubric', completedAt: new Date() } });
      return false;
    }
    const [currentJob, submission] = await Promise.all([
      this.prisma.aiProcessingJob.findUnique({ where: { id: jobId }, select: { status: true, evidence: { select: { status: true } } } }),
      this.prisma.assessmentSubmission.findUnique({ where: { studentId_termId_rubricVersionId: { studentId, termId, rubricVersionId } }, select: { status: true } }),
    ]);
    const allowDraft = process.env.AI_ALLOW_DRAFT_PROCESSING === 'true' && currentJob?.evidence?.status === 'DRAFT';
    const valid = currentJob?.status === AiProcessingJobStatus.PROCESSING && (submission?.status === 'SUBMITTED' || allowDraft);
    if (!valid) await this.prisma.aiProcessingJob.updateMany({ where: { id: jobId, status: 'PROCESSING' }, data: { status: 'CANCELLED', error: 'Phiếu chưa nộp hoặc đã được trả lại', completedAt: new Date() } });
    return valid;
  }
}
