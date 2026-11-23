import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getAiMode } from './ai-mode';
import { CreateEvidenceDto, UploadEvidenceFileDto, UploadFileDto, SubmitSupplementDto, InspectAiDto } from './dto/evidence.dto';
import { EvidenceStatus, Role, TermStatus } from '@prisma/client';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import { randomUUID } from 'crypto';

@Injectable()
export class EvidenceService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService) { }

  async findAll(
    user: any,
    params: {
      studentId?: string;
      termId?: string;
      classId?: string;
      status?: EvidenceStatus;
      statusGroup?: string;
      search?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      pageSize?: number;
    },
  ) {
    const { termId, classId, status, statusGroup, search, sortOrder = 'desc', page = 1, pageSize = 20 } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    where.AND = [await this.workflow.evidenceScope(user, termId, classId)];
    if (params.studentId && user.role !== Role.STUDENT) where.studentId = params.studentId;

    if (termId) where.termId = termId;

    if (statusGroup === 'APPROVED') {
      where.status = EvidenceStatus.APPROVED;
    } else if (statusGroup === 'SUPPLEMENT') {
      where.status = EvidenceStatus.NEEDS_SUPPLEMENT;
    } else if (statusGroup === 'REVIEWING') {
      where.status = {
        in: [EvidenceStatus.NEEDS_HUMAN_REVIEW, EvidenceStatus.PROCESSING, EvidenceStatus.PLAUSIBLE],
      };
    } else if (status && status !== ('ALL' as any)) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { declaredActivityName: { contains: search, mode: 'insensitive' } },
        { student: { fullName: { contains: search, mode: 'insensitive' } } },
        { student: { studentCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const baseScopeWhere = { ...where };
    delete baseScopeWhere.status;

    const [items, total, countAll, countApproved, countSupplement, countReviewing] = await Promise.all([
      this.prisma.evidence.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { submittedAt: sortOrder },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              studentCode: true,
              class: { select: { id: true, code: true, name: true } },
            },
          },
          term: { select: { id: true, code: true, name: true, status: true } },
          activity: { select: { id: true, name: true, type: true } },
          files: true,
          lockedBy: { select: { id: true, fullName: true } },
          verificationResults: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          aiSuggestions: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          aiProcessingJobs: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              pipelineRuns: {
                take: 1,
                orderBy: { startedAt: 'desc' },
                select: {
                  id: true,
                  status: true,
                  inputVersion: true,
                  rubricVersionId: true,
                  output: true,
                },
              },
            },
          },
          anomalyFlags: true,
          reviews: {
            include: {
              reviewer: { select: { fullName: true } },
              criterion: { select: { code: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          criterionAssessment: {
            select: {
              id: true,
              criterionId: true,
              criterion: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  maxScore: true,
                  rubricVersionId: true,
                },
              },
            },
          },
          supplementRequests: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          },
        },
      }),
      this.prisma.evidence.count({ where }),
      this.prisma.evidence.count({ where: baseScopeWhere }),
      this.prisma.evidence.count({ where: { ...baseScopeWhere, status: EvidenceStatus.APPROVED } }),
      this.prisma.evidence.count({ where: { ...baseScopeWhere, status: EvidenceStatus.NEEDS_SUPPLEMENT } }),
      this.prisma.evidence.count({
        where: {
          ...baseScopeWhere,
          status: { in: [EvidenceStatus.NEEDS_HUMAN_REVIEW, EvidenceStatus.PROCESSING, EvidenceStatus.PLAUSIBLE] },
        },
      }),
    ]);

    const aiMode = getAiMode();
    return {
      items: await Promise.all(items.map(async (item) => {
        const signed = await this.withSignedFiles(item);
        return aiMode === 'ASSIST' ? { ...signed, aiMode } : { ...signed, aiMode, aiSuggestions: [], aiProcessingJobs: [] };
      })),
      total,
      page,
      pageSize,
      counts: {
        all: countAll,
        approved: countApproved,
        supplement: countSupplement,
        reviewing: countReviewing,
      },
    };
  }

  async findOne(id: string, user: any) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            studentCode: true,
            email: true,
            class: { select: { id: true, code: true, name: true, facultyId: true } },
          },
        },
        term: true,
        aiSuggestions: { orderBy: { createdAt: 'desc' }, take: 1 },
        ocrResults: { orderBy: { createdAt: 'desc' }, take: 1 },
        verificationResults: { orderBy: { createdAt: 'desc' } },
        anomalyFlags: true,
        activity: {
          include: {
            participants: {
              where: { studentId: user.id },
            },
          },
        },
        files: true,
        criterionAssessment: { select: { criterion: { select: { id: true, code: true, name: true, maxScore: true, rubricVersionId: true } } } },
        aiProcessingJobs: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { pipelineRuns: { orderBy: { startedAt: 'desc' }, take: 1, include: { steps: { orderBy: { startedAt: 'asc' } } } } },
        },
        reviews: {
          include: {
            reviewer: { select: { id: true, fullName: true, role: true } },
            criterion: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        supplementRequests: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
        appeals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');

    await this.workflow.scope(user, evidence.studentId, evidence.termId);

    const [handoff, submitted] = await Promise.all([
      this.prisma.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId: evidence.studentId, termId: evidence.termId } } }),
      this.prisma.assessmentSubmission.count({ where: { studentId: evidence.studentId, termId: evidence.termId, status: 'SUBMITTED' } }),
    ]);
    const canReview = user.role === Role.STAFF && ['ACTIVE', 'REVIEWING'].includes(evidence.term.status) && !['DRAFT', 'WITHDRAWN', 'APPROVED', 'REJECTED'].includes(evidence.status) && !['SENT', 'EXCLUDED'].includes(handoff?.status ?? '') && (!evidence.term.workflowEnabled || !!handoff && submitted > 0);
    const signed = await this.withSignedFiles(evidence);
    const latestRun = evidence.aiProcessingJobs?.[0]?.pipelineRuns?.[0];
    const currentRubric = evidence.criterionAssessment?.criterion?.rubricVersionId;
    const aiIsCurrent = latestRun?.status === 'COMPLETED' && latestRun.inputVersion === evidence.version && latestRun.rubricVersionId === currentRubric;
    const aiMode = getAiMode();
    if (aiMode !== 'ASSIST') return { ...signed, permissions: { canReview }, aiMode, aiSuggestions: [], ocrResults: [], aiProcessingJobs: [], aiAnalysisStatus: 'NOT_STARTED' };
    return { ...signed, permissions: { canReview }, aiMode, aiSuggestions: aiIsCurrent ? signed.aiSuggestions : [], aiAnalysisStatus: latestRun && !aiIsCurrent && latestRun.status === 'COMPLETED' ? 'STALE' : latestRun?.status ?? 'NOT_STARTED' };
  }

  private async withSignedFiles<T extends { files?: Array<{ fileUrl: string; signedUrlAvailable?: boolean }> }>(value: T): Promise<T> {
    if (!value.files?.length) return value;
    const files = await Promise.all(
      value.files.map(async (file) => {
        try {
          const signedUrl = await this.getFileUrl(file.fileUrl);
          return { ...file, fileUrl: signedUrl, signedUrlAvailable: true };
        } catch (_err) {
          return { ...file, fileUrl: file.fileUrl, signedUrlAvailable: false };
        }
      }),
    );
    return { ...value, files };
  }

  private async cleanupStorageObject(fileUrl: string): Promise<{ success: boolean; error?: string }> {
    if (!fileUrl || !fileUrl.startsWith('evidence/')) return { success: true };
    try {
      let config: { baseUrl: string; key: string; bucket: string };
      try {
        config = this.getStorageConfig();
      } catch (configErr: any) {
        console.warn(`[EvidenceStorageCleanup] Không lấy được cấu hình Storage để dọn tệp ${fileUrl}: ${configErr?.message}`);
        return { success: false, error: configErr?.message || 'Thiếu cấu hình Storage' };
      }
      const { baseUrl, key, bucket } = config;
      const objectKey = fileUrl.slice('evidence/'.length);
      const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`[EvidenceStorageCleanup] Dọn tệp Storage ${fileUrl} thất bại (HTTP ${response.status}): ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }
      return { success: true };
    } catch (networkErr: any) {
      console.warn(`[EvidenceStorageCleanup] Lỗi kết nối khi dọn tệp Storage ${fileUrl}: ${networkErr?.message}`);
      return { success: false, error: networkErr?.message || 'Lỗi mạng khi gọi Storage' };
    }
  }

  private getStorageConfig() {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_EVIDENCE_BUCKET || 'evidence';
    if (!baseUrl || !key) throw new ServiceUnavailableException('Chưa cấu hình Supabase Storage. Hãy thêm SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY vào .env của backend hoặc .env ở thư mục gốc, sau đó khởi động lại backend.');
    return { baseUrl, key, bucket };
  }

  async getFileUrl(fileUrl: string) {
    if (!fileUrl.startsWith('evidence/')) return fileUrl;
    const { baseUrl, key, bucket } = this.getStorageConfig();
    const objectKey = fileUrl.slice('evidence/'.length);
    const response = await fetch(`${baseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!response.ok) throw new ServiceUnavailableException('Không tạo được liên kết xem tệp minh chứng trong Supabase Storage');
    const result = await response.json() as { signedURL?: string; signedUrl?: string };
    const signedPath = result.signedURL || result.signedUrl;
    if (!signedPath) throw new ServiceUnavailableException('Supabase Storage không trả về liên kết xem tệp');
    return signedPath.startsWith('http') ? signedPath : `${baseUrl}/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`;
  }

  async testAi(id: string, studentId: string) {
    if (getAiMode() !== 'ASSIST') throw new BadRequestException('AI đang tắt hoặc chạy nền; không có kết quả chạy thử để hiển thị.');
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: {
        files: true,
        term: { select: { startDate: true, endDate: true } },
        student: { select: { fullName: true, studentCode: true } },
        criterionAssessment: { include: { criterion: true } },
      },
    });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không có quyền kiểm tra hồ sơ này');
    if (evidence.status !== EvidenceStatus.DRAFT) throw new BadRequestException('Chỉ có thể chạy thử AI trên minh chứng nháp');
    if (!evidence.criterionAssessment?.criterion) throw new BadRequestException('Minh chứng cần được gắn với một tiêu chí trước khi chạy thử AI');
    if (!evidence.files.length) throw new BadRequestException('Hãy tải ít nhất một tệp minh chứng trước khi chạy thử AI');
    await this.prisma.$transaction(tx => this.workflow.assertStudentEditable(tx, studentId, evidence.termId));

    const pipelineUrl = process.env.AI_PIPELINE_URL;
    if (!pipelineUrl) throw new ServiceUnavailableException('AI_PIPELINE_URL chưa được cấu hình cho Backend');

    const criterion = evidence.criterionAssessment.criterion;
    const publishedRubric = await this.prisma.rubricVersion.findFirst({
      where: { id: criterion.rubricVersionId, termId: evidence.termId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!publishedRubric) throw new BadRequestException('Tiêu chí không còn thuộc rubric đang áp dụng của kỳ này');
    const files = await Promise.all(evidence.files.map(async file => ({
      url: await this.getFileUrl(file.fileUrl),
      fileName: file.fileName,
      fileType: file.fileType,
    })));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_PIPELINE_TIMEOUT_MS || 60000));
    let response: Response;
    try {
      response = await fetch(`${pipelineUrl.replace(/\/$/, '')}/evidence/process`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.AI_PIPELINE_TOKEN ? { Authorization: `Bearer ${process.env.AI_PIPELINE_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          evidenceId: evidence.id,
          termId: evidence.termId,
          activityName: evidence.declaredActivityName,
          description: evidence.description,
          declaredRole: evidence.declaredRole,
          evidenceType: evidence.evidenceType,
          participationDate: evidence.participationDate,
          termStartDate: evidence.term.startDate,
          termEndDate: evidence.term.endDate,
          declaredStudent: evidence.student,
          criterion: {
            id: criterion.id,
            code: criterion.code,
            name: criterion.name,
            maxScore: criterion.maxScore,
            scoringConfig: criterion.scoringConfig,
          },
          files,
          enableWebSearch: true,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi mạng không xác định';
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException('AI chạy thử quá thời gian chờ. Hãy thử lại sau.');
      }
      throw new ServiceUnavailableException(`Không kết nối được AI để chạy thử: ${message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      throw new ServiceUnavailableException(`AI chạy thử trả HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }

    const output = await response.json() as {
      suggestions?: Array<{
        criterionId: string;
        suggestedScore?: number | null;
        reasoning: string;
        confidenceScore?: number | null;
      }>;
      analysis?: Record<string, unknown>;
    };
    if (!Array.isArray(output.suggestions) || !output.analysis) {
      throw new ServiceUnavailableException('AI chạy thử trả về kết quả không đầy đủ');
    }
    const suggestions = output.suggestions.filter(suggestion => suggestion.criterionId === criterion.id);
    if (suggestions.some(suggestion =>
      (suggestion.suggestedScore != null && (!Number.isFinite(suggestion.suggestedScore) || suggestion.suggestedScore < 0 || suggestion.suggestedScore > criterion.maxScore))
      || (suggestion.confidenceScore != null && (!Number.isFinite(suggestion.confidenceScore) || suggestion.confidenceScore < 0 || suggestion.confidenceScore > 1))
      || !suggestion.reasoning?.trim(),
    )) {
      throw new ServiceUnavailableException('AI chạy thử trả về điểm hoặc giải thích không hợp lệ');
    }

    return { suggestions, analysis: output.analysis, persisted: false };
  }

  // Chạy thử AI trên một tệp minh chứng bất kỳ (không lưu kết quả).
  // Proxy sang AI Service để Web không phải gọi trực tiếp cổng 8000.
  async inspectAi(dto: InspectAiDto) {
    if (getAiMode() !== 'ASSIST') throw new BadRequestException('AI đang tắt hoặc chạy nền; không có kết quả kiểm tra để hiển thị.');
    const pipelineUrl = process.env.AI_PIPELINE_URL;
    if (!pipelineUrl) throw new ServiceUnavailableException('AI_PIPELINE_URL chưa được cấu hình cho Backend');

    const fileBytesBase64 = dto.fileData
      ? (dto.fileData.match(/^data:[^;]+;base64,(.+)$/)?.[1] || dto.fileData)
      : undefined;
    if (!fileBytesBase64 && !dto.fileUrl) {
      throw new BadRequestException('Cần cung cấp tệp minh chứng (fileData hoặc fileUrl) để chạy AI.');
    }

    const targetCriterion = dto.criterionId
      ? await this.prisma.criterion.findUnique({
          where: { id: dto.criterionId },
          select: { id: true, code: true, name: true, maxScore: true, scoringConfig: true },
        })
      : null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_PIPELINE_TIMEOUT_MS || 60000));
    let response: Response;
    try {
      response = await fetch(`${pipelineUrl.replace(/\/$/, '')}/api/v1/evidence/inspect`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.AI_PIPELINE_TOKEN ? { Authorization: `Bearer ${process.env.AI_PIPELINE_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          evidenceId: `ai-test-${randomUUID()}`,
          activityName: dto.activityName || null,
          evidenceType: dto.evidenceType,
          declaredStudent: dto.declaredStudent,
          participationDate: dto.participationDate || null,
          termStartDate: dto.termStartDate || null,
          termEndDate: dto.termEndDate || null,
          enableWebSearch: dto.enableWebSearch ?? true,
          fileUrl: dto.fileUrl || null,
          fileBytesBase64: fileBytesBase64 || null,
          previousHashes: dto.previousHashes || null,
          ocrEngine: dto.ocrEngine || 'auto',
          criterion: targetCriterion || null,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi mạng không xác định';
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException('AI chạy thử quá thời gian chờ. Hãy thử lại sau.');
      }
      throw new ServiceUnavailableException(`Không kết nối được AI để chạy thử: ${message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      throw new ServiceUnavailableException(`AI chạy thử trả HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }

    return await response.json();
  }

  async create(studentId: string, dto: CreateEvidenceDto) {
    // 1. Tìm kỳ học (mặc định lấy kỳ ACTIVE)
    let termId = dto.termId;
    if (!termId) {
      const activeTerm = await this.prisma.term.findFirst({ where: { status: TermStatus.ACTIVE } });
      if (!activeTerm) throw new BadRequestException('Hiện không có kỳ học nào đang mở nhận minh chứng');
      termId = activeTerm.id;
    } else {
      const term = await this.prisma.term.findUnique({ where: { id: termId } });
      if (!term) throw new NotFoundException('Không tìm thấy kỳ');
      await this.prisma.$transaction(tx => this.workflow.assertStudentEditable(tx, studentId, termId));
    }

    if (dto.fileUrls?.some(url => typeof url !== 'string' || url.startsWith('evidence/') && !url.startsWith(`evidence/${studentId}/${termId}/`))) throw new BadRequestException('Tệp không thuộc sinh viên và kỳ này');
    // 2. Tìm Tiêu chí nếu sinh viên có chọn
    let targetCriterion = null;
    if (dto.criterionId) {
      targetCriterion = await this.prisma.criterion.findUnique({ where: { id: dto.criterionId } });
    } else if (dto.criterionCode) {
      targetCriterion = await this.prisma.criterion.findFirst({
        where: { code: dto.criterionCode, rubricVersion: { termId, status: 'PUBLISHED' } },
      });
    }

    const publishedVersion = await this.prisma.rubricVersion.findFirst({
      where: { termId, status: 'PUBLISHED' },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (publishedVersion && (!targetCriterion || targetCriterion.rubricVersionId !== publishedVersion.id)) {
      throw new BadRequestException('Hãy chọn một tiêu chí thuộc rubric đang áp dụng cho kỳ này');
    }

    if (targetCriterion?.rubricVersionId) {
      const criterionVersion = await this.prisma.rubricVersion.findUnique({ where: { id: targetCriterion.rubricVersionId } });
      if (!criterionVersion || criterionVersion.termId !== termId || criterionVersion.status !== 'PUBLISHED') {
        throw new BadRequestException('Tiêu chí không thuộc phiên bản quy chế đang áp dụng cho kỳ này');
      }
    }

    // 3. Tạo Evidence
    return this.workflow.studentEdit(studentId, termId, async (tx) => {
      let criterionAssessmentId: string | undefined;
      if (targetCriterion?.rubricVersionId) {
        const assessment = await tx.criterionAssessment.upsert({
          where: { studentId_termId_criterionId: { studentId, termId, criterionId: targetCriterion.id } },
          create: { studentId, termId, criterionId: targetCriterion.id },
          update: {},
          select: { id: true },
        });
        criterionAssessmentId = assessment.id;
      }
      return tx.evidence.create({
        data: {
          studentId,
          termId,
          criterionAssessmentId,
          activityId: dto.activityId || null,
          declaredActivityName: dto.declaredActivityName?.trim() || null,
          description: dto.description?.trim() || null,
          declaredRole: dto.declaredRole || 'THAM_GIA_CHINH',
          evidenceType: dto.evidenceType,
          participationDate: dto.participationDate ? new Date(dto.participationDate) : new Date(),
          status: publishedVersion || dto.draft ? EvidenceStatus.DRAFT : EvidenceStatus.NEEDS_HUMAN_REVIEW,
          files: dto.fileUrls && dto.fileUrls.length > 0
            ? {
              create: dto.fileUrls.map((url) => ({
                fileUrl: url,
                fileType: url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
              })),
            }
            : undefined,
        },
        include: {
          files: true,
          term: true,
          criterionAssessment: { include: { criterion: true } },
          aiSuggestions: { include: { criterion: true } },
        },
      });
    });
  }

  async submit(id: string, studentId: string) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: { files: true, term: true },
    });

    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');
    if (evidence.term.workflowEnabled) throw new BadRequestException('Nộp minh chứng cùng phiếu rèn luyện; không nộp riêng bằng thao tác này');
    await this.ensureEvidenceEditable(id, studentId);

    if (evidence.files.length === 0) {
      throw new BadRequestException('Hồ sơ phải có ít nhất 1 file minh chứng đính kèm');
    }

    return this.prisma.evidence.update({
      where: { id },
      data: {
        status: EvidenceStatus.NEEDS_HUMAN_REVIEW,
        submittedAt: new Date(),
      },
    });
  }

  async supplement(id: string, studentId: string, dto: SubmitSupplementDto) {
    const evidence = await this.prisma.evidence.findUniqueOrThrow({ where: { id } });
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không sở hữu minh chứng');
    if (!dto.fileData && !dto.explanation?.trim() && !dto.verificationUrl?.trim()) throw new BadRequestException('Cần tệp, liên kết hoặc giải trình bổ sung');
    if (dto.verificationUrl && !/^https?:\/\//i.test(dto.verificationUrl)) throw new BadRequestException('Liên kết xác minh phải dùng HTTP hoặc HTTPS');
    const validate = async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      const term = await this.workflow.lock(tx, evidence.termId);
      const current = await tx.evidence.findUniqueOrThrow({ where: { id } });
      const request = await tx.supplementRequest.findFirst({ where: { evidenceId: id, resolvedAt: null }, orderBy: { createdAt: 'desc' } });
      const handoff = await tx.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId: evidence.termId } } });
      if (!['ACTIVE', 'REVIEWING'].includes(term.status) || current.status !== 'NEEDS_SUPPLEMENT' || !request || new Date() > (request.deadline ?? term.reviewDeadline) || ['SENT', 'EXCLUDED'].includes(handoff?.status ?? '')) throw new BadRequestException('Hồ sơ không nhận bổ sung hoặc đã quá hạn');
      return current;
    };
    await this.prisma.$transaction(validate);
    let storage: { fileUrl: string; fileType: string; fileName: string; fileSize: number } | null = null;
    let cleanup: (() => Promise<unknown>) | undefined;
    if (dto.fileData) {
      const match = dto.fileData.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
      if (!match || !dto.fileName || !dto.fileType || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(dto.fileType)) throw new BadRequestException('Chỉ nhận PDF hoặc ảnh JPEG/PNG/WebP có tên tệp');
      const buffer = Buffer.from(match[2], 'base64');
      if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new BadRequestException('Tệp phải nhỏ hơn 8 MB');
      const { baseUrl, key, bucket } = this.getStorageConfig();
      const safeName = dto.fileName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100);
      const objectKey = `${studentId}/${evidence.termId}/${id}/${randomUUID()}-${safeName}`;
      const objectUrl = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetch(objectUrl, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': dto.fileType, 'x-upsert': 'false' }, body: buffer });
      if (!response.ok) throw new ServiceUnavailableException('Không tải được tệp bổ sung lên Supabase Storage');
      storage = { fileUrl: `evidence/${objectKey}`, fileType: dto.fileType, fileName: dto.fileName, fileSize: buffer.length };
      cleanup = () => fetch(objectUrl, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
    }
    try {
      return await this.prisma.$transaction(async tx => {
        const current = await validate(tx);
        if (storage) await tx.evidenceFile.create({ data: { evidenceId: id, ...storage } });
        await tx.supplementRequest.updateMany({ where: { evidenceId: id, resolvedAt: null }, data: { resolvedAt: new Date() } });
        await tx.aiProcessingJob.updateMany({ where: { evidenceId: id, status: { in: ['QUEUED', 'PROCESSING'] } }, data: { status: 'CANCELLED', error: 'Sinh viên đã bổ sung phiên bản mới', completedAt: new Date() } });
        const aiMode = getAiMode();
        await tx.evidence.update({ where: { id }, data: { status: aiMode === 'ASSIST' ? 'PROCESSING' : 'NEEDS_HUMAN_REVIEW', version: { increment: 1 }, lockedById: null, lockedAt: null, description: [current.description, dto.explanation?.trim(), dto.verificationUrl?.trim()].filter(Boolean).join('\n') } });
        if (current.criterionAssessmentId) await tx.criterionAssessment.update({ where: { id: current.criterionAssessmentId }, data: { status: 'NEEDS_VERIFICATION', officialScore: null, officialReason: null, finalReviewerId: null, finalizedAt: null, suggestedScore: null, suggestionReason: null } });
        if (aiMode !== 'OFF') await tx.aiProcessingJob.create({ data: { evidenceId: id } });
        await tx.auditLog.create({ data: { userId: studentId, action: 'EVIDENCE_SUPPLEMENTED', entityType: 'Evidence', entityId: id, newValue: { studentId, termId: evidence.termId, version: current.version + 1, explanation: dto.explanation ?? null, verificationUrl: dto.verificationUrl ?? null } } });
        return { submitted: true, version: current.version + 1 };
      });
    } catch (err) { if (cleanup) await cleanup().catch(() => undefined); throw err; }
  }

  async withdraw(id: string, studentId: string) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');

    if (evidence.status === EvidenceStatus.APPROVED) {
      throw new BadRequestException('Hồ sơ đã được phê duyệt, không thể tự ý rút. Vui lòng gửi khiếu nại.');
    }
    await this.ensureEvidenceEditable(id, studentId);

    return this.workflow.studentEdit(studentId, evidence.termId, tx => tx.evidence.update({
      where: { id }, data: { status: EvidenceStatus.WITHDRAWN, version: { increment: 1 } },
    }));
  }

  async addFile(id: string, studentId: string, dto: UploadFileDto) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');
    if (evidence.status === EvidenceStatus.APPROVED) throw new BadRequestException('Hồ sơ đã được phê duyệt chính thức, không thể thêm tệp');

    await this.ensureEvidenceEditable(id, studentId);
    if (!dto.fileUrl.startsWith(`evidence/${studentId}/${evidence.termId}/${id}/`)) throw new BadRequestException('Tệp phải được tải lên kho minh chứng của hồ sơ này');
    return this.workflow.studentEdit(studentId, evidence.termId, async (tx) => {
      const currentEvidence = await tx.evidence.findUnique({ where: { id } });
      if (!currentEvidence) throw new NotFoundException('Không tìm thấy hồ sơ');
      if (currentEvidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');
      if (currentEvidence.status === EvidenceStatus.APPROVED) throw new BadRequestException('Hồ sơ đã được phê duyệt chính thức, không thể thêm tệp');

      return tx.evidenceFile.create({
        data: {
          evidenceId: id,
          fileUrl: dto.fileUrl,
          fileType: dto.fileType,
        },
      });
    });
  }

  async uploadDraftFile(id: string, studentId: string, dto: UploadEvidenceFileDto) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id }, include: { term: true } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');
    if (evidence.status !== EvidenceStatus.DRAFT) throw new BadRequestException('Chỉ có thể thêm tệp khi hồ sơ còn là bản nháp');
    await this.ensureEvidenceEditable(id, studentId);
    const match = dto.fileData.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new BadRequestException('Tệp gửi lên không đúng định dạng');
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new BadRequestException('Tệp minh chứng phải nhỏ hơn 8 MB');
    const { baseUrl, key, bucket } = this.getStorageConfig();
    const safeName = dto.fileName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100) || 'evidence-file';
    const objectKey = `${studentId}/${evidence.termId}/${id}/${randomUUID()}-${safeName}`;
    const storageUrl = `evidence/${objectKey}`;

    // 1. Tải tệp lên Supabase Storage
    const response = await fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': dto.fileType, 'x-upsert': 'false' }, body: buffer,
    });
    if (!response.ok) throw new ServiceUnavailableException(`Supabase Storage từ chối tải tệp (HTTP ${response.status}). Kiểm tra bucket "${bucket}", khóa service role và định dạng tệp.`);

    // 2. Lưu bản ghi vào cơ sở dữ liệu qua transaction khóa Term
    let file: any;
    try {
      file = await this.workflow.studentEdit(studentId, evidence.termId, async (tx) => {
        const currentEvidence = await tx.evidence.findUnique({ where: { id } });
        if (!currentEvidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');
        if (currentEvidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');
        if (currentEvidence.status !== EvidenceStatus.DRAFT) throw new BadRequestException('Chỉ có thể thêm tệp khi hồ sơ còn là bản nháp');

        const created = await tx.evidenceFile.create({
          data: { evidenceId: id, fileUrl: storageUrl, fileType: dto.fileType, fileName: dto.fileName, fileSize: buffer.length },
        });
        // TEMP TEST MODE (AI_ALLOW_DRAFT_PROCESSING=true): tự kích hoạt AI ngay khi tải file lên hồ sơ nháp
        if (process.env.AI_ALLOW_DRAFT_PROCESSING === 'true' && getAiMode() !== 'OFF') {
          const pending = await tx.aiProcessingJob.count({ where: { evidenceId: id, status: { in: ['QUEUED', 'PROCESSING'] } } });
          if (!pending) await tx.aiProcessingJob.create({ data: { evidenceId: id } });
        }
        return created;
      });
    } catch (dbError) {
      // Kiểm tra xem liệu DB có thực sự tạo bản ghi hay chưa (phòng trường hợp commit xong nhưng kết nối bị ngắt)
      const existingFile = await this.prisma.evidenceFile.findFirst({ where: { fileUrl: storageUrl } });
      if (!existingFile) {
        // DB thực sự chưa có bản ghi, dọn dẹp Storage để không tạo tệp rác mồ côi
        await this.cleanupStorageObject(storageUrl);
      }
      throw dbError;
    }

    // 3. Ký URL xem tệp (độc lập: lỗi ký không xóa tệp đã lưu trong DB)
    try {
      const signedUrl = await this.getFileUrl(file.fileUrl);
      return { ...file, fileUrl: signedUrl, signedUrlAvailable: true };
    } catch (_signError) {
      return {
        ...file,
        fileUrl: file.fileUrl,
        signedUrlAvailable: false,
        message: 'Tệp đã được lưu an toàn nhưng chưa tạo được liên kết xem tạm thời. Bạn có thể tải lại trang sau.',
      };
    }
  }

  async update(id: string, user: any, dto: any) {
    if (user.role !== Role.STUDENT) throw new ForbiddenException('Chỉ sinh viên sở hữu hồ sơ được chỉnh sửa minh chứng');
    const evidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (user.role === Role.STUDENT && evidence.studentId !== user.id) {
      throw new ForbiddenException('Không có quyền thao tác');
    }
    if (evidence.status === EvidenceStatus.APPROVED) {
      throw new BadRequestException('Hồ sơ đã được phê duyệt chính thức, không thể sửa');
    }
    if (user.role === Role.STUDENT) await this.ensureEvidenceEditable(id, user.id);

    return this.workflow.studentEdit(user.id, evidence.termId, async (tx) => {
      const currentEvidence = await tx.evidence.findUnique({ where: { id } });
      if (!currentEvidence) throw new NotFoundException('Không tìm thấy hồ sơ');
      if (currentEvidence.studentId !== user.id) throw new ForbiddenException('Không có quyền thao tác');
      if (currentEvidence.status === EvidenceStatus.APPROVED) throw new BadRequestException('Hồ sơ đã được phê duyệt chính thức, không thể sửa');

      return tx.evidence.update({
        where: { id },
        data: {
          version: { increment: 1 },
          declaredActivityName: dto.declaredActivityName !== undefined ? dto.declaredActivityName.trim() : undefined,
          description: dto.description !== undefined ? dto.description.trim() || null : undefined,
          declaredRole: dto.declaredRole !== undefined ? dto.declaredRole : undefined,
          evidenceType: dto.evidenceType !== undefined ? dto.evidenceType : undefined,
          participationDate: dto.participationDate ? new Date(dto.participationDate) : undefined,
        },
        include: {
          files: true,
          term: true,
        },
      });
    });
  }

  private async ensureEvidenceEditable(evidenceId: string, studentId: string) {
    const evidence = await this.prisma.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không sở hữu minh chứng');
    await this.prisma.$transaction(tx => this.workflow.assertStudentEditable(tx, studentId, evidence.termId));
  }

  async deleteDraftFile(id: string, fileId: string, studentId: string) {
    const initialEvidence = await this.prisma.evidence.findUnique({ where: { id }, include: { term: true } });
    if (!initialEvidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');
    if (initialEvidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');
    if (initialEvidence.status === EvidenceStatus.APPROVED) throw new BadRequestException('Không thể xóa tệp minh chứng đã được duyệt');

    const fileToDelete = await this.workflow.studentEdit(studentId, initialEvidence.termId, async (tx) => {
      const currentEvidence = await tx.evidence.findUnique({ where: { id } });
      if (!currentEvidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');
      if (currentEvidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');
      if (currentEvidence.status === EvidenceStatus.APPROVED) throw new BadRequestException('Không thể xóa tệp minh chứng đã được duyệt');

      const file = await tx.evidenceFile.findFirst({ where: { id: fileId, evidenceId: id } });
      if (!file) throw new NotFoundException('Không tìm thấy tệp minh chứng');
      await tx.evidenceFile.delete({ where: { id: fileId } });
      return file;
    });

    const cleanupResult = await this.cleanupStorageObject(fileToDelete.fileUrl);
    return { deleted: true, storageCleaned: cleanupResult.success };
  }

  async deleteEvidence(id: string, user: any) {
    if (user.role !== Role.STUDENT) throw new ForbiddenException('Chỉ sinh viên sở hữu hồ sơ được xóa minh chứng');
    const initialEvidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!initialEvidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (initialEvidence.studentId !== user.id) {
      throw new ForbiddenException('Không có quyền thao tác');
    }

    const { storageUrls } = await this.workflow.studentEdit(user.id, initialEvidence.termId, async (tx) => {
      // Đọc lại hồ sơ và danh sách tệp BÊN TRONG TRANSACTION sau khi đã lấy khóa Term
      const evidence = await tx.evidence.findUnique({
        where: { id },
        include: { files: true, aiProcessingJobs: { select: { id: true } } },
      });
      if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
      if (evidence.studentId !== user.id) {
        throw new ForbiddenException('Không có quyền thao tác');
      }

      if (evidence.status !== EvidenceStatus.DRAFT || evidence.aiProcessingJobs.length > 0) {
        throw new BadRequestException('Chỉ hồ sơ nháp chưa từng nộp mới được xóa; hồ sơ đã có lịch sử xử lý cần được lưu để tra cứu.');
      }

      const storageFiles = evidence.files
        .map((f) => f.fileUrl)
        .filter((url) => url.startsWith('evidence/'));

      await tx.evidenceFile.deleteMany({ where: { evidenceId: id } });
      await tx.aiProcessingJob.deleteMany({ where: { evidenceId: id } });
      await tx.review.deleteMany({ where: { evidenceId: id } });
      await tx.supplementRequest.deleteMany({ where: { evidenceId: id } });
      await tx.appeal.deleteMany({ where: { evidenceId: id } });
      await tx.evidence.delete({ where: { id } });

      return { storageUrls: storageFiles };
    });

    // Dọn dẹp Storage sau khi transaction DB đã commit thành công
    const cleanupResults = await Promise.all(
      storageUrls.map((url) => this.cleanupStorageObject(url)),
    );
    const uncleaned = cleanupResults.filter((r) => !r.success);
    if (uncleaned.length > 0) {
      console.warn(`[EvidenceDelete] Đã xóa hồ sơ ${id} khỏi DB nhưng còn ${uncleaned.length} tệp Storage chưa dọn dẹp được.`);
    }

    return {
      id,
      deleted: true,
      filesCleaned: storageUrls.length - uncleaned.length,
      filesPendingCleanup: uncleaned.length,
    };
  }

  async deleteDraft(id: string, studentId: string) {
    return this.deleteEvidence(id, { id: studentId, role: Role.STUDENT });
  }
}
