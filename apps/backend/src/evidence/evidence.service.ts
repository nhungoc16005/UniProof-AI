import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEvidenceDto, UploadFileDto } from './dto/evidence.dto';
import { EvidenceStatus, Role, TermStatus } from '@prisma/client';

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
      const studentFilter: any = {};
      if (user.facultyId) {
        studentFilter.class = { facultyId: user.facultyId };
      }
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

    return { items, total, page, pageSize };
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
        activity: {
          include: {
            participants: {
              where: { studentId: user.id },
            },
          },
        },
        files: true,
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

    return evidence;
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
      if (!term || term.status === TermStatus.CLOSED) {
        throw new BadRequestException('Kỳ học này đã đóng, không thể nộp thêm hồ sơ');
      }
    }

    // 2. Tìm Tiêu chí nếu sinh viên có chọn
    let targetCriterion = null;
    if (dto.criterionId) {
      targetCriterion = await this.prisma.criterion.findUnique({ where: { id: dto.criterionId } });
    } else if (dto.criterionCode) {
      targetCriterion = await this.prisma.criterion.findFirst({ where: { code: dto.criterionCode } });
    }

    // 3. Tạo Evidence
    return this.prisma.evidence.create({
      data: {
        studentId,
        termId,
        activityId: dto.activityId || null,
        declaredActivityName: dto.declaredActivityName.trim(),
        declaredRole: dto.declaredRole || 'THAM_GIA_CHINH',
        evidenceType: dto.evidenceType,
        participationDate: dto.participationDate ? new Date(dto.participationDate) : new Date(),
        status: EvidenceStatus.NEEDS_HUMAN_REVIEW, // Chuyển cho Cán bộ xem
        files: dto.fileUrls && dto.fileUrls.length > 0
          ? {
              create: dto.fileUrls.map((url) => ({
                fileUrl: url,
                fileType: url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
              })),
            }
          : undefined,
        aiSuggestions: targetCriterion
          ? {
              create: {
                criterionId: targetCriterion.id,
                suggestedScore: targetCriterion.maxScore || 2.0,
                suggestedRole: dto.declaredRole || 'THAM_GIA_CHINH',
                reasoning: `Sinh viên tự khai báo áp dụng mục [${targetCriterion.code}: ${targetCriterion.name}]`,
                confidenceScore: 0.95,
              },
            }
          : undefined,
      },
      include: {
        files: true,
        term: true,
        aiSuggestions: {
          include: { criterion: true },
        },
      },
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

  async update(id: string, user: any, dto: any) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (user.role === Role.STUDENT && evidence.studentId !== user.id) {
      throw new ForbiddenException('Không có quyền thao tác');
    }
    if (evidence.status === EvidenceStatus.APPROVED) {
      throw new BadRequestException('Hồ sơ đã được phê duyệt chính thức, không thể sửa');
    }

    return this.prisma.evidence.update({
      where: { id },
      data: {
        declaredActivityName: dto.declaredActivityName !== undefined ? dto.declaredActivityName.trim() : undefined,
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

  async deleteEvidence(id: string, user: any) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (user.role === Role.STUDENT && evidence.studentId !== user.id) {
      throw new ForbiddenException('Không có quyền thao tác');
    }

    if (evidence.status === EvidenceStatus.APPROVED) {
      throw new BadRequestException('Không thể xóa hồ sơ đã được phê duyệt điểm chính thức');
    }

    await this.prisma.evidenceFile.deleteMany({ where: { evidenceId: id } });
    await this.prisma.review.deleteMany({ where: { evidenceId: id } });
    await this.prisma.supplementRequest.deleteMany({ where: { evidenceId: id } });
    await this.prisma.appeal.deleteMany({ where: { evidenceId: id } });
    return this.prisma.evidence.delete({ where: { id } });
  }

  async deleteDraft(id: string, studentId: string) {
    return this.deleteEvidence(id, { id: studentId, role: Role.STUDENT });
  }
}
