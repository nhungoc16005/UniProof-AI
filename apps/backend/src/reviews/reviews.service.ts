import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import { ReviewDecisionDto, VerificationSourceDto } from './dto/review.dto';
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

    where.AND = [await this.workflow.evidenceScope(officer, termId, classId)];

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
    await this.workflow.scope(officer, evidence.studentId, evidence.termId);

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

    const claimed = await this.workflow.edit(officer, evidence.studentId, evidence.termId, tx => tx.evidence.updateMany({
      where: { id: evidenceId, OR: [{ lockedById: null }, { lockedById: officer.id }, { lockedAt: { lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) } }] },
      data: { lockedById: officer.id, lockedAt: now },
    }));
    if (!claimed.count) throw new ConflictException('Hồ sơ vừa được cán bộ khác nhận xử lý');
    return this.prisma.evidence.findUniqueOrThrow({ where: { id: evidenceId }, include: { lockedBy: { select: { id: true, fullName: true } } } });
  }

  // ==========================================
  // RELEASE LOCK
  // ==========================================
  async releaseEvidence(evidenceId: string, officer: any) {
    const evidence = await this.prisma.evidence.findUnique({ where: { id: evidenceId }, include: { student: { select: { class: { select: { facultyId: true } } } } } });
    if (!evidence) throw new NotFoundException('Không tìm thấy hồ sơ');
    await this.workflow.scope(officer, evidence.studentId, evidence.termId);

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
    await this.workflow.scope(officer, evidence.studentId, evidence.termId);
    if (evidence.term.status === TermStatus.CLOSED) {
      throw new BadRequestException('Kỳ học đã chốt sổ điểm, không thể thay đổi kết quả đánh giá');
    }
    const versionedRubric = await this.prisma.rubricVersion.findFirst({ where: { termId: evidence.termId, status: 'PUBLISHED' }, select: { id: true } });
    if (dto.action === ReviewDecision.SCORE_ADJUSTED || dto.approvedPoints != null) {
      throw new BadRequestException('Minh chứng chỉ được xác minh tại đây; điểm chính thức phải được chốt ở tiêu chí trong phiếu đánh giá sinh viên.');
    }

    return this.workflow.edit(officer, evidence.studentId, evidence.termId, async (tx) => {
      const current = await tx.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
      if (current.lockedById && current.lockedById !== officer.id && current.lockedAt && Date.now() - current.lockedAt.getTime() < 15 * 60 * 1000) throw new ConflictException('Hồ sơ đang được cán bộ khác xử lý');
      if (dto.expectedVersion !== undefined && current.version !== dto.expectedVersion) throw new ConflictException('Minh chứng đã thay đổi từ lúc mở trang; hãy tải lại trước khi quyết định');
      if (current.version !== evidence.version || current.status !== evidence.status) throw new ConflictException('Minh chứng đã thay đổi, hãy tải lại');
      if (['APPROVED', 'REJECTED', 'WITHDRAWN', 'DRAFT'].includes(current.status)) throw new BadRequestException('Minh chứng đã có quyết định hoặc chưa nộp; không được quyết định lặp');
      if (!dto.comment?.trim()) throw new BadRequestException('Cần ghi lý do quyết định');
      if (dto.action === 'REJECTED' && !dto.rejectBasis?.trim()) throw new BadRequestException('Cần ghi căn cứ từ chối');
      if (dto.action === 'SUPPLEMENT_REQUESTED' && !dto.missingItem?.trim()) throw new BadRequestException('Cần ghi nội dung phải bổ sung');
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
          version: { increment: 1 },
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
          eventKey: dto.action === ReviewDecision.SUPPLEMENT_REQUESTED ? 'SUPPLEMENT_REQUIRED' : 'EVIDENCE_REVIEWED',
          dedupeKey: `evidence-review:${evidenceId}:${updatedEvidence.version}:${dto.action}`,
          title: `Hồ sơ "${evidence.declaredActivityName}" đã có kết quả`,
          content: `Cán bộ ${officer.fullName} đã xử lý hồ sơ của bạn với kết quả: ${dto.action}. Ghi chú: ${dto.comment}`,
          targetPath: dto.action === ReviewDecision.SUPPLEMENT_REQUESTED ? `/student/evidence/${evidenceId}/supplement` : `/student/evidence/${evidenceId}`,
          metadata: { evidenceId, termId: evidence.termId, action: dto.action },
        },
      });

      return updatedEvidence;
    });
  }

  async addSource(evidenceId: string, officer: any, dto: VerificationSourceDto) {
    const evidence = await this.prisma.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
    return this.workflow.edit(officer, evidence.studentId, evidence.termId, async tx => {
      const current = await tx.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
      if (['APPROVED', 'REJECTED', 'WITHDRAWN', 'DRAFT'].includes(current.status)) throw new BadRequestException('Chỉ bổ sung nguồn khi minh chứng đang xét duyệt');
      if (current.lockedById && current.lockedById !== officer.id && current.lockedAt && Date.now() - current.lockedAt.getTime() < 15 * 60 * 1000) throw new ConflictException('Hồ sơ đang được cán bộ khác xử lý');
      if (dto.level === 4 && dto.confirmedStudent) throw new BadRequestException('Nguồn cấp 4 chưa xác nhận cá nhân tham gia');
      const record = await tx.verificationResult.create({ data: { evidenceId, verificationLevel: dto.level, status: dto.confirmedActivity && dto.confirmedStudent ? 'VERIFIED' : 'PLAUSIBLE', activityExistsVerified: dto.confirmedActivity, studentParticipationVerified: dto.confirmedStudent, sourceDescription: [dto.sourceName.trim(), dto.sourceUrl?.trim(), dto.note.trim()].filter(Boolean).join('\n') } });
      await tx.evidence.update({ where: { id: evidenceId }, data: { version: { increment: 1 } } });
      await tx.aiProcessingJob.updateMany({ where: { evidenceId, status: { in: ['QUEUED', 'PROCESSING'] } }, data: { status: 'CANCELLED', error: 'Cán bộ đã bổ sung căn cứ xác minh', completedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: officer.id, action: 'VERIFICATION_SOURCE_ADDED', entityType: 'Evidence', entityId: evidenceId, newValue: { sourceId: record.id, level: dto.level, sourceName: dto.sourceName, sourceUrl: dto.sourceUrl ?? null, note: dto.note } } });
      return record;
    });
  }
}
