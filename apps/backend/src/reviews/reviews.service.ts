import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import { ReviewDecisionDto } from './dto/review.dto';
import { EvidenceStatus, ReviewDecision, Role, TermStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService) {}

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

    if (officer.role === Role.STAFF && !officer.facultyId) {
      throw new ForbiddenException('Tài khoản cán bộ chưa được gán Khoa phụ trách');
    }

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
          lockedBy: { select: { id: true, fullName: true } },
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
      include: { lockedBy: true, student: { select: { class: { select: { facultyId: true } } } } },
    });

    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ minh chứng');
    this.assertFacultyScope(officer, evidence.student.class?.facultyId);

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
    const evidence = await this.prisma.evidence.findUnique({ where: { id: evidenceId }, include: { student: { select: { class: { select: { facultyId: true } } } } } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    this.assertFacultyScope(officer, evidence.student.class?.facultyId);

    // Chỉ người đang giữ khóa được mở khóa.
    if (evidence.lockedById && evidence.lockedById !== officer.id) {
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
    const studentFaculty = await this.prisma.user.findUnique({ where: { id: evidence.studentId }, select: { class: { select: { facultyId: true } } } });
    this.assertFacultyScope(officer, studentFaculty?.class?.facultyId);
    if (evidence.term.status === TermStatus.CLOSED) {
      throw new BadRequestException('Kỳ học đã chốt sổ điểm, không thể thay đổi kết quả đánh giá');
    }
    const versionedRubric = await this.prisma.rubricVersion.findFirst({ where: { termId: evidence.termId, status: 'PUBLISHED' }, select: { id: true } });
    if (dto.action === ReviewDecision.SCORE_ADJUSTED || dto.approvedPoints != null) {
      throw new BadRequestException('Minh chứng chỉ được xác minh tại đây; điểm chính thức phải được chốt ở tiêu chí trong phiếu đánh giá sinh viên.');
    }

    return this.workflow.edit(officer, evidence.studentId, evidence.termId, async (tx) => {
      const current = await tx.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
      if (current.version !== evidence.version || current.status !== evidence.status) throw new ConflictException('Minh chứng đã thay đổi, hãy tải lại');
      if (versionedRubric) {
        const submitted = await tx.assessmentSubmission.count({ where: { studentId: evidence.studentId, termId: evidence.termId, status: 'SUBMITTED' } });
        if (!submitted || ['DRAFT', 'WITHDRAWN'].includes(current.status)) throw new BadRequestException('Minh chứng chưa được nộp để xét duyệt');
      }
      let newEvidenceStatus: EvidenceStatus = EvidenceStatus.NEEDS_HUMAN_REVIEW;

      if (dto.action === ReviewDecision.APPROVED) {
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
          finalScore: null,
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

      // 3. Cập nhật Evidence & giải phóng Lock. Xác minh minh chứng không ghi điểm.
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

      // Any changed evidence invalidates the linked criterion calculation.
      if (evidence.criterionAssessmentId) await tx.criterionAssessment.update({ where: { id: evidence.criterionAssessmentId }, data: { status: 'NEEDS_VERIFICATION', suggestedScore: null, suggestionReason: null, officialScore: null, officialReason: null, finalizedAt: null, finalReviewerId: null } });
      await tx.auditLog.create({ data: {
        userId: officer.id,
        action: `EVIDENCE_${dto.action}`,
        entityType: 'Evidence',
        entityId: evidenceId,
        oldValue: { status: evidence.status },
        newValue: { status: newEvidenceStatus, criterionId: dto.criterionId || null, finalScore: null, reason: dto.comment || null },
      } });

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

  private assertFacultyScope(officer: any, studentFacultyId?: string | null) {
    if (officer.role === Role.STAFF && (!officer.facultyId || officer.facultyId !== studentFacultyId)) {
      throw new ForbiddenException('Bạn chỉ được xử lý hồ sơ sinh viên thuộc Khoa phụ trách');
    }
  }
}
