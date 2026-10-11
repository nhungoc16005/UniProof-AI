import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAppealDto, ResolveAppealDto } from './dto/appeal.dto';
import { AppealStatus, EvidenceStatus, Role } from '@prisma/client';

@Injectable()
export class AppealsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: any, params: { status?: AppealStatus; page?: number; pageSize?: number }) {
    const { status, page = 1, pageSize = 20 } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (user.role === Role.STUDENT) {
      where.studentId = user.id;
    } else if (user.role === Role.STAFF && user.facultyId) {
      where.evidence = { student: { class: { facultyId: user.facultyId } } };
    }

    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.appeal.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { select: { id: true, fullName: true, studentCode: true } },
          evidence: {
            select: {
              id: true,
              declaredActivityName: true,
              status: true,
              term: { select: { code: true, name: true } },
            },
          },
          resolver: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.appeal.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async create(studentId: string, dto: CreateAppealDto) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: dto.evidenceId },
    });

    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');
    if (evidence.studentId !== studentId) throw new ForbiddenException('Bạn không sở hữu hồ sơ này');

    // Chỉ cho phép khiếu nại nếu hồ sơ đã có kết quả (REJECTED hoặc APPROVED)
    if (evidence.status !== EvidenceStatus.REJECTED && evidence.status !== EvidenceStatus.APPROVED) {
      throw new BadRequestException('Chỉ có thể khiếu nại hồ sơ đã có kết quả xét duyệt');
    }

    // Kiểm tra xem đã có đơn khiếu nại đang chờ xử lý chưa
    const existingAppeal = await this.prisma.appeal.findFirst({
      where: { evidenceId: dto.evidenceId, status: AppealStatus.PENDING },
    });
    if (existingAppeal) {
      throw new BadRequestException('Hồ sơ này đã có một đơn khiếu nại đang chờ giải quyết');
    }

    return this.prisma.$transaction(async (tx) => {
      // Cập nhật trạng thái evidence sang APPEALING
      await tx.evidence.update({
        where: { id: dto.evidenceId },
        data: { status: EvidenceStatus.APPEALING },
      });

      return tx.appeal.create({
        data: {
          evidenceId: dto.evidenceId,
          studentId,
          content: dto.content.trim(),
          requestedScore: dto.requestedScore || null,
          status: AppealStatus.PENDING,
        },
        include: { evidence: true },
      });
    });
  }

  async resolve(appealId: string, officer: any, dto: ResolveAppealDto) {
    const appeal = await this.prisma.appeal.findUnique({
      where: { id: appealId },
      include: { evidence: true },
    });

    if (!appeal) throw new NotFoundException('Không tìm thấy đơn khiếu nại');
    if (appeal.status !== AppealStatus.PENDING) {
      throw new BadRequestException('Đơn khiếu nại này đã được giải quyết');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật kết quả khiếu nại
      const updatedAppeal = await tx.appeal.update({
        where: { id: appealId },
        data: {
          status: dto.status,
          resolverId: officer.id,
          resolutionNote: dto.resolutionNote.trim(),
          adjustedScore: dto.adjustedScore || null,
          resolvedAt: new Date(),
        },
      });

      // 2. Nếu chấp thuận (ACCEPTED) -> Mở lại hồ sơ đưa vào hàng đợi duyệt
      if (dto.status === AppealStatus.ACCEPTED) {
        await tx.evidence.update({
          where: { id: appeal.evidenceId },
          data: { status: EvidenceStatus.NEEDS_HUMAN_REVIEW },
        });
      } else {
        // Bác đơn -> Trả về trạng thái cũ REJECTED
        await tx.evidence.update({
          where: { id: appeal.evidenceId },
          data: { status: EvidenceStatus.REJECTED },
        });
      }

      // 3. Gửi thông báo cho Sinh viên
      await tx.notification.create({
        data: {
          userId: appeal.studentId,
          relatedEvidenceId: appeal.evidenceId,
          type: 'APPEAL_RESOLVED',
          title: `Đơn khiếu nại hồ sơ "${appeal.evidence.declaredActivityName}" đã được phản hồi`,
          content: `Kết quả: ${dto.status === AppealStatus.ACCEPTED ? 'Chấp thuận' : 'Bác bỏ'}. Ghi chú: ${dto.resolutionNote}`,
        },
      });

      return updatedAppeal;
    });
  }
}
