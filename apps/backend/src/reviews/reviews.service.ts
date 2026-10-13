import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReviewDecisionDto } from './dto/review.dto';
import { EvidenceStatus, ReviewDecision, Role, TermStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // REVIEW QUEUE (OFFICER)
  // ==========================================
  async getQueue(
    officer: any,
    params: {
      status?: string;
      termId?: string;
      classId?: string;
      search?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      pageSize?: number;
    },
  ) {
    const { status, termId, classId, search, sortOrder = 'asc', page = 1, pageSize = 20 } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    // Cán bộ chỉ xét duyệt hồ sơ thuộc khoa phụ trách
    const studentFilter: any = {};
    if (officer.role === Role.STAFF && officer.facultyId) {
      studentFilter.class = { facultyId: officer.facultyId };
    }
    if (classId) {
      studentFilter.classId = classId;
    }
    if (Object.keys(studentFilter).length > 0) {
      where.student = studentFilter;
    }

    if (termId) where.termId = termId;

    if (status && status !== 'ALL') {
      where.status = status as EvidenceStatus;
    } else if (!status) {
      // Mặc định lấy các hồ sơ cần xử lý nếu không chỉ định
      where.status = {
        in: [
          EvidenceStatus.NEEDS_HUMAN_REVIEW,
          EvidenceStatus.PROCESSING,
          EvidenceStatus.PLAUSIBLE,
          EvidenceStatus.NEEDS_SUPPLEMENT,
          EvidenceStatus.APPEALING,
        ],
      };
    }
    // Nếu status === 'ALL', không lọc theo status (lấy tất cả bao gồm APPROVED)

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
        orderBy: { submittedAt: sortOrder }, // FIFO mặc định (hồ sơ nộp trước duyệt trước)
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
          activity: { select: { id: true, name: true } },
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

  // ==========================================
  // CLAIM LOCK (Chống xung đột 2 cán bộ duyệt trùng)
  // ==========================================
  async claimEvidence(evidenceId: string, officer: any) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { lockedBy: true },
    });

    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');

    const now = new Date();
    const LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 phút

    // Nếu hồ sơ đang bị cán bộ khác khóa và chưa hết hạn 15 phút
    if (
      evidence.lockedById &&
      evidence.lockedById !== officer.id &&
      evidence.lockedAt &&
      now.getTime() - new Date(evidence.lockedAt).getTime() < LOCK_TIMEOUT_MS
    ) {
      throw new ConflictException({
        code: 'EVIDENCE_LOCKED',
        message: `Hồ sơ đang được Cán bộ [${evidence.lockedBy?.fullName || 'khác'}] xử lý. Vui lòng chọn hồ sơ khác.`,
        lockedBy: evidence.lockedBy?.fullName,
        lockedAt: evidence.lockedAt,
      });
    }

    // Cấp lock cho cán bộ hiện tại
    return this.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        lockedById: officer.id,
        lockedAt: now,
      },
      include: {
        lockedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  // ==========================================
  // RELEASE LOCK
  // ==========================================
  async releaseEvidence(evidenceId: string, officer: any) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id: evidenceId } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');

    // Chỉ người giữ lock hoặc Admin mới được mở khóa
    if (evidence.lockedById && evidence.lockedById !== officer.id && officer.role !== Role.ADMIN) {
      throw new ForbiddenException('Bạn không phải người đang giữ khóa hồ sơ này');
    }

    return this.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        lockedById: null,
        lockedAt: null,
      },
    });
  }

  // ==========================================
  // REVIEW DECISION (APPROVE / REJECT / MODIFY / SUPPLEMENT)
  // ==========================================
  async submitDecision(evidenceId: string, officer: any, dto: ReviewDecisionDto) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { term: true, student: true },
    });

    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');
    if (evidence.term.status === TermStatus.CLOSED) {
      throw new BadRequestException('Kỳ học đã chốt sổ điểm, không thể thay đổi kết quả đánh giá');
    }

    return this.prisma.$transaction(async (tx) => {
      let newEvidenceStatus: EvidenceStatus = EvidenceStatus.NEEDS_HUMAN_REVIEW;

      if (dto.action === ReviewDecision.APPROVED || dto.action === ReviewDecision.SCORE_ADJUSTED) {
        newEvidenceStatus = EvidenceStatus.APPROVED;
      } else if (dto.action === ReviewDecision.REJECTED) {
        newEvidenceStatus = EvidenceStatus.REJECTED;
      } else if (dto.action === ReviewDecision.SUPPLEMENT_REQUESTED) {
        newEvidenceStatus = EvidenceStatus.NEEDS_SUPPLEMENT;
      }

      // 1. Tạo bản ghi Review
      const review = await tx.review.create({
        data: {
          evidenceId,
          reviewerId: officer.id,
          decision: dto.action,
          criterionId: dto.criterionId || null,
          finalScore: dto.approvedPoints !== undefined ? dto.approvedPoints : null,
          rejectBasis: dto.rejectBasis || null,
          reason: dto.comment,
        },
      });

      // 2. Nếu yêu cầu bổ sung -> Tạo SupplementRequest
      if (dto.action === ReviewDecision.SUPPLEMENT_REQUESTED) {
        await tx.supplementRequest.create({
          data: {
            evidenceId,
            reviewId: review.id,
            missingItem: dto.missingItem || dto.comment,
            deadline: dto.supplementDeadline ? new Date(dto.supplementDeadline) : null,
          },
        });
      }

      // 3. Nếu APPROVED hoặc SCORE_ADJUSTED -> Cập nhật bảng tổng hợp điểm ConductScore
      if (dto.action === ReviewDecision.APPROVED || dto.action === ReviewDecision.SCORE_ADJUSTED) {
        const pointsToAdd = dto.approvedPoints || 0;

        const currentScore = await tx.conductScore.findUnique({
          where: {
            studentId_termId: {
              studentId: evidence.studentId,
              termId: evidence.termId,
            },
          },
        });

        const newTotal = Math.min(100.0, (currentScore?.totalScore || 0) + pointsToAdd);

        let classification = 'YẾU';
        if (newTotal >= 90) classification = 'XUẤT SẮC';
        else if (newTotal >= 80) classification = 'TỐT';
        else if (newTotal >= 65) classification = 'KHÁ';
        else if (newTotal >= 50) classification = 'TRUNG BÌNH';

        await tx.conductScore.upsert({
          where: {
            studentId_termId: {
              studentId: evidence.studentId,
              termId: evidence.termId,
            },
          },
          update: {
            totalScore: newTotal,
            classification,
          },
          create: {
            studentId: evidence.studentId,
            termId: evidence.termId,
            totalScore: newTotal,
            classification,
          },
        });
      }

      // 4. Cập nhật Evidence & giải phóng Lock
      const updatedEvidence = await tx.evidence.update({
        where: { id: evidenceId },
        data: {
          status: newEvidenceStatus,
          lockedById: null,
          lockedAt: null,
        },
        include: {
          reviews: { include: { reviewer: true, criterion: true } },
          supplementRequests: true,
        },
      });

      // 5. Tự động gửi thông báo cho Sinh viên
      await tx.notification.create({
        data: {
          userId: evidence.studentId,
          relatedEvidenceId: evidenceId,
          type: dto.action === ReviewDecision.SUPPLEMENT_REQUESTED ? 'SUPPLEMENT_REQUIRED' : 'EVIDENCE_REVIEWED',
          title: `Hồ sơ "${evidence.declaredActivityName}" đã có kết quả`,
          content: `Cán bộ ${officer.fullName} đã xử lý hồ sơ của bạn với kết quả: ${dto.action}. Ghi chú: ${dto.comment}`,
        },
      });

      return updatedEvidence;
    });
  }
}
