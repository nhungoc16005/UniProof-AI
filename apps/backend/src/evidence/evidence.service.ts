import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEvidenceDto, UploadEvidenceFileDto, UploadFileDto, SubmitSupplementDto } from './dto/evidence.dto';
import { EvidenceStatus, Role, TermStatus } from '@prisma/client';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import { randomUUID } from 'crypto';

@Injectable()
export class EvidenceService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService) {}

  async findAll(
    user: any,
    params: {
      studentId?: string;
      termId?: string;
      classId?: string;
      status?: EvidenceStatus;
      search?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      pageSize?: number;
    },
  ) {
    const { termId, classId, status, search, sortOrder = 'desc', page = 1, pageSize = 20 } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    where.AND = [await this.workflow.evidenceScope(user, termId, classId)];
    if (params.studentId && user.role !== Role.STUDENT) where.studentId = params.studentId;

    if (termId) where.termId = termId;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { declaredActivityName: { contains: search, mode: 'insensitive' } },
        { student: { fullName: { contains: search, mode: 'insensitive' } } },
        { student: { studentCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
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
          aiProcessingJobs: { take: 1, orderBy: { createdAt: 'desc' } },
          anomalyFlags: true,
          reviews: {
            include: {
              reviewer: { select: { fullName: true } },
              criterion: { select: { code: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.evidence.count({ where }),
    ]);

    return { items: await Promise.all(items.map((item) => this.withSignedFiles(item))), total, page, pageSize };
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
          orderBy: { createdAt: 'desc' },
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
    const canReview = user.role === Role.STAFF && ['ACTIVE','REVIEWING'].includes(evidence.term.status) && !['DRAFT','WITHDRAWN','APPROVED','REJECTED'].includes(evidence.status) && !['SENT','EXCLUDED'].includes(handoff?.status ?? '') && (!evidence.term.workflowEnabled || !!handoff && submitted > 0);
    const signed = await this.withSignedFiles(evidence);
    const latestRun = evidence.aiProcessingJobs?.[0]?.pipelineRuns?.[0];
    const currentRubric = evidence.criterionAssessment?.criterion?.rubricVersionId;
    const aiIsCurrent = latestRun?.status === 'COMPLETED' && latestRun.inputVersion === evidence.version && latestRun.rubricVersionId === currentRubric;
    return { ...signed, permissions: { canReview }, aiSuggestions: aiIsCurrent ? signed.aiSuggestions : [], aiAnalysisStatus: latestRun && !aiIsCurrent && latestRun.status === 'COMPLETED' ? 'STALE' : latestRun?.status ?? 'NOT_STARTED' };
  }

  private async withSignedFiles<T extends { files?: Array<{ fileUrl: string }> }>(value: T): Promise<T> {
    if (!value.files?.length) return value;
    const files = await Promise.all(value.files.map(async (file) => ({ ...file, fileUrl: await this.getFileUrl(file.fileUrl) })));
    return { ...value, files };
  }

  private getStorageConfig() {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_EVIDENCE_BUCKET || 'evidence';
    if (!baseUrl || !key) throw new ServiceUnavailableException('Chưa cấu hình Supabase Storage (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
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
        declaredActivityName: dto.declaredActivityName.trim(),
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
      if (!['ACTIVE','REVIEWING'].includes(term.status) || current.status !== 'NEEDS_SUPPLEMENT' || !request || new Date() > (request.deadline ?? term.reviewDeadline) || ['SENT','EXCLUDED'].includes(handoff?.status ?? '')) throw new BadRequestException('Hồ sơ không nhận bổ sung hoặc đã quá hạn');
      return current;
    };
    await this.prisma.$transaction(validate);
    let storage: { fileUrl: string; fileType: string; fileName: string; fileSize: number } | null = null;
    let cleanup: (() => Promise<unknown>) | undefined;
    if (dto.fileData) {
      const match = dto.fileData.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
      if (!match || !dto.fileName || !dto.fileType || !['application/pdf','image/jpeg','image/png','image/webp'].includes(dto.fileType)) throw new BadRequestException('Chỉ nhận PDF hoặc ảnh JPEG/PNG/WebP có tên tệp');
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
        await tx.aiProcessingJob.updateMany({ where: { evidenceId: id, status: { in: ['QUEUED','PROCESSING'] } }, data: { status: 'CANCELLED', error: 'Sinh viên đã bổ sung phiên bản mới', completedAt: new Date() } });
        await tx.evidence.update({ where: { id }, data: { status: 'PROCESSING', version: { increment: 1 }, lockedById: null, lockedAt: null, description: [current.description, dto.explanation?.trim(), dto.verificationUrl?.trim()].filter(Boolean).join('\n') } });
        if (current.criterionAssessmentId) await tx.criterionAssessment.update({ where: { id: current.criterionAssessmentId }, data: { status: 'NEEDS_VERIFICATION', officialScore: null, officialReason: null, finalReviewerId: null, finalizedAt: null, suggestedScore: null, suggestionReason: null } });
        await tx.aiProcessingJob.create({ data: { evidenceId: id } });
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

    await this.ensureEvidenceEditable(id, studentId);
    if (!dto.fileUrl.startsWith(`evidence/${studentId}/${evidence.termId}/${id}/`)) throw new BadRequestException('Tệp phải được tải lên kho minh chứng của hồ sơ này');
    return this.workflow.studentEdit(studentId, evidence.termId, tx => tx.evidenceFile.create({
      data: {
        evidenceId: id,
        fileUrl: dto.fileUrl,
        fileType: dto.fileType,
      },
    }));
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
    const response = await fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': dto.fileType, 'x-upsert': 'false' }, body: buffer,
    });
    if (!response.ok) throw new ServiceUnavailableException('Tải tệp minh chứng lên Supabase Storage thất bại');
    try {
      const file = await this.workflow.studentEdit(studentId, evidence.termId, tx => tx.evidenceFile.create({ data: { evidenceId: id, fileUrl: `evidence/${objectKey}`, fileType: dto.fileType, fileName: dto.fileName, fileSize: buffer.length } }));
      return { ...file, fileUrl: await this.getFileUrl(file.fileUrl) };
    } catch (error) {
      await fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } }).catch(() => undefined);
      throw error;
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

    return this.workflow.studentEdit(user.id, evidence.termId, tx => tx.evidence.update({
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
    }));
  }

  private async ensureEvidenceEditable(evidenceId: string, studentId: string) {
    const evidence = await this.prisma.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không sở hữu minh chứng');
    await this.prisma.$transaction(tx => this.workflow.assertStudentEditable(tx, studentId, evidence.termId));
  }

  async deleteDraftFile(id: string, fileId: string, studentId: string) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id }, include: { term: true } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');
    if (evidence.status === EvidenceStatus.APPROVED) throw new BadRequestException('Không thể xóa tệp minh chứng đã được duyệt');
    await this.ensureEvidenceEditable(id, studentId);
    const file = await this.prisma.evidenceFile.findFirst({ where: { id: fileId, evidenceId: id } });
    if (!file) throw new NotFoundException('Không tìm thấy tệp minh chứng');
    if (file.fileUrl.startsWith('evidence/')) {
      const { baseUrl, key, bucket } = this.getStorageConfig();
      await fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${file.fileUrl.slice('evidence/'.length).split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
    }
    await this.prisma.evidenceFile.delete({ where: { id: fileId } });
    return { deleted: true };
  }

  async deleteEvidence(id: string, user: any) {
    if (user.role !== Role.STUDENT) throw new ForbiddenException('Chỉ sinh viên sở hữu hồ sơ được xóa minh chứng');
    const evidence = await this.prisma.evidence.findUnique({ where: { id }, include: { files: true, aiProcessingJobs: { select: { id: true } } } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (user.role === Role.STUDENT && evidence.studentId !== user.id) {
      throw new ForbiddenException('Không có quyền thao tác');
    }

    if (evidence.status !== EvidenceStatus.DRAFT || evidence.aiProcessingJobs.length > 0) {
      throw new BadRequestException('Chỉ hồ sơ nháp chưa từng nộp mới được xóa; hồ sơ đã có lịch sử xử lý cần được lưu để tra cứu.');
    }
    if (user.role === Role.STUDENT) await this.ensureEvidenceEditable(id, user.id);

    const storageFiles = evidence.files.filter((file) => file.fileUrl.startsWith('evidence/'));
    if (storageFiles.length) {
      const { baseUrl, key, bucket } = this.getStorageConfig();
      await Promise.all(storageFiles.map((file) => fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${file.fileUrl.slice('evidence/'.length).split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } })));
    }
    await this.prisma.evidenceFile.deleteMany({ where: { evidenceId: id } });
    await this.prisma.aiProcessingJob.deleteMany({ where: { evidenceId: id } });
    await this.prisma.review.deleteMany({ where: { evidenceId: id } });
    await this.prisma.supplementRequest.deleteMany({ where: { evidenceId: id } });
    await this.prisma.appeal.deleteMany({ where: { evidenceId: id } });
    return this.prisma.evidence.delete({ where: { id } });
  }

  async deleteDraft(id: string, studentId: string) {
    return this.deleteEvidence(id, { id: studentId, role: Role.STUDENT });
  }
}
