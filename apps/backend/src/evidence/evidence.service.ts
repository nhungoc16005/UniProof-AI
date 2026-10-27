import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEvidenceDto, UploadEvidenceFileDto, UploadFileDto } from './dto/evidence.dto';
import { EvidenceStatus, Role, TermStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class EvidenceService {
  constructor(private prisma: PrismaService) {}

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

    // Phân quyền dữ liệu
    if (user.role === Role.STUDENT) {
      where.studentId = user.id;
    } else if (user.role === Role.STAFF) {
      // Cán bộ chỉ xem hồ sơ của sinh viên thuộc khoa mình
      if (!user.facultyId) throw new ForbiddenException('Tài khoản cán bộ chưa được gán Khoa phụ trách');
      const studentFilter: any = {};
      studentFilter.class = { facultyId: user.facultyId };
      if (classId) {
        studentFilter.classId = classId;
      }
      if (Object.keys(studentFilter).length > 0) {
        where.student = studentFilter;
      }
      if (params.studentId) where.studentId = params.studentId;
    } else {
      if (classId) where.student = { classId };
      if (params.studentId) where.studentId = params.studentId;
    }

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
        verificationResults: { orderBy: { createdAt: 'desc' }, take: 1 },
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

    // Kiểm tra quyền truy cập (Sinh viên không xem được của người khác)
    if (user.role === Role.STUDENT && evidence.studentId !== user.id) {
      throw new ForbiddenException('Bạn không có quyền truy cập hồ sơ này');
    }
    if (user.role === Role.STAFF && (!user.facultyId || evidence.student.class?.facultyId !== user.facultyId)) {
      throw new ForbiddenException('Bạn chỉ được xem hồ sơ sinh viên thuộc Khoa phụ trách');
    }

    const signed = await this.withSignedFiles(evidence);
    const latestRun = evidence.aiProcessingJobs?.[0]?.pipelineRuns?.[0];
    const currentRubric = evidence.criterionAssessment?.criterion?.rubricVersionId;
    const aiIsCurrent = latestRun?.status === 'COMPLETED' && latestRun.inputVersion === evidence.version && latestRun.rubricVersionId === currentRubric;
    return { ...signed, aiSuggestions: aiIsCurrent ? signed.aiSuggestions : [], aiAnalysisStatus: latestRun && !aiIsCurrent && latestRun.status === 'COMPLETED' ? 'STALE' : latestRun?.status ?? 'NOT_STARTED' };
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
      if (!term || term.status !== TermStatus.ACTIVE || new Date() > term.submissionDeadline) {
        throw new BadRequestException(term?.status === TermStatus.UPCOMING ? 'Kỳ học chưa mở nhận hồ sơ' : 'Kỳ học này hiện không nhận hồ sơ mới');
      }
    }

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
    return this.prisma.$transaction(async (tx) => {
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
        status: dto.draft ? EvidenceStatus.DRAFT : EvidenceStatus.NEEDS_HUMAN_REVIEW,
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
    if (evidence.term.status === TermStatus.CLOSED) throw new BadRequestException('Kỳ học đã đóng');

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

  async withdraw(id: string, studentId: string) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');

    if (evidence.status === EvidenceStatus.APPROVED) {
      throw new BadRequestException('Hồ sơ đã được phê duyệt, không thể tự ý rút. Vui lòng gửi khiếu nại.');
    }

    return this.prisma.evidence.update({
      where: { id },
      data: { status: EvidenceStatus.WITHDRAWN },
    });
  }

  async addFile(id: string, studentId: string, dto: UploadFileDto) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');

    return this.prisma.evidenceFile.create({
      data: {
        evidenceId: id,
        fileUrl: dto.fileUrl,
        fileType: dto.fileType,
      },
    });
  }

  async uploadDraftFile(id: string, studentId: string, dto: UploadEvidenceFileDto) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id }, include: { term: true } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');
    if (evidence.studentId !== studentId) throw new ForbiddenException('Không có quyền thao tác');
    if (evidence.status !== EvidenceStatus.DRAFT) throw new BadRequestException('Chỉ có thể thêm tệp khi hồ sơ còn là bản nháp');
    if (evidence.term.status !== TermStatus.ACTIVE || new Date() > evidence.term.submissionDeadline) throw new BadRequestException('Kỳ này không nhận thêm minh chứng');
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
      const file = await this.prisma.evidenceFile.create({ data: { evidenceId: id, fileUrl: `evidence/${objectKey}`, fileType: dto.fileType, fileName: dto.fileName, fileSize: buffer.length } });
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

    return this.prisma.evidence.update({
      where: { id },
      data: {
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
  }

  private async ensureEvidenceEditable(evidenceId: string, studentId: string) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id: evidenceId }, select: { termId: true, term: { select: { status: true, submissionDeadline: true } } } });
    if (!evidence) return;
    if (evidence.term.status !== TermStatus.ACTIVE || new Date() > evidence.term.submissionDeadline) throw new BadRequestException('Kỳ này không nhận chỉnh sửa minh chứng');
    const submissions = await this.prisma.assessmentSubmission.findMany({ where: { studentId, termId: evidence.termId, status: 'SUBMITTED' }, select: { id: true }, take: 1 });
    if (submissions.length) throw new BadRequestException('Phiếu đã nộp; chỉ có thể sửa minh chứng sau khi cán bộ trả phiếu');
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
